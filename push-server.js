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

// --- CORRECTION MAJEURE ICI (Basée sur votre script WhatsApp) ---
const CONFIG = {
  COLLECTION_USERS: "partenaire", // On remet 'partenaire' car c'est là que ça marche pour WhatsApp
  COLLECTION_RESERVATIONS: "reservations",
  COLLECTION_MESSAGES: "messages",
  FIELD_ARRAY_TOKENS: "fcmTokens",      
};

// Date de démarrage (-5 sec pour marge)
const SERVER_START_TIME = Date.now() - 5000;

// =============================================================================
// 3. HELPERS
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

  console.log(`🔍 Recherche tokens dans '${CONFIG.COLLECTION_USERS}' pour ${uniqueUids.length} ID(s)...`);

  for (const batchUids of userChunks) {
      try {
        const refs = batchUids.map(uid => db.collection(CONFIG.COLLECTION_USERS).doc(uid));
        const snaps = await db.getAll(...refs);
        
        snaps.forEach((snap) => {
           if(snap.exists) {
               const data = snap.data();
               const tokensSet = new Set();
               
               // 1. Tokens principaux
               if (Array.isArray(data[CONFIG.FIELD_ARRAY_TOKENS])) {
                   data[CONFIG.FIELD_ARRAY_TOKENS].forEach(t => tokensSet.add(t));
               }
               // 2. Compatibilité (vieux champ)
               if (data['lastfcmTokens']) tokensSet.add(data['lastfcmTokens']);

               // 3. Validation
               const validTokens = [];
               tokensSet.forEach(t => { if (t && t.length > 20) validTokens.push(t); });

               if (validTokens.length > 0) {
                   console.log(`   -> ✅ ${snap.id} : ${validTokens.length} token(s) trouvés.`);
                   validTokens.forEach(t => results.push(t));
               } else {
                   console.log(`   -> ⚠️  ${snap.id} trouvé, mais AUCUN token FCM.`);
               }
           } else {
               console.log(`   -> ❌ ${snap.id} introuvable dans '${CONFIG.COLLECTION_USERS}'.`);
           }
        });
      } catch (err) { console.error("Erreur lecture Firestore:", err.message); }
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
      console.log(`   🚀 PUSH RESULTAT : ${response.successCount} envoyé(s), ${response.failureCount} échec(s).`);
  } catch (error) { console.error("❌ Erreur FCM:", error.message); }
}

// =============================================================================
// 4. LISTENER RÉSERVATIONS
// =============================================================================

function startReservationsListener() {
  console.log("🎧 Écoute des Réservations...");

  db.collection(CONFIG.COLLECTION_RESERVATIONS).onSnapshot(async (snapshot) => {
      
      for (const change of snapshot.docChanges()) {
        const resData = change.doc.data();
        const resId = change.doc.id;

        if (change.type === 'removed') continue;

        // --- FILTRAGE DATE ---
        const itemDateStr = resData.updatedAt || resData.createdAt;
        let itemTime = 0;
        if (itemDateStr) itemTime = new Date(itemDateStr).getTime();
        
        if (itemTime < SERVER_START_TIME) continue;

        console.log(`⚡ Changement détecté : [${change.type.toUpperCase()}] ID: ${resId}`);

        // --- CIBLAGE (Logique Unifiée avec WhatsApp) ---
        const partnerIds = new Set();

        // 1. Via assignedServerIds (Comme le script WhatsApp)
        if (Array.isArray(resData.assignedServerIds)) {
            resData.assignedServerIds.forEach(uid => partnerIds.add(uid));
        }

        // 2. Via services.partenaireId (Sécurité supplémentaire)
        const extractPid = (s) => s.partenaireId || s.partnerId || s.uid;
        
        if (Array.isArray(resData.services)) {
            resData.services.forEach(s => { const pid = extractPid(s); if (pid) partnerIds.add(pid); });
        }
        if (resData.pack && Array.isArray(resData.pack.services)) {
            resData.pack.services.forEach(s => { const pid = extractPid(s); if (pid) partnerIds.add(pid); });
        }

        const pIds = Array.from(partnerIds);

        if (pIds.length === 0) {
            console.log("   -> 🔴 Aucun partenaire identifié (assignedServerIds ou services vides).");
            continue;
        }

        console.log(`   -> 🎯 Cibles identifiées : ${pIds.join(', ')}`);

        // --- MESSAGE ---
        let title = "";
        let body = "";

        if (change.type === 'added') {
            title = "🎉 Nouvelle Réservation";
            body = `Le ${resData.date || resData.dateDebut || 'Date inconnue'}`;
        }
        else if (change.type === 'modified') {
            if (resData.status === 'CANCELLED') {
                 title = "🚫 Réservation Annulée";
                 body = `Annulation du ${resData.date || ''}`;
            } else {
                 title = "📅 Modification Réservation";
                 body = `Mise à jour du ${resData.date || ''}`;
            }
        }

        // --- ENVOI ---
        if (title) {
            const tokens = await getUserTokensMap(pIds);
            if (tokens.length > 0) {
                await sendMulticast({ title, body, tokens });
            } else {
                console.log(`   -> ⚠️  Utilisateurs trouvés mais AUCUN token FCM disponible.`);
            }
        }
      }
  });
}

// =============================================================================
// 5. LISTENER CHAT
// =============================================================================

function startChatListener() {
    console.log("🎧 Écoute du Chat...");
    db.collection(CONFIG.COLLECTION_MESSAGES)
      .orderBy('createdAt', 'desc')
      .limit(20)
      .onSnapshot((snapshot) => {
        snapshot.docChanges().forEach(async (change) => {
            if (change.type === 'added') {
                const data = change.doc.data();
                if (!data.createdAt) return;
                
                let msgTime = data.createdAt.toMillis ? data.createdAt.toMillis() : new Date(data.createdAt).getTime();
                if (msgTime < SERVER_START_TIME) return;

                const receiverUid = data.receiverId;
                if (!receiverUid || data.notificationSent) return;

                await db.collection(CONFIG.COLLECTION_MESSAGES).doc(change.doc.id).update({ notificationSent: true }).catch(()=>{});

                const tokens = await getUserTokensMap([receiverUid]);
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

// START
console.log(`🚀 Serveur Push Démarré (Collection: ${CONFIG.COLLECTION_USERS})`);
startReservationsListener();
startChatListener();