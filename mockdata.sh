#!/usr/bin/env bash
set -euo pipefail

echo "✅ SEED ROBUSTE : 50 Réservations (2006-2025), 3 Users, 7 Dépenses, 2 Paiements pour 50% des résas."

# Vérification du fichier de clé
if [ ! -f "./serviceAccountKey.json" ]; then
  echo "❌ Erreur : serviceAccountKey.json introuvable dans le dossier courant."
  echo "Veuillez placer votre clé privée Firebase à la racine."
  exit 1
fi

# Installation des dépendances si nécessaire
if [ ! -d "node_modules" ]; then
  echo "📦 Installation des dépendances..."
  npm i firebase-admin @faker-js/faker >/dev/null 2>&1
else
  # Vérification rapide si les modules sont là
  if [ ! -d "node_modules/firebase-admin" ]; then
     npm i firebase-admin @faker-js/faker >/dev/null 2>&1
  fi
fi

# ------------------------------------------------------------
# CRÉATION DU SCRIPT NODEJS DE SEED
# ------------------------------------------------------------
cat > seed-custom.js <<'EOF'
const admin = require('firebase-admin');
const { fakerFR: faker } = require('@faker-js/faker');
const serviceAccount = require('./serviceAccountKey.json');

// --- CONFIGURATION ---
const PASSWORD = "User123";
const RESERVATION_COUNT = 50;
const EXPENSE_COUNT = 7;
const SERVICE_COUNT = 5;

// Plage de dates : Oct 2006 -> Oct 2025
const START_DATE = new Date('2006-10-01T00:00:00Z');
const END_DATE = new Date('2025-10-31T23:59:59Z');

const SLOTS = [
  { key: 'matin', label: 'Matin', start: '08:00', end: '12:00' },
  { key: 'aprem', label: 'Après-midi', start: '13:00', end: '17:00' },
  { key: 'soir',  label: 'Soir',  start: '18:00', end: '02:00' }
];

// Initialisation Firebase
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
// 1. NETTOYAGE (Wipe DB)
// ==========================================
async function clearAll() {
  console.log("\n🔥 1. NETTOYAGE COMPLET DE LA BASE...");
  
  // Suppression Utilisateurs Auth
  let nextPageToken;
  const uids = [];
  do {
    const res = await auth.listUsers(1000, nextPageToken);
    res.users.forEach(u => uids.push(u.uid));
    nextPageToken = res.pageToken;
  } while (nextPageToken);
  
  if (uids.length > 0) {
    // Suppression par lots de 1000 max
    const chunks = [];
    while (uids.length > 0) chunks.push(uids.splice(0, 1000));
    for (const chunk of chunks) await auth.deleteUsers(chunk);
  }
  console.log(`   - Utilisateurs Auth supprimés.`);

  // Suppression Collections Firestore
  const collections = await db.listCollections();
  for (const col of collections) {
    const snap = await col.listDocuments();
    if (snap.length > 0) {
      // Batch delete (par lots de 500)
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
// 2. CRÉATION UTILISATEURS & STAFF
// ==========================================
async function createUsers() {
  console.log("👤 2. Création des utilisateurs...");
  const batch = db.batch();
  const staffIds = [];

  // Définition des users
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

    // Collection users
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

    // Collection staff (uniquement pour les serveurs)
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
  console.log(`   - 3 Utilisateurs créés (1 Admin, 2 Staff).`);
  return staffIds;
}

// ==========================================
// 3. SERVICES & EQUIPES
// ==========================================
async function createResources(staffIds) {
  console.log("🛠️  3. Création Services & Équipes...");
  const batch = db.batch();
  const serviceIds = [];
  const teamIds = [];

  // 5 Services
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
    serviceIds.push(ref); // on stocke la ref ou l'objet complet si besoin
  }

  // 2 Équipes
  const teamNames = ['Équipe Matin', 'Équipe Soir'];
  for (const name of teamNames) {
    const ref = db.collection('teams').doc();
    batch.set(ref, {
      id: ref.id,
      nom: name,
      staffIds: staffIds, // Tous les serveurs dans toutes les équipes pour l'exemple
      active: true,
      createdAt: isoNow()
    });
    teamIds.push(ref.id);
  }

  await batch.commit();
  return { teamIds };
}

// ==========================================
// 4. RÉSERVATIONS & PAIEMENTS
// ==========================================
async function createReservations(staffIds, teamIds) {
  console.log(`📅 4. Création de ${RESERVATION_COUNT} Réservations (période 2006-2025)...`);
  
  // Création d'un pool de clients fictifs
  const clients = [];
  for(let i=0; i<10; i++) {
     clients.push({
        id: db.collection('clients').doc().id,
        nom: faker.person.lastName(),
        prenom: faker.person.firstName(),
        phone: faker.phone.number('########')
     });
     // On pourrait les insérer en base, mais ce n'est pas explicitement demandé, on le fait pour la cohérence
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
    const slot = pick(SLOTS);
    
    // Status : 10% d'annulations pour tester le flag
    const isCancelled = Math.random() < 0.1;
    const status = isCancelled ? 'CANCELLED' : 'CONFIRMED';
    
    const totalPrice = randInt(1000, 8000);
    
    // 50% des réservations ont 2 règlements
    const hasPayments = (i % 2 === 0); 
    let advance = 0;

    if (hasPayments) {
        // Règlement 1 : Acompte (30%)
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

        // Règlement 2 : Solde (70%) - Date légèrement après
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

        advance = totalPrice; // Considéré comme payé
    }

    // Objet Réservation
    batch.set(ref, {
      id: ref.id,
      clientId: client.id,
      clientName: `${client.nom} ${client.prenom}`,
      customerPhone: client.phone, // Important pour l'affichage
      date: dateStr,
      startTime: slot.start,
      endTime: slot.end,
      selectedSlotId: slot.key,
      status: status,
      totalPrice: totalPrice,
      advance: advance, // Montant payé
      advancePayment: advance, // Doublon pour compatibilité modèle
      assignedServerIds: [pick(staffIds)],
      teamIds: [pick(teamIds)],
      createdAt: isoNow()
    });
    opCount++;

    // Commit par lot pour éviter la limite de 500
    if (opCount >= batchSize) {
        await batch.commit();
        batch = db.batch();
        opCount = 0;
    }
  }
  
  if (opCount > 0) await batch.commit();
  console.log(`   - Réservations et Paiements insérés.`);
}

// ==========================================
// 5. DÉPENSES
// ==========================================
async function createExpenses() {
  console.log(`💸 5. Création de ${EXPENSE_COUNT} Dépenses...`);
  const batch = db.batch();
  const categories = ['Achat Alimentaire', 'Électricité', 'Entretien', 'Salaires', 'Publicité'];

  for (let i = 0; i < EXPENSE_COUNT; i++) {
    const ref = db.collection('expenses').doc();
    batch.set(ref, {
      id: ref.id,
      title: faker.commerce.productName(),
      amount: randInt(50, 2000),
      category: pick(categories),
      date: toDateOnly(randomDate(START_DATE, END_DATE)), // Dépenses réparties sur la même période
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
    const staffIds = await createUsers();
    const { teamIds } = await createResources(staffIds);
    await createReservations(staffIds, teamIds);
    await createExpenses();

    console.log("\n✅ SEED TERMINÉ AVEC SUCCÈS !");
    console.log("------------------------------------------------");
    console.log("👉 Admin   : admin@gmail.com    / User123");
    console.log("👉 Serveur1: serveur1@gmail.com / User123");
    console.log("👉 Serveur2: serveur2@gmail.com / User123");
    process.exit(0);
  } catch (e) {
    console.error("❌ ERREUR FATALE:", e);
    process.exit(1);
  }
}

run();
EOF

# Exécution du script Node généré
node seed-custom.js

# Suppression du script temporaire
rm seed-custom.js

echo "🎉 Opération terminée."