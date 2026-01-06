/* eslint-disable no-undef */
// Firebase Messaging SW (compat) - must be served at /firebase-messaging-sw.js

importScripts('https://www.gstatic.com/firebasejs/10.12.5/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.5/firebase-messaging-compat.js');


firebase.initializeApp({
    apiKey: "AIzaSyCuuv5Ct4laED73ejjT88nqxBNDtXubAWI",
    authDomain: "laprincesse-salledesfetes.firebaseapp.com",
    databaseURL: "https://laprincesse-salledesfetes-default-rtdb.firebaseio.com",
    projectId: "laprincesse-salledesfetes",
    storageBucket: "laprincesse-salledesfetes.firebasestorage.app",
    messagingSenderId: "834193551998",
    appId: "1:834193551998:web:0e27ae6b42e76ecefc9e2f",
    measurementId: "G-4ER0LC84ER",
    vapidKey: "BM2RBmBWpexF8AuEX7bJ34DVvtbPi0-9pbP8yYZ7nU8hfR6vSQZvUuZoAF-V96X05k0-ujJLEM55aH9BFLqtNuA"
});

const messaging = firebase.messaging();

// Optionnel: afficher les notifications quand l'app est en background
messaging.onBackgroundMessage((payload) => {
  const title = (payload.notification && payload.notification.title) || 'Notification';
  const options = {
    body: (payload.notification && payload.notification.body) || '',
    icon: (payload.notification && payload.notification.icon) || '/favicon.ico',
    data: payload.data || {}
  };
  self.registration.showNotification(title, options);
});
