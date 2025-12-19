import admin from "firebase-admin";
import { faker } from "@faker-js/faker";
import fs from "node:fs";

const PROJECT_ID = process.env.FIREBASE_PROJECT_ID;
const KEY_PATH = process.env.GOOGLE_APPLICATION_CREDENTIALS || "./serviceAccountKey.json";
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "admin@gmail.com";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "admin123456";

const N_CLIENTS = Number(process.env.MOCK_CLIENTS || 250);
const N_STAFF = Number(process.env.MOCK_STAFF || 80);
const N_TEAMS = Number(process.env.MOCK_TEAMS || 45);
const N_RES = Number(process.env.MOCK_RESERVATIONS || 600);
const PAY_MAX = Number(process.env.MOCK_PAYMENTS_MAX_PER_RES || 4);

if (!PROJECT_ID) throw new Error("FIREBASE_PROJECT_ID manquant");
if (!fs.existsSync(KEY_PATH)) throw new Error(`Service account introuvable: ${KEY_PATH}`);

const key = JSON.parse(fs.readFileSync(KEY_PATH, "utf-8"));

admin.initializeApp({
  credential: admin.credential.cert(key),
  projectId: PROJECT_ID,
});

const db = admin.firestore();
const auth = admin.auth();

const iso = (d = new Date()) => new Date(d).toISOString();
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const uniqId = (prefix) => `${prefix}_${faker.string.alphanumeric(10).toLowerCase()}`;
const randPhoneTN = () => pick(["2","4","5","9"]) + faker.string.numeric(7);
const randCin = () => faker.string.numeric(8);
const onlyDigits = (s) => String(s || "").replace(/\D/g, "");

function makeSlots() {
  // Slots stables: garde l'idée slotId=aprem etc. Si ton app utilise d'autres ids,
  // remplace ici sans toucher le reste.
  return [
    { id: "matin", label: "Matin", start: "08:00", end: "12:00", price: 600, validFrom: "2024-01-01", validTo: "2026-12-31" },
    { id: "aprem", label: "Après-midi", start: "13:00", end: "17:00", price: 900, validFrom: "2024-01-01", validTo: "2026-12-31" },
    { id: "soir",  label: "Soirée", start: "19:00", end: "02:00", price: 2500, validFrom: "2024-01-01", validTo: "2026-12-31" },
  ];
}

// --------------------
// FIRESTORE: delete EVERYTHING (collections + sous-collections)
// --------------------
async function deleteDocumentRecursive(docRef) {
  const subcols = await docRef.listCollections();
  for (const sub of subcols) {
    const subSnap = await sub.get();
    for (const subDoc of subSnap.docs) {
      await deleteDocumentRecursive(subDoc.ref);
    }
  }
  await docRef.delete();
}

async function clearCollectionRecursive(colRef) {
  const snap = await colRef.get();
  if (snap.empty) return;

  // delete docs recursively (safe)
  for (const doc of snap.docs) {
    await deleteDocumentRecursive(doc.ref);
  }
}

async function wipeFirestoreAll() {
  const cols = await db.listCollections();
  for (const col of cols) {
    await clearCollectionRecursive(col);
  }
}

// --------------------
// AUTH: keep only admin@gmail.com
// --------------------
async function keepOnlyAdminAuthUser() {
  let adminUser = null;

  // 1) find admin user if exists
  try {
    adminUser = await auth.getUserByEmail(ADMIN_EMAIL);
  } catch (e) {
    adminUser = null;
  }

  // 2) delete all other users
  let nextPageToken = undefined;
  const toDelete = [];
  do {
    const res = await auth.listUsers(1000, nextPageToken);
    for (const u of res.users) {
      if ((u.email || "").toLowerCase() !== ADMIN_EMAIL.toLowerCase()) {
        toDelete.push(u.uid);
      }
    }
    nextPageToken = res.pageToken;
  } while (nextPageToken);

  // batch delete (up to 1000 per call)
  for (let i = 0; i < toDelete.length; i += 1000) {
    const chunk = toDelete.slice(i, i + 1000);
    await auth.deleteUsers(chunk);
  }

  // 3) create admin if missing
  if (!adminUser) {
    adminUser = await auth.createUser({
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD,
      emailVerified: true,
      displayName: "Admin",
      disabled: false,
    });
  }

  return adminUser;
}

// --------------------
// MOCK MODELS
// --------------------
function mkClient() {
  const prenom = faker.person.firstName();
  const nom = faker.person.lastName();
  const issued = faker.date.past({ years: 8 });
  const phone = randPhoneTN();

  return {
    nom,
    prenom,
    cin: randCin(),
    dateCin: faker.date.between({ from: issued, to: new Date() }).toISOString().slice(0, 10),
    prenomMarie1: faker.person.firstName(),
    prenomMarie2: faker.person.firstName(),
    telephone: phone,
    email: faker.internet.email({ firstName: prenom, lastName: nom }).toLowerCase(),
    adresse: faker.location.streetAddress({ useFullAddress: true }),
    createdAt: iso(faker.date.past({ years: 2 })),
    // champs “bonus” (si ton app ignore, c’est OK)
    notes: faker.lorem.sentence(),
    telephoneDigits: onlyDigits(phone),
  };
}

function mkStaff(slotIds) {
  const fullName = `${faker.person.firstName()} ${faker.person.lastName()}`;
  const email = faker.internet.email().toLowerCase();
  const phone = randPhoneTN();

  // rates complets pour chaque slot
  const rates = {};
  for (const s of slotIds) rates[s] = faker.number.int({ min: 60, max: 260 });

  return {
    nom: fullName,
    email,
    telephone: phone,
    specialite: pick(["Serveur", "Barman", "Sécurité", "Accueil", "Responsable Salle"]),
    role: pick(["ADMIN", "SERVER"]),
    active: true,
    createdAt: iso(faker.date.past({ years: 2 })),
    rates,
    // bonus
    notes: faker.lorem.words({ min: 4, max: 10 }),
    phoneDigits: onlyDigits(phone),
  };
}

function mkTeam() {
  const type = pick(["ORCHESTRE", "TRAITEUR", "PHOTOGRAPHE", "TROUPE", "AUTRE"]);
  const phone = randPhoneTN();

  const members = Array.from({ length: faker.number.int({ min: 4, max: 12 }) }).map(() => ({
    nom: `${faker.person.firstName()} ${faker.person.lastName()}`,
    role: pick(["Chanteur", "Batteur", "Clavier", "DJ", "Chef", "Serveur", "Caméraman", "Danseur", "Technicien"]),
  }));

  // ✅ plusieurs services: 3..8
  const services = Array.from({ length: faker.number.int({ min: 3, max: 8 }) }).map(() => ({
    nom: `${pick(["Pack", "Option", "Formule", "Service"])} ${faker.word.adjective()} ${faker.word.noun()}`,
    description: faker.lorem.sentences({ min: 1, max: 2 }),
    prix: faker.number.int({ min: 250, max: 12000 }),
    // bonus
    duree: pick(["2h", "3h", "4h", "soirée", "journée"]),
  }));

  return {
    nom: `${type} - ${faker.company.name()}`,
    type,
    chefEquipe: `${faker.person.firstName()} ${faker.person.lastName()}`,
    telephone: phone,
    active: true,
    createdAt: iso(faker.date.past({ years: 2 })),
    members,
    services,
    // bonus
    phoneDigits: onlyDigits(phone),
    adresse: faker.location.streetAddress({ useFullAddress: true }),
  };
}

function mkReservation({ clientId, clientName, slot, staffIds, teamIds }) {
  const d = faker.date.between({
    from: new Date(Date.now() - 1000 * 60 * 60 * 24 * 200),
    to: new Date(Date.now() + 1000 * 60 * 60 * 24 * 250),
  });
  const date = d.toISOString().slice(0, 10);

  const assignedServerIds = faker.helpers.arrayElements(staffIds, faker.number.int({ min: 1, max: Math.min(6, staffIds.length) }));
  const assignedTeamIds = faker.helpers.arrayElements(teamIds, faker.number.int({ min: 1, max: Math.min(4, teamIds.length) }));

  const status = pick(["CONFIRMED", "PENDING", "CANCELLED"]);
  const extra = faker.number.int({ min: 0, max: 6000 });
  const totalPrice = (slot.price || 0) + extra;

  return {
    clientId,
    clientName,
    date,
    startTime: slot.start,
    endTime: slot.end,
    assignedServerIds,
    assignedTeamIds,
    selectedSlotId: slot.id,
    notes: faker.lorem.sentences({ min: 1, max: 3 }),
    status,
    totalPrice,
    advance: 0,              // recalculé via paiements
    advanceOnly: true,       // cohérent avec ton code
    createdAt: iso(faker.date.recent({ days: 200 })),
    // bonus
    reference: `RES-${faker.string.numeric(7)}`,
  };
}

function mkPayment(reservationId, remainingMax, createdByEmail) {
  const type = pick(["ESPECES", "CHEQUE", "VIREMENT"]);
  const amount = faker.number.int({ min: 50, max: Math.max(50, remainingMax) });

  const payDate = faker.date.recent({ days: 240 });
  const checkDate = faker.date.soon({ days: 60 });

  return {
    reservationId,
    type,
    amount,
    date: payDate.toISOString().slice(0, 10),
    checkDate: checkDate.toISOString().slice(0, 10),      // rempli même si pas chèque
    checkNumber: faker.string.numeric(8),                 // rempli
    receiptNumber: `RCP-${faker.string.numeric(6)}`,
    createdAt: iso(payDate),
    createdBy: (createdByEmail || faker.internet.email()).toLowerCase(),
    // bonus
    notes: faker.lorem.words({ min: 3, max: 10 }),
  };
}

function mkAdminUserProfile(authUser) {
  const now = new Date();
  return {
    uid: authUser.uid,
    id: "admin",
    email: (authUser.email || "admin@gmail.com").toLowerCase(),
    displayName: authUser.displayName || "Admin",
    firstName: "Admin",
    lastName: "User",
    nom: "Admin",
    role: "super_admin",
    phone: randPhoneTN(),
    telephone: randPhoneTN(),
    specialite: "Admin",
    active: true,
    createdAt: now,
  };
}

async function main() {
  console.log("🧨 1) Wipe Firestore (TOUT)...");
  await wipeFirestoreAll();

  console.log("🧹 2) Firebase Auth: ne garder QUE", ADMIN_EMAIL, "...");
  const adminUser = await keepOnlyAdminAuthUser();

  console.log("⚙️ 3) Seed config/general (creneaux/slots)...");
  const slots = makeSlots();
  await db.doc("config/general").set({ creneaux: slots }, { merge: false });
  const slotIds = slots.map(s => s.id);

  console.log("👑 4) Seed Firestore users: seulement l'admin...");
  await db.doc(`users/${adminUser.uid}`).set(mkAdminUserProfile(adminUser), { merge: false });

  console.log(`👥 5) Seed clients (${N_CLIENTS})...`);
  const clientRefs = [];
  for (let i = 0; i < N_CLIENTS; i++) {
    const data = mkClient();
    const ref = await db.collection("clients").add(data);
    clientRefs.push({ id: ref.id, data });
  }

  console.log(`🧑‍🍳 6) Seed staff/serveurs (${N_STAFF})...`);
  const staffRefs = [];
  for (let i = 0; i < N_STAFF; i++) {
    const data = mkStaff(slotIds);
    const ref = await db.collection("staff").add(data);
    staffRefs.push({ id: ref.id, data });
  }

  console.log(`🎭 7) Seed teams (Équipes & Prestataires) (${N_TEAMS})...`);
  const teamRefs = [];
  for (let i = 0; i < N_TEAMS; i++) {
    const data = mkTeam();
    const ref = await db.collection("teams").add(data);
    teamRefs.push({ id: ref.id, data });
  }

  console.log(`📅 8) Seed reservations (${N_RES})...`);
  const reservationRefs = [];
  for (let i = 0; i < N_RES; i++) {
    const c = pick(clientRefs);
    const slot = pick(slots);

    const data = mkReservation({
      clientId: c.id,
      clientName: `${c.data.prenom} ${c.data.nom}`,
      slot,
      staffIds: staffRefs.map(s => s.id),
      teamIds: teamRefs.map(t => t.id),
    });

    const ref = await db.collection("reservations").add(data);
    reservationRefs.push({ id: ref.id, data });
  }

  console.log("💰 9) Seed payments (beaucoup) + mise à jour advance...");
  const adminEmail = (adminUser.email || ADMIN_EMAIL).toLowerCase();

  for (const r of reservationRefs) {
    const howMany = faker.number.int({ min: 1, max: PAY_MAX }); // >=1 pour avoir des payments visibles
    let paid = 0;

    for (let i = 0; i < howMany; i++) {
      const remaining = Math.max(0, (r.data.totalPrice || 0) - paid);
      if (remaining <= 0) break;

      const p = mkPayment(r.id, Math.max(50, Math.floor(remaining)), adminEmail);
      paid += Number(p.amount) || 0;
      await db.collection("payments").add(p);
    }

    await db.doc(`reservations/${r.id}`).set(
      { advance: paid, advanceOnly: true },
      { merge: true }
    );
  }

  console.log("✅ Terminé.");
  console.log("Firestore rempli: config/general, users(ADMIN only), clients, staff, teams, reservations, payments");
  console.log("Auth: only", ADMIN_EMAIL);
}

main().catch((e) => {
  console.error("❌ Error:", e);
  process.exit(1);
});
