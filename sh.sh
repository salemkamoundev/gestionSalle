#!/bin/bash

# ==========================================
# CONFIGURATION
# ==========================================
TARGET_FILE="src/app/features/calendar/calendar-view/calendar-view.component.ts"

echo "🎨 Correction des couleurs des Slots (Matin/Soir) - Vert si vide..."

# ==========================================
# SCRIPT NODE.JS
# ==========================================
cat <<'EOF' > patch_slots_colors.js
const fs = require('fs');
const filePath = process.argv[2];

try {
    if (!fs.existsSync(filePath)) {
        console.error('❌ Fichier introuvable :', filePath);
        process.exit(1);
    }

    let content = fs.readFileSync(filePath, 'utf8');
    let modified = false;

    // =========================================================
    // 1. LOGIQUE TYPESCRIPT (getSlotClass)
    // =========================================================
    // On ajoute une fonction spécifique pour les slots Matin/Soir
    
    if (!content.includes('getSlotClass(day: any, slotType: string)')) {
        const slotLogic = `
  /**
   * Couleur d'un SLOT (Matin ou Soir)
   * - Vert : Vide
   * - Blanc/Rouge : Occupé (selon la logique de réservation)
   */
  getSlotClass(day: any, slotType: string): string {
    // Vérifier s'il y a une réservation pour ce slot précis
    const isOccupied = day.reservations && day.reservations.some((r: any) => 
        (r.slotId && r.slotId.toLowerCase() === slotType) || 
        (!r.slotId) // Si pas de slotId, on considère que ça prend toute la journée ? À ajuster.
    );

    // Si LIBRE -> Vert clair + Bordure verte
    if (!isOccupied) {
      return 'bg-green-50 border-green-200 hover:bg-green-100 cursor-pointer';
    }
    
    // Si OCCUPÉ -> Blanc (les pastilles de réservation feront la couleur)
    return 'bg-white border-slate-200';
  }
`;
        const lastBrace = content.lastIndexOf('}');
        content = content.slice(0, lastBrace) + slotLogic + content.slice(lastBrace);
        console.log('✅ Logique TS (getSlotClass) injectée.');
        modified = true;
    }

    // =========================================================
    // 2. MODIFICATION DU HTML (Slots Matin/Soir)
    // =========================================================

    // On cherche les divs qui contiennent "MATIN" ou "SOIR"
    // Ce sont tes slots. On doit nettoyer leurs classes et ajouter [ngClass]

    // A. SLOT MATIN
    // Cherche : <div class="..." ... > ... MATIN ... </div>
    // On utilise une regex large pour trouver la div parente du span MATIN
    const matinRegex = /(<div\s+class=")([^"]*)("\s*>)(<span[^>]*>MATIN<\/span>)/i;
    
    if (matinRegex.test(content) && !content.includes("getSlotClass(day, 'matin')")) {
        content = content.replace(matinRegex, (match, start, classes, end, span) => {
            // On garde les classes structurelles (flex-1, rounded, border, relative, group, transition...)
            // On enlève les couleurs statiques (slate-100, blue-300, blue-50, etc)
            let newClasses = classes
                .replace(/border-slate-\d+/g, '')
                .replace(/hover:border-blue-\d+/g, '')
                .replace(/hover:bg-blue-\d+\/\d+/g, '')
                .replace(/bg-white/g, '')
                .trim();
            
            // On ajoute border et border-dashed qui sont sympas pour les slots vides
            if (!newClasses.includes('border')) newClasses += ' border border-dashed';

            return `${start}${newClasses}" [ngClass]="getSlotClass(day, 'matin')${end}${span}`;
        });
        console.log('✅ Slot MATIN corrigé (Devient Vert si vide).');
        modified = true;
    }

    // B. SLOT SOIR (Idem)
    const soirRegex = /(<div\s+class=")([^"]*)("\s*>)(<span[^>]*>SOIR<\/span>)/i;

    if (soirRegex.test(content) && !content.includes("getSlotClass(day, 'soir')")) {
        content = content.replace(soirRegex, (match, start, classes, end, span) => {
            let newClasses = classes
                .replace(/border-slate-\d+/g, '')
                .replace(/hover:border-blue-\d+/g, '')
                .replace(/hover:bg-blue-\d+\/\d+/g, '')
                .replace(/bg-white/g, '')
                .trim();
            
            if (!newClasses.includes('border')) newClasses += ' border border-dashed';

            return `${start}${newClasses}" [ngClass]="getSlotClass(day, 'soir')${end}${span}`;
        });
        console.log('✅ Slot SOIR corrigé (Devient Vert si vide).');
        modified = true;
    }

    if (modified) {
        fs.writeFileSync(filePath, content);
        console.log('💾 Fichier sauvegardé.');
    } else {
        console.log('ℹ️ Aucune modification nécessaire.');
    }

} catch (e) {
    console.error('❌ Erreur:', e);
}
EOF

# ==========================================
# EXECUTION
# ==========================================
if command -v node &> /dev/null; then
    node patch_slots_colors.js "$TARGET_FILE"
    rm patch_slots_colors.js
    echo "✨ Terminé."
else
    echo "❌ Node.js requis."
fi