#!/bin/bash

echo "🚑 RÉPARATION DE LA COMPILATION (FIX MAIN.TS)..."

# 1. On s'assure que le fichier de seeding existe bien
cat > src/app/seed-seasons.ts <<EOF
import { Firestore, doc, setDoc, getFirestore } from '@angular/fire/firestore';
import { initializeApp } from 'firebase/app';
import { environment } from '../environments/environment';

export async function seedSeasonalSlots() {
  console.log('%c 🚀 DÉBUT DU SEEDING SAISONNIER...', 'color: blue; font-weight: bold;');
  
  const app = initializeApp(environment.firebase);
  const db = getFirestore(app);
  
  // CONFIGURATION DES SAISONS
  const seasonsDef = [
    { name: 'Hiver', start: '01-01', end: '03-20', priceMatin: 200, priceAprem1: 400, priceAprem2: 500, priceSoir: 600 },
    { name: 'Printemps', start: '03-21', end: '06-20', priceMatin: 300, priceAprem1: 600, priceAprem2: 700, priceSoir: 900 },
    { name: 'Été', start: '06-21', end: '09-21', priceMatin: 500, priceAprem1: 900, priceAprem2: 1200, priceSoir: 1500 },
    { name: 'Automne', start: '09-22', end: '12-20', priceMatin: 250, priceAprem1: 500, priceAprem2: 600, priceSoir: 700 },
    { name: 'Fêtes', start: '12-21', end: '12-31', priceMatin: 400, priceAprem1: 800, priceAprem2: 1000, priceSoir: 1200 }
  ];

  const years = [2025, 2026];
  let allSlots: any[] = [];

  years.forEach(year => {
    seasonsDef.forEach(s => {
      const validFrom = \`\${year}-\${s.start}\`;
      const validTo = \`\${year}-\${s.end}\`;
      const suffix = \`(\${s.name} \${year})\`;

      allSlots.push({ id: 'matin', label: \`Matin \${suffix}\`, start: '08:00', end: '12:00', price: s.priceMatin, validFrom, validTo });
      allSlots.push({ id: 'aprem1', label: \`Après-midi Option 1 \${suffix}\`, start: '12:00', end: '16:00', price: s.priceAprem1, validFrom, validTo });
      allSlots.push({ id: 'aprem2', label: \`Après-midi Option 2 \${suffix}\`, start: '12:00', end: '19:00', price: s.priceAprem2, validFrom, validTo });
      allSlots.push({ id: 'soir', label: \`Soir \${suffix}\`, start: '18:00', end: '02:00', price: s.priceSoir, validFrom, validTo });
    });
  });

  try {
    await setDoc(doc(db, 'config/general'), { creneaux: allSlots });
    console.log(\`✅ \${allSlots.length} créneaux injectés.\`);
    alert('✅ SEEDING TERMINÉ ! Rafraîchissez pour tester.');
  } catch (e) {
    console.error('❌ ERREUR :', e);
    alert('Erreur seeding: ' + e);
  }
}
EOF

# 2. Correction chirurgicale de main.ts via Node.js
node -e "
const fs = require('fs');
const file = 'src/main.ts';

if (fs.existsSync(file)) {
  let content = fs.readFileSync(file, 'utf8');
  let modified = false;

  // Correction 1 : Remplacer l'import du mauvais fichier 'reset-config' par 'seed-seasons'
  if (content.includes('./app/reset-config')) {
    content = content.replace('./app/reset-config', './app/seed-seasons');
    modified = true;
    console.log('✅ Import corrigé (reset-config -> seed-seasons)');
  }

  // Correction 2 : Remplacer TOUTES les occurrences de forceResetConfig par seedSeasonalSlots
  // (Le script précédent n'avait remplacé que la première occurrence)
  if (content.includes('forceResetConfig')) {
    content = content.split('forceResetConfig').join('seedSeasonalSlots');
    modified = true;
    console.log('✅ Appels de fonction corrigés (forceResetConfig -> seedSeasonalSlots)');
  }
  
  // Correction 3 : S'assurer que le nom importé est bien seedSeasonalSlots
  // Si on a 'import { seedSeasonalSlots }' c'est bon, mais vérifions si l'ancien nom traîne dans l'import
  // Normalement géré par le split/join ci-dessus, mais on sécurise l'import exact
  
  if (modified) {
    fs.writeFileSync(file, content);
    console.log('🎉 src/main.ts a été réparé avec succès.');
  } else {
    console.log('ℹ️  Aucune réparation nécessaire sur main.ts.');
  }
} else {
  console.error('❌ src/main.ts introuvable.');
}
"

echo "--------------------------------------------------------"
echo "✅ PRÊT. Relancez 'ng serve'."
echo "--------------------------------------------------------"