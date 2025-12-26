#!/usr/bin/env bash
set -euo pipefail

echo "✅ SEED CUSTOM : 2 Staff, 1 Admin, 10 Réservations (dont 2 annulées avec avoirs), 9 Créneaux."

if [ ! -f "./serviceAccountKey.json" ]; then
  echo "❌ serviceAccountKey.json introuvable dans le dossier courant."
  exit 1
fi

# Installation dépendances si nécessaire
if [ ! -d "node_modules" ]; then
  npm i >/dev/null 2>&1 || true
fi
npm i firebase-admin @faker-js/faker >/dev/null 2>&1

# ------------------------------------------------------------
# CRÉATION DU SCRIPT NODEJS DE SEED
# ------------------------------------------------------------
cat > seed-custom.js <<'EOF'
const admin = require('firebase-admin');
const { fakerFR: faker } = require('@faker-js/faker');
const serviceAccount = require('./serviceAccountKey.json');

// --- CONFIGURATION STRICTE ---
const PASSWORD = "User123";
const TEAM_COUNT = 2;   // 2 Équipes
const CLIENT_COUNT = 2; // 2 Clients

// 3 Périodes x 3 Slots = 9 Créneaux
const PERIODS = [
  { id: 'hiver_2025', label: 'Hiver 2025',  from: '2025-01-01', to: '2025-03-31', coef: 1.0 },
  { id: 'printemps_2025', label: 'Printemps 2025', from: '2025-04-01', to: '2025-06-30', coef: 1.1 },
  { id: 'ete_2025', label: 'Été 2025',    from: '2025-07-01', to: '2025-09-30', coef: 1.3 }
];

const DAY_SLOTS = [
  { key: 'matin', label: 'Matin', start: '08:00', end: '12:00', basePrice: 1000 },
  { key: 'aprem', label: 'Après-midi', start: '13:00', end: '17:00', basePrice: 1200 },
  { key: 'soir',  label: 'Soir',  start: '18:00', end: '02:00', basePrice: 1800 },
];

if (!admin.apps.length) {
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
}
const db = admin.firestore();
const auth = admin.auth();

const isoNow = () => new Date().toISOString();
const toDateOnly = (d) => d.toISOString().split('T')[0];
function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}
function randInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function pick(arr) { return arr[randInt(0, arr.length - 1)]; }

// ==========================================
// 1. NETTOYAGE
// ==========================================
async function clearAll() {
  console.log("\n🔥 NETTOYAGE COMPLET...");
  
  // Auth
  let nextPageToken;
  const uids = [];
  do {
    const res = await auth.listUsers(1000, nextPageToken);
    res.users.forEach(u => uids.push(u.uid));
    nextPageToken = res.pageToken;
  } while (nextPageToken);
  if (uids.length > 0) await auth.deleteUsers(uids);
  console.log(`   - ${uids.length} utilisateurs Auth supprimés.`);

  // Firestore
  const collections = await db.listCollections();
  for (const col of collections) {
    const snap = await col.listDocuments();
    if (snap.length > 0) {
      const batch = db.batch();
      snap.forEach(doc => batch.delete(doc));
      await batch.commit();
    }
  }
  console.log("   - Firestore vidé.");
}

// ==========================================
// 2. CRÉATION UTILISATEURS (2 Staff + 1 Admin)
// ==========================================
async function createUsers() {
  console.log("👤 Création des utilisateurs...");
  const batch = db.batch();
  const staffUids = [];

  // ADMIN
  const adminUser = await auth.createUser({ email: 'admin@gmail.com', password: PASSWORD, displayName: 'Admin Principal', emailVerified: true });
  batch.set(db.collection('users').doc(adminUser.uid), {
    id: adminUser.uid, uid: adminUser.uid, nom: 'Admin Principal', email: 'admin@gmail.com', role: 'ADMIN', active: true, createdAt: isoNow()
  });

  // STAFF (2 spécifiques)
  const staffs = ['serveur1@gmail.com', 'serveur2@gmail.com'];
  let i = 1;
  for (const email of staffs) {
    const user = await auth.createUser({ email, password: PASSWORD, displayName: `Serveur ${i}`, emailVerified: true });
    staffUids.push(user.uid);
    
    // Users collection
    batch.set(db.collection('users').doc(user.uid), {
      id: user.uid, uid: user.uid, nom: `Serveur ${i}`, email, role: 'SERVER', active: true, createdAt: isoNow()
    });
    
    // Staff collection
    batch.set(db.collection('staff').doc(user.uid), {
      id: user.uid, nom: `Serveur ${i}`, email, telephone: '5500000' + i, role: 'SERVER', specialite: 'Serveur', active: true, createdAt: isoNow(), rates: {}
    });
    i++;
  }

  await batch.commit();
  console.log(`   - 1 Admin + 2 Staffs créés.`);
  return staffUids;
}

// ==========================================
// 3. CONFIG & CATALOGUE
// ==========================================
async function createConfig() {
  console.log("⚙️  Configuration (9 Créneaux + Services)...");
  const creneaux = [];
  for (const p of PERIODS) {
    for (const s of DAY_SLOTS) {
      creneaux.push({
        id: `${p.id}_${s.key}`,
        label: `${p.label} - ${s.label}`,
        start: s.start, end: s.end,
        price: Math.round(s.basePrice * p.coef),
        validFrom: p.from, validTo: p.to
      });
    }
  }
  await db.collection('config').doc('general').set({ creneaux });

  // Services
  const servicesData = [
    { nom: 'Traiteur', prix: 3000 }, { nom: 'Photographe', prix: 800 }, 
    { nom: 'DJ', prix: 1200 }, { nom: 'Décoration', prix: 1500 }
  ];
  const batch = db.batch();
  const serviceCatalog = [];
  for (const s of servicesData) {
    const ref = db.collection('services').doc();
    batch.set(ref, { id: ref.id, ...s, active: true });
    serviceCatalog.push({ ...s, id: ref.id });
  }
  await batch.commit();
  return serviceCatalog;
}

// ==========================================
// 4. CLIENTS & EQUIPES
// ==========================================
async function createEntities() {
  console.log(`👥 Création ${CLIENT_COUNT} Clients & ${TEAM_COUNT} Équipes...`);
  const batch = db.batch();
  const clientIds = [];
  const teamIds = [];

  // Clients
  for (let i = 0; i < CLIENT_COUNT; i++) {
    const ref = db.collection('clients').doc();
    clientIds.push(ref.id);
    batch.set(ref, {
      id: ref.id, nom: faker.person.lastName(), prenom: faker.person.firstName(),
      telephone: faker.phone.number('########'), email: faker.internet.email(),
      createdAt: isoNow()
    });
  }

  // Equipes
  for (let i = 0; i < TEAM_COUNT; i++) {
    const ref = db.collection('teams').doc();
    teamIds.push(ref.id);
    batch.set(ref, {
      id: ref.id, nom: `Équipe ${faker.animal.type()}`, type: 'AUTRE',
      telephone: faker.phone.number('########'), active: true
    });
  }

  await batch.commit();
  return { clientIds, teamIds };
}

// ==========================================
// 5. RESERVATIONS (8 Normales + 2 Annulées avec Avoir)
// ==========================================
async function createReservations(clientIds, staffUids, teamIds, serviceCatalog) {
  console.log("📅 Création des 10 Réservations...");
  const batch = db.batch();
  
  // --- A) 8 Réservations "Normales" avec états de paiement variés ---
  const paymentScenarios = [
    { label: 'Rien payé', advancePct: 0 },
    { label: 'Avance 20%', advancePct: 0.2 },
    { label: 'Avance 50%', advancePct: 0.5 },
    { label: 'Payé Total', advancePct: 1 },
    { label: 'Rien payé', advancePct: 0 },
    { label: 'Avance 30%', advancePct: 0.3 },
    { label: 'Payé Total', advancePct: 1 },
    { label: 'Avance 10%', advancePct: 0.1 }
  ];

  for (let i = 0; i < 8; i++) {
    const ref = db.collection('reservations').doc();
    const slot = pick(DAY_SLOTS);
    const day = addDays(new Date(), randInt(-5, 20));
    const price = slot.basePrice + randInt(0, 1000);
    const advance = Math.round(price * paymentScenarios[i].advancePct);
    
    // Création Paiement si avance > 0
    if (advance > 0) {
        const payRef = db.collection('payments').doc();
        batch.set(payRef, {
            id: payRef.id, reservationId: ref.id, amount: advance, 
            type: 'ESPECES', date: isoNow(), description: 'Acompte'
        });
    }

    batch.set(ref, {
      id: ref.id,
      clientId: pick(clientIds),
      clientName: 'Client Normal',
      date: toDateOnly(day),
      startTime: slot.start, endTime: slot.end,
      selectedSlotId: slot.key, slotId: `as_${slot.key}_2025`,
      status: 'CONFIRMED',
      totalPrice: price,
      advance: advance,
      assignedServerIds: [pick(staffUids)],
      createdAt: isoNow()
    });
  }

  // --- B) 2 Réservations Annulées avec BON RÉUTILISABLE ---
  // On simule une résa qui a été payée (ou partiellement), puis annulée -> argent transformé en Avoir
  for (let i = 0; i < 2; i++) {
    const ref = db.collection('reservations').doc();
    const clientId = clientIds[i % clientIds.length]; // Un pour chaque client si possible
    const slot = pick(DAY_SLOTS);
    const amountPaid = 500; // Montant qui a été transformé en bon

    // 1. La réservation annulée
    batch.set(ref, {
      id: ref.id,
      clientId: clientId,
      clientName: 'Client Annulé Avec Avoir',
      date: toDateOnly(addDays(new Date(), randInt(10, 30))),
      startTime: slot.start, endTime: slot.end,
      selectedSlotId: slot.key, slotId: `as_${slot.key}_2025`,
      status: 'CANCELLED',
      totalPrice: 1500,
      advance: amountPaid, // Montant qui avait été versé
      assignedServerIds: [],
      createdAt: isoNow()
    });

    // 2. Le Bon (Reçu provisoire) disponible
    const receiptRef = db.collection('provisional_receipts').doc();
    batch.set(receiptRef, {
        id: receiptRef.id,
        clientId: clientId,
        amount: amountPaid,
        createdAt: isoNow(),
        description: `Avoir suite annulation réservation du ${toDateOnly(addDays(new Date(), randInt(10, 30)))}`,
        status: 'AVAILABLE', // IMPORTANT: Disponible pour être utilisé
        originalPaymentType: 'ESPECES',
        source: 'CANCELLATION',
        sourceReservationId: ref.id
    });
  }

  await batch.commit();
  console.log("   - 8 Réservations actives + 2 Annulées (Avoirs générés).");
}

// ==========================================
// RUN
// ==========================================
async function run() {
  try {
    await clearAll();
    const staffUids = await createUsers();
    const serviceCatalog = await createConfig();
    const { clientIds, teamIds } = await createEntities();
    await createReservations(clientIds, staffUids, teamIds, serviceCatalog);

    console.log("\n✅ SEED TERMINÉ AVEC SUCCÈS !");
    console.log("👉 Admin: admin@gmail.com / User123");
    console.log("👉 Staff: serveur1@gmail.com / User123");
    console.log("👉 Staff: serveur2@gmail.com / User123");
    process.exit(0);
  } catch (e) {
    console.error("❌ Erreur:", e);
    process.exit(1);
  }
}

run();
EOF

# Exécution
node seed-custom.js
rm seed-custom.js # Nettoyage du script temporaire

echo "✅ Base de données réinitialisée et remplie selon les spécifications."