const admin = require('firebase-admin');
const { fakerFR: faker } = require('@faker-js/faker');

const SERVICE_ACCOUNT = require('./serviceAccountKey.json');

// CONFIG
const RES_PER_EMPLOYEE = 2;

// Slots attendus par le calendrier (slotId)
const slots = [
  { slotId: 'matin', start: '08:00', end: '12:00' },
  { slotId: 'aprem', start: '13:00', end: '17:00' },
  { slotId: 'soir',  start: '19:00', end: '02:00' }
];

admin.initializeApp({
  credential: admin.credential.cert(SERVICE_ACCOUNT)
});

const db = admin.firestore();

function formatYMD(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function randomDateNearNow() {
  // On crée des dates proches (dans ±20 jours) pour que ça tombe dans des vues calendrier “réalistes”
  const base = new Date();
  const offset = faker.number.int({ min: -10, max: 20 });
  base.setDate(base.getDate() + offset);
  return base;
}

async function getServerUserIds() {
  // Le rôle stocké dans Firestore pour l'app est 'ADMIN' | 'SERVER' (voir AuthService) :contentReference[oaicite:4]{index=4}
  const snap = await db.collection('users').where('role', '==', 'SERVER').get();
  return snap.docs.map(d => d.id);
}

async function ensureSomeClients(minClients = 5) {
  const clientsSnap = await db.collection('clients').limit(minClients).get();
  if (!clientsSnap.empty) {
    return clientsSnap.docs.map(d => d.id);
  }

  // Si pas de clients, on en crée quelques-uns
  const created = [];
  const batch = db.batch();
  for (let i = 0; i < minClients; i++) {
    const ref = db.collection('clients').doc();
    created.push(ref.id);
    batch.set(ref, {
      id: ref.id,
      nom: faker.person.lastName(),
      prenom: faker.person.firstName(),
      cin: faker.string.numeric(8),
      dateCin: faker.date.past().toISOString().split('T')[0],
      telephone: faker.string.numeric(8),
      email: faker.internet.email(),
      adresse: faker.location.streetAddress(),
      createdAt: new Date().toISOString()
    });
  }
  await batch.commit();
  return created;
}

async function createReservationsForServers(serverUids, clientIds) {
  console.log(`👥 Serveurs trouvés: ${serverUids.length}`);

  if (serverUids.length === 0) {
    console.log("⚠️ Aucun user avec role=SERVER dans Firestore/users. Rien à faire.");
    return;
  }

  // Firestore batch limit = 500 opérations
  let batch = db.batch();
  let opCount = 0;

  const commitIfNeeded = async () => {
    if (opCount >= 450) {
      await batch.commit();
      batch = db.batch();
      opCount = 0;
    }
  };

  for (const uid of serverUids) {
    for (let i = 0; i < RES_PER_EMPLOYEE; i++) {
      const slot = faker.helpers.arrayElement(slots);
      const d = randomDateNearNow();
      const dateStr = formatYMD(d);

      const clientId = faker.helpers.arrayElement(clientIds);
      const total = faker.number.int({ min: 500, max: 3000 });

      const resRef = db.collection('reservations').doc();
      const payRef = db.collection('payments').doc();

      // IMPORTANT :
      // - my-planning filtre sur r.date === 'yyyy-MM-dd' et assignedServerIds.includes(uid) :contentReference[oaicite:5]{index=5}
      // - calendrier “global” filtre sur slotId :contentReference[oaicite:6]{index=6}
      // - modèle Reservation attend startTime/endTime/date string :contentReference[oaicite:7]{index=7}
      batch.set(resRef, {
        id: resRef.id,
        clientId,
        clientName: `Client ${faker.person.firstName()}`,
        date: dateStr,
        startTime: slot.start,
        endTime: slot.end,

        // Champs clés pour l’affichage staff
        assignedServerIds: [uid],

        // Champs clés pour l’affichage calendrier “slot”
        slotId: slot.slotId,

        // Compat (si d’autres écrans utilisent selectedSlotId)
        selectedSlotId: slot.slotId,

        status: 'CONFIRMED',
        totalPrice: total,
        advance: total,
        createdAt: new Date().toISOString()
      });
      opCount++;
      await commitIfNeeded();

      batch.set(payRef, {
        id: payRef.id,
        reservationId: resRef.id,
        amount: total,
        date: dateStr,
        type: 'ESPECES',
        createdAt: new Date().toISOString()
      });
      opCount++;
      await commitIfNeeded();
    }
  }

  if (opCount > 0) {
    await batch.commit();
  }
}

async function run() {
  try {
    console.log("🔎 Récupération des serveurs (users.role == SERVER)...");
    const serverUids = await getServerUserIds();

    console.log("🔎 Vérification/Création de clients...");
    const clientIds = await ensureSomeClients(8);

    console.log("📅 Création des réservations + paiements (2 par serveur)...");
    await createReservationsForServers(serverUids, clientIds);

    console.log("\n✅ OK : /my-planning devrait maintenant afficher les réservations des employés.");
    console.log("ℹ️ Rappel: l’écran staff filtre sur date == 'YYYY-MM-DD' + assignedServerIds.includes(uid).");
  } catch (e) {
    console.error("❌ Erreur:", e);
    process.exit(1);
  }
}

run();
