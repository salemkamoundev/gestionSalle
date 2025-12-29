#!/usr/bin/env bash
set -euo pipefail

echo "✅ SEED FINAL : Config Complète (Dates & Prix), Calendrier UTC, Données 2025-2026."

# 1. Vérification clé
if [ ! -f "./serviceAccountKey.json" ]; then
  echo "❌ Erreur : serviceAccountKey.json introuvable."
  echo "Veuillez placer votre clé privée Firebase à la racine."
  exit 1
fi

# 2. Installation dépendances
if [ ! -d "node_modules" ] || [ ! -d "node_modules/firebase-admin" ]; then
  echo "📦 Installation des dépendances..."
  npm i firebase-admin @faker-js/faker >/dev/null 2>&1
fi

# ------------------------------------------------------------
# GÉNÉRATION DU SCRIPT NODEJS
# ------------------------------------------------------------
cat > seed-custom.js <<'EOF'
const admin = require('firebase-admin');
const { fakerFR: faker } = require('@faker-js/faker');
const serviceAccount = require('./serviceAccountKey.json');

// --- CONFIGURATION ---
const PASSWORD = "User123";
const RESERVATION_COUNT = 60; 
const EXPENSE_COUNT = 15;
const PACK_COUNT = 3;

// DATES UTC STRICTES
const START_TIMESTAMP = Date.UTC(2025, 9, 1);   // 1er Oct 2025
const END_TIMESTAMP   = Date.UTC(2026, 11, 31); // 31 Déc 2026

// Helpers Dates
const toDateOnly = (d) => {
  const year = d.getUTCFullYear();
  const month = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const STR_START = '2025-10-01';
const STR_END   = '2026-12-31';

// --- DEFINITIONS AVEC PRIX ET DATES ---
// Ces données seront injectées dans 'config/general' pour l'écran de Configuration
const SLOT_DEFINITIONS = [
  { 
    id: 'matin', 
    label: 'Matin', 
    start: '08:00', 
    end: '12:00', 
    validFrom: STR_START, 
    validTo: STR_END, 
    price: 1000, 
    active: true 
  },
  { 
    id: 'aprem', 
    label: 'Après-midi', 
    start: '13:00', 
    end: '17:00', 
    validFrom: STR_START, 
    validTo: STR_END, 
    price: 1500, 
    active: true 
  },
  { 
    id: 'soir',  
    label: 'Soir',  
    start: '18:00', 
    end: '02:00', 
    validFrom: STR_START, 
    validTo: STR_END, 
    price: 2500, 
    active: true 
  }
];

if (!admin.apps.length) {
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
}
const db = admin.firestore();
const auth = admin.auth();

const isoNow = () => new Date().toISOString();
const randInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const pick = (arr) => arr[randInt(0, arr.length - 1)];
const pickMultiple = (arr, count) => {
    const shuffled = [...arr].sort(() => 0.5 - Math.random());
    return shuffled.slice(0, count);
};

// ==========================================
// 1. NETTOYAGE
// ==========================================
async function clearAll() {
  console.log("\n🔥 1. NETTOYAGE...");
  
  // Auth
  let nextPageToken;
  const uids = [];
  do {
    const res = await auth.listUsers(1000, nextPageToken);
    res.users.forEach(u => uids.push(u.uid));
    nextPageToken = res.pageToken;
  } while (nextPageToken);
  
  if (uids.length > 0) {
    const chunks = [];
    while (uids.length > 0) chunks.push(uids.splice(0, 1000));
    for (const chunk of chunks) await auth.deleteUsers(chunk);
  }

  // Firestore
  const collections = await db.listCollections();
  for (const col of collections) {
    const snap = await col.listDocuments();
    if (snap.length > 0) {
      const batches = [];
      let batch = db.batch();
      let count = 0;
      for (const doc of snap) {
        batch.delete(doc);
        count++;
        if (count >= 400) {
          batches.push(batch);
          batch = db.batch();
          count = 0;
        }
      }
      if (count > 0) batches.push(batch);
      for (const b of batches) await b.commit();
    }
  }
}

// ==========================================
// 2. CONFIGURATION (CORRIGÉE)
// ==========================================
async function createConfig() {
  console.log("⚙️  2. Configuration (Prix & Dates)...");
  // C'est ici que 'ConfigurationComponent' lit les données.
  // On injecte les définitions complètes avec validFrom/validTo/price.
  await db.collection('config').doc('general').set({
    creneaux: SLOT_DEFINITIONS,
    updatedAt: isoNow()
  });
}

// ==========================================
// 3. CALENDRIER (SLOTS QUOTIDIENS)
// ==========================================
async function createSlotsCalendar() {
  console.log("🗓️  3. Génération Calendrier UTC...");
  
  let currentTs = START_TIMESTAMP;
  let batch = db.batch();
  let count = 0;
  const createdSlots = [];

  while (currentTs <= END_TIMESTAMP) {
    const currentDate = new Date(currentTs);
    const dateStr = toDateOnly(currentDate);

    for (const ts of SLOT_DEFINITIONS) {
      const slotId = `${dateStr}_${ts.id}`;
      const slotRef = db.collection('slots').doc(slotId);
      
      const slotData = {
        id: slotId,
        date: dateStr,
        period: ts.id,
        label: ts.label,
        startTime: ts.start,
        endTime: ts.end,
        status: 'AVAILABLE',
        createdAt: isoNow()
      };

      batch.set(slotRef, slotData);
      createdSlots.push(slotData);
      count++;

      if (count >= 400) {
        await batch.commit();
        batch = db.batch();
        count = 0;
      }
    }
    
    currentTs += 24 * 60 * 60 * 1000;
  }

  if (count > 0) await batch.commit();
  console.log(`   - ${createdSlots.length} créneaux générés.`);
  return createdSlots;
}

// ==========================================
// 4. USERS & CLIENTS
// ==========================================
async function createEntities() {
  console.log("👤 4. Users & Clients...");
  const batch = db.batch();
  const staffIds = [];
  const clientIds = [];

  const usersDef = [
    { email: 'admin@gmail.com', role: 'ADMIN', nom: 'Admin', prenom: 'System' },
    { email: 'serveur1@gmail.com', role: 'STAFF', nom: 'Serveur', prenom: 'Un' },
    { email: 'serveur2@gmail.com', role: 'STAFF', nom: 'Serveur', prenom: 'Deux' }
  ];

  for (const u of usersDef) {
    const userRecord = await auth.createUser({
      email: u.email,
      password: PASSWORD,
      displayName: `${u.nom} ${u.prenom}`,
      emailVerified: true
    });

    const userRef = db.collection('users').doc(userRecord.uid);
    batch.set(userRef, {
      id: userRecord.uid,
      uid: userRecord.uid,
      email: u.email,
      nom: u.nom,
      prenom: u.prenom,
      role: u.role,
      active: true,
      createdAt: isoNow()
    });

    if (u.role === 'STAFF') {
      const staffRef = db.collection('staff').doc(userRecord.uid);
      batch.set(staffRef, {
        id: userRecord.uid,
        nom: u.nom,
        prenom: u.prenom,
        email: u.email,
        phone: faker.phone.number('########'),
        role: 'Serveur',
        active: true,
        createdAt: isoNow()
      });
      staffIds.push(userRecord.uid);
    }
  }

  for (let i = 1; i <= 5; i++) {
    const clientRef = db.collection('clients').doc();
    const clientData = {
      id: clientRef.id,
      nom: faker.person.lastName(),
      prenom: faker.person.firstName(),
      email: faker.internet.email(),
      phone: faker.phone.number('########'),
      createdAt: isoNow()
    };
    batch.set(clientRef, clientData);
    clientIds.push(clientData);
  }

  await batch.commit();
  return { staffIds, clientIds };
}

// ==========================================
// 5. SERVICES & EQUIPES
// ==========================================
async function createResources(staffIds) {
  console.log("🛠️  5. Services & Équipes...");
  const batch = db.batch();
  const teamIds = [];
  const services = [];

  const servicesNames = ['Traiteur', 'Photographe', 'DJ', 'Décoration', 'Location Salle'];
  const icons = ['restaurant', 'camera_alt', 'queue_music', 'filter_vintage', 'apartment'];
  
  let idx = 0;
  for (const name of servicesNames) {
    const ref = db.collection('services').doc();
    const serviceData = {
      id: ref.id,
      nom: name,
      prix: randInt(500, 5000),
      active: true,
      icon: icons[idx] || 'local_offer',
      description: faker.lorem.sentence()
    };
    batch.set(ref, serviceData);
    services.push(serviceData);
    idx++;
  }

  const teamNames = ['Équipe Matin', 'Équipe Soir'];
  for (const name of teamNames) {
    const ref = db.collection('teams').doc();
    batch.set(ref, {
      id: ref.id,
      nom: name,
      staffIds: staffIds,
      active: true,
      createdAt: isoNow()
    });
    teamIds.push(ref.id);
  }

  await batch.commit();
  return { teamIds, services };
}

// ==========================================
// 6. PACKS
// ==========================================
async function createPacks(staffIds, teamIds, services) {
  console.log("📦 6. Packs...");
  const batch = db.batch();
  const packNames = ['Pack Mariage Royal', 'Pack Anniversaire VIP', 'Pack Soirée Simple'];

  for (let i = 0; i < PACK_COUNT; i++) {
    const ref = db.collection('packs').doc();
    
    const packServices = pickMultiple(services, randInt(2, 4)).map(s => ({
      id: s.id,
      nom: s.nom,
      name: s.nom,
      prix: s.prix,
      price: s.prix,
      icon: s.icon
    }));

    const totalPrice = packServices.reduce((sum, s) => sum + s.prix, 0);
    const packStaff = pickMultiple(staffIds, randInt(1, 2));
    const packTeams = pickMultiple(teamIds, 1);

    batch.set(ref, {
      id: ref.id,
      nom: packNames[i],
      description: faker.lorem.paragraph(),
      active: true,
      services: packServices,
      staffIds: packStaff,
      teamIds: packTeams,
      price: totalPrice,
      prix: totalPrice,
      createdAt: isoNow()
    });
  }
  
  await batch.commit();
}

// ==========================================
// 7. RÉSERVATIONS
// ==========================================
async function createReservations(allSlots, clientList, staffIds, teamIds) {
  console.log(`📅 7. Réservations (${RESERVATION_COUNT})...`);
  
  const shuffledSlots = allSlots.sort(() => 0.5 - Math.random());
  const selectedSlots = shuffledSlots.slice(0, RESERVATION_COUNT);

  let batch = db.batch();
  let opCount = 0;

  for (let i = 0; i < selectedSlots.length; i++) {
    const slot = selectedSlots[i];
    
    if (!slot.date) continue;

    const client = pick(clientList);
    const ref = db.collection('reservations').doc();
    
    const totalPrice = randInt(1000, 8000);
    const hasPayments = (i % 2 === 0);
    let advance = 0;

    if (hasPayments) {
        const p1Amount = Math.round(totalPrice * 0.3);
        const p1Ref = db.collection('payments').doc();
        batch.set(p1Ref, {
            id: p1Ref.id, reservationId: ref.id, amount: p1Amount,
            type: 'ESPECES', date: isoNow(), description: 'Acompte'
        });
        opCount++;

        const p2Ref = db.collection('payments').doc();
        batch.set(p2Ref, {
            id: p2Ref.id, reservationId: ref.id, amount: totalPrice - p1Amount,
            type: 'CHEQUE', date: isoNow(), description: 'Solde'
        });
        opCount++;
        advance = totalPrice;
    }

    const isCancelled = Math.random() < 0.1;
    
    batch.set(ref, {
      id: ref.id,
      clientId: client.id,
      clientName: `${client.nom} ${client.prenom}`,
      customerPhone: client.phone,
      
      date: slot.date, 
      selectedSlotId: slot.period,
      startTime: slot.startTime,
      endTime: slot.endTime,
      slotId: slot.id,

      status: isCancelled ? 'CANCELLED' : 'CONFIRMED',
      totalPrice: totalPrice,
      advance: advance,
      advancePayment: advance,
      
      assignedServerIds: [pick(staffIds)],
      teamIds: [pick(teamIds)],
      createdAt: isoNow()
    });
    opCount++;

    const slotRef = db.collection('slots').doc(slot.id);
    batch.update(slotRef, { status: 'BOOKED', reservationId: ref.id });
    opCount++;

    if (opCount >= 400) {
        await batch.commit();
        batch = db.batch();
        opCount = 0;
    }
  }
  
  if (opCount > 0) await batch.commit();
}

// ==========================================
// 8. DÉPENSES
// ==========================================
async function createExpenses() {
  console.log("💸 8. Dépenses...");
  const batch = db.batch();
  const categories = ['Achat Alimentaire', 'Électricité', 'Entretien', 'Salaires', 'Publicité'];

  for (let i = 0; i < EXPENSE_COUNT; i++) {
    const ref = db.collection('expenses').doc();
    const randomTs = START_TIMESTAMP + Math.random() * (END_TIMESTAMP - START_TIMESTAMP);
    
    batch.set(ref, {
      id: ref.id,
      title: faker.commerce.productName(),
      amount: randInt(50, 2000),
      category: pick(categories),
      date: toDateOnly(new Date(randomTs)),
      description: faker.lorem.sentence(),
      createdAt: isoNow()
    });
  }
  await batch.commit();
}

async function run() {
  try {
    await clearAll();
    await createConfig();
    
    const allSlots = await createSlotsCalendar();
    const { staffIds, clientIds } = await createEntities();
    const { teamIds, services } = await createResources(staffIds);
    await createPacks(staffIds, teamIds, services);
    await createReservations(allSlots, clientIds, staffIds, teamIds);
    await createExpenses();

    console.log("\n✅ SEED TERMINÉ !");
    console.log("👉 Admin   : admin@gmail.com    / User123");
    process.exit(0);
  } catch (e) {
    console.error("❌ ERREUR:", e);
    process.exit(1);
  }
}

run();
EOF

node seed-custom.js
rm seed-custom.js

echo "🎉 Script terminé."