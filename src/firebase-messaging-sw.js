/* Auto-fixed by fix-fcm-sw.sh */
importScripts("/assets/firebase/firebase-app-compat.js");
importScripts("/assets/firebase/firebase-messaging-compat.js");

/* Auto-fixed by fix-fcm-sw-local.sh */

/* Auto-fixed by fix-fcm-sw.sh */


firebase.initializeApp({
    vapidKey: "BM2RBmBWpexF8AuEX7bJ34DVvtbPi0-9pbP8yYZ7nU8hfR6vSQZvUuZoAF-V96X05k0-ujJLEM55aH9BFLqtNuA",
    apiKey: "AIzaSyCuuv5Ct4laED73ejjT88nqxBNDtXubAWI",
    authDomain: "laprincesse-salledesfetes.firebaseapp.com",
    databaseURL: "https://laprincesse-salledesfetes-default-rtdb.firebaseio.com",
    projectId: "laprincesse-salledesfetes",
    storageBucket: "laprincesse-salledesfetes.firebasestorage.app",
    messagingSenderId: "834193551998",
    appId: "1:834193551998:web:0e27ae6b42e76ecefc9e2f",
    measurementId: "G-4ER0LC84ER"
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage(function(payload) {
  self.registration.showNotification(payload.notification.title, {
    body: payload.notification.body,
    icon: '/assets/icons/icon-192x192.png'
  });
});
