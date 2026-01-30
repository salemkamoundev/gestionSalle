const admin = require("firebase-admin");
const fs = require('fs');
const util = require('util');

// =============================================================================
// 1. CONFIGURATION & LOGS
// =============================================================================

const LOG_FILE = './server.logs';
const logFileStream = fs.createWriteStream(LOG_FILE, { flags: 'a' });
const originalStdout = process.stdout.write.bind(process.stdout);
const originalStderr = process.stderr.write.bind(process.stderr);

function getTimestamp() { 
    return new Date().toISOString().replace(/T/, ' ').replace(/\..+/, ''); 
}

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

// =============================================================================
// 2. INITIALISATION FIREBASE
// =============================================================================

try {
    const serviceAccount = require("./serviceAccountKey.json");
    if (!admin.apps.length) {
        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount)
        });
    }
    console.log("✅ Firebase Admin initialisé.");
} catch (e) {
    console.error("❌ ERREUR : Impossible de charger serviceAccountKey.json");
    process.exit(1);
}

const db = admin.firestore();
const fcm = admin.messaging();

const CONFIG = {
  COLLECTION_USERS: "users", 
  COLLECTION_RESERVATIONS: "reservations",
  COLLECTION_MESSAGES: "messages",
  FIELD_ARRAY_TOKENS: "fcmTokens",      
};

// =============================================================================
// 3. SYSTÈME ANTI-DOUBLON (CACHE TIMESTAMP)
// =============================================================================

const processedTimestamps = new Map();

function shouldProcess(resId, triggerTime) {
    if (!triggerTime) return false; 
    const lastProcessed = processedTimestamps.get(resId);
    if (lastProcessed && triggerTime <= lastProcessed) return false;

    processedTimestamps.set(resId, triggerTime);
    setTimeout(() => {
        if (processedTimestamps.get(resId) === triggerTime) {
            processedTimestamps.delete(resId);
        }
    }, 5 * 60 * 1000);

    return true;
}

// =============================================================================
// 4. HELPERS
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
               const tokensSet = new Set();
               if (Array.isArray(data[CONFIG.FIELD_ARRAY_TOKENS])) {
                   data[CONFIG.FIELD_ARRAY_TOKENS].forEach(t => tokensSet.add(t));
               }
               if (data['lastfcmTokens']) tokensSet.add(data['lastfcmTokens']);

               const validTokens = [];
               tokensSet.forEach(t => { if (t && t.length > 20) validTokens.push(t); });

               if (validTokens.length > 0) validTokens.forEach(t => results.push(t));
           }
        });
      } catch (err) { console.error("Erreur lecture tokens:", err.message); }
  }
  return [...new Set(results)];
}

async function sendMulticast({ title, body, tokens }) {
  if (!tokens || tokens.length === 0) return;
  const message = {
    notification: { title, body },
    android: { priority: "high" },
    webpush: { 
        headers: { "Urgency": "high" }, 
        notification: { title, body, icon: '/assets/icons/icon-192x192.png' } 
    },
    tokens: tokens,
  };
  try { 
      const response = await fcm.sendEachForMulticast(message);
      console.log(`   🚀 PUSH ENVOYÉ : ${response.successCount} OK.`);
  } catch (error) { console.error("❌ Erreur FCM:", error.message); }
}

// =============================================================================
// 5. LISTENER RÉSERVATIONS
// =============================================================================

function startReservationsListener() {
  console.log("🎧 Écoute des Réservations (Mode 'Nouvelle/Annulation Only')...");

  db.collection(CONFIG.COLLECTION_RESERVATIONS).onSnapshot(async (snapshot) => {
      
      for (const change of snapshot.docChanges()) {
        if (change.type === 'removed') continue;

        const resData = change.doc.data();
        const resId = change.doc.id;
        const triggerTime = resData.triggerPushTime;

        if (!shouldProcess(resId, triggerTime)) continue;

        // --- DÉTERMINATION DU TYPE DE NOTIFICATION ---
        let title = "";
        let body = "";
        const dateStr = resData.date || resData.dateDebut || 'Date inconnue';

        if (change.type === 'added') {
            // 1. NOUVELLE RÉSERVATION -> OUI
            console.log(`⚡ [NOUVELLE] ID: ${resId}`);
            title = "🎉 Nouvelle Réservation";
            body = `Vous avez une mission le ${dateStr}`;

        } else if (resData.status === 'CANCELLED') {
            // 2. ANNULATION -> OUI
            console.log(`⚡ [ANNULATION] ID: ${resId}`);
            title = "🚫 Réservation Annulée";
            body = `La réservation du ${dateStr} a été annulée.`;

        } else {
            // 3. MODIFICATION -> NON (On ignore)
            console.log(`   -> 🔇 Modification ignorée sur demande (ID: ${resId})`);
            
            // On reset quand même le flag pour que le système reste propre
            await db.collection(CONFIG.COLLECTION_RESERVATIONS).doc(resId).update({ triggerPush: false }).catch(()=>{});
            continue; // ON ARRÊTE LÀ
        }

        // --- SUITE LOGIQUE (Seulement si Added ou Cancelled) ---
        
        // 1. CIBLAGE
        const partnerIds = new Set();
        if (Array.isArray(resData.assignedServerIds)) resData.assignedServerIds.forEach(uid => partnerIds.add(uid));
        const extractPid = (s) => s.partenaireId || s.partnerId || s.uid;
        if (Array.isArray(resData.services)) resData.services.forEach(s => { const pid = extractPid(s); if (pid) partnerIds.add(pid); });
        if (resData.pack && Array.isArray(resData.pack.services)) resData.pack.services.forEach(s => { const pid = extractPid(s); if (pid) partnerIds.add(pid); });

        const pIds = Array.from(partnerIds);

        if (pIds.length === 0) {
            console.log("   -> 🛑 Aucun partenaire à notifier.");
            continue;
        }

        // 2. ENVOI
        const tokens = await getUserTokensMap(pIds);
        if (tokens.length > 0) {
            await sendMulticast({ title, body, tokens });
        } else {
            console.log("   -> ⚠️  Pas de tokens trouvés.");
        }
        
        // Reset flag
        await db.collection(CONFIG.COLLECTION_RESERVATIONS).doc(resId).update({ triggerPush: false }).catch(()=>{});
      }
  });
}

// =============================================================================
// 6. LISTENER CHAT
// =============================================================================

function startChatListener() {
    console.log("🎧 Écoute du Chat...");
    const startTime = Date.now() - 5000;

    db.collection(CONFIG.COLLECTION_MESSAGES)
      .orderBy('createdAt', 'desc')
      .limit(10)
      .onSnapshot((snapshot) => {
        snapshot.docChanges().forEach(async (change) => {
            if (change.type === 'added') {
                const data = change.doc.data();
                if (!data.createdAt) return;
                
                let msgTime = data.createdAt.toMillis ? data.createdAt.toMillis() : new Date(data.createdAt).getTime();
                if (msgTime < startTime) return;

                if (!data.receiverId || data.notificationSent) return;

                await db.collection(CONFIG.COLLECTION_MESSAGES).doc(change.doc.id).update({ notificationSent: true }).catch(()=>{});

                const tokens = await getUserTokensMap([data.receiverId]);
                if (tokens.length > 0) {
                    await sendMulticast({ 
                        title: `Message de ${data.senderName || 'Client'}`, 
                        body: data.content || "Nouveau message", 
                        tokens 
                    });
                }
            }
        });
    });
}

console.log(`🚀 Serveur Push Démarré (Nouvelle/Annulation Only)`);
startReservationsListener();
startChatListener();