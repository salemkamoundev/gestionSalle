const admin = require("firebase-admin");
const fs = require('fs');
const util = require('util');
const path = require('path');

// =============================================================================
// 0. PID LOCK
// =============================================================================
const PID_FILE = path.resolve(__dirname, 'server.pid');
function acquireLock() {
    try {
        if (fs.existsSync(PID_FILE)) {
            const oldPid = parseInt(fs.readFileSync(PID_FILE, 'utf8'));
            try { process.kill(oldPid, 0); try { process.kill(oldPid, 'SIGTERM'); } catch(e) {} } catch (e) {}
        }
        fs.writeFileSync(PID_FILE, process.pid.toString());
    } catch (err) {}
}
process.on('exit', () => { try { fs.unlinkSync(PID_FILE); } catch(e){} });
acquireLock();

// =============================================================================
// 1. INIT
// =============================================================================
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
    console.log("✅ Firebase Admin initialisé.");
} catch (e) { console.error("❌ ERREUR ServiceAccount"); process.exit(1); }

const db = admin.firestore();
const fcm = admin.messaging();
const CONFIG = { COLLECTION_USERS: "users", COLLECTION_RESERVATIONS: "reservations", COLLECTION_MESSAGES: "messages", FIELD_ARRAY_TOKENS: "fcmTokens" };
const SERVER_START_TIME = Date.now();

// =============================================================================
// 2. TOKEN HELPER (CORRIGÉ : SINGLE TOKEN ONLY)
// =============================================================================

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
               
               // --- MODIFICATION MAJEURE ICI ---
               // Au lieu de prendre tout le tableau, on ne prend QUE le dernier jeton actif
               // C'est ce qui va empêcher les doublons si l'historique est pollué.
               
               let tokenToUse = null;

               if (data['lastfcmTokens']) {
                   // Priorité 1 : Le champ explicite "Dernier Jeton"
                   tokenToUse = data['lastfcmTokens'];
               } else if (Array.isArray(data[CONFIG.FIELD_ARRAY_TOKENS]) && data[CONFIG.FIELD_ARRAY_TOKENS].length > 0) {
                   // Priorité 2 : Le dernier élément du tableau (souvent le plus récent)
                   const arr = data[CONFIG.FIELD_ARRAY_TOKENS];
                   tokenToUse = arr[arr.length - 1];
               }

               if (tokenToUse && tokenToUse.length > 20) {
                   results.push(tokenToUse);
               }
           }
        });
      } catch (err) { console.error("Erreur lecture tokens:", err.message); }
  }
  // On dédoublonne encore au cas où plusieurs users partagent le même token (rare mais possible)
  return [...new Set(results)];
}

async function sendMulticast({ title, body, tokens }) {
  if (!tokens || tokens.length === 0) return;
  
  // LOG DE DÉBOGAGE POUR VOIR COMBIEN DE TOKENS SONT VISÉS
  console.log(`   🎯 Envoi PUSH vers ${tokens.length} appareil(s)...`);
  
  const message = {
    notification: { title, body },
    android: { priority: "high" },
    webpush: { headers: { "Urgency": "high" }, notification: { title, body, icon: '/assets/icons/icon-192x192.png' } },
    tokens: tokens,
  };
  try { 
      const response = await fcm.sendEachForMulticast(message);
      console.log(`   🚀 Résultat : ${response.successCount} succès.`);
  } catch (error) { console.error("❌ Erreur FCM:", error.message); }
}

// =============================================================================
// 3. LISTENERS
// =============================================================================

function startReservationsListener() {
  console.log("🎧 Écoute Réservations...");
  db.collection(CONFIG.COLLECTION_RESERVATIONS).onSnapshot(async (snapshot) => {
      for (const change of snapshot.docChanges()) {
        if (change.type === 'removed') continue;
        const resData = change.doc.data();
        const resId = change.doc.id;
        
        if (resData.triggerPushTime && resData.triggerPushTime < SERVER_START_TIME) {
            if (resData.triggerPush !== false) await db.collection(CONFIG.COLLECTION_RESERVATIONS).doc(resId).update({ triggerPush: false }).catch(()=>{});
            continue;
        }
        if (!resData.triggerPushTime) continue;

        try {
            await db.runTransaction(async (t) => {
                const ref = db.collection(CONFIG.COLLECTION_RESERVATIONS).doc(resId);
                const doc = await t.get(ref);
                if (!doc.exists) throw "Missing";
                if (doc.data().triggerPush === false) throw "Done";
                t.update(ref, { triggerPush: false });
            });

            let title = "", body = "";
            const dateStr = resData.date || 'Date inconnue';
            if (change.type === 'added') { title = "🎉 Nouvelle Réservation"; body = `Vous avez une mission le ${dateStr}`; } 
            else if (resData.status === 'CANCELLED') { title = "🚫 Réservation Annulée"; body = `La réservation du ${dateStr} a été annulée.`; } 
            else continue;

            const partnerIds = new Set();
            if (Array.isArray(resData.assignedServerIds)) resData.assignedServerIds.forEach(uid => partnerIds.add(uid));
            const extractPid = (s) => s.partenaireId || s.partnerId || s.uid;
            if (Array.isArray(resData.services)) resData.services.forEach(s => { const pid = extractPid(s); if (pid) partnerIds.add(pid); });
            if (resData.pack && Array.isArray(resData.pack.services)) resData.pack.services.forEach(s => { const pid = extractPid(s); if (pid) partnerIds.add(pid); });

            const tokens = await getUserTokensMap(Array.from(partnerIds));
            if (tokens.length > 0) await sendMulticast({ title, body, tokens });

        } catch (e) { if(e!=="Done") console.error("Err Resa:", e); }
      }
  });
}

function startChatListener() {
    console.log("🎧 Écoute Chat...");
    db.collection(CONFIG.COLLECTION_MESSAGES).orderBy('createdAt', 'desc').limit(10).onSnapshot((snapshot) => {
        snapshot.docChanges().forEach(async (change) => {
            if (change.type === 'added') {
                const data = change.doc.data();
                const msgId = change.doc.id;
                if (!data.createdAt) return;
                let msgTime = data.createdAt.toMillis ? data.createdAt.toMillis() : new Date(data.createdAt).getTime();
                if (msgTime < SERVER_START_TIME) return;
                if (!data.receiverId || data.notificationSent) return;

                try {
                    await db.runTransaction(async (t) => {
                        const ref = db.collection(CONFIG.COLLECTION_MESSAGES).doc(msgId);
                        const doc = await t.get(ref);
                        if (!doc.exists) throw "Missing";
                        if (doc.data().notificationSent === true) throw "Done";
                        t.update(ref, { notificationSent: true });
                    });

                    console.log(`💬 MESSAGE CHAT UNIQUE: ${msgId}`);
                    // C'est ici que la magie opère : getUserTokensMap ne renverra qu'UN seul token
                    const tokens = await getUserTokensMap([data.receiverId]);
                    if (tokens.length > 0) {
                        await sendMulticast({ 
                            title: `Message de ${data.senderName || 'Client'}`, 
                            body: data.content || "Nouveau message", 
                            tokens 
                        });
                    }
                } catch (e) { if(e!=="Done") console.error("Err Chat:", e); }
            }
        });
    });
}

console.log(`🚀 Serveur Push (Mode SINGLE TOKEN)`);
startReservationsListener();
startChatListener();