#!/bin/bash

echo "Génération des scripts (Correction Doubles Notifs + Services)..."

# ============================================================
# 1. SCRIPT PUSH NOTIFICATIONS (push-server.js)
# ============================================================
cat > push-server.js << 'EOF'
const admin = require("firebase-admin");
const fs = require('fs');
const util = require('util');

// --- CONFIGURATION LOGS ---
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

// --- INIT FIREBASE ---
try {
    const serviceAccount = require("./serviceAccountKey.json");
    if (!admin.apps.length) {
        admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
    }
} catch (e) {
    console.error("CRASH: serviceAccountKey.json manquant ou invalide.", e);
    process.exit(1);
}

const db = admin.firestore();
const fcm = admin.messaging();

// ==========================================
// 🔧 CONFIGURATION
// ==========================================
const CONFIG = {
  COLLECTION_USERS: "users", 
  COLLECTION_RESERVATIONS: "reservations",
  COLLECTION_MESSAGES: "messages",
  
  FIELD_ARRAY_TOKENS: "fcmTokens",      
  FIELD_LAST_TOKEN: "lastfcmTokens"      
};

// --- MÉMOIRES ---
const contentCache = new Map();   // Pour comparer le contenu (avant/après)
const localDebounce = new Map();  // Pour éviter l'auto-déclenchement (Anti-Doublon)

console.log(`🚀 SERVICE PUSH DÉMARRÉ (Anti-Doublon Activé)`);

// --- UTILITAIRES ---
function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

// --- RÉCUPÉRATION DES TOKENS ---
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
               const uid = snap.id;
               const tokensSet = new Set();
               if (data[CONFIG.FIELD_LAST_TOKEN] && typeof data[CONFIG.FIELD_LAST_TOKEN] === 'string') tokensSet.add(data[CONFIG.FIELD_LAST_TOKEN]);
               const tokenArray = data[CONFIG.FIELD_ARRAY_TOKENS];
               if (Array.isArray(tokenArray)) tokenArray.forEach(t => { if (t) tokensSet.add(t); });
               tokensSet.forEach(t => { if (t && t.length > 20) results.push({ uid, token: t }); });
           }
        });
      } catch (err) { console.error("❌ Erreur lecture tokens:", err.message); }
  }
  return results;
}

async function removeDeadToken(uid, token) {
    try {
        await db.collection(CONFIG.COLLECTION_USERS).doc(uid).update({
            [CONFIG.FIELD_ARRAY_TOKENS]: admin.firestore.FieldValue.arrayRemove(token)
        });
    } catch (e) { console.error(`Erreur nettoyage ${uid}:`, e.message); }
}

async function saveToHistory(uid, title, body, data) {
    try {
        await db.collection(CONFIG.COLLECTION_USERS).doc(uid).collection('notifications').add({
            title, body, data: data || {}, read: false, type: data.type || 'general',
            createdAt: admin.firestore.FieldValue.serverTimestamp()
        });
    } catch (e) { console.error(`❌ Échec sauvegarde historique ${uid}:`, e.message); }
}

async function sendMulticast({ title, body, data, targets }) {
  if (!targets || targets.length === 0) return;
  const uniqueUids = [...new Set(targets.map(t => t.uid))];
  uniqueUids.forEach(uid => saveToHistory(uid, title, body, data));

  const tokensList = targets.map(t => t.token);
  const message = {
    notification: { title, body },
    data: Object.fromEntries(Object.entries(data || {}).map(([k, v]) => [k, String(v)])),
    android: { priority: "high" },
    webpush: { headers: { "Urgency": "high" }, notification: { title, body, icon: '/assets/icons/icon-192x192.png', requireInteraction: true } },
    tokens: tokensList,
  };
  try {
      const response = await fcm.sendEachForMulticast(message);
      if (response.failureCount > 0) {
          const cleanupPromises = [];
          response.responses.forEach((resp, idx) => {
              if (!resp.success) {
                  const error = resp.error;
                  const badTarget = targets[idx];
                  if (error.code === 'messaging/registration-token-not-registered' || error.code === 'messaging/invalid-argument') {
                      cleanupPromises.push(removeDeadToken(badTarget.uid, badTarget.token));
                  }
              }
          });
          if (cleanupPromises.length > 0) await Promise.all(cleanupPromises);
      } else { console.log(`✅ Push envoyé : "${title}" à ${response.successCount} appareils.`); }
  } catch (error) { console.error("❌ Erreur Critique FCM:", error); }
}

// --- LISTENERS ---

function startReservationsListener() {
  console.log("🎧 Écoute active sur 'reservations'...");
  
  db.collection(CONFIG.COLLECTION_RESERVATIONS).onSnapshot(async (snapshot) => {
      for (const change of snapshot.docChanges()) {
        const resId = change.doc.id;
        
        if (change.type === 'removed') {
            contentCache.delete(resId);
            localDebounce.delete(resId);
            continue;
        }

        // 1. VERROU LOCAL (Anti-Doublon Strict)
        // Si on a traité ce document il y a moins de 3s, on ignore (c'est probablement notre propre mise à jour)
        const lastRun = localDebounce.get(resId) || 0;
        if (Date.now() - lastRun < 3000) continue;

        const resData = change.doc.data();
        const rawSlot = resData.slotId || resData.creneau;
        const assignedServers = Array.isArray(resData['assignedServerIds']) ? resData['assignedServerIds'] : [];
        const slotLabel = rawSlot ? String(rawSlot).charAt(0).toUpperCase() + String(rawSlot).slice(1) : 'Non spécifié';
        
        // --- DONNEES POUR SIGNATURE ---
        const currentPacks = Array.isArray(resData.packs) ? resData.packs : [];
        const currentPackIds = currentPacks.map(p => p.id).sort();
        const currentServices = Array.isArray(resData.services) ? resData.services : [];
        const currentServiceIds = currentServices.map(s => s.id).sort();

        // Signature
        const contentSignature = JSON.stringify({
            d: resData.date,
            s: rawSlot,
            u: [...assignedServers].sort(),
            p: currentPackIds,
            sv: currentServiceIds
        });

        if (change.type === 'added') {
            contentCache.set(resId, contentSignature);
        }

        // Check annulation traitée
        if (resData.status === 'CANCELLED' && resData.cancellationNotified) continue;

        // =========================================================
        // CAS 1 : ANNULATION
        // =========================================================
        if (resData.status === 'CANCELLED') {
              console.log(`🚫 Annulation détectée : ${resId}`);
              
              // Verrouillage immédiat
              localDebounce.set(resId, Date.now()); 

              await db.collection(CONFIG.COLLECTION_RESERVATIONS).doc(resId).update({ 
                  cancellationNotified: true, 
                  staffNotificationSentAt: admin.firestore.FieldValue.serverTimestamp() 
              });

              if (assignedServers.length > 0) {
                  const targets = await getUserTokensMap(assignedServers);
                  await sendMulticast({ 
                      title: "Mission Annulée ❌", 
                      body: `La réservation du ${resData.date || 'date inconnue'} (${slotLabel}) a été annulée.`, 
                      targets, 
                      data: { reservationId: resId, type: 'reservation_cancelled' } 
                  });
              }
              continue; 
        }

        // =========================================================
        // CAS 2 : NOUVELLE AFFECTATION (Partenaire ajouté)
        // =========================================================
        const alreadyNotified = Array.isArray(resData['staffNotifiedUids']) ? resData['staffNotifiedUids'] : [];
        const newStaff = assignedServers.filter(uid => !alreadyNotified.includes(uid));
        
        if (newStaff.length > 0) {
            console.log(`✨ Nouvelle affectation (${newStaff.length}) sur ${resId}`);
            localDebounce.set(resId, Date.now()); // Verrouillage

            await db.collection(CONFIG.COLLECTION_RESERVATIONS).doc(resId).update({ 
                staffNotifiedUids: admin.firestore.FieldValue.arrayUnion(...newStaff), 
                staffNotificationSentAt: admin.firestore.FieldValue.serverTimestamp() 
            });
            const targets = await getUserTokensMap(newStaff);
            await sendMulticast({ 
                title: "📅 Nouvelle Mission", 
                body: `Vous avez été ajouté à une réservation le ${resData.date || ''}.\nCréneau: ${slotLabel}`, 
                targets, 
                data: { reservationId: resId, type: 'reservation_assigned' } 
            });
            contentCache.set(resId, contentSignature); 
            continue;
        }

        // =========================================================
        // CAS 3 : MODIFICATIONS (Ajout/Retrait Services, Packs, Users)
        // =========================================================
        const previousSignature = contentCache.get(resId);
        
        if (change.type === 'modified' && previousSignature) {
            const prevData = JSON.parse(previousSignature);
            
            // --- A. PARTENAIRE RETIRÉ ---
            const prevUsers = prevData.u || [];
            const removedUsers = prevUsers.filter(uid => !assignedServers.includes(uid));

            if (removedUsers.length > 0) {
                console.log(`👋 Partenaire désélectionné sur ${resId}`);
                localDebounce.set(resId, Date.now()); // Verrouillage

                await db.collection(CONFIG.COLLECTION_RESERVATIONS).doc(resId).update({ 
                    staffNotificationSentAt: admin.firestore.FieldValue.serverTimestamp() 
                });
                const targets = await getUserTokensMap(removedUsers);
                await sendMulticast({ 
                    title: "Mission Retirée 🚫", 
                    body: `Vous n'êtes plus affecté à la réservation du ${resData.date || ''}.`, 
                    targets, 
                    data: { reservationId: resId, type: 'reservation_removed' } 
                });
                contentCache.set(resId, contentSignature);
            }

            // --- B. PACK OU SERVICE RETIRÉ -> "Mission Retirée" ---
            const prevPackIds = prevData.p || [];
            const prevServiceIds = prevData.sv || [];
            
            const currentPackSet = new Set(currentPackIds);
            const currentServiceSet = new Set(currentServiceIds);

            const hasPackRemoved = prevPackIds.some(id => !currentPackSet.has(id));
            const hasServiceRemoved = prevServiceIds.some(id => !currentServiceSet.has(id));

            if (hasPackRemoved || hasServiceRemoved) {
                const cause = hasServiceRemoved ? "service" : "pack";
                console.log(`🗑️ ${cause} retiré sur ${resId} -> Envoi 'Mission Retirée'`);
                localDebounce.set(resId, Date.now()); // Verrouillage

                await db.collection(CONFIG.COLLECTION_RESERVATIONS).doc(resId).update({ 
                    staffNotificationSentAt: admin.firestore.FieldValue.serverTimestamp() 
                });

                if (assignedServers.length > 0) {
                    const targets = await getUserTokensMap(assignedServers);
                    await sendMulticast({ 
                        title: "Mission Retirée 🚫", 
                        body: `Un ${cause} a été retiré de la réservation du ${resData.date || ''}.`, 
                        targets, 
                        data: { reservationId: resId, type: 'reservation_removed' } 
                    });
                }
                
                contentCache.set(resId, contentSignature);
                continue; // Stop ici
            }

            // --- C. SERVICE AJOUTÉ -> "Nouvelle Mission" ---
            const hasServiceAdded = currentServiceIds.some(id => !prevServiceIds.includes(id));
            
            if (hasServiceAdded) {
                console.log(`➕ Service ajouté sur ${resId} -> Envoi 'Nouvelle Mission'`);
                localDebounce.set(resId, Date.now()); // Verrouillage

                await db.collection(CONFIG.COLLECTION_RESERVATIONS).doc(resId).update({ 
                    staffNotificationSentAt: admin.firestore.FieldValue.serverTimestamp() 
                });

                if (assignedServers.length > 0) {
                    const targets = await getUserTokensMap(assignedServers);
                    await sendMulticast({ 
                        title: "📅 Nouvelle Mission", 
                        body: `Un nouveau service a été ajouté pour le ${resData.date || ''}.\nCréneau: ${slotLabel}`, 
                        targets, 
                        data: { reservationId: resId, type: 'reservation_assigned' } 
                    });
                }
                contentCache.set(resId, contentSignature);
                continue; // Stop ici
            }
        }

        // =========================================================
        // CAS 4 : MODIFICATION CLASSIQUE (Date, Heure, Note...)
        // =========================================================
        if (change.type === 'modified' && assignedServers.length > 0) {
            const currentCacheSig = contentCache.get(resId);
            
            // Si signature identique, on a déjà traité ou c'est un doublon
            if (currentCacheSig === contentSignature) {
                continue; 
            }

            if (resData.status === 'CANCELLED') continue;

            console.log(`📝 Modification détectée sur ${resId}`);
            localDebounce.set(resId, Date.now()); // Verrouillage

            // Mise à jour cache avant actions
            contentCache.set(resId, contentSignature);

            await db.collection(CONFIG.COLLECTION_RESERVATIONS).doc(resId).update({ 
                staffNotificationSentAt: admin.firestore.FieldValue.serverTimestamp() 
            });

            const targets = await getUserTokensMap(assignedServers);
            await sendMulticast({ 
                title: "Modification 📝", 
                body: `La réservation du ${resData.date || ''} a été mise à jour.`, 
                targets, 
                data: { reservationId: resId, type: 'reservation_modified' } 
            });
        }
      }
  });
}

function startChatListener() {
  console.log("🎧 Écoute du Chat...");
  const startTimestamp = admin.firestore.Timestamp.now();
  db.collection(CONFIG.COLLECTION_MESSAGES).where('createdAt', '>', startTimestamp).onSnapshot((snapshot) => {
      snapshot.docChanges().forEach((change) => {
        if (change.type === 'added') {
            const msgId = change.doc.id; const data = change.doc.data(); const receiverUid = data.receiverId;
            if (!receiverUid) return;
            setTimeout(async () => {
                const freshDoc = await db.collection(CONFIG.COLLECTION_MESSAGES).doc(msgId).get();
                if (!freshDoc.exists) return;
                const currentData = freshDoc.data();
                if (currentData.read === false && !currentData.notificationSent) {
                    await db.collection(CONFIG.COLLECTION_MESSAGES).doc(msgId).update({ notificationSent: true });
                    const usersData = await getUserDataMap([receiverUid]);
                    for (const user of usersData) {
                        const senderName = currentData.senderId === 'ADMIN' ? "L'Administration" : "Un client";
                        const waMsg = `💬 *Nouveau message de ${senderName}*\n\n"${(currentData.text || "Fichier").substring(0, 100)}"`;
                        await sendWhatsAppMessage(user.uid, user.phone, waMsg);
                    }
                } 
            }, 5000);
        }
      });
  });
}

startReservationsListener();
startChatListener();
EOF

# ============================================================
# 2. SCRIPT WHATSAPP (whatsapp-bot.js)
# ============================================================
cat > whatsapp-bot.js << 'EOF'
const admin = require("firebase-admin");
const fs = require('fs');
const util = require('util');
const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');

const CONFIG = { COLLECTION_USERS: "partenaire", COLLECTION_RESERVATIONS: "reservations", COLLECTION_MESSAGES: "messages", FIELD_PHONE: "telephone", COUNTRY_CODE: "216" };

const LOG_FILE = './whatsapp.logs';
const logFileStream = fs.createWriteStream(LOG_FILE, { flags: 'a' });
const originalStdout = process.stdout.write.bind(process.stdout);
const originalStderr = process.stderr.write.bind(process.stderr);
function getTimestamp() { return new Date().toISOString().replace(/T/, ' ').replace(/\..+/, ''); }
console.log = function(...args) { const msg = util.format(...args) + '\n'; logFileStream.write(`[${getTimestamp()}] [INFO] ${msg}`); originalStdout(msg); };
console.error = function(...args) { const msg = util.format(...args) + '\n'; logFileStream.write(`[${getTimestamp()}] [ERROR] ${msg}`); originalStderr(msg); };

console.log('🚀 Démarrage du script WhatsApp...');
const whatsappClient = new Client({ authStrategy: new LocalAuth(), puppeteer: { args: ['--no-sandbox', '--disable-setuid-sandbox'], headless: true } });
let isWhatsAppReady = false;

whatsappClient.on('qr', (qr) => { console.log('\n📱 QR CODE WHATSAPP :\n'); qrcode.generate(qr, { small: true }); });
whatsappClient.on('ready', () => { console.log('✅ WhatsApp connecté !'); isWhatsAppReady = true; });
whatsappClient.initialize();

async function sendWhatsAppMessage(targetUid, rawPhone, messageText) {
    if (!isWhatsAppReady || !rawPhone) return;
    try {
        let cleanPhone = String(rawPhone).replace(/\D/g, '');
        if (cleanPhone.length === 8) cleanPhone = CONFIG.COUNTRY_CODE + cleanPhone;
        if (cleanPhone.startsWith('00')) cleanPhone = cleanPhone.substring(2);
        await whatsappClient.sendMessage(cleanPhone + "@c.us", messageText);
        console.log(`📤 WhatsApp envoyé à ${targetUid}`);
    } catch (err) { console.error(`❌ Échec WhatsApp ${targetUid}:`, err.message); }
}

try {
    const serviceAccount = require("./serviceAccountKey.json");
    if (!admin.apps.length) admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
} catch (e) { console.error("CRASH: serviceAccountKey.json manquant.", e); process.exit(1); }
const db = admin.firestore();

// --- MEMOIRE CACHE ---
const contentCache = new Map();
const localDebounce = new Map();

function chunk(arr, size) { const out = []; for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size)); return out; }
async function getUserDataMap(uids) {
  const uniqueUids = [...new Set((uids || []).filter(u => u && typeof u === 'string'))];
  if (uniqueUids.length === 0) return [];
  const results = []; 
  const userChunks = chunk(uniqueUids, 10); 
  for (const batchUids of userChunks) {
      try {
        const refs = batchUids.map(uid => db.collection(CONFIG.COLLECTION_USERS).doc(uid));
        const snaps = await db.getAll(...refs);
        snaps.forEach((snap) => { if(snap.exists) { results.push({ uid: snap.id, phone: snap.data()[CONFIG.FIELD_PHONE] || null }); } });
      } catch (err) { console.error("❌ Erreur user data:", err.message); }
  }
  return results;
}

function startReservationsListener() {
  console.log("🎧 Écoute active sur 'reservations'...");
  db.collection(CONFIG.COLLECTION_RESERVATIONS).onSnapshot(async (snapshot) => {
      for (const change of snapshot.docChanges()) {
        const resId = change.doc.id;
        if (change.type === 'removed') { contentCache.delete(resId); localDebounce.delete(resId); continue; }

        // VERROU ANTI-DOUBLON LOCAL (3 sec)
        const lastRun = localDebounce.get(resId) || 0;
        if (Date.now() - lastRun < 3000) continue;

        const resData = change.doc.data();
        const rawSlot = resData.slotId || resData.creneau;
        const assignedServers = Array.isArray(resData['assignedServerIds']) ? resData['assignedServerIds'] : [];
        const slotLabel = rawSlot ? String(rawSlot).charAt(0).toUpperCase() + String(rawSlot).slice(1) : 'Non spécifié';

        // Données comparées
        const currentPacks = Array.isArray(resData.packs) ? resData.packs : [];
        const currentPackIds = currentPacks.map(p => p.id).sort();
        const currentServices = Array.isArray(resData.services) ? resData.services : [];
        const currentServiceIds = currentServices.map(s => s.id).sort();

        // Signature
        const contentSignature = JSON.stringify({ 
            d: resData.date, s: rawSlot, u: [...assignedServers].sort(), 
            p: currentPackIds, sv: currentServiceIds 
        });

        if (change.type === 'added') { contentCache.set(resId, contentSignature); }

        if (resData.status === 'CANCELLED' && resData.cancellationNotified) continue;

        // 1. ANNULATION
        if (resData.status === 'CANCELLED') {
              console.log(`🚫 Annulation : ${resId}`);
              localDebounce.set(resId, Date.now()); 
              await db.collection(CONFIG.COLLECTION_RESERVATIONS).doc(resId).update({ cancellationNotified: true, staffNotificationSentAt: admin.firestore.FieldValue.serverTimestamp() });
              const usersData = await getUserDataMap(assignedServers);
              for (const user of usersData) await sendWhatsAppMessage(user.uid, user.phone, `*Mission Annulée ❌*\nLa réservation du ${resData.date || ''} (${slotLabel}) a été annulée.`);
              continue; 
        }

        // 2a. NOUVELLE AFFECTATION
        const alreadyNotified = Array.isArray(resData['staffNotifiedUids']) ? resData['staffNotifiedUids'] : [];
        const newStaff = assignedServers.filter(uid => !alreadyNotified.includes(uid));
        if (newStaff.length > 0) {
            console.log(`✨ Nouvelle affectation : ${resId}`);
            localDebounce.set(resId, Date.now()); 
            await db.collection(CONFIG.COLLECTION_RESERVATIONS).doc(resId).update({ staffNotifiedUids: admin.firestore.FieldValue.arrayUnion(...newStaff), staffNotificationSentAt: admin.firestore.FieldValue.serverTimestamp() });
            const usersData = await getUserDataMap(newStaff);
            for (const user of usersData) await sendWhatsAppMessage(user.uid, user.phone, `*📅 Nouvelle Mission*\nVous avez été ajouté à une réservation le ${resData.date || ''}.\nCréneau: ${slotLabel}\n\nConnectez-vous pour voir les détails.`);
            contentCache.set(resId, contentSignature); 
            continue;
        }

        // 3. CHANGEMENTS CONTENU
        const previousSignature = contentCache.get(resId);
        if (change.type === 'modified' && previousSignature) {
            const prevData = JSON.parse(previousSignature);
            
            // Retrait Partenaire
            const prevUsers = prevData.u || [];
            const removedUsers = prevUsers.filter(uid => !assignedServers.includes(uid));
            if (removedUsers.length > 0) {
                console.log(`👋 Retrait Partenaire : ${removedUsers.length}`);
                localDebounce.set(resId, Date.now()); 
                await db.collection(CONFIG.COLLECTION_RESERVATIONS).doc(resId).update({ staffNotificationSentAt: admin.firestore.FieldValue.serverTimestamp() });
                const usersData = await getUserDataMap(removedUsers);
                for (const user of usersData) await sendWhatsAppMessage(user.uid, user.phone, `*Mission Retirée 🚫*\nVous n'êtes plus affecté à la réservation du ${resData.date || ''}.`);
                contentCache.set(resId, contentSignature);
            }

            // Retrait Pack OU Service -> Mission Retirée
            const prevPackIds = prevData.p || [];
            const prevServiceIds = prevData.sv || [];
            const hasPackRemoved = prevPackIds.some(id => !currentPackIds.includes(id));
            const hasServiceRemoved = prevServiceIds.some(id => !currentServiceIds.includes(id));

            if (hasPackRemoved || hasServiceRemoved) {
                console.log(`🗑️ Elément retiré -> Envoi 'Mission Retirée'`);
                localDebounce.set(resId, Date.now()); 
                await db.collection(CONFIG.COLLECTION_RESERVATIONS).doc(resId).update({ staffNotificationSentAt: admin.firestore.FieldValue.serverTimestamp() });
                if (assignedServers.length > 0) {
                    const usersData = await getUserDataMap(assignedServers);
                    const cause = hasServiceRemoved ? "Un service" : "Un pack";
                    for (const user of usersData) await sendWhatsAppMessage(user.uid, user.phone, `*Mission Retirée 🚫*\n${cause} a été retiré de la réservation du ${resData.date || ''}.`);
                }
                contentCache.set(resId, contentSignature);
                continue;
            }

            // Ajout Service -> Nouvelle Mission
            const hasServiceAdded = currentServiceIds.some(id => !prevServiceIds.includes(id));
            if (hasServiceAdded) {
                console.log(`➕ Service ajouté -> Envoi 'Nouvelle Mission'`);
                localDebounce.set(resId, Date.now()); 
                await db.collection(CONFIG.COLLECTION_RESERVATIONS).doc(resId).update({ staffNotificationSentAt: admin.firestore.FieldValue.serverTimestamp() });
                if (assignedServers.length > 0) {
                    const usersData = await getUserDataMap(assignedServers);
                    for (const user of usersData) await sendWhatsAppMessage(user.uid, user.phone, `*📅 Nouvelle Mission*\nUn nouveau service a été ajouté pour le ${resData.date || ''}.\nCréneau: ${slotLabel}`);
                }
                contentCache.set(resId, contentSignature);
                continue;
            }
        }

        // 4. MODIFICATION CLASSIQUE
        if (change.type === 'modified' && assignedServers.length > 0) {
            const currentCacheSig = contentCache.get(resId);
            if (currentCacheSig === contentSignature) continue; // Déjà traité

            if (resData.status === 'CANCELLED') continue;

            console.log(`📝 Modification : ${resId}`);
            localDebounce.set(resId, Date.now()); 
            contentCache.set(resId, contentSignature);

            await db.collection(CONFIG.COLLECTION_RESERVATIONS).doc(resId).update({ staffNotificationSentAt: admin.firestore.FieldValue.serverTimestamp() });
            const usersData = await getUserDataMap(assignedServers);
            for (const user of usersData) await sendWhatsAppMessage(user.uid, user.phone, `*📝 Modification*\nLa réservation du ${resData.date || ''} a été mise à jour.`);
        }
      }
  });
}

function startChatListener() {
  console.log("🎧 Écoute du Chat...");
  const startTimestamp = admin.firestore.Timestamp.now();
  db.collection(CONFIG.COLLECTION_MESSAGES).where('createdAt', '>', startTimestamp).onSnapshot((snapshot) => {
      snapshot.docChanges().forEach((change) => {
        if (change.type === 'added') {
            const msgId = change.doc.id; const data = change.doc.data(); const receiverUid = data.receiverId;
            if (!receiverUid) return;
            setTimeout(async () => {
                const freshDoc = await db.collection(CONFIG.COLLECTION_MESSAGES).doc(msgId).get();
                if (!freshDoc.exists) return;
                const currentData = freshDoc.data();
                if (currentData.read === false && !currentData.notificationSent) {
                    await db.collection(CONFIG.COLLECTION_MESSAGES).doc(msgId).update({ notificationSent: true });
                    const usersData = await getUserDataMap([receiverUid]);
                    for (const user of usersData) {
                        const senderName = currentData.senderId === 'ADMIN' ? "L'Administration" : "Un client";
                        const waMsg = `💬 *Nouveau message de ${senderName}*\n\n"${(currentData.text || "Fichier").substring(0, 100)}"`;
                        await sendWhatsAppMessage(user.uid, user.phone, waMsg);
                    }
                } 
            }, 5000);
        }
      });
  });
}

startReservationsListener();
startChatListener();
EOF

echo "✅ Scripts générés avec succès (Gestion Retrait OK)"