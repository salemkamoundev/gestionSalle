const admin = require("firebase-admin");
const fs = require('fs');
const util = require('util');

const LOG_FILE = './server.logs';
const logFileStream = fs.createWriteStream(LOG_FILE, { flags: 'a' });
const originalStdout = process.stdout.write.bind(process.stdout);
const originalStderr = process.stderr.write.bind(process.stderr);

function getTimestamp() { return new Date().toISOString().replace(/T/, ' ').replace(/\..+/, ''); }

console.log = function(...args) {
    const msg = util.format(...args) + '\n';
    logFileStream.write(`[${getTimestamp()}] [INFO] ${msg}`);
    originalStdout(msg);
};
console.error = function(...args) {
    const msg = util.format(...args) + '\n';
    logFileStream.write(`[${getTimestamp()}] [ERROR] ${msg}`);
    originalStderr(msg);
};

try {
    const serviceAccount = require("./serviceAccountKey.json");
    if (!admin.apps.length) admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
} catch (e) { process.exit(1); }

const db = admin.firestore();
const fcm = admin.messaging();

const CONFIG = {
  COLLECTION_USERS: "partenaire", 
  COLLECTION_RESERVATIONS: "reservations",
  COLLECTION_MESSAGES: "messages",
  FIELD_ARRAY_TOKENS: "fcmTokens",      
  FIELD_LAST_TOKEN: "lastfcmTokens"      
};

function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

async function getUserTokensMap(uids) {
  const uniqueUids = [...new Set((uids || []).filter(u => u && typeof u === 'string'))];
  if (uniqueUids.length === 0) return [];
  const results = []; 
  const userChunks = chunk(uniqueUids, 10); 
  for (const batchUids of userChunks) {
      try {
        const refs = batchUids.map(uid => db.collection(CONFIG.COLLECTION_USERS).doc(uid));
        const snaps = await db.getAll(...refs);
        snaps.forEach((snap) => {
           if(snap.exists) {
               const data = snap.data();
               const tokensSet = new Set();
               if (data[CONFIG.FIELD_LAST_TOKEN]) tokensSet.add(data[CONFIG.FIELD_LAST_TOKEN]);
               const tokenArray = data[CONFIG.FIELD_ARRAY_TOKENS];
               if (Array.isArray(tokenArray)) tokenArray.forEach(t => { if (t) tokensSet.add(t); });
               tokensSet.forEach(t => { if (t && t.length > 20) results.push({ uid: snap.id, token: t }); });
           }
        });
      } catch (err) { }
  }
  return results;
}

async function sendMulticast({ title, body, targets }) {
  if (!targets || targets.length === 0) return;
  const tokensList = targets.map(t => t.token);
  const uniqueTokens = [...new Set(tokensList)];
  const message = {
    notification: { title, body },
    android: { priority: "high" },
    webpush: { headers: { "Urgency": "high" }, notification: { title, body, icon: '/assets/icons/icon-192x192.png' } },
    tokens: uniqueTokens,
  };
  try { await fcm.sendEachForMulticast(message); } catch (error) { }
}

function startReservationsListener() {
  console.log("🎧 Écoute 'reservations' (Push)...");
  db.collection(CONFIG.COLLECTION_RESERVATIONS).onSnapshot(async (snapshot) => {
      for (const change of snapshot.docChanges()) {
        if (change.type === 'removed') continue;

        const resData = change.doc.data();
        const resId = change.doc.id;
        
        // 1. DÉTECTION SUPPRESSIONS (Via uidsToRemove)
        if (resData.uidsToRemove && Array.isArray(resData.uidsToRemove) && resData.uidsToRemove.length > 0) {
             console.log(`🚫 Push: Suppression détectée sur ${resId}`);
             const targets = await getUserTokensMap(resData.uidsToRemove);
             if (targets.length > 0) {
                 await sendMulticast({
                     title: "Annulation de Service ❌",
                     body: `Vous avez été retiré de la réservation du ${resData.date || ''}.`,
                     targets
                 });
             }
             // Le nettoyage est fait par le script WhatsApp (ou le premier qui passe), 
             // mais c'est safe de le faire ici aussi (idempotent)
             await db.collection(CONFIG.COLLECTION_RESERVATIONS).doc(resId).update({
                 uidsToRemove: admin.firestore.FieldValue.delete() 
             });
        }

        const lastNotif = resData.staffNotificationSentAt ? resData.staffNotificationSentAt.toMillis() : 0;
        if (Date.now() - lastNotif < 2000 && !resData.uidsToRemove) continue; 

        const assignedServers = Array.isArray(resData['assignedServerIds']) ? resData['assignedServerIds'] : [];

        // 2. ANNULATION
        if (resData.status === 'CANCELLED' && !resData.cancellationNotified) {
              await db.collection(CONFIG.COLLECTION_RESERVATIONS).doc(resId).update({ cancellationNotified: true });
              const targets = await getUserTokensMap(assignedServers);
              await sendMulticast({ title: "Mission Annulée ❌", body: `Réservation du ${resData.date} annulée.`, targets });
              continue;
        }

        if (resData.status === 'CANCELLED') continue;

        // 3. AFFECTATION
        const alreadyNotified = Array.isArray(resData['staffNotifiedUids']) ? resData['staffNotifiedUids'] : [];
        const newStaff = assignedServers.filter(uid => !alreadyNotified.includes(uid));
        
        if (newStaff.length > 0) {
            await db.collection(CONFIG.COLLECTION_RESERVATIONS).doc(resId).update({ 
                staffNotifiedUids: admin.firestore.FieldValue.arrayUnion(...newStaff), 
                staffNotificationSentAt: admin.firestore.FieldValue.serverTimestamp() 
            });
            const targets = await getUserTokensMap(newStaff);
            await sendMulticast({ title: "📅 Nouvelle Mission", body: `Ajouté sur le ${resData.date}.`, targets });
        }

        // 4. PACKS
        const currentPacks = Array.isArray(resData.packs) ? resData.packs : [];
        const notifiedPackIds = Array.isArray(resData.notifiedPackIds) ? resData.notifiedPackIds : [];
        const newPacks = currentPacks.filter(p => p && p.id && !notifiedPackIds.includes(p.id));

        if (newPacks.length > 0) {
             const packNames = newPacks.map(p => p.nom || p.name).join(', ');
             const newPackIds = newPacks.map(p => p.id);
             await db.collection(CONFIG.COLLECTION_RESERVATIONS).doc(resId).update({
                 notifiedPackIds: admin.firestore.FieldValue.arrayUnion(...newPackIds),
                 staffNotificationSentAt: admin.firestore.FieldValue.serverTimestamp()
             });
             const targets = await getUserTokensMap(assignedServers);
             await sendMulticast({ title: "📦 Nouveau Pack", body: `Ajout: ${packNames}`, targets });
        }
      }
  });
}

function startChatListener() {
  const startTimestamp = admin.firestore.Timestamp.now();
  db.collection(CONFIG.COLLECTION_MESSAGES).where('createdAt', '>', startTimestamp).onSnapshot((snapshot) => {
      snapshot.docChanges().forEach((change) => {
        if (change.type === 'added') {
            const msgId = change.doc.id;
            const data = change.doc.data();
            const receiverUid = data.receiverId;
            if (!receiverUid) return;
            setTimeout(async () => {
                const freshDoc = await db.collection(CONFIG.COLLECTION_MESSAGES).doc(msgId).get();
                if (!freshDoc.exists) return;
                const currentData = freshDoc.data();
                if (currentData.read === false && !currentData.notificationSent) {
                    await db.collection(CONFIG.COLLECTION_MESSAGES).doc(msgId).update({ notificationSent: true });
                    const targets = await getUserTokensMap([receiverUid]);
                    if (targets.length > 0) await sendMulticast({ title: "Nouveau Message", body: "Vous avez reçu un message.", targets });
                } 
            }, 5000);
        }
      });
  });
}

startReservationsListener();
startChatListener();
