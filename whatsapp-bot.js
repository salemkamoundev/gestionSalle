const admin = require("firebase-admin");
const fs = require('fs');
const util = require('util');
const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');

// ==========================================
// 🔧 CONFIGURATION
// ==========================================
const CONFIG = {
    // C'est ici qu'on définit la source des numéros de téléphone
    COLLECTION_USERS: "users",
    
    COLLECTION_RESERVATIONS: "reservations",
    COLLECTION_MESSAGES: "messages",
    
    FIELD_PHONE: "telephone",        
    
    // Config WhatsApp (Tunisie)
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
    console.error("❌ CRASH: serviceAccountKey.json manquant ou invalide.", e);
    process.exit(1);
}

const db = admin.firestore();

// ==========================================
// 🤖 CLIENT WHATSAPP (WWEBJS)
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
    console.log('📱 QR CODE GÉNÉRÉ CI-DESSOUS (Scanne avec WhatsApp) :');
    console.log('================================================\n');
    qrcode.generate(qr, { small: true });
});

whatsappClient.on('ready', () => {
    console.log('✅ WhatsApp est connecté et prêt !');
    isWhatsAppReady = true;
});

whatsappClient.on('auth_failure', msg => {
    console.error('❌ Erreur authentification WhatsApp :', msg);
});

whatsappClient.initialize();

/**
 * Envoie un message WhatsApp
 */
async function sendWhatsAppMessage(targetUid, rawPhone, messageText) {
    if (!isWhatsAppReady) {
        console.error(`⚠️ WhatsApp pas encore prêt. Message pour ${targetUid} mis en attente.`);
        return;
    }

    if (!rawPhone) {
        console.log(`⚠️ Pas de numéro pour ${targetUid} dans la collection '${CONFIG.COLLECTION_USERS}'`);
        return;
    }

    try {
        // 1. Nettoyage du numéro
        let cleanPhone = String(rawPhone).replace(/\D/g, '');

        // 2. Gestion du préfixe (Tunisie)
        if (cleanPhone.length === 8) { 
            cleanPhone = CONFIG.COUNTRY_CODE + cleanPhone;
        }
        
        if (cleanPhone.startsWith('00')) {
            cleanPhone = cleanPhone.substring(2);
        }

        // 3. Construction ID WhatsApp
        const chatId = cleanPhone + "@c.us";

        // 4. Envoi
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

/**
 * Récupère les données (téléphone) depuis la collection PARTENAIRE
 */
async function getUserDataMap(uids) {
  // Filtrer les UIDs vides ou invalides
  const uniqueUids = [...new Set((uids || []).filter(u => u && typeof u === 'string'))];
  
  if (uniqueUids.length === 0) return [];
      
  const results = []; 
  const userChunks = chunk(uniqueUids, 10); 

  for (const batchUids of userChunks) {
      try {
        // IMPORTANT : On pointe vers CONFIG.COLLECTION_USERS qui vaut "partenaire"
        const refs = batchUids.map(uid => db.collection(CONFIG.COLLECTION_USERS).doc(uid));
        const snaps = await db.getAll(...refs);
        
        snaps.forEach((snap) => {
           if(snap.exists) {
               const data = snap.data();
               const uid = snap.id;
               // On cherche le champ 'telephone'
               const phone = data[CONFIG.FIELD_PHONE] || null;
               
               if (phone) {
                   results.push({ uid, phone });
               } else {
                   console.log(`⚠️ Partenaire ${uid} trouvé sans téléphone.`);
               }
           }
        });
      } catch (err) { console.error("❌ Erreur lecture données partenaire:", err.message); }
  }
  return results;
}

// ==========================================
// 🎧 LISTENERS (LOGIQUE MÉTIER)
// ==========================================

function startReservationsListener() {
  console.log("🎧 Écoute active sur 'reservations'...");
  
  db.collection(CONFIG.COLLECTION_RESERVATIONS).onSnapshot(async (snapshot) => {
      for (const change of snapshot.docChanges()) {
        
        if (change.type === 'removed') continue;

        const resData = change.doc.data();
        const resId = change.doc.id;

        const rawSlot = resData.slotId || resData.creneau;
        const slotLabel = rawSlot ? String(rawSlot).charAt(0).toUpperCase() + String(rawSlot).slice(1) : 'Non spécifié';

        // Anti-spam (5 sec)
        const lastNotif = resData.staffNotificationSentAt ? resData.staffNotificationSentAt.toMillis() : 0;
        if (Date.now() - lastNotif < 5000) continue; 

        const assignedServers = Array.isArray(resData['assignedServerIds']) ? resData['assignedServerIds'] : [];

        // --- CAS 1 : ANNULATION ---
        if (resData.status === 'CANCELLED' && !resData.cancellationNotified) {
              
              console.log(`🚫 Annulation détectée : ${resId}`);
              
              await db.collection(CONFIG.COLLECTION_RESERVATIONS).doc(resId).update({ 
                  cancellationNotified: true, 
                  staffNotificationSentAt: admin.firestore.FieldValue.serverTimestamp() 
              });

              if (assignedServers.length === 0) continue;

              // Récupération depuis la collection PARTENAIRE
              const usersData = await getUserDataMap(assignedServers);
              
              const title = "❌ Mission Annulée";
              const body = `La réservation du ${resData.date || 'date inconnue'} (${slotLabel}) a été annulée.`;

              for (const user of usersData) {
                  await sendWhatsAppMessage(user.uid, user.phone, `*${title}*\n${body}`);
              }
              continue;
        }

        // --- CAS 2 : NOUVELLE AFFECTATION ---
        if (resData.status !== 'CANCELLED') {
            const alreadyNotified = Array.isArray(resData['staffNotifiedUids']) ? resData['staffNotifiedUids'] : [];
            const newStaff = assignedServers.filter(uid => !alreadyNotified.includes(uid));
            
            if (newStaff.length > 0) {
                console.log(`✨ Nouvelle affectation (${newStaff.length}) sur ${resId}`);
                
                await db.collection(CONFIG.COLLECTION_RESERVATIONS).doc(resId).update({ 
                    staffNotifiedUids: admin.firestore.FieldValue.arrayUnion(...newStaff), 
                    staffNotificationSentAt: admin.firestore.FieldValue.serverTimestamp() 
                });

                // Récupération depuis la collection PARTENAIRE
                const usersData = await getUserDataMap(newStaff);
                
                const title = "📅 Nouvelle Mission";
                const body = `Vous avez été ajouté à une réservation le ${resData.date || ''}.\nCréneau: ${slotLabel}`;

                for (const user of usersData) {
                    await sendWhatsAppMessage(user.uid, user.phone, `*${title}*\n${body}\n\nConnectez-vous pour voir les détails.`);
                }
            }
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
                    
                    // Récupération depuis la collection PARTENAIRE
                    const usersData = await getUserDataMap([receiverUid]);
                    
                    if (usersData.length > 0) {
                        const user = usersData[0];
                        const senderName = currentData.senderId === 'ADMIN' ? "L'Administration" : "Un client";
                        const msgContent = (currentData.text || "Fichier reçu").substring(0, 100);
                        
                        const waMsg = `💬 *Nouveau message de ${senderName}*\n\n"${msgContent}"`;
                        
                        await sendWhatsAppMessage(user.uid, user.phone, waMsg);
                    } else {
                        // Optionnel: log si le destinataire n'est pas un partenaire (donc pas de notif whatsapp)
                        // console.log(`Pas de téléphone trouvé pour ${receiverUid} dans la collection partenaire.`);
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