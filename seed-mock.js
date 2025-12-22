const admin = require('firebase-admin');
const { fakerFR: faker } = require('@faker-js/faker');

const serviceAccount = require('./serviceAccountKey.json');

// --- CONFIG ---
const PASSWORD = "User123";
const STAFF_COUNT = 5;
const TEAM_COUNT = 6;
const CLIENT_COUNT = 12;
const EXTRA_DIVERSE_RESERVATIONS = 20;

// Slots UI (calendrier)
const DAY_SLOTS = [
  { key: 'matin', label: 'Matin', start: '08:00', end: '12:00', basePrice: 1500 },
  { key: 'aprem', label: 'Après-midi', start: '13:00', end: '17:00', basePrice: 1500 },
  { key: 'soir',  label: 'Soir',  start: '18:00', end: '02:00', basePrice: 2200 },
];

// Périodes (pour "Liste des Périodes & Créneaux" dans /admin/config)
const PERIODS = [
  { id: 'hiver_2025', label: 'Hiver 2025',  from: '2025-01-01', to: '2025-03-31', coef: 1.10 },
  { id: 'printemps_2025', label: 'Printemps 2025', from: '2025-04-01', to: '2025-06-30', coef: 1.00 },
  { id: 'ete_2025', label: 'Été 2025',    from: '2025-07-01', to: '2025-09-30', coef: 1.20 },
  { id: 'automne_2025', label: 'Automne 2025', from: '2025-10-01', to: '2025-12-31', coef: 1.05 },
];

// compat ancienne UI (slotId = as_matin_2025, etc.)
const LEGACY_SLOT_IDS = [
  { id: 'as_matin_2025', label: 'Année 2025 - Matin', start: '08:00', end: '12:00', price: 1500, validFrom: '2025-01-01', validTo: '2025-12-31' },
  { id: 'as_aprem_2025', label: 'Année 2025 - Après-midi', start: '13:00', end: '17:00', price: 1500, validFrom: '2025-01-01', validTo: '2025-12-31' },
  { id: 'as_soir_2025',  label: 'Année 2025 - Soir', start: '18:00', end: '02:00', price: 2200, validFrom: '2025-01-01', validTo: '2025-12-31' },
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
function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
function pick(arr) {
  return arr[randInt(0, arr.length - 1)];
}

// ==========================================
// 0) CLEAR AUTH USERS
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
    console.log(`   🗑️ Suppression lot: ${chunk.length} | ✅ ok=${result.successCount} | ❌ fail=${result.failureCount}`);
  }
  console.log(`✅ Suppression Auth terminée. Total supprimés: ${uids.length}\n`);
}

// ==========================================
// 1) CLEAR FIRESTORE
// ==========================================
async function clearDatabase() {
  console.log("\n🔥 NETTOYAGE COMPLET DE LA BASE (Firestore)...");
  const collections = await db.listCollections();
  if (collections.length === 0) {
    console.log("   ✅ Déjà vide.");
    return;
  }
  for (const collection of collections) {
    console.log(`   🗑️ Suppression collection: ${collection.id}`);
    await deleteCollection(collection.id, 100);
  }
  console.log("✅ Firestore vidé.\n");
}

async function deleteCollection(collectionPath, batchSize) {
  const collectionRef = db.collection(collectionPath);
  const query = collectionRef.orderBy('__name__').limit(batchSize);
  return new Promise((resolve, reject) => {
    deleteQueryBatch(query, resolve).catch(reject);
  });
}
async function deleteQueryBatch(query, resolve) {
  const snapshot = await query.get();
  if (snapshot.size === 0) return resolve();
  const batch = db.batch();
  snapshot.docs.forEach((doc) => batch.delete(doc.ref));
  await batch.commit();
  process.nextTick(() => deleteQueryBatch(query, resolve));
}

// ==========================================
// 2) CONFIG (Périodes & Créneaux + options/event types)
// ==========================================
async function generateConfig() {
  console.log("⚙️ Config (Périodes & Créneaux + 3 slots/jour)...");

  const creneaux = [];

  // 4 périodes x 3 créneaux
  for (const p of PERIODS) {
    for (const s of DAY_SLOTS) {
      creneaux.push({
        id: `${p.id}_${s.key}`,
        label: `${p.label} - ${s.label}`,
        start: s.start,
        end: s.end,
        price: Math.round(s.basePrice * p.coef),
        validFrom: p.from,
        validTo: p.to
      });
    }
  }

  // compat "as_matin_2025" etc
  for (const legacy of LEGACY_SLOT_IDS) creneaux.push(legacy);

  await db.collection('config').doc('general').set({ creneaux });

  // config event types
  const eventTypes = [
    { label: 'Mariage', price: 5000, active: true },
    { label: 'Fiançailles', price: 2500, active: true },
    { label: 'Anniversaire', price: 1800, active: true },
    { label: 'Entreprise', price: 3200, active: true },
  ];
  const batch = db.batch();
  eventTypes.forEach(e => batch.set(db.collection('config_event_types').doc(), e));

  // options
  const options = [
    { label: 'Photographe', price: 800, unit: 'Forfait', active: true },
    { label: 'Décoration premium', price: 1200, unit: 'Forfait', active: true },
    { label: 'Gâteau', price: 400, unit: 'Forfait', active: true },
    { label: 'DJ', price: 900, unit: 'Forfait', active: true },
  ];
  options.forEach(o => batch.set(db.collection('config_options').doc(), o));

  await batch.commit();
  console.log(`   ✅ creneaux=${creneaux.length}`);
}

// ==========================================
// 3) SERVICES CATALOG (collection: services)
// ==========================================
async function generateServiceCatalog() {
  console.log("🧾 Génération catalogue services (services)...");
  const services = [
    { nom: 'Traiteur VIP', description: 'Buffet + service', prix: 5000, active: true, createdAt: isoNow() },
    { nom: 'Décoration Salle', description: 'Décor complet', prix: 2000, active: true, createdAt: isoNow() },
    { nom: 'Photographie', description: 'Reportage photo', prix: 1200, active: true, createdAt: isoNow() },
    { nom: 'Vidéo', description: 'Film + montage', prix: 1500, active: true, createdAt: isoNow() },
    { nom: 'DJ', description: 'Animation musicale', prix: 900, active: true, createdAt: isoNow() },
    { nom: 'Orchestre', description: 'Live band', prix: 1800, active: true, createdAt: isoNow() },
    { nom: 'Sécurité', description: 'Agents', prix: 700, active: true, createdAt: isoNow() },
  ];

  const batch = db.batch();
  const ids = [];
  for (const s of services) {
    const ref = db.collection('services').doc();
    ids.push(ref.id);
    batch.set(ref, { id: ref.id, ...s });
  }
  await batch.commit();
  console.log(`   ✅ services=${ids.length}`);
  return services;
}

// ==========================================
// 4) USERS AUTH + users/{uid} + staff/{uid}
// ==========================================
async function createAuthUser({ email, password, displayName }) {
  return auth.createUser({ email, password, displayName, emailVerified: true });
}

async function generateAdminUser() {
  console.log("👑 Création Admin (Auth + users)...");
  const email = "admin@gmail.com";
  const displayName = "Admin Principal";
  const user = await createAuthUser({ email, password: PASSWORD, displayName });

  await db.collection('users').doc(user.uid).set({
    id: user.uid,
    uid: user.uid,
    nom: displayName,
    email,
    role: 'ADMIN',
    active: true,
    createdAt: isoNow()
  });

  // Optionnel : visible aussi dans staff
  await db.collection('staff').doc(user.uid).set({
    id: user.uid,
    nom: displayName,
    email,
    telephone: '00000000',
    role: 'ADMIN',
    specialite: 'Admin',
    active: true,
    createdAt: isoNow(),
    rates: {}
  });

  console.log(`   ✅ Admin: ${email} uid=${user.uid}`);
  return user.uid;
}

async function generateStaffAndUsers(allSlotIdsForRates) {
  console.log(`👨‍🍳 Génération ${STAFF_COUNT} staff (Auth + staff + users)...`);

  const specialites = ['Serveur', 'Barman', 'Sécurité', 'Nettoyage', 'Manager', 'Hôtesse'];
  const staffUids = [];
  const batch = db.batch();

  for (let i = 0; i < STAFF_COUNT; i++) {
    const nom = faker.person.fullName();
    const email = `serveur${i + 1}@example.com`;
    const specialite = pick(specialites);

    const authUser = await createAuthUser({ email, password: PASSWORD, displayName: nom });
    const uid = authUser.uid;
    staffUids.push(uid);

    // rates pour chaque créneau configuré (ids uniques)
    const rates = {};
    for (const slotId of allSlotIdsForRates) {
      // petit bonus pour soir
      const isSoir = String(slotId).includes('soir');
      rates[slotId] = isSoir ? randInt(90, 180) : randInt(60, 140);
    }

    batch.set(db.collection('staff').doc(uid), {
      id: uid,
      nom: String(nom || 'Nom Inconnu'),
      email,
      telephone: faker.phone.number('########'),
      role: 'SERVER',
      specialite: String(specialite),
      active: true,
      createdAt: isoNow(),
      rates
    });

    batch.set(db.collection('users').doc(uid), {
      id: uid,
      uid,
      nom: String(nom || 'Nom Inconnu'),
      email,
      role: 'SERVER',
      active: true,
      createdAt: isoNow()
    });

    console.log(`   ✅ Staff: ${email} uid=${uid}`);
  }

  await batch.commit();
  return staffUids;
}

// ==========================================
// 5) CLIENTS (tous champs utiles)
// ==========================================
async function generateClients() {
  console.log(`🧑‍🤝‍🧑 Génération ${CLIENT_COUNT} clients (détails complets)...`);
  const batch = db.batch();
  const ids = [];

  for (let i = 0; i < CLIENT_COUNT; i++) {
    const ref = db.collection('clients').doc();
    ids.push(ref.id);

    const nom = faker.person.lastName();
    const prenom = faker.person.firstName();

    batch.set(ref, {
      id: ref.id,
      nom,
      prenom,
      cin: faker.string.numeric(8),
      dateCin: toDateOnly(addDays(new Date(), -randInt(200, 2000))),
      prenomMarie1: faker.person.firstName(),
      prenomMarie2: faker.person.firstName(),
      telephone: faker.phone.number('########'),
      email: faker.internet.email({ firstName: prenom, lastName: nom }),
      adresse: faker.location.streetAddress(),
      ville: faker.location.city(),
      pays: 'Tunisie',
      nationalite: 'Tunisienne',
      dateNaissance: toDateOnly(addDays(new Date(), -randInt(7000, 16000))),
      profession: faker.person.jobTitle(),
      notes: faker.lorem.sentence(),
      createdAt: isoNow()
    });
  }

  await batch.commit();
  console.log(`   ✅ clients=${ids.length}`);
  return ids;
}

// ==========================================
// 6) ÉQUIPES & PRESTATAIRES (collection: teams)
// ==========================================
async function generateTeams(serviceCatalog) {
  console.log(`👥 Génération ${TEAM_COUNT} équipes/prestataires (teams)...`);

  // Types attendus par Team model: ORCHESTRE | TRAITEUR | PHOTOGRAPHE | TROUPE | AUTRE
  const types = ['ORCHESTRE', 'TRAITEUR', 'PHOTOGRAPHE', 'TROUPE', 'AUTRE'];

  const batch = db.batch();
  const teamIds = [];

  for (let i = 0; i < TEAM_COUNT; i++) {
    const ref = db.collection('teams').doc();
    teamIds.push(ref.id);

    const type = pick(types);
    const nom = `${type} - ${faker.company.name()}`.replace(/\s+/g, ' ').trim();

    // services: on prend 2-4 services du catalogue
    const services = [];
    const howMany = randInt(2, 4);
    const pool = [...serviceCatalog];
    for (let k = 0; k < howMany; k++) {
      const s = pool.splice(randInt(0, pool.length - 1), 1)[0];
      services.push({ nom: s.nom, prix: Number(s.prix) || randInt(300, 2500) });
    }

    batch.set(ref, {
      id: ref.id,
      nom,
      chefEquipe: faker.person.fullName(),
      telephone: faker.phone.number('########'),
      type,
      services,
      active: true,
      createdAt: isoNow()
    });
  }

  await batch.commit();
  console.log(`   ✅ teams=${teamIds.length}`);
  return teamIds;
}

// ==========================================
// 7) PACKS (collection: packs) liés staff + teams
// ==========================================
async function generatePacks(teamIds, staffUids) {
  console.log("🎁 Génération packs (packs) liés aux teams & staff...");
  const batch = db.batch();
  const ids = [];

  const samples = [
    { nom: 'Pack Mariage Royal', description: 'Tout inclus pour un mariage de rêve', services: [{ nom: 'Traiteur VIP', prix: 5000 }, { nom: 'Décoration Salle', prix: 2000 }, { nom: 'Orchestre', prix: 1800 }], active: true },
    { nom: 'Pack Anniversaire', description: 'Animation + gâteau', services: [{ nom: 'DJ', prix: 900 }, { nom: 'Gâteau', prix: 400 }], active: true },
    { nom: 'Pack Entreprise', description: 'Cocktail + photo', services: [{ nom: 'Traiteur VIP', prix: 5000 }, { nom: 'Photographie', prix: 1200 }], active: true },
  ];

  for (const p of samples) {
    const ref = db.collection('packs').doc();
    ids.push(ref.id);

    const teamPick = teamIds.length ? [pick(teamIds)] : [];
    const staffPick = staffUids.length ? [pick(staffUids)] : [];

    batch.set(ref, {
      id: ref.id,
      nom: p.nom,
      description: p.description,
      active: p.active,
      services: p.services,
      teamIds: teamPick,
      staffIds: staffPick,
      createdAt: isoNow()
    });
  }

  await batch.commit();
  console.log(`   ✅ packs=${ids.length}`);
  return ids;
}

// ==========================================
// 8) RESERVATIONS (3 slots/jour + assignTeamIds + 20 divers)
// ==========================================
function statusPool() {
  // dans l’app tu as plusieurs statuts possibles; on mélange
  return ['PENDING', 'CONFIRMED', 'CANCELLED', 'COMPLETED'];
}

function legacySlotIdFromKey(key) {
  if (key === 'matin') return 'as_matin_2025';
  if (key === 'aprem') return 'as_aprem_2025';
  return 'as_soir_2025';
}

async function generateReservations(clientIds, staffUids, teamIds, packIds) {
  console.log("📅 Génération réservations (matin/aprem/soir) + 20 divers...");

  const batch = db.batch();
  const today = new Date();

  // Base: pour remplir le calendrier sur les 14 prochains jours
  const baseCount = 40; // un bon volume (en plus des 20 diverse)
  for (let i = 0; i < baseCount; i++) {
    const ref = db.collection('reservations').doc();
    const day = addDays(today, randInt(0, 14));
    const dateStr = toDateOnly(day);
    const slot = pick(DAY_SLOTS);
    const clientId = pick(clientIds);
    const staffId = pick(staffUids);

    const assignedTeamIds = teamIds.length && Math.random() < 0.6 ? [pick(teamIds)] : [];
    const packId = packIds.length && Math.random() < 0.4 ? pick(packIds) : null;

    const totalPrice = slot.basePrice + (assignedTeamIds.length ? randInt(400, 2500) : 0);

    batch.set(ref, {
      id: ref.id,
      clientId,
      clientName: 'Client Test',
      date: dateStr,                 // ✅ string YYYY-MM-DD (calendrier)
      startTime: slot.start,
      endTime: slot.end,

      // ✅ champs de slot (compat multi-UI)
      slotKey: slot.key,             // nouveau (pour debug)
      selectedSlotId: slot.key,      // model récent
      slotId: legacySlotIdFromKey(slot.key), // ancienne UI

      status: 'CONFIRMED',
      notes: faker.lorem.sentence(),
      totalPrice,
      advance: Math.random() < 0.3 ? Math.round(totalPrice * 0.2) : 0,

      assignedServerIds: [staffId],
      assignedTeamIds,
      assignedStaffIds: [staffId],   // compat éventuelle

      packId: packId || '',
      createdAt: isoNow()
    });
  }

  // + 20 réservations “diverses”
  for (let i = 0; i < EXTRA_DIVERSE_RESERVATIONS; i++) {
    const ref = db.collection('reservations').doc();
    const day = addDays(today, randInt(-10, 35)); // quelques-unes dans le passé récent
    const dateStr = toDateOnly(day);
    const slot = pick(DAY_SLOTS);
    const st = pick(statusPool());
    const clientId = pick(clientIds);

    // 1-2 staff
    const assignedServerIds = [];
    assignedServerIds.push(pick(staffUids));
    if (Math.random() < 0.25) assignedServerIds.push(pick(staffUids));

    // 0-2 teams
    const assignedTeamIds = [];
    if (teamIds.length && Math.random() < 0.7) assignedTeamIds.push(pick(teamIds));
    if (teamIds.length && Math.random() < 0.2) assignedTeamIds.push(pick(teamIds));

    const totalPrice = slot.basePrice
      + assignedTeamIds.length * randInt(600, 2200)
      + assignedServerIds.length * randInt(100, 400);

    batch.set(ref, {
      id: ref.id,
      clientId,
      clientName: 'Client Divers',
      date: dateStr,
      startTime: slot.start,
      endTime: slot.end,

      slotKey: slot.key,
      selectedSlotId: slot.key,
      slotId: legacySlotIdFromKey(slot.key),

      status: st,
      notes: faker.lorem.paragraph(),
      totalPrice,
      advance: st === 'CONFIRMED' ? randInt(0, Math.round(totalPrice * 0.4)) : 0,

      assignedServerIds,
      assignedTeamIds,
      createdAt: isoNow()
    });
  }

  await batch.commit();
  const snap = await db.collection('reservations').get();
  console.log(`   ✅ reservations=${snap.size}`);
}

// ==========================================
// MAIN
// ==========================================
async function run() {
  try {
    await clearAuthUsers();
    await clearDatabase();

    // Config (creneaux)
    await generateConfig();

    // Services
    const serviceCatalog = await generateServiceCatalog();

    // Admin
    await generateAdminUser();

    // pour rates staff: ids configurés
    const cfg = await db.collection('config').doc('general').get();
    const creneaux = (cfg.data()?.creneaux || []);
    const slotIds = creneaux.map(s => s.id).filter(Boolean);

    // Staff + users
    const staffUids = await generateStaffAndUsers(slotIds);

    // Clients
    const clientIds = await generateClients();

    // Teams/Prestataires
    const teamIds = await generateTeams(serviceCatalog);

    // Packs
    const packIds = await generatePacks(teamIds, staffUids);

    // Reservations (+20 divers)
    await generateReservations(clientIds, staffUids, teamIds, packIds);

    const usersSnap = await db.collection('users').get();
    const staffSnap = await db.collection('staff').get();
    const teamsSnap = await db.collection('teams').get();
    const servicesSnap = await db.collection('services').get();
    const packsSnap = await db.collection('packs').get();
    const resSnap = await db.collection('reservations').get();
    const clientsSnap = await db.collection('clients').get();

    console.log("\n✅ CHECK Firestore:");
    console.log(`   users=${usersSnap.size}`);
    console.log(`   staff=${staffSnap.size}`);
    console.log(`   clients=${clientsSnap.size}`);
    console.log(`   teams=${teamsSnap.size}`);
    console.log(`   services=${servicesSnap.size}`);
    console.log(`   packs=${packsSnap.size}`);
    console.log(`   reservations=${resSnap.size}`);

    console.log(`\n👉 Logins: admin@gmail.com / ${PASSWORD} | serveur1@example.com / ${PASSWORD}`);
    console.log("🎉 Seed terminé. Va sur http://localhost:4200/reservations");

    process.exit(0);
  } catch (e) {
    console.error("❌ Erreur seed:", e);
    process.exit(1);
  }
}

run();
