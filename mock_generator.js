const admin = require('firebase-admin');
const { fakerFR: faker } = require('@faker-js/faker');

// --- CONFIGURATION ---
const serviceAccount = require('./serviceAccountKey.json');
const PASSWORD = "User123";
const COUNT = 5;
const RESERVATIONS_PER_EMPLOYEE = 2;

// Initialisation
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();
const auth = admin.auth();

// ==========================================
// 🔥 0. SUPPRESSION DE TOUS LES USERS FIREBASE AUTH
// ==========================================
async function clearAuthUsers() {
  console.log("\n🔥 SUPPRESSION DE TOUS LES UTILISATEURS FIREBASE AUTH...");

  let nextPageToken = undefined;
  const uids = [];

  do {
    const res = await auth.listUsers(1000, nextPageToken);
    res.users.forEach(u => uids.push(u.uid));
    nextPageToken = res.pageToken;
  } while (nextPageToken);

  if (uids.length === 0) {
    console.log("   ✅ Aucun utilisateur Auth à supprimer.");
    return;
  }

  for (let i = 0; i < uids.length; i += 1000) {
    const chunk = uids.slice(i, i + 1000);
    const result = await auth.deleteUsers(chunk);

    console.log(
      `   🗑️ Suppression lot: ${chunk.length} | ✅ ok=${result.successCount} | ❌ fail=${result.failureCount}`
    );

    if (result.failureCount > 0) {
      result.errors.forEach(err => {
        console.log(`      - uid=${chunk[err.index]} : ${err.error?.message || err.error}`);
      });
    }
  }

  console.log(`✅ Suppression Auth terminée. Total supprimés: ${uids.length}\n`);
}

// ==========================================
// 🧹 1. NETTOYAGE FIRESTORE
// ==========================================
async function clearDatabase() {
  console.log("\n🔥 NETTOYAGE COMPLET DE LA BASE DE DONNÉES (Firestore)...");

  const collections = await db.listCollections();

  if (collections.length === 0) {
    console.log("   ✅ La base est déjà vide.");
    return;
  }

  for (const collection of collections) {
    console.log(`   🗑️ Suppression collection : ${collection.id}`);
    await deleteCollection(db, collection.id, 50);
  }
  console.log("✅ Firestore entièrement vidé.\n");
}

async function deleteCollection(db, collectionPath, batchSize) {
  const collectionRef = db.collection(collectionPath);
  const query = collectionRef.orderBy('__name__').limit(batchSize);

  return new Promise((resolve, reject) => {
    deleteQueryBatch(db, query, resolve).catch(reject);
  });
}

async function deleteQueryBatch(db, query, resolve) {
  const snapshot = await query.get();
  const batchSize = snapshot.size;

  if (batchSize === 0) {
    resolve();
    return;
  }

  const batch = db.batch();
  snapshot.docs.forEach((doc) => batch.delete(doc.ref));
  await batch.commit();

  process.nextTick(() => {
    deleteQueryBatch(db, query, resolve);
  });
}

// ==========================================
// 🌱 2. GÉNÉRATION CONFIG
// ==========================================
async function generateConfig() {
  console.log('⚙️  Config...');

  const batch = db.batch();

  const creneaux = [
    { id: 'hiver_soir', label: 'Soirée Hiver', start: '19:00', end: '02:00', price: 2000, validFrom: '2025-01-01', validTo: '2025-12-31' }
  ];
  await db.collection('config').doc('general').set({ creneaux });

  const eventTypes = [
    { label: 'Mariage', price: 5000, active: true },
    { label: 'Fiançailles', price: 2500, active: true }
  ];
  eventTypes.forEach(e => batch.set(db.collection('config_event_types').doc(), e));

  const options = [
    { label: 'Photographe', price: 800, unit: 'Forfait', active: true }
  ];
  options.forEach(o => batch.set(db.collection('config_options').doc(), o));

  await batch.commit();
}

// ==========================================
// 👤 3. CRÉATION USERS AUTH + USERS FIRESTORE
// ==========================================
async function createAuthUser({ email, password, displayName }) {
  return auth.createUser({
    email,
    password,
    displayName,
    emailVerified: true
  });
}

async function generateAdminUser() {
  console.log("👑 Création Admin (Auth + Firestore)...");

  const email = "admin@gmail.com";
  const displayName = "Admin Principal";

  const user = await createAuthUser({
    email,
    password: PASSWORD,
    displayName
  });

  await db.collection('users').doc(user.uid).set({
    id: user.uid,
    uid: user.uid,
    nom: displayName,
    email,
    role: 'ADMIN',
    active: true,
    status: 'actif',
    createdAt: new Date().toISOString()
  });

  console.log(`   ✅ Admin créé: ${email} uid=${user.uid}`);
  return user.uid;
}

// ==========================================
// 👨‍🍳 4. STAFF + USERS SERVEURS (Auth + Firestore)
// ==========================================
async function generateStaffAndUsers() {
  console.log(`👨‍🍳 Génération ${COUNT} STAFF + USERS (Auth + Firestore)...`);

  const rolesStaff = ['Serveur', 'Cuisinier', 'Sécurité', 'Nettoyage', 'Manager', 'Hôtesse'];
  const staffUids = [];

  const batch = db.batch();

  for (let i = 0; i < COUNT; i++) {
    const fakeName = faker.person.fullName();
    const staffEmail = `serveur${i + 1}@example.com`; // stable, sans doublon
    const staffRoleLabel = faker.helpers.arrayElement(rolesStaff);

    // ✅ Auth user
    const authUser = await createAuthUser({
      email: staffEmail,
      password: PASSWORD,
      displayName: fakeName
    });

    const uid = authUser.uid;
    staffUids.push(uid);

    // ✅ staff/{uid}
    batch.set(db.collection('staff').doc(uid), {
      id: uid,
      uid,
      nom: fakeName ? String(fakeName) : "Nom Inconnu",
      role: String(staffRoleLabel || "Serveur"),
      status: 'actif',
      createdAt: new Date().toISOString()
    });

    // ✅ users/{uid} (pour /admin/serveurs si ta page lit users)
    batch.set(db.collection('users').doc(uid), {
      id: uid,
      uid,
      nom: fakeName ? String(fakeName) : "Nom Inconnu",
      email: staffEmail,
      role: "SERVEUR",
      active: true,
      status: 'actif',
      createdAt: new Date().toISOString()
    });

    console.log(`   ✅ Serveur créé: ${staffEmail} uid=${uid}`);
  }

  await batch.commit();

  const staffSnap = await db.collection('staff').get();
  const usersSnap = await db.collection('users').get();
  console.log(`   ✅ staff Firestore = ${staffSnap.size}`);
  console.log(`   ✅ users Firestore (sans admin) = ${usersSnap.size}`);

  return staffUids;
}

// ==========================================
// 🧑‍🤝‍🧑 5. CLIENTS
// ==========================================
async function generateClients() {
  console.log("🧑‍🤝‍🧑 Génération Clients...");

  const batchCli = db.batch();

  for (let i = 0; i < 3; i++) {
    const ref = db.collection('clients').doc();
    batchCli.set(ref, {
      id: ref.id,
      nom: faker.person.lastName(),
      prenom: faker.person.firstName(),
      email: faker.internet.email()
    });
  }

  await batchCli.commit();

  const cliSnap = await db.collection('clients').get();
  console.log(`   ✅ clients Firestore = ${cliSnap.size}`);
}

// ==========================================
// 📅 6. RESERVATIONS LIÉES AU STAFF
// ==========================================
async function generateReservations(staffUids) {
  console.log("📅 Génération Réservations liées au staff...");

  const batchRes = db.batch();

  for (const staffUid of staffUids) {
    for (let j = 0; j < RESERVATIONS_PER_EMPLOYEE; j++) {
      const resRef = db.collection('reservations').doc();
      batchRes.set(resRef, {
        id: resRef.id,
        clientName: "Client Test",
        date: faker.date.future().toISOString(),
        status: 'CONFIRMED',
        employeeId: staffUid,
        assignedTo: staffUid
      });
    }
  }

  await batchRes.commit();

  const resSnap = await db.collection('reservations').get();
  console.log(`   ✅ reservations Firestore = ${resSnap.size}`);
}

// ==========================================
// 🚀 MAIN
// ==========================================
async function run() {
  try {
    // 0) Purge Auth (tous les comptes)
    await clearAuthUsers();

    // 1) Purge Firestore (toutes collections)
    await clearDatabase();

    // 2) Config
    await generateConfig();

    // 3) Admin (Auth + users Firestore)
    await generateAdminUser();

    // 4) Staff + serveurs (Auth + staff/users Firestore)
    const staffUids = await generateStaffAndUsers();

    // 5) Clients
    await generateClients();

    // 6) Reservations
    await generateReservations(staffUids);

    // Vérif finale
    const usersSnap = await db.collection('users').get();
    const staffSnap = await db.collection('staff').get();
    console.log(`\n✅ CHECK: users Firestore = ${usersSnap.size} | staff Firestore = ${staffSnap.size}`);

    console.log('\n🎉 BASE DE DONNÉES RÉPARÉE ET REMPLIE !');
    console.log('👉 Rafraîchis http://localhost:4200/admin/serveurs');
    console.log(`👉 Logins: admin@gmail.com / ${PASSWORD} et serveur1@example.com / ${PASSWORD}`);

    process.exit(0);
  } catch (error) {
    console.error('❌ Erreur :', error);
    process.exit(1);
  }
}

run();
