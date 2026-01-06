importScripts('https://www.gstatic.com/firebasejs/10.9.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.9.0/firebase-messaging-compat.js');

// Configuration identique à environment.ts
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

messaging.onBackgroundMessage(function(payload) {
  console.log('[SW] Notification reçue:', payload);
  const title = payload?.notification?.title || 'Nouvelle Notification';
  const options = {
    body: payload?.notification?.body || '',
    icon: '/favicon.ico',
    data: payload.data
  };
  self.registration.showNotification(title, options);
});

// Listener indispensable pour éviter l'erreur "channel closed"
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
