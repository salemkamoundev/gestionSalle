const admin = require("firebase-admin");
const fs = require('fs');
const util = require('util');
const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');

// ==========================================
// 🔧 CONFIGURATION
// ==========================================
const CONFIG = {
    COLLECTION_USERS: "partenaire", // Source des numéros de téléphone
    COLLECTION_RESERVATIONS: "reservations",
    COLLECTION_MESSAGES: "messages",
    
    FIELD_PHONE: "telephone",        
    COUNTRY_CODE: "216"             
};

// ==========================================
// 📝 SYSTÈME DE LOGS
// ==========================================
const LOG_FILE = './whatsapp.logs';
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

// ==========================================
// 🔥 INIT FIREBASE
// ==========================================
try {
    const serviceAccount = require("./serviceAccountKey.json");
    if (!admin.apps.length) {
        admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
    }
    console.log("✅ Firebase Admin initialisé.");
} catch (e) {
    console.error("❌ CRASH: serviceAccountKey.json manquant.", e);
    process.exit(1);
}

const db = admin.firestore();
const SERVER_START_TIME = Date.now();

// ==========================================
// 🤖 CLIENT WHATSAPP
// ==========================================
console.log('🚀 Démarrage du script WhatsApp...');

const whatsappClient = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
        headless: true
    }
});

let isWhatsAppReady = false;

whatsappClient.on('qr', (qr) => {
    console.log('\n================================================');
    console.log('📱 QR CODE GÉNÉRÉ CI-DESSOUS :');
    console.log('================================================\n');
    qrcode.generate(qr, { small: true });
});

whatsappClient.on('ready', () => {
    console.log('✅ WhatsApp connecté !');
    isWhatsAppReady = true;
});

whatsappClient.initialize();

async function sendWhatsAppMessage(targetUid, rawPhone, messageText) {
    if (!isWhatsAppReady) return;
    if (!rawPhone) return;

    try {
        let cleanPhone = String(rawPhone).replace(/\D/g, '');
        if (cleanPhone.length === 8) cleanPhone = CONFIG.COUNTRY_CODE + cleanPhone;
        if (cleanPhone.startsWith('00')) cleanPhone = cleanPhone.substring(2);

        const chatId = cleanPhone + "@c.us";
        await whatsappClient.sendMessage(chatId, messageText);
        console.log(`📤 WhatsApp envoyé à ${targetUid} (${cleanPhone})`);
    } catch (err) {
        console.error(`❌ Échec envoi WhatsApp à ${targetUid}:`, err.message);
    }
}

// ==========================================
// 🛠️ UTILITAIRES
// ==========================================

function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

async function getUserDataMap(uids) {
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
               const phone = data[CONFIG.FIELD_PHONE] || null;
               if (phone) results.push({ uid: snap.id, phone });
           }
        });
      } catch (err) { console.error("❌ Erreur lecture données:", err.message); }
  }
  return results;
}

// ==========================================
// 🎧 LISTENERS (LOGIQUE ROBUSTE)
// ==========================================

function startReservationsListener() {
  console.log("🎧 Écoute active sur 'reservations'...");
  
  db.collection(CONFIG.COLLECTION_RESERVATIONS).onSnapshot(async (snapshot) => {
      for (const change of snapshot.docChanges()) {
        
        if (change.type === 'removed') continue;

        const resData = change.doc.data();
        const resId = change.doc.id;

        // --- FILTRE TEMPOREL (Anti-spam au redémarrage) ---
        if (resData.triggerPushTime && resData.triggerPushTime < SERVER_START_TIME) {
            if (resData.triggerPush !== false) {
                 await db.collection(CONFIG.COLLECTION_RESERVATIONS).doc(resId).update({ triggerPush: false }).catch(()=>{});
            }
            continue;
        }

        // Si pas de demande de push, on ignore
        if (!resData.triggerPushTime) continue;

        try {
            // =================================================================
            // 1. CAPTURE DES DONNÉES *AVANT* TRANSACTION
            // =================================================================
            const uidsToRemove = Array.isArray(resData.uidsToRemove) ? resData.uidsToRemove : [];
            const isCancelled = resData.status === 'CANCELLED';
            const assignedServers = Array.isArray(resData.assignedServerIds) ? resData.assignedServerIds : [];
            
            // Info Date & Créneau
            const rawSlot = resData.slotId || resData.creneau;
            const slotLabel = rawSlot ? String(rawSlot).charAt(0).toUpperCase() + String(rawSlot).slice(1) : 'Non spécifié';
            const dateStr = resData.date ? new Date(resData.date).toLocaleDateString('fr-FR') : 'Date inconnue';

            // =================================================================
            // 2. TRANSACTION : Acquittement + Nettoyage
            // =================================================================
            await db.runTransaction(async (t) => {
                const ref = db.collection(CONFIG.COLLECTION_RESERVATIONS).doc(resId);
                const doc = await t.get(ref);
                if (!doc.exists) throw "Missing";
                
                // Si déjà traité, on arrête
                if (doc.data().triggerPush === false) throw "Done";
                
                // On valide le traitement et on vide la liste des retraits
                t.update(ref, { 
                    triggerPush: false, 
                    uidsToRemove: [] // On vide seulement maintenant
                });
            });

            // =================================================================
            // 3. LOGIQUE D'ENVOI WHATSAPP
            // =================================================================

            // --- A. GESTION DES RETRAITS (Prioritaire) ---
            if (uidsToRemove.length > 0) {
                 console.log(`📉 Retrait détecté pour ${uidsToRemove.length} utilisateurs sur ${resId}`);
                 const removedUsers = await getUserDataMap(uidsToRemove);
                 
                 for (const user of removedUsers) {
                     await sendWhatsAppMessage(
                         user.uid, 
                         user.phone, 
                         `*⚠️ Mise à jour Planning*\nTu n'es plus affecté à la réservation du ${dateStr} (${slotLabel}).`
                     );
                 }
            }

            // --- B. GESTION DU RESTE (Ceux qui restent ou Annulation globale) ---
            
            // On calcule la liste des destinataires principaux
            const partnerIds = new Set();
            
            // 1. Serveurs assignés
            assignedServers.forEach(uid => partnerIds.add(uid));
            
            // 2. Partenaires liés aux services (DJ, Photographe...)
            const extractPid = (s) => s.partenaireId || s.partnerId || s.uid;
            if (Array.isArray(resData.services)) resData.services.forEach(s => { const pid = extractPid(s); if (pid) partnerIds.add(pid); });
            if (resData.pack && Array.isArray(resData.pack.services)) resData.pack.services.forEach(s => { const pid = extractPid(s); if (pid) partnerIds.add(pid); });

            // On retire ceux qui viennent d'être supprimés pour ne pas leur envoyer "Mission modifiée" juste après "Retiré"
            uidsToRemove.forEach(uid => partnerIds.delete(uid));

            const finalUsers = await getUserDataMap(Array.from(partnerIds));
            
            if (finalUsers.length > 0) {
                let title = "", body = "";

                if (isCancelled) { 
                    title = "🚫 Réservation Annulée"; 
                    body = `La réservation du ${dateStr} (${slotLabel}) a été annulée.`; 
                } else if (change.type === 'added') { 
                    title = "🎉 Nouvelle Réservation"; 
                    body = `Vous avez une mission le ${dateStr}.\nCréneau: ${slotLabel}`; 
                } else { 
                    title = "📝 Réservation Modifiée"; 
                    body = `La réservation du ${dateStr} (${slotLabel}) a été mise à jour.`; 
                }

                for (const user of finalUsers) {
                    await sendWhatsAppMessage(
                        user.uid, 
                        user.phone, 
                        `*${title}*\n${body}\n\nConnectez-vous pour voir les détails.`
                    );
                }
            }

        } catch (e) { 
            if(e !== "Done") console.error("Err Resa:", e); 
        }
      }
  });
}

function startChatListener() {
  console.log("🎧 Écoute du Chat...");
  const startTimestamp = admin.firestore.Timestamp.now();
  
  db.collection(CONFIG.COLLECTION_MESSAGES)
    .where('createdAt', '>', startTimestamp)
    .onSnapshot((snapshot) => {
      snapshot.docChanges().forEach(async (change) => {
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
                    
                    const usersData = await getUserDataMap([receiverUid]);
                    
                    if (usersData.length > 0) {
                        const user = usersData[0];
                        const senderName = currentData.senderId === 'ADMIN' ? "L'Administration" : "Un client";
                        const msgContent = (currentData.text || "Fichier reçu").substring(0, 100);
                        
                        await sendWhatsAppMessage(
                            user.uid, 
                            user.phone, 
                            `💬 *Nouveau message de ${senderName}*\n\n"${msgContent}"`
                        );
                    }
                } 
            }, 5000);
        }
      });
  });
}

// Lancement des écoutes
startReservationsListener();
startChatListener();