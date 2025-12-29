#!/usr/bin/env bash
set -euo pipefail

echo "✅ SEED ROBUSTE V2 : Config, Calendrier, Packs (Prix corrects), Réservations, Users, Dépenses."

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
const RESERVATION_COUNT = 50;
const EXPENSE_COUNT = 7;
const PACK_COUNT = 3;

// Période : Octobre 2025 -> Avril 2026
const START_DATE = new Date('2025-10-01');
const END_DATE = new Date('2026-04-30');

// Définitions horaires (Config)
const SLOT_DEFINITIONS = [
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
  console.log("\n🔥 1. NETTOYAGE DE LA BASE...");
  
  // Clean Auth
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

  // Clean Firestore
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
// 2. CONFIGURATION (GLOBAL SETTINGS)
// ==========================================
async function createConfig() {
  console.log("⚙️  2. Injection Configuration (config/general)...");
  await db.collection('config').doc('general').set({
    creneaux: SLOT_DEFINITIONS,
    updatedAt: isoNow()
  });
  console.log("   - Config sauvegardée.");
}

// ==========================================
// 3. CRÉATION DES CRÉNEAUX (CALENDRIER)
// ==========================================
async function createSlotsCalendar() {
  console.log("🗓️  3. Génération du Calendrier (Slots) jour par jour...");
  
  let currentDate = new Date(START_DATE);
  let batch = db.batch();
  let count = 0;
  const createdSlots = [];

  while (currentDate <= END_DATE) {
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
    currentDate.setDate(currentDate.getDate() + 1);
  }

  if (count > 0) await batch.commit();
  console.log(`   - ${createdSlots.length} créneaux générés.`);
  return createdSlots;
}

// ==========================================
// 4. UTILISATEURS & CLIENTS
// ==========================================
async function createEntities() {
  console.log("👤 4. Création Users & Clients...");
  const batch = db.batch();
  const staffIds = [];
  const clientIds = [];

  // A. USERS
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

    // Firestore: users
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

    // Firestore: staff
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

  // B. CLIENTS
  for (let i = 1; i <= 2; i++) {
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
  console.log("🛠️  5. Création Services & Équipes...");
  const batch = db.batch();
  const teamIds = [];
  const services = [];

  // Services
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

  // Équipes
  const teamNames = ['Équipe Matin', 'Équipe Soir'];
  for (const name of teamNames) {
    const ref = db.collection('teams').doc();
    batch.set(ref, {
      id: ref.id,
      nom: name,
      staffIds: staffIds, // Assignation des vrais staffs
      active: true,
      createdAt: isoNow()
    });
    teamIds.push(ref.id);
  }

  await batch.commit();
  return { teamIds, services };
}

// ==========================================
// 6. PACKS (NOUVEAU)
// ==========================================
async function createPacks(staffIds, teamIds, services) {
  console.log(`📦 6. Création de ${PACK_COUNT} Packs avec prix calculés...`);
  const batch = db.batch();
  const packNames = ['Pack Mariage Royal', 'Pack Anniversaire VIP', 'Pack Soirée Simple'];

  for (let i = 0; i < PACK_COUNT; i++) {
    const ref = db.collection('packs').doc();
    
    // Sélectionner des services aléatoires pour ce pack
    const packServices = pickMultiple(services, randInt(2, 4)).map(s => ({
      id: s.id,
      nom: s.nom,
      name: s.nom, // Compatibilité
      prix: s.prix,
      price: s.prix, // Compatibilité
      icon: s.icon
    }));

    // Calculer le prix total (Somme des services)
    const totalPrice = packServices.reduce((sum, s) => sum + s.prix, 0);

    // Sélectionner staff et équipes
    const packStaff = pickMultiple(staffIds, randInt(1, 2));
    const packTeams = pickMultiple(teamIds, 1);

    batch.set(ref, {
      id: ref.id,
      nom: packNames[i],
      description: faker.lorem.paragraph(),
      active: true,
      services: packServices,
      staffIds: packStaff,  // VRAIS IDs
      teamIds: packTeams,   // VRAIS IDs
      price: totalPrice,    // PRIX CORRIGÉ
      prix: totalPrice,     // COMPATIBILITÉ
      createdAt: isoNow()
    });
  }
  
  await batch.commit();
  console.log("   - Packs créés avec succès.");
}

// ==========================================
// 7. RÉSERVATIONS
// ==========================================
async function createReservations(allSlots, clientList, staffIds, teamIds) {
  console.log(`📅 7. Création de ${RESERVATION_COUNT} Réservations...`);
  
  const shuffledSlots = allSlots.sort(() => 0.5 - Math.random());
  const selectedSlots = shuffledSlots.slice(0, RESERVATION_COUNT);

  let batch = db.batch();
  let opCount = 0;

  for (let i = 0; i < selectedSlots.length; i++) {
    const slot = selectedSlots[i];
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
  console.log(`   - Réservations insérées.`);
}

// ==========================================
// 8. DÉPENSES
// ==========================================
async function createExpenses() {
  console.log(`💸 8. Création de ${EXPENSE_COUNT} Dépenses...`);
  const batch = db.batch();
  const categories = ['Achat Alimentaire', 'Électricité', 'Entretien', 'Salaires', 'Publicité'];

  for (let i = 0; i < EXPENSE_COUNT; i++) {
    const ref = db.collection('expenses').doc();
    const randomTs = START_DATE.getTime() + Math.random() * (END_DATE.getTime() - START_DATE.getTime());
    
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

// ==========================================
// RUN
// ==========================================
async function run() {
  try {
    await clearAll();
    await createConfig();
    
    const allSlots = await createSlotsCalendar();
    const { staffIds, clientIds } = await createEntities();
    const { teamIds, services } = await createResources(staffIds); // Returns services now
    
    // Création des Packs avec les bonnes références
    await createPacks(staffIds, teamIds, services);

    await createReservations(allSlots, clientIds, staffIds, teamIds);
    await createExpenses();

    console.log("\n✅ SEED TERMINÉ AVEC SUCCÈS !");
    console.log("------------------------------------------------");
    console.log("👉 Admin   : admin@gmail.com    / User123");
    console.log("👉 Serveur1: serveur1@gmail.com / User123");
    console.log("👉 Serveur2: serveur2@gmail.com / User123");
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