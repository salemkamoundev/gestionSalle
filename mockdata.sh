#!/usr/bin/env bash
set -euo pipefail

echo "✅ SEED FINAL : Config Créneaux, 50 Réservations (Oct 2025 - Avr 2026), Users, Dépenses."

# 1. Vérification clé
if [ ! -f "./serviceAccountKey.json" ]; then
  echo "❌ Erreur : serviceAccountKey.json introuvable."
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
const RESERVATION_COUNT = 50;
const EXPENSE_COUNT = 7;

// DATES : Octobre 2025 -> Avril 2026
const START_DATE = new Date('2025-10-01T00:00:00Z');
const END_DATE = new Date('2026-04-30T23:59:59Z');

// DEFINITION DES CRÉNEAUX
const SLOTS_DATA = [
  { id: 'matin', label: 'Matin', start: '08:00', end: '12:00', active: true },
  { id: 'aprem', label: 'Après-midi', start: '13:00', end: '17:00', active: true },
  { id: 'soir',  label: 'Soir',  start: '18:00', end: '02:00', active: true }
];

// Initialisation
if (!admin.apps.length) {
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
}
const db = admin.firestore();
const auth = admin.auth();

// Helpers
const isoNow = () => new Date().toISOString();
const toDateOnly = (d) => d.toISOString().split('T')[0];
const randomDate = (start, end) => new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
const randInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const pick = (arr) => arr[randInt(0, arr.length - 1)];

// ==========================================
// 1. NETTOYAGE
// ==========================================
async function clearAll() {
  console.log("\n🔥 1. NETTOYAGE DE LA BASE...");
  
  // Auth Users
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
  console.log(`   - Auth users supprimés.`);

  // Firestore Collections
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
  console.log("   - Firestore vidé.");
}

// ==========================================
// 2. CONFIGURATION (CRÉNEAUX)
// ==========================================
async function createConfig() {
  console.log("⚙️  2. Injection de la Configuration (Créneaux)...");
  // On enregistre les 3 créneaux dans config/general
  await db.collection('config').doc('general').set({
    creneaux: SLOTS_DATA,
    updatedAt: isoNow()
  });
  console.log("   - 3 créneaux ajoutés dans config/general.");
}

// ==========================================
// 3. UTILISATEURS & STAFF
// ==========================================
async function createUsers() {
  console.log("👤 3. Création des utilisateurs...");
  const batch = db.batch();
  const staffIds = [];

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

  await batch.commit();
  return staffIds;
}

// ==========================================
// 4. SERVICES & EQUIPES
// ==========================================
async function createResources(staffIds) {
  console.log("🛠️  4. Création Services & Équipes...");
  const batch = db.batch();
  const teamIds = [];

  const servicesNames = ['Traiteur', 'Photographe', 'DJ', 'Décoration', 'Location Salle'];
  for (const name of servicesNames) {
    const ref = db.collection('services').doc();
    batch.set(ref, {
      id: ref.id,
      nom: name,
      prix: randInt(500, 5000),
      active: true,
      description: faker.lorem.sentence()
    });
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
  return { teamIds };
}

// ==========================================
// 5. RÉSERVATIONS & PAIEMENTS
// ==========================================
async function createReservations(staffIds, teamIds) {
  console.log(`📅 5. Création de ${RESERVATION_COUNT} Réservations...`);
  
  // Clients
  const clients = [];
  for(let i=0; i<10; i++) {
     clients.push({
        id: db.collection('clients').doc().id,
        nom: faker.person.lastName(),
        prenom: faker.person.firstName(),
        phone: faker.phone.number('########')
     });
     await db.collection('clients').doc(clients[i].id).set({
         ...clients[i], email: faker.internet.email(), createdAt: isoNow()
     });
  }

  const batchSize = 400;
  let batch = db.batch();
  let opCount = 0;

  for (let i = 0; i < RESERVATION_COUNT; i++) {
    const ref = db.collection('reservations').doc();
    const client = pick(clients);
    const dateObj = randomDate(START_DATE, END_DATE);
    const dateStr = toDateOnly(dateObj);
    
    // Sélection d'un créneau depuis la config
    const slotData = pick(SLOTS_DATA);
    
    const isCancelled = Math.random() < 0.1;
    const status = isCancelled ? 'CANCELLED' : 'CONFIRMED';
    const totalPrice = randInt(1000, 8000);
    
    const hasPayments = (i % 2 === 0); 
    let advance = 0;

    if (hasPayments) {
        // Acompte
        const p1Amount = Math.round(totalPrice * 0.3);
        const p1Ref = db.collection('payments').doc();
        batch.set(p1Ref, {
            id: p1Ref.id,
            reservationId: ref.id,
            amount: p1Amount,
            type: 'ESPECES',
            date: isoNow(),
            description: 'Acompte'
        });
        opCount++;

        // Solde
        const p2Ref = db.collection('payments').doc();
        batch.set(p2Ref, {
            id: p2Ref.id,
            reservationId: ref.id,
            amount: totalPrice - p1Amount,
            type: 'CHEQUE',
            date: isoNow(),
            description: 'Solde'
        });
        opCount++;

        advance = totalPrice;
    }

    batch.set(ref, {
      id: ref.id,
      clientId: client.id,
      clientName: `${client.nom} ${client.prenom}`,
      customerPhone: client.phone,
      date: dateStr,
      startTime: slotData.start,
      endTime: slotData.end,
      selectedSlotId: slotData.id, // ID du créneau (matin, aprem...)
      status: status,
      totalPrice: totalPrice,
      advance: advance,
      advancePayment: advance,
      assignedServerIds: [pick(staffIds)],
      teamIds: [pick(teamIds)],
      createdAt: isoNow()
    });
    opCount++;

    if (opCount >= batchSize) {
        await batch.commit();
        batch = db.batch();
        opCount = 0;
    }
  }
  
  if (opCount > 0) await batch.commit();
  console.log(`   - Réservations insérées.`);
}

// ==========================================
// 6. DÉPENSES
// ==========================================
async function createExpenses() {
  console.log(`💸 6. Création de ${EXPENSE_COUNT} Dépenses...`);
  const batch = db.batch();
  const categories = ['Achat Alimentaire', 'Électricité', 'Entretien', 'Salaires', 'Publicité'];

  for (let i = 0; i < EXPENSE_COUNT; i++) {
    const ref = db.collection('expenses').doc();
    batch.set(ref, {
      id: ref.id,
      title: faker.commerce.productName(),
      amount: randInt(50, 2000),
      category: pick(categories),
      date: toDateOnly(randomDate(START_DATE, END_DATE)),
      description: faker.lorem.sentence(),
      createdAt: isoNow()
    });
  }
  await batch.commit();
}

// ==========================================
// RUN
// ==========================================
async function run() {
  try {
    await clearAll();
    await createConfig(); // Ajout de la config
    const staffIds = await createUsers();
    const { teamIds } = await createResources(staffIds);
    await createReservations(staffIds, teamIds);
    await createExpenses();

    console.log("\n✅ SEED TERMINÉ AVEC SUCCÈS !");
    console.log("------------------------------------------------");
    console.log("👉 Admin   : admin@gmail.com    / User123");
    console.log("👉 Serveur1: serveur1@gmail.com / User123");
    process.exit(0);
  } catch (e) {
    console.error("❌ ERREUR:", e);
    process.exit(1);
  }
}

run();
EOF

# Exécution
node seed-custom.js
rm seed-custom.js

echo "🎉 Fin du script."