#!/bin/bash

# 1. Création du script d'injection Node.js
# L'utilisation de 'EOF' (entre guillemets) empêche l'interprétation des variables par le shell
cat <<'EOF' > inject_seasons.js
const admin = require('firebase-admin');

// Vérification de la présence de la clé
let serviceAccount;
try {
  serviceAccount = require('./serviceAccountKey.json');
} catch (e) {
  console.error('❌ Erreur : Le fichier serviceAccountKey.json est introuvable.');
  console.log('👉 Allez dans Console Firebase > Paramètres > Comptes de service pour en générer un.');
  process.exit(1);
}

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

const seasons = [
  { name: 'Hiver', startMonth: '12-01', endMonth: '02-28', year: 2025, nextYear: 2026 },
  { name: 'Printemps', startMonth: '03-01', endMonth: '05-31', year: 2026, nextYear: 2026 },
  { name: 'Été', startMonth: '06-01', endMonth: '08-31', year: 2026, nextYear: 2026 },
  { name: 'Automne', startMonth: '09-01', endMonth: '11-30', year: 2026, nextYear: 2026 }
];

const slotTemplates = [
  { id: 'matin', label: 'Matin', start: '08:00', end: '12:00', price: 500 },
  { id: 'aprem', label: 'Après-midi', start: '13:00', end: '17:00', price: 800 },
  { id: 'soir', label: 'Soirée', start: '19:00', end: '02:00', price: 2200 }
];

let finalCreneaux = [];

seasons.forEach(s => {
  slotTemplates.forEach(t => {
    finalCreneaux.push({
      id: `${s.name.toLowerCase()}_${t.id}`,
      label: `${t.label} - ${s.name}`,
      start: t.start,
      end: t.end,
      price: t.price,
      validFrom: `${s.year}-${s.startMonth}`,
      validTo: `${s.nextYear}-${s.endMonth}`
    });
  });
});

async function run() {
  try {
    console.log('⏳ Connexion à Firestore et injection des 12 créneaux...');
    
    // On cible le document de configuration général
    await db.collection('config').doc('general').set({
      creneaux: finalCreneaux
    }, { merge: true });
    
    console.log('✅ Succès ! Données injectées dans config/general');
    console.log(`📅 Période Hiver : du ${seasons[0].year}-${seasons[0].startMonth} au ${seasons[0].nextYear}-${seasons[0].endMonth}`);
    console.log('🆔 Exemple d\'ID valide pour votre URL : hiver_soir');
  } catch (error) {
    console.error('❌ Erreur lors de l\'injection :', error);
  } finally {
    process.exit();
  }
}

run();
EOF

echo "📦 Installation de firebase-admin..."
npm install firebase-admin

echo "------------------------------------------------------------"
echo "🚀 INSTRUCTIONS FINALES"
echo "1. Assurez-vous d'avoir 'serviceAccountKey.json' dans ce dossier."
echo "2. Exécutez l'injection avec : node inject_seasons.js"
echo "3. Testez l'URL : http://localhost:4200/reservations/new?date=2025-12-09&slotId=hiver_soir"
echo "------------------------------------------------------------"