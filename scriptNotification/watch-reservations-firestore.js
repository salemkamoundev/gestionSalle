/**
 * Watch Firestore for new reservations and notify assigned employees via FCM.
 * Run: node watch-reservations-firestore.js
 */
import 'dotenv/config';
import admin from 'firebase-admin';

if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
  console.error('Missing GOOGLE_APPLICATION_CREDENTIALS in .env');
  process.exit(1);
}

admin.initializeApp({
  credential: admin.credential.applicationDefault(),
});

const db = admin.firestore();

const RES_COL = process.env.FIRESTORE_RESERVATIONS_COLLECTION || 'reservations';
const EMP_COL = process.env.FIRESTORE_EMPLOYEES_COLLECTION || 'employees';

// ⚠️ Pour éviter de renvoyer 2 fois si le script redémarre:
const processed = new Set(); // en prod: persister (Redis / Firestore / DB)

function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

async function getEmployeeTokens(employeeId) {
  const snap = await db.collection(EMP_COL).doc(employeeId).get();
  if (!snap.exists) return [];
  const data = snap.data() || {};
  const tokens = Array.isArray(data.fcmTokenss) ? data.fcmTokenss : [];
  return tokens.filter(Boolean);
}

async function sendToTokens(tokens, payload) {
  if (!tokens.length) return { successCount: 0, failureCount: 0 };

  // FCM impose des limites; multicast OK, et on chunk par sécurité
  let successCount = 0;
  let failureCount = 0;

  for (const part of chunk(tokens, 450)) {
    const res = await admin.messaging().sendEachForMulticast({
      tokens: part,
      notification: payload.notification,
      data: payload.data,
      android: payload.android,
      apns: payload.apns,
    });

    successCount += res.successCount;
    failureCount += res.failureCount;

    // Optionnel: nettoyage de tokens invalides
    res.responses.forEach((r, idx) => {
      if (!r.success) {
        const code = r.error?.code || '';
        if (
          code.includes('registration-token-not-registered') ||
          code.includes('invalid-argument')
        ) {
          console.warn('[FCM] Invalid token:', part[idx], code);
          // Ici tu peux supprimer le token de l’employé dans Firestore
        }
      }
    });
  }

  return { successCount, failureCount };
}

async function notifyAssignedEmployees(reservationId, reservation) {
  const employeeIds = Array.isArray(reservation.employees) ? reservation.employees : [];
  if (!employeeIds.length) return;

  // Exemple de contenu notification
  const title = 'Nouvelle réservation';
  const body =
    reservation.title
      ? `Vous êtes affecté à: ${reservation.title}`
      : `Vous êtes affecté à la réservation ${reservationId}`;

  // Récupère tous les tokens de tous les employés
  const tokensByEmployee = await Promise.all(
    employeeIds.map(async (empId) => [empId, await getEmployeeTokens(empId)])
  );

  for (const [empId, tokens] of tokensByEmployee) {
    if (!tokens.length) {
      console.log(`[SKIP] Aucun token pour employé=${empId}`);
      continue;
    }

    const payload = {
      notification: { title, body },
      data: {
        type: 'reservation_assigned',
        reservationId,
        employeeId: String(empId),
      },
    };

    const res = await sendToTokens(tokens, payload);
    console.log(
      `[SENT] reservation=${reservationId} -> employee=${empId} tokens=${tokens.length} ok=${res.successCount} fail=${res.failureCount}`
    );
  }
}

function startWatcher() {
  console.log(`👀 Watcher Firestore démarré sur collection "${RES_COL}"`);

  // Astuce: “uniquement les nouveaux” -> orderBy createdAt + startAt now
  // Mais si tu n’as pas createdAt, on gère avec `processed` + docChanges
  const unsubscribe = db.collection(RES_COL).onSnapshot(
    async (snap) => {
      const changes = snap.docChanges();

      for (const ch of changes) {
        if (ch.type !== 'added') continue;

        const doc = ch.doc;
        const reservationId = doc.id;
        if (processed.has(reservationId)) continue;
        processed.add(reservationId);

        const reservation = doc.data() || {};
        const hasEmployees = Array.isArray(reservation.employees) && reservation.employees.length > 0;

        if (!hasEmployees) {
          console.log(`[NEW] reservation=${reservationId} (no employees) -> skip`);
          continue;
        }

        console.log(`[NEW] reservation=${reservationId} employees=${reservation.employees.length}`);
        try {
          await notifyAssignedEmployees(reservationId, reservation);
        } catch (e) {
          console.error(`[ERR] notify reservation=${reservationId}`, e);
        }
      }
    },
    (err) => {
      console.error('🔥 Firestore watcher error:', err);
      process.exit(1);
    }
  );

  // fermeture propre
  process.on('SIGINT', () => {
    console.log('Stopping...');
    unsubscribe();
    process.exit(0);
  });
}

startWatcher();

