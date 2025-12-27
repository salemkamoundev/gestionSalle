#!/usr/bin/env bash
set -euo pipefail

echo "✅ SEED CONFIG : Insertion des Créneaux pour TOUTE L'ANNÉE 2025..."

if [ ! -f "./serviceAccountKey.json" ]; then
  echo "❌ serviceAccountKey.json introuvable dans le dossier courant."
  exit 1
fi

# Installation dépendances si nécessaire
if [ ! -d "node_modules" ]; then
  npm i >/dev/null 2>&1 || true
fi
npm i firebase-admin >/dev/null 2>&1

# ------------------------------------------------------------
# CRÉATION DU SCRIPT NODEJS
# ------------------------------------------------------------
cat > seed-slots-year.js <<'EOF'
const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

// --- 1. DÉFINITION DES TYPES DE CRÉNEAUX ---
const DAY_SLOTS = [
  { key: 'matin', label: 'Matin', start: '08:00', end: '12:00' },
  { key: 'aprem', label: 'Après-midi', start: '13:00', end: '17:00' },
  { key: 'soir',  label: 'Soir',  start: '18:00', end: '02:00' },
];

// --- 2. CONFIGURATION COMPLÈTE 2025 ---
// Ajout de l'Automne pour couvrir jusqu'au 31 décembre
const PERIODS = [
  { 
    id: 'hiver_2025', 
    label: 'Hiver 2025',  
    from: '2025-01-01', 
    to: '2025-03-31', 
    grille_tarifs: { matin: 600, aprem: 800, soir: 1200 }
  },
  { 
    id: 'printemps_2025', 
    label: 'Printemps 2025', 
    from: '2025-04-01', 
    to: '2025-06-30', 
    grille_tarifs: { matin: 700, aprem: 950, soir: 1400 } 
  },
  { 
    id: 'ete_2025', 
    label: 'Été 2025',    
    from: '2025-07-01', 
    to: '2025-09-30', 
    // Haute saison : Prix majorés
    grille_tarifs: { matin: 900, aprem: 1200, soir: 1800 } 
  },
  { 
    id: 'automne_2025', 
    label: 'Automne 2025',    
    from: '2025-10-01', 
    to: '2025-12-31', 
    // Retour aux prix standards (similaire au printemps ou hiver selon ta politique)
    grille_tarifs: { matin: 700, aprem: 900, soir: 1300 } 
  }
];

if (!admin.apps.length) {
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
}
const db = admin.firestore();

async function createConfig() {
  console.log("⚙️  Génération des créneaux pour l'année complète...");
  
  const creneaux = [];
  
  for (const p of PERIODS) {
    for (const s of DAY_SLOTS) {
      const montant = p.grille_tarifs[s.key];

      if (!montant) {
        console.warn(`⚠️ Pas de tarif pour ${p.label} - ${s.label}`);
        continue;
      }

      creneaux.push({
        id: `${p.id}_${s.key}`,
        label: `${p.label} - ${s.label}`,
        start: s.start,
        end: s.end,
        price: montant,
        validFrom: p.from,
        validTo: p.to
      });
    }
  }

  // Insertion dans Firestore
  await db.collection('config').doc('general').set({ creneaux }, { merge: true });
  
  console.log(`✅ SUCCÈS : ${creneaux.length} créneaux insérés (4 Saisons x 3 Créneaux).`);
  console.log("   Couverture : du 01/01/2025 au 31/12/2025");
}

createConfig().then(() => {
  console.log("\n👋 Fin du script.");
  process.exit(0);
}).catch((e) => {
  console.error("❌ Erreur:", e);
  process.exit(1);
});
EOF

# Exécution
node seed-slots-year.js
rm seed-slots-year.js

echo "✅ Script terminé."