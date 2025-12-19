/* eslint-disable no-console */
const admin = require('firebase-admin');

const PROJECT_ID = process.env.FIREBASE_PROJECT_ID || 'laprincesse-salledesfetes';

function isoDate(d) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function firstDayOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}
function lastDayOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}

function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

// Delete an entire collection in batches
async function deleteCollection(db, colName, batchSize = 400) {
  const colRef = db.collection(colName);
  while (true) {
    const snap = await colRef.limit(batchSize).get();
    if (snap.empty) break;
    const batch = db.batch();
    snap.docs.forEach(doc => batch.delete(doc.ref));
    await batch.commit();
  }
}

(async () => {
  // Init admin
  if (!admin.apps.length) {
    admin.initializeApp({ projectId: PROJECT_ID });
  }
  const db = admin.firestore();

  // If emulator, admin SDK will route via FIRESTORE_EMULATOR_HOST automatically.
  console.log('==> Using projectId:', PROJECT_ID);
  console.log('==> FIRESTORE_EMULATOR_HOST:', process.env.FIRESTORE_EMULATOR_HOST || '(not set)');

  // 1) WIPE (keep list explicit)
  const collectionsToWipe = [
    'reservations',
    'clients',
    'payments',
    'teams',
    'users',
    'activity_logs',
    'config'
  ];

  console.log('==> Wiping collections:', collectionsToWipe.join(', '));
  for (const c of collectionsToWipe) {
    await deleteCollection(db, c);
  }

  // 2) SEED: 1 reservation per slot (matin/aprem/soir) for current month
  const now = new Date();
  const start = firstDayOfMonth(now);
  const end = lastDayOfMonth(now);

  const slots = [
    { key: 'matin', label: 'MATIN', startTime: '09:00', endTime: '12:00' },
    { key: 'aprem', label: 'APRES-MIDI', startTime: '14:00', endTime: '17:00' },
    { key: 'soir',  label: 'SOIR', startTime: '19:00', endTime: '23:00' },
  ];

  const docs = [];
  let idx = 1;

  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const dateStr = isoDate(d);
    for (const s of slots) {
      docs.push({
        clientId: `mock-client-${idx}`,
        clientName: `Client Mock ${idx} (${s.label})`,
        date: dateStr,
        startTime: s.startTime,
        endTime: s.endTime,
        selectedSlotId: s.key,
        status: 'CONFIRMED',
        totalPrice: 600,
        advance: 300,
        notes: `Mock: 1 réservation par case (${s.label})`,
        createdAt: new Date().toISOString()
      });
      idx++;
    }
  }

  console.log(`==> Seeding ${docs.length} reservations into 'reservations'...`);

  // Batch writes (Firestore batch limit: 500)
  const batches = chunk(docs, 450);
  for (const [i, part] of batches.entries()) {
    const batch = db.batch();
    part.forEach((data) => {
      const ref = db.collection('reservations').doc(); // auto id
      batch.set(ref, data);
    });
    await batch.commit();
    console.log(`   -> batch ${i + 1}/${batches.length} committed (${part.length} docs)`);
  }

  console.log('✅ Done.');
})().catch((e) => {
  console.error('❌ Seed failed:', e);
  process.exit(1);
});
