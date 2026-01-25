const admin = require("firebase-admin");
const fs = require('fs');
const util = require('util');
const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');

const CONFIG = {
    // Si votre diagnostic a dit 'partenaires', changez ici
    COLLECTION_USERS: "partenaire", 
    COLLECTION_RESERVATIONS: "reservations",
    COLLECTION_MESSAGES: "messages",
    FIELD_PHONE: "telephone",          
    COUNTRY_CODE: "216"
};

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

console.log('🚀 Démarrage du script WhatsApp (avec support Annulation Service)...');

const whatsappClient = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: { args: ['--no-sandbox', '--disable-setuid-sandbox'], headless: true }
});

let isWhatsAppReady = false;

whatsappClient.on('qr', (qr) => qrcode.generate(qr, { small: true }));
whatsappClient.on('ready', () => { console.log('✅ WhatsApp est prêt !'); isWhatsAppReady = true; });
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
    } catch (err) { console.error(`❌ Échec envoi WhatsApp à ${targetUid}:`, err.message); }
}

try {
    const serviceAccount = require("./serviceAccountKey.json");
    if (!admin.apps.length) admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
} catch (e) { process.exit(1); }

const db = admin.firestore();

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
               results.push({ uid: snap.id, phone: data[CONFIG.FIELD_PHONE] || data.phone || null });
           }
        });
      } catch (err) { }
  }
  return results;
}

function startReservationsListener() {
  console.log("🎧 Écoute 'reservations'...");
  db.collection(CONFIG.COLLECTION_RESERVATIONS).onSnapshot(async (snapshot) => {
      for (const change of snapshot.docChanges()) {
        if (change.type === 'removed') continue;

        const resData = change.doc.data();
        const resId = change.doc.id;
        const rawSlot = resData.slotId || resData.creneau;
        const slotLabel = rawSlot ? String(rawSlot).charAt(0).toUpperCase() + String(rawSlot).slice(1) : 'Non spécifié';

        // 1. GESTION DES SUPPRESSIONS DE SERVICE (Désélection)
        // Le frontend écrit dans 'uidsToRemove' les IDs des staffs qui viennent d'être retirés
        if (resData.uidsToRemove && Array.isArray(resData.uidsToRemove) && resData.uidsToRemove.length > 0) {
            console.log(`🚫 Détection suppression staff sur ${resId} :`, resData.uidsToRemove);
            
            const usersToRemove = await getUserDataMap(resData.uidsToRemove);
            
            // Notification
            for (const user of usersToRemove) {
                const msg = `❌ *Annulation de Service*\n\nVous avez été retiré de la réservation du ${resData.date || 'date inconnue'} (${slotLabel}).\n\nSi vous pensez qu'il s'agit d'une erreur, contactez l'administration.`;
                await sendWhatsAppMessage(user.uid, user.phone, msg);
            }

            // Nettoyage du champ pour éviter les doublons
            await db.collection(CONFIG.COLLECTION_RESERVATIONS).doc(resId).update({
                uidsToRemove: admin.firestore.FieldValue.delete() 
            });
            
            // On continue pour traiter les autres cas (ajouts)
        }

        const lastNotif = resData.staffNotificationSentAt ? resData.staffNotificationSentAt.toMillis() : 0;
        if (Date.now() - lastNotif < 2000 && !resData.uidsToRemove) continue; 

        const assignedServers = Array.isArray(resData['assignedServerIds']) ? resData['assignedServerIds'] : [];

        // 2. ANNULATION GLOBALE
        if (resData.status === 'CANCELLED' && !resData.cancellationNotified) {
              await db.collection(CONFIG.COLLECTION_RESERVATIONS).doc(resId).update({ cancellationNotified: true });
              if (assignedServers.length === 0) continue;
              const usersData = await getUserDataMap(assignedServers);
              for (const user of usersData) {
                  await sendWhatsAppMessage(user.uid, user.phone, `*Mission Annulée ❌*\nLa réservation du ${resData.date || ''} (${slotLabel}) a été annulée.`);
              }
              continue;
        }

        if (resData.status === 'CANCELLED') continue;

        // 3. NOUVELLE AFFECTATION
        const alreadyNotified = Array.isArray(resData['staffNotifiedUids']) ? resData['staffNotifiedUids'] : [];
        const newStaff = assignedServers.filter(uid => !alreadyNotified.includes(uid));
        
        if (newStaff.length > 0) {
            await db.collection(CONFIG.COLLECTION_RESERVATIONS).doc(resId).update({ 
                staffNotifiedUids: admin.firestore.FieldValue.arrayUnion(...newStaff), 
                staffNotificationSentAt: admin.firestore.FieldValue.serverTimestamp() 
            });
            const usersData = await getUserDataMap(newStaff);
            for (const user of usersData) {
                await sendWhatsAppMessage(user.uid, user.phone, `*📅 Nouvelle Mission*\nVous avez été ajouté le ${resData.date || ''}.\nCréneau: ${slotLabel}\n\nConnectez-vous pour voir les détails.`);
            }
        }

        // 4. NOUVEAU PACK
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
             if (assignedServers.length > 0) {
                 const usersData = await getUserDataMap(assignedServers);
                 for (const user of usersData) {
                     await sendWhatsAppMessage(user.uid, user.phone, `*📦 Nouveau Pack Ajouté*\n${packNames}\nSur réservation du ${resData.date}.`);
                 }
             }
        }
      }
  });
}

// (Chat Listener inchangé, inclu pour complétude)
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
                    const usersData = await getUserDataMap([receiverUid]);
                    if (usersData.length > 0) {
                        const waMsg = `💬 *Message*\n"${(currentData.text || "Fichier").substring(0, 50)}"`;
                        await sendWhatsAppMessage(usersData[0].uid, usersData[0].phone, waMsg);
                    }
                } 
            }, 5000);
        }
      });
  });
}

startReservationsListener();
startChatListener();
