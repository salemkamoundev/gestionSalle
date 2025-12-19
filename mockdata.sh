#!/usr/bin/env bash
set -euo pipefail

: "${FIREBASE_PROJECT_ID:=laprincesse-salledesfetes}"
: "${GOOGLE_APPLICATION_CREDENTIALS:=./serviceAccountKey.json}"

: "${ADMIN_EMAIL:=admin@gmail.com}"
: "${ADMIN_PASSWORD:=admin123456}"

# Volumes (tu peux encore augmenter)
: "${MOCK_CLIENTS:=400}"
: "${MOCK_SERVERS:=140}"            # ✅ staff = serveurs dans collection users
: "${MOCK_TEAMS:=70}"
: "${MOCK_RESERVATIONS:=400}"
: "${MOCK_PAYMENTS_MAX_PER_RES:=2}"

if [[ -z "${FIREBASE_PROJECT_ID}" ]]; then
  echo "❌ FIREBASE_PROJECT_ID est vide. Exemple: export FIREBASE_PROJECT_ID=\"mon-projet-id\""
  exit 1
fi

if [[ ! -f "${GOOGLE_APPLICATION_CREDENTIALS}" ]]; then
  echo "❌ Service account introuvable: ${GOOGLE_APPLICATION_CREDENTIALS}"
  exit 1
fi

if [[ ! -f package.json ]]; then
  echo "❌ package.json introuvable. Lance ce script à la racine du projet."
  exit 1
fi

mkdir -p scripts

echo "📦 Dépendances..."
npm i -D firebase-admin @faker-js/faker >/dev/null 2>&1 || true

cat > scripts/reset_and_seed_big_mock_data_v2.mjs <<'EOF'
import admin from "firebase-admin";
import { faker } from "@faker-js/faker";
import fs from "node:fs";

const PROJECT_ID = process.env.FIREBASE_PROJECT_ID;
const KEY_PATH = process.env.GOOGLE_APPLICATION_CREDENTIALS || "./serviceAccountKey.json";

const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || "admin@gmail.com").toLowerCase();
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "admin123456";

const N_CLIENTS = Number(process.env.MOCK_CLIENTS || 400);
const N_SERVERS = Number(process.env.MOCK_SERVERS || 140);
const N_TEAMS = Number(process.env.MOCK_TEAMS || 70);
const N_RES = Number(process.env.MOCK_RESERVATIONS || 1200);
const PAY_MAX = Number(process.env.MOCK_PAYMENTS_MAX_PER_RES || 5);

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
const onlyDigits = (s) => String(s || "").replace(/\D/g, "");
const randPhoneTN = () => pick(["2","4","5","9"]) + faker.string.numeric(7);
const randCin = () => faker.string.numeric(8);
const uidLike = (prefix) => `${prefix}_${faker.string.alphanumeric(22)}`;

// --------------------
// Slots (slotId=aprem etc.)
// --------------------
function makeSlots() {
  return [
    { id: "matin", label: "Matin", start: "08:00", end: "12:00", price: 600, validFrom: "2024-01-01", validTo: "2026-12-31" },
    { id: "aprem", label: "Après-midi", start: "13:00", end: "17:00", price: 900, validFrom: "2024-01-01", validTo: "2026-12-31" },
    { id: "soir",  label: "Soirée", start: "19:00", end: "02:00", price: 2500, validFrom: "2024-01-01", validTo: "2026-12-31" },
  ];
}

// --------------------
// Firestore wipe total (collections + sous-collections)
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
// Auth: keep ONLY admin@gmail.com
// --------------------
async function keepOnlyAdminAuthUser() {
  let adminUser = null;

  try {
    adminUser = await auth.getUserByEmail(ADMIN_EMAIL);
  } catch {}

  // delete all other auth users
  let nextPageToken = undefined;
  const toDelete = [];
  do {
    const res = await auth.listUsers(1000, nextPageToken);
    for (const u of res.users) {
      if ((u.email || "").toLowerCase() !== ADMIN_EMAIL) toDelete.push(u.uid);
    }
    nextPageToken = res.pageToken;
  } while (nextPageToken);

  for (let i = 0; i < toDelete.length; i += 1000) {
    await auth.deleteUsers(toDelete.slice(i, i + 1000));
  }

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
// MOCKS
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
    notes: faker.lorem.sentences({ min: 1, max: 2 }),
    telephoneDigits: onlyDigits(phone),
  };
}

// ✅ IMPORTANT: serveurs = docs dans collection "users"
function mkServerUser(slotIds) {
  const first = faker.person.firstName();
  const last = faker.person.lastName();
  const email = faker.internet.email({ firstName: first, lastName: last }).toLowerCase();
  const phone = randPhoneTN();

  const rates = {};
  for (const s of slotIds) rates[s] = faker.number.int({ min: 60, max: 280 });

  return {
    nom: `${first} ${last}`,
    email,
    telephone: phone,
    specialite: pick(["Serveur", "Barman", "Sécurité", "Accueil", "Responsable Salle"]),
    role: "SERVER",                 // ✅ ce que ton app compare
    active: true,
    createdAt: iso(faker.date.past({ years: 2 })),
    rates,
    notes: faker.lorem.words({ min: 5, max: 12 }),
    telephoneDigits: onlyDigits(phone),
  };
}

function mkAdminUser(authUser, slotIds) {
  const rates = {};
  for (const s of slotIds) rates[s] = faker.number.int({ min: 100, max: 350 });

  const phone = randPhoneTN();
  return {
    nom: "Admin",
    email: (authUser.email || ADMIN_EMAIL).toLowerCase(),
    telephone: phone,
    specialite: "Admin",
    role: "ADMIN",
    active: true,
    createdAt: iso(new Date()),
    rates,
    notes: "Compte administrateur",
    telephoneDigits: onlyDigits(phone),
  };
}

function mkTeam() {
  const type = pick(["ORCHESTRE", "TRAITEUR", "PHOTOGRAPHE", "TROUPE", "AUTRE"]);
  const phone = randPhoneTN();

  const members = Array.from({ length: faker.number.int({ min: 5, max: 14 }) }).map(() => ({
    nom: `${faker.person.firstName()} ${faker.person.lastName()}`,
    role: pick(["Chanteur", "Batteur", "Clavier", "DJ", "Chef", "Serveur", "Caméraman", "Danseur", "Technicien"]),
  }));

  // ✅ plusieurs services 4..10
  const services = Array.from({ length: faker.number.int({ min: 4, max: 10 }) }).map(() => ({
    nom: `${pick(["Pack", "Option", "Formule", "Service"])} ${faker.word.adjective()} ${faker.word.noun()}`,
    description: faker.lorem.sentences({ min: 1, max: 3 }),
    prix: faker.number.int({ min: 300, max: 18000 }),
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
    adresse: faker.location.streetAddress({ useFullAddress: true }),
    telephoneDigits: onlyDigits(phone),
  };
}

/**
 * ✅ Version modifiée:
 * - plus de génération aléatoire de date ici
 * - la date est imposée (string YYYY-MM-DD)
 * => permet 1 seule réservation par "case" (date + slotId)
 */
function mkReservation({ clientId, clientName, slot, serverIds, teamIds, date }) {
  const assignedServerIds = faker.helpers.arrayElements(
    serverIds,
    faker.number.int({ min: 1, max: Math.min(7, serverIds.length) })
  );
  const assignedTeamIds = faker.helpers.arrayElements(
    teamIds,
    faker.number.int({ min: 1, max: Math.min(5, teamIds.length) })
  );

  const status = pick(["CONFIRMED", "PENDING", "CANCELLED"]);
  const extra = faker.number.int({ min: 0, max: 9000 });
  const totalPrice = (slot.price || 0) + extra;

  return {
    clientId,
    clientName,
    date,                 // ✅ date imposée
    startTime: slot.start,
    endTime: slot.end,
    assignedServerIds,
    assignedTeamIds,
    selectedSlotId: slot.id,
    notes: faker.lorem.sentences({ min: 1, max: 4 }),
    status,
    totalPrice,
    advance: 0,             // recalculé via payments
    advanceOnly: true,
    createdAt: iso(faker.date.recent({ days: 240 })),
    reference: `RES-${faker.string.numeric(7)}`,
  };
}

function mkPayment(reservationId, remainingMax, createdByEmail) {
  const type = pick(["ESPECES", "CHEQUE", "VIREMENT"]);
  const amount = faker.number.int({ min: 50, max: Math.max(50, remainingMax) });

  const payDate = faker.date.recent({ days: 320 });
  const checkDate = faker.date.soon({ days: 90 });

  return {
    reservationId,
    type,
    amount,
    date: payDate.toISOString().slice(0, 10),
    checkDate: checkDate.toISOString().slice(0, 10),
    checkNumber: faker.string.numeric(8),
    receiptNumber: `RCP-${faker.string.numeric(6)}`,
    createdAt: iso(payDate),
    createdBy: (createdByEmail || ADMIN_EMAIL).toLowerCase(),
    notes: faker.lorem.words({ min: 4, max: 12 }),
  };
}

async function main() {
  console.log("🧨 1) Wipe Firestore (TOUT)...");
  await wipeFirestoreAll();

  console.log("🧹 2) Auth: ne garder QUE", ADMIN_EMAIL, "...");
  const adminUser = await keepOnlyAdminAuthUser();

  console.log("⚙️ 3) config/general (creneaux)...");
  const slots = makeSlots();
  await db.doc("config/general").set({ creneaux: slots }, { merge: false });
  const slotIds = slots.map(s => s.id);

  console.log("👑 4) Firestore users: admin + serveurs (staff)...");
  // admin docId = uid auth
  await db.doc(`users/${adminUser.uid}`).set(mkAdminUser(adminUser, slotIds), { merge: false });

  // serveurs: docs Firestore uniquement (PAS d'auth users)
  const serverIds = [];
  for (let i = 0; i < N_SERVERS; i++) {
    const id = uidLike("srv"); // doc id random
    await db.doc(`users/${id}`).set(mkServerUser(slotIds), { merge: false });
    serverIds.push(id);
  }

  console.log(`👥 5) clients (${N_CLIENTS})...`);
  const clients = [];
  for (let i = 0; i < N_CLIENTS; i++) {
    const ref = await db.collection("clients").add(mkClient());
    const snap = await ref.get();
    clients.push({ id: ref.id, data: snap.data() });
  }

  console.log(`🎭 6) teams (${N_TEAMS})...`);
  const teams = [];
  for (let i = 0; i < N_TEAMS; i++) {
    const ref = await db.collection("teams").add(mkTeam());
    teams.push({ id: ref.id });
  }
  const teamIds = teams.map(t => t.id);

  // ✅ 7) reservations: 1 réservation max par case (date + créneau)
  console.log(`📅 7) reservations (${N_RES}) (1 par case date+créneau)...`);

  const from = new Date(Date.now() - 1000 * 60 * 60 * 24 * 240);
  const to   = new Date(Date.now() + 1000 * 60 * 60 * 24 * 300);

  // construit toutes les dates (YYYY-MM-DD) entre from et to
  const allDates = [];
  for (let d = new Date(from); d <= to; d.setDate(d.getDate() + 1)) {
    allDates.push(d.toISOString().slice(0, 10));
  }

  // toutes les combinaisons possibles date × slots
  const allCases = [];
  for (const date of allDates) {
    for (const slot of slots) {
      allCases.push({ date, slot });
    }
  }

  const MAX_CASES = allCases.length;
  const target = Math.min(N_RES, MAX_CASES);

  faker.helpers.shuffle(allCases);
  const chosen = allCases.slice(0, target);

  const reservations = [];
  for (let i = 0; i < chosen.length; i++) {
    const { date, slot } = chosen[i];
    const c = pick(clients);

    const ref = await db.collection("reservations").add(
      mkReservation({
        clientId: c.id,
        clientName: `${c.data.prenom} ${c.data.nom}`,
        slot,
        serverIds,
        teamIds,
        date, // ✅ garantit unicité par case
      })
    );

    const snap = await ref.get();
    reservations.push({ id: ref.id, data: snap.data() });
  }

  console.log(`✅ ${reservations.length} réservations créées sur ${MAX_CASES} cases possibles.`);

  console.log("💰 8) payments (beaucoup) + maj advance...");
  const createdBy = ADMIN_EMAIL;

  for (const r of reservations) {
    const howMany = faker.number.int({ min: 1, max: PAY_MAX });
    let paid = 0;

    for (let i = 0; i < howMany; i++) {
      const remaining = Math.max(0, (r.data.totalPrice || 0) - paid);
      if (remaining <= 0) break;

      const p = mkPayment(r.id, Math.max(50, Math.floor(remaining)), createdBy);
      paid += Number(p.amount) || 0;
      await db.collection("payments").add(p);
    }

    await db.doc(`reservations/${r.id}`).set(
      { advance: paid, advanceOnly: true },
      { merge: true }
    );
  }

  console.log("✅ OK: reset + seed terminé");
  console.log("Auth: only", ADMIN_EMAIL);
  console.log("Firestore: users(admin+servers), clients, teams, reservations, payments, config/general");
}

main().catch((e) => {
  console.error("❌ Error:", e);
  process.exit(1);
});
EOF

echo "🚀 Exécution reset + seed v2..."
FIREBASE_PROJECT_ID="${FIREBASE_PROJECT_ID}" \
GOOGLE_APPLICATION_CREDENTIALS="${GOOGLE_APPLICATION_CREDENTIALS}" \
ADMIN_EMAIL="${ADMIN_EMAIL}" \
ADMIN_PASSWORD="${ADMIN_PASSWORD}" \
MOCK_CLIENTS="${MOCK_CLIENTS}" \
MOCK_SERVERS="${MOCK_SERVERS}" \
MOCK_TEAMS="${MOCK_TEAMS}" \
MOCK_RESERVATIONS="${MOCK_RESERVATIONS}" \
MOCK_PAYMENTS_MAX_PER_RES="${MOCK_PAYMENTS_MAX_PER_RES}" \
node scripts/reset_and_seed_big_mock_data_v2.mjs

echo "🎉 OK."
