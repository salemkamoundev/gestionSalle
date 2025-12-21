const admin = require("firebase-admin");

// Charger la clé de service
// ASSUREZ-VOUS QUE LE FICHIER serviceAccountKey.json EST DANS CE DOSSIER
const serviceAccount = require("./serviceAccountKey.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();
const fcm = admin.messaging();

console.log("🚀 Service de notification démarré...");
console.log("📡 En attente de nouveaux messages de l'admin...");

/**
 * Écoute les nouveaux messages dans la collection 'admin_announcements'
 */
db.collection('admin_announcements')
  .where('notificationSent', '==', false) // N'envoie que si pas déjà notifié
  .onSnapshot(async (snapshot) => {
    
    for (const change of snapshot.docChanges()) {
      if (change.type === 'added') {
        const msgData = change.doc.data();
        const msgId = change.doc.id;

        console.log(`\n🆕 Nouveau message détecté : "${msgData.text}"`);
        
        await broadcastNotification(msgData.text, msgId);
      }
    }
  });

/**
 * Récupère les tokens et envoie le push
 */
async function broadcastNotification(messageText, messageId) {
  try {
    // 1. Récupérer tous les utilisateurs ayant un fcmTokens
    const usersSnapshot = await db.collection('users').get();
    const tokens = [];

    usersSnapshot.forEach(doc => {
      const data = doc.data();
      if (data.fcmTokens) {
        tokens.push(data.fcmTokens);
      }
    });

    if (tokens.length === 0) {
      console.log("⚠️ Aucun token trouvé dans la collection 'users'.");
      return;
    }

    console.log(`🎯 Envoi à ${tokens.length} appareils...`);

    // 2. Préparer le message push
    const message = {
      notification: {
        title: "Nouveau message de l'Admin 📢",
        body: messageText
      },
      data: {
        click_action: "FLUTTER_NOTIFICATION_CLICK", // Utile pour mobile
        url: "/admin/chat",
        id: messageId
      },
      tokens: tokens
    };

    // 3. Envoyer via FCM
    const response = await fcm.sendEachForMulticast(message);
    console.log(`✅ Succès : ${response.successCount} envoyés / ${response.failureCount} échecs.`);

    // 4. Marquer le message comme "notifié" dans Firestore pour éviter les doublons
    await db.collection('admin_announcements').doc(messageId).update({
      notificationSent: true,
      sentAt: admin.firestore.FieldValue.serverTimestamp()
    });

  } catch (error) {
    console.error("🔥 Erreur lors du broadcast :", error);
  }
}
