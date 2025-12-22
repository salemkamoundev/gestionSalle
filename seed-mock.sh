#!/usr/bin/env bash
set -euo pipefail

echo "✅ Seed mock data (Auth + Firestore) avec 3 créneaux/jour (matin/aprem/soir)"

if [ ! -f "./serviceAccountKey.json" ]; then
  echo "❌ serviceAccountKey.json introuvable dans le dossier courant."
  exit 1
fi

# Dépendances (si pas déjà dans ton projet)
if [ ! -d "node_modules" ]; then
  npm i >/dev/null 2>&1 || true
fi
npm i firebase-admin @faker-js/faker >/dev/null 2>&1

cat > seed-mock.js <<'JS'
const admin = require('firebase-admin');
const { fakerFR: faker } = require('@faker-js/faker');

// --- CONFIGURATION ---
const serviceAccount = require('./serviceAccountKey.json');
const PASSWORD = "User123";
const STAFF_COUNT = 5;
const DAYS_PER_STAFF = 2;
const CLIENT_COUNT = 3;

const SLOTS = [
  { id: 'matin', label: 'Matin', start: '08:00', end: '12:00', price: 1500, validFrom: '2025-01-01', validTo: '2025-12-31' },
  { id: 'aprem', label: 'Après-midi', start: '13:00', end: '17:00', price: 1500, validFrom: '2025-01-01', validTo: '2025-12-31' },
  { id: 'soir',  label: 'Soir', start: '18:00', end: '02:00', price: 2000, validFrom: '2025-01-01', validTo: '2025-12-31' }
];

if (!admin.apps.length) admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();
const auth = admin.auth();

const isoNow = () => new Date().toISOString();
const toDateOnly = (d) => d.toISOString().split('T')[0];
const addDays = (date, days) => { const d = new Date(date); d.setDate(d.getDate() + days); return d; };
const randInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

// 0) Purge Auth
async function clearAuthUsers() {
  console.log("\n🔥 SUPPRESSION DE TOUS LES UTILISATEURS FIREBASE AUTH...");
  let nextPageToken = undefined;
  const uids = [];
  do {
    const res = await auth.listUsers(1000, nextPageToken);
    res.users.forEach(u => uids.push(u.uid));
    nextPageToken = res.pageToken;
  } while (nextPageToken);

  if (uids.length === 0) return console.log("   ✅ Aucun utilisateur Auth à supprimer.");
  for (let i = 0; i < uids.length; i += 1000) {
    const chunk = uids.slice(i, i + 1000);
    const result = await auth.deleteUsers(chunk);
    console.log(`   🗑️ Lot: ${chunk.length} | ok=${result.successCount} | fail=${result.failureCount}`);
  }
  console.log(`✅ Auth purgé (${uids.length})\n`);
}

// 1) Purge Firestore
async function clearDatabase() {
  console.log("\n🔥 NETTOYAGE COMPLET DE LA BASE (Firestore)...");
  const collections = await db.listCollections();
  for (const c of collections) await deleteCollection(c.id, 50);
  console.log("✅ Firestore vidé.\n");
}
async function deleteCollection(path, batchSize) {
  const ref = db.collection(path);
  const q = ref.orderBy('__name__').limit(batchSize);
  return new Promise((resolve, reject) => deleteQueryBatch(q, resolve).catch(reject));
}
async function deleteQueryBatch(q, resolve) {
  const snap = await q.get();
  if (snap.size === 0) return resolve();
  const batch = db.batch();
  snap.docs.forEach(d => batch.delete(d.ref));
  await batch.commit();
  process.nextTick(() => deleteQueryBatch(q, resolve));
}

// 2) Config
async function generateConfig() {
  console.log("⚙️ Config (3 créneaux)...");
  await db.collection('config').doc('general').set({ creneaux: SLOTS });

  const batch = db.batch();
  [
    { label: 'Mariage', price: 5000, active: true },
    { label: 'Fiançailles', price: 2500, active: true },
  ].forEach(e => batch.set(db.collection('config_event_types').doc(), e));

  [{ label: 'Photographe', price: 800, unit: 'Forfait', active: true }]
    .forEach(o => batch.set(db.collection('config_options').doc(), o));

  await batch.commit();
}

// 3) Users Auth helper
async function createAuthUser({ email, password, displayName }) {
  return auth.createUser({ email, password, displayName, emailVerified: true });
}

async function generateAdmin() {
  console.log("👑 Admin (Auth + users + staff)...");
  const email = "admin@gmail.com";
  const displayName = "Admin Principal";
  const u = await createAuthUser({ email, password: PASSWORD, displayName });

  await db.collection('users').doc(u.uid).set({
    id: u.uid, uid: u.uid, nom: displayName, email,
    role: 'ADMIN', active: true, createdAt: isoNow()
  });

  await db.collection('staff').doc(u.uid).set({
    id: u.uid, nom: displayName, email,
    role: 'ADMIN', specialite: 'Admin', active: true, createdAt: isoNow()
  });

  return u.uid;
}

async function generateStaff() {
  console.log(`👨‍🍳 ${STAFF_COUNT} serveurs (Auth + staff + users)...`);
  const staffUids = [];
  const specialites = ['Serveur', 'Barman', 'Sécurité', 'Nettoyage', 'Manager', 'Hôtesse'];
  const batch = db.batch();

  for (let i = 0; i < STAFF_COUNT; i++) {
    const nom = faker.person.fullName();
    const email = `serveur${i + 1}@example.com`;
    const specialite = faker.helpers.arrayElement(specialites);

    const u = await createAuthUser({ email, password: PASSWORD, displayName: nom });
    staffUids.push(u.uid);

    batch.set(db.collection('staff').doc(u.uid), {
      id: u.uid,
      nom: String(nom || 'Nom Inconnu'),
      email,
      telephone: faker.phone.number('########'),
      specialite: String(specialite || 'Serveur'),
      role: 'SERVER',
      active: true,
      createdAt: isoNow(),
      rates: { matin: randInt(60,120), aprem: randInt(60,120), soir: randInt(80,160) }
    });

    batch.set(db.collection('users').doc(u.uid), {
      id: u.uid, uid: u.uid,
      nom: String(nom || 'Nom Inconnu'),
      email,
      role: 'SERVER',
      active: true,
      createdAt: isoNow()
    });
  }

  await batch.commit();
  return staffUids;
}

async function generateClients() {
  console.log("🧑‍🤝‍🧑 Clients...");
  const batch = db.batch();
  const ids = [];
  for (let i = 0; i < CLIENT_COUNT; i++) {
    const ref = db.collection('clients').doc();
    ids.push(ref.id);
    batch.set(ref, {
      id: ref.id,
      nom: faker.person.lastName(),
      prenom: faker.person.firstName(),
      email: faker.internet.email()
    });
  }
  await batch.commit();
  return ids;
}

// 6) Reservations: 3 slots / jour
async function generateReservations(staffUids, clientIds) {
  console.log("📅 Reservations (matin/aprem/soir) ...");

  const batch = db.batch();
  const today = new Date();

  for (const staffUid of staffUids) {
    for (let d = 0; d < DAYS_PER_STAFF; d++) {
      const day = addDays(today, randInt(0, 14));
      const dateStr = toDateOnly(day); // ✅ 'YYYY-MM-DD'

      for (const slot of SLOTS) {
        const resRef = db.collection('reservations').doc();
        const clientId = clientIds[randInt(0, clientIds.length - 1)];

        batch.set(resRef, {
          id: resRef.id,
          clientId,
          clientName: "Client Test",
          date: dateStr,
          slotId: slot.id,
          selectedSlotId: slot.id,
          startTime: slot.start,
          endTime: slot.end,
          status: 'CONFIRMED',
          assignedServerIds: [staffUid],
          assignedTeamIds: [],
          totalPrice: slot.price,
          createdAt: isoNow()
        });
      }
    }
  }

  await batch.commit();
  const snap = await db.collection('reservations').get();
  console.log(`   ✅ reservations=${snap.size}`);
}

(async function run() {
  try {
    await clearAuthUsers();
    await clearDatabase();

    await generateConfig();
    await generateAdmin();
    const staffUids = await generateStaff();
    const clientIds = await generateClients();
    await generateReservations(staffUids, clientIds);

    console.log("🎉 Seed terminé.");
    console.log(`👉 Logins: admin@gmail.com / ${PASSWORD} | serveur1@example.com / ${PASSWORD}`);
    process.exit(0);
  } catch (e) {
    console.error("❌ Seed error:", e);
    process.exit(1);
  }
})();
JS

node seed-mock.js
echo "✅ Seed OK. Rafraîchis: http://localhost:4200/reservations"
