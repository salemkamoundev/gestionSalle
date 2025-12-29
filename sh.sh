#!/usr/bin/env bash
set -euo pipefail

echo "✅ SEED SAISONNIER : Génération des créneaux par périodes (2025-2026)"

# 1. Vérification clé
if [ ! -f "./serviceAccountKey.json" ]; then
  echo "❌ Erreur : serviceAccountKey.json introuvable."
  exit 1
fi

# 2. Installation dépendances
if [ ! -d "node_modules" ] || [ ! -d "node_modules/firebase-admin" ]; then
  echo "📦 Installation des dépendances..."
  npm i firebase-admin >/dev/null 2>&1
fi

# ------------------------------------------------------------
# GÉNÉRATION DU SCRIPT NODEJS
# ------------------------------------------------------------
cat > seed-seasonal.js <<'EOF'
const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

// --- DÉFINITION DES PÉRIODES ---

// 1. Basse Saison (Oct - Mi-Déc 2025)
const P1_START = '2025-10-01';
const P1_END   = '2025-12-14';

// 2. Fêtes de fin d'année (Mi-Déc - Jan 2026) - PRIX ÉLEVÉS
const P2_START = '2025-12-15';
const P2_END   = '2026-01-05';

// 3. Basse Saison (Jan - Mai 2026)
const P3_START = '2026-01-06';
const P3_END   = '2026-05-31';

// 4. Haute Saison ÉTÉ (Juin - Sept 2026) - PRIX TRÈS ÉLEVÉS
const P4_START = '2026-06-01';
const P4_END   = '2026-09-30';

// 5. Arrière Saison (Oct - Déc 2026)
const P5_START = '2026-10-01';
const P5_END   = '2026-12-31';

// --- CONFIGURATION DES PRIX PAR SAISON ---
// Cette liste sera injectée dans 'config/general' et utilisée pour générer les slots
const SEASONAL_DEFINITIONS = [
  // --- PÉRIODE 1 : AUTOMNE 2025 ---
  { id: 'p1_matin', label: 'Matin (Automne)', start: '08:00', end: '12:00', validFrom: P1_START, validTo: P1_END, price: 800 },
  { id: 'p1_aprem', label: 'Aprem (Automne)', start: '13:00', end: '17:00', validFrom: P1_START, validTo: P1_END, price: 1200 },
  { id: 'p1_soir',  label: 'Soir (Automne)',  start: '18:00', end: '02:00', validFrom: P1_START, validTo: P1_END, price: 2000 },

  // --- PÉRIODE 2 : FÊTES ---
  { id: 'p2_matin', label: 'Matin (Fêtes)', start: '08:00', end: '12:00', validFrom: P2_START, validTo: P2_END, price: 1500 },
  { id: 'p2_aprem', label: 'Aprem (Fêtes)', start: '13:00', end: '17:00', validFrom: P2_START, validTo: P2_END, price: 2000 },
  { id: 'p2_soir',  label: 'Soir (Fêtes)',  start: '18:00', end: '03:00', validFrom: P2_START, validTo: P2_END, price: 3500 },

  // --- PÉRIODE 3 : HIVER/PRINTEMPS 2026 ---
  { id: 'p3_matin', label: 'Matin (Basse)', start: '08:00', end: '12:00', validFrom: P3_START, validTo: P3_END, price: 800 },
  { id: 'p3_aprem', label: 'Aprem (Basse)', start: '13:00', end: '17:00', validFrom: P3_START, validTo: P3_END, price: 1200 },
  { id: 'p3_soir',  label: 'Soir (Basse)',  start: '18:00', end: '02:00', validFrom: P3_START, validTo: P3_END, price: 2000 },

  // --- PÉRIODE 4 : ÉTÉ 2026 (HAUTE SAISON) ---
  { id: 'p4_matin', label: 'Matin (Été)', start: '08:00', end: '12:00', validFrom: P4_START, validTo: P4_END, price: 1500 },
  { id: 'p4_aprem', label: 'Aprem (Été)', start: '13:00', end: '17:00', validFrom: P4_START, validTo: P4_END, price: 2500 },
  { id: 'p4_soir',  label: 'Soir (Été)',  start: '18:00', end: '04:00', validFrom: P4_START, validTo: P4_END, price: 4000 },

  // --- PÉRIODE 5 : FIN 2026 ---
  { id: 'p5_matin', label: 'Matin (Fin 26)', start: '08:00', end: '12:00', validFrom: P5_START, validTo: P5_END, price: 900 },
  { id: 'p5_aprem', label: 'Aprem (Fin 26)', start: '13:00', end: '17:00', validFrom: P5_START, validTo: P5_END, price: 1300 },
  { id: 'p5_soir',  label: 'Soir (Fin 26)',  start: '18:00', end: '02:00', validFrom: P5_START, validTo: P5_END, price: 2200 }
];

if (!admin.apps.length) {
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
}
const db = admin.firestore();
const isoNow = () => new Date().toISOString();

// Helper UTC Date String
const toDateOnly = (d) => {
  const year = d.getUTCFullYear();
  const month = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// ==========================================
// 1. NETTOYAGE SLOTS
// ==========================================
async function clearSlotsOnly() {
  console.log("\n🧹 1. Nettoyage des créneaux existants...");
  
  const snapshot = await db.collection('slots').get();
  if (snapshot.size === 0) {
    console.log("   - Aucun slot à supprimer.");
    return;
  }

  const batches = [];
  let batch = db.batch();
  let count = 0;

  snapshot.docs.forEach((doc) => {
    batch.delete(doc.ref);
    count++;
    if (count >= 400) {
      batches.push(batch);
      batch = db.batch();
      count = 0;
    }
  });

  if (count > 0) batches.push(batch);
  await Promise.all(batches.map(b => b.commit()));
  console.log(`   - ${snapshot.size} slots supprimés.`);
}

// ==========================================
// 2. SAUVEGARDE CONFIG (POUR L'ADMIN)
// ==========================================
async function updateConfig() {
  console.log("⚙️  2. Injection de la configuration saisonnière...");
  await db.collection('config').doc('general').set({
    creneaux: SEASONAL_DEFINITIONS,
    updatedAt: isoNow()
  });
}

// ==========================================
// 3. GÉNÉRATION DES SLOTS CALENDRIER
// ==========================================
async function createSeasonalSlots() {
  console.log("🗓️  3. Génération des créneaux pour chaque période...");
  
  let totalCreated = 0;
  let batch = db.batch();
  let opCount = 0;

  // On boucle sur chaque définition de période
  for (const def of SEASONAL_DEFINITIONS) {
    const start = new Date(def.validFrom); // YYYY-MM-DD est parsé en UTC par défaut si ISO simplifié
    const end = new Date(def.validTo);
    
    // On itère jour par jour pour cette définition
    let current = new Date(start);
    
    while (current <= end) {
      const dateStr = toDateOnly(current);
      // ID unique combinant date + période (ex: 2025-12-25_p2_soir)
      const slotId = `${dateStr}_${def.id}`; 
      
      const slotRef = db.collection('slots').doc(slotId);
      
      const slotData = {
        id: slotId,
        date: dateStr,
        period: def.id,   // Important pour relier à la config
        label: def.label, // Affiché dans le calendrier
        startTime: def.start,
        endTime: def.end,
        price: def.price, // Prix spécifique à la date
        status: 'AVAILABLE',
        createdAt: isoNow()
      };

      batch.set(slotRef, slotData);
      totalCreated++;
      opCount++;

      if (opCount >= 400) {
        await batch.commit();
        batch = db.batch();
        opCount = 0;
      }

      // Jour suivant
      current.setDate(current.getDate() + 1);
    }
    console.log(`   -> Période '${def.label}' générée (${def.validFrom} au ${def.validTo})`);
  }

  if (opCount > 0) await batch.commit();
  console.log(`   - Total : ${totalCreated} créneaux générés.`);
}

async function run() {
  try {
    await clearSlotsOnly();
    await updateConfig();
    await createSeasonalSlots();
    console.log("\n✅ TERMINÉ ! Calendrier saisonnier généré.");
    process.exit(0);
  } catch (e) {
    console.error("❌ Erreur:", e);
    process.exit(1);
  }
}

run();
EOF

node seed-seasonal.js
rm seed-seasonal.js

echo "🎉 Script terminé."