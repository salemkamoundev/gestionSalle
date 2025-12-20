#!/bin/bash

# ==========================================
# CONFIGURATION
# ==========================================
BASE_APP="src/app"
HISTORY_TS="$BASE_APP/features/clients/client-history/client-history.component.ts"

echo "✏️ Ajout des boutons Modifier dans l'historique..."

# ==========================================
# SCRIPT NODE.JS DE PATCH
# ==========================================
cat <<'EOF' > patch_history_actions.js
const fs = require('fs');
const filePath = process.argv[2];

try {
    if (!fs.existsSync(filePath)) {
        console.error('❌ Fichier introuvable :', filePath);
        process.exit(1);
    }

    let content = fs.readFileSync(filePath, 'utf8');
    let modified = false;

    // ---------------------------------------------------------
    // 1. AJOUT DES IMPORTS ET INJECTIONS
    // ---------------------------------------------------------
    
    // Import Router
    if (!content.includes('Router } from \'@angular/router\'')) {
        content = content.replace(
            /import {([^}]*)} from '@angular\/router';/, 
            "import { $1, Router } from '@angular/router';"
        );
    }

    // Injection Router dans la classe
    if (!content.includes('private router = inject(Router)')) {
        const injectPoint = 'export class ClientHistoryComponent implements OnInit {';
        if (content.includes(injectPoint)) {
            content = content.replace(injectPoint, `${injectPoint}\n  private router = inject(Router);`);
        }
    }

    // Ajout des méthodes editReservation et editPayment
    if (!content.includes('editReservation(id: string)')) {
        const logic = `
  editReservation(id: string) {
    // Redirection vers la page d'édition ou le calendrier
    this.router.navigate(['/reservations/edit', id]); 
  }

  editPayment(id: string) {
    // Redirection vers l'édition du paiement
    // (Ou ouverture d'une modale si tu préfères plus tard)
    this.router.navigate(['/payments/edit', id]);
  }
`;
        const lastBrace = content.lastIndexOf('}');
        content = content.slice(0, lastBrace) + logic + content.slice(lastBrace);
        console.log('✅ Méthodes editReservation et editPayment ajoutées.');
        modified = true;
    }

    // ---------------------------------------------------------
    // 2. MODIFICATION DU HTML (Tableau Réservations)
    // ---------------------------------------------------------
    
    // A. Header : Ajouter une colonne vide pour les actions après Montant
    const resHeaderSearch = '<th class="px-6 py-3 text-right">Montant</th>';
    const resHeaderReplace = '<th class="px-6 py-3 text-right">Montant</th>\n                    <th class="px-6 py-3 w-10"></th>';
    
    if (content.includes(resHeaderSearch) && !content.includes('<th class="px-6 py-3 w-10"></th>')) {
        content = content.replace(resHeaderSearch, resHeaderReplace);
        modified = true;
    }

    // B. Body : Ajouter le bouton
    // On cherche la cellule du prix pour insérer après
    const resBodySearchRegex = /(<div class="font-bold text-slate-700 text-base">{{ r.totalPrice \| number:'1.2-2' }} <small>TND<\/small><\/div>\s*<\/td>)/;
    
    const resBtnHtml = `
                    <td class="px-6 py-4 text-right">
                      <button (click)="editReservation(r.id)" class="text-blue-400 hover:text-blue-600 p-2 rounded-full hover:bg-blue-50 transition" title="Modifier la réservation">
                        <span class="material-icons text-lg">edit</span>
                      </button>
                    </td>`;

    if (resBodySearchRegex.test(content) && !content.includes('editReservation(r.id)')) {
        content = content.replace(resBodySearchRegex, `$1${resBtnHtml}`);
        console.log('✅ Bouton Modifier Réservation ajouté.');
        modified = true;
    }

    // ---------------------------------------------------------
    // 3. MODIFICATION DU HTML (Tableau Paiements)
    // ---------------------------------------------------------

    // A. Header
    // Note: Le header paiements est identique à celui des réservations dans le code précédent
    // On utilise une regex pour cibler celui qui est dans la section "Tableau Paiements" si possible, 
    // ou on assume que le replace précédent a géré les deux s'ils sont identiques.
    // Mais vérifions le contexte "Historique Règlements"
    
    // Le replace précédent a peut-être déjà remplacé les deux headers si la string était identique.
    // Vérifions si le bouton action manque dans le body des paiements.

    // B. Body
    const payBodySearchRegex = /(<div class="font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-lg inline-block border border-emerald-100">\s*\+ {{ p.amount \| number:'1.2-2' }} TND\s*<\/div>\s*<\/td>)/;

    const payBtnHtml = `
                    <td class="px-6 py-4 text-right">
                      <button (click)="editPayment(p.id)" class="text-emerald-400 hover:text-emerald-600 p-2 rounded-full hover:bg-emerald-50 transition" title="Modifier le règlement">
                        <span class="material-icons text-lg">edit</span>
                      </button>
                    </td>`;

    if (payBodySearchRegex.test(content) && !content.includes('editPayment(p.id)')) {
        content = content.replace(payBodySearchRegex, `$1${payBtnHtml}`);
        console.log('✅ Bouton Modifier Règlement ajouté.');
        modified = true;
    }

    if (modified) {
        fs.writeFileSync(filePath, content);
        console.log('💾 Fichier sauvegardé avec succès.');
    } else {
        console.log('ℹ️ Aucune modification nécessaire (déjà fait ?).');
    }

} catch (e) {
    console.error('❌ Erreur:', e);
}
EOF

# ==========================================
# EXECUTION
# ==========================================
if command -v node &> /dev/null; then
    node patch_history_actions.js "$HISTORY_TS"
    rm patch_history_actions.js
    echo "✨ Terminé."
else
    echo "❌ Node.js requis."
fi