#!/bin/bash

echo "🛠️  AJOUT DU BOUTON MODIFIER CLIENT (Version Robuste)..."

# Utilisation de Node.js pour modifier les fichiers sans casser la syntaxe
node <<'EOF'
const fs = require('fs');

// FICHIERS CIBLES
const tsFile = 'src/app/features/calendar/reservation-form/reservation-form.component.ts';
const htmlFile = 'src/app/features/calendar/reservation-form/reservation-form.component.html';

// ---------------------------------------------------------
// 1. MODIFICATION DU TYPESCRIPT (.ts)
// ---------------------------------------------------------
if (fs.existsSync(tsFile)) {
  let tsContent = fs.readFileSync(tsFile, 'utf8');
  let tsModified = false;

  // A. Ajout du signal 'clientToEdit'
  if (!tsContent.includes('clientToEdit = signal')) {
    // On l'ajoute après currentClientId
    tsContent = tsContent.replace(
      /(currentClientId = signal.*?;)/, 
      '$1\n  clientToEdit = signal<any>(null);'
    );
    tsModified = true;
    console.log('✅ TS: Signal clientToEdit ajouté.');
  }

  // B. Ajout de la méthode 'onEditClient'
  if (!tsContent.includes('onEditClient(')) {
    const method = `
  onEditClient(client: any) {
    if (this.isPastReservation()) return;
    this.clientToEdit.set(client);
    this.showClientModal.set(true);
  }
`;
    // On l'insère avant openClientModal
    if (tsContent.includes('openClientModal()')) {
        tsContent = tsContent.replace('openClientModal()', method + '\n  openClientModal()');
        tsModified = true;
        console.log('✅ TS: Méthode onEditClient ajoutée.');
    }
  }

  // C. Reset du client à la fermeture du modal
  if (!tsContent.includes('this.clientToEdit.set(null)')) {
    // On cherche la fermeture du modal client
    const closeRegex = /(closeClientModal\(\)\s*\{)([^}]*?)(\})/;
    if (closeRegex.test(tsContent)) {
        tsContent = tsContent.replace(closeRegex, '$1$2  this.clientToEdit.set(null);\n$3');
        tsModified = true;
        console.log('✅ TS: Reset du client à la fermeture ajouté.');
    }
  }

  if (tsModified) fs.writeFileSync(tsFile, tsContent);
} else {
  console.error('❌ Fichier TS introuvable !');
}

// ---------------------------------------------------------
// 2. MODIFICATION DU TEMPLATE (.html)
// ---------------------------------------------------------
if (fs.existsSync(htmlFile)) {
  let htmlContent = fs.readFileSync(htmlFile, 'utf8');
  let htmlModified = false;

  // A. Insertion du bouton Modifier
  if (!htmlContent.includes('onEditClient(selectedClient())')) {
    // On cherche l'affichage du nom du client. 
    // Pattern typique : {{ selectedClient()?.nom }} ... </h3>
    // On insère le bouton AVANT la fermeture du </h3> pour qu'il soit sur la même ligne
    
    const namePattern = /({{ selectedClient\(\)\?\.nom }}.*?)(<\/h3>)/s;
    
    const editButton = `
       <button type="button" (click)="onEditClient(selectedClient())" class="ml-2 inline-flex items-center justify-center w-6 h-6 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-full transition" title="Modifier le client">
         <span class="material-icons text-sm">edit</span>
       </button>`;

    if (namePattern.test(htmlContent)) {
      htmlContent = htmlContent.replace(namePattern, '$1' + editButton + '$2');
      htmlModified = true;
      console.log('✅ HTML: Bouton Modifier inséré à côté du nom.');
    } else {
      // Fallback : Si on ne trouve pas le h3, on cherche le conteneur global du nom
      console.warn('⚠️ HTML: Balise h3 du nom introuvable, tentative insertion fallback...');
      const fallbackPattern = /(selectedClient\(\)\?\.nom}})/;
      if (fallbackPattern.test(htmlContent)) {
          htmlContent = htmlContent.replace(fallbackPattern, '$1' + editButton);
          htmlModified = true;
      }
    }
  } else {
      console.log('ℹ️  HTML: Le bouton Modifier semble déjà présent.');
  }

  // B. Mise à jour du composant <app-client-form> pour passer l'ID
  if (htmlContent.includes('<app-client-form') && !htmlContent.includes('[clientId]')) {
    htmlContent = htmlContent.replace('<app-client-form', '<app-client-form [clientId]="clientToEdit()?.id"');
    htmlModified = true;
    console.log('✅ HTML: Passage de clientId à app-client-form ajouté.');
  }

  if (htmlModified) {
      fs.writeFileSync(htmlFile, htmlContent);
      console.log('🎉 Template HTML mis à jour avec succès.');
  }
} else {
  console.error('❌ Fichier HTML introuvable !');
}
EOF