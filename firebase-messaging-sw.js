/* eslint-disable no-undef */
// IMPORTANT: ce SW doit être servi à la racine (ex: /firebase-messaging-sw.js)

importScripts('https://www.gstatic.com/firebasejs/10.12.5/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.5/firebase-messaging-compat.js');

// ✅ Même config que src/environments/environment.ts (firebase: {...})
firebase.initializeApp({
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

// (Optionnel) Notification en background
messaging.onBackgroundMessage(function(payload) {
  const title = payload?.notification?.title || 'Notification';
  const options = {
    body: payload?.notification?.body || '',
    icon: '/favicon.ico'
  };
  self.registration.showNotification(title, options);
});
