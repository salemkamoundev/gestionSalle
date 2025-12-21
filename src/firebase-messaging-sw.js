/* eslint-disable no-undef */
/**
 * Firebase Messaging Service Worker
 * Servi à la racine du site via angular.json assets => /firebase-messaging-sw.js
 *
 * IMPORTANT:
 * - Remplace firebaseConfig ci-dessous
 * - Si tu utilises Firebase v9 modular en prod, tu peux aussi intégrer via importScripts compat comme ici.
 */

importScripts('https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.23.0/firebase-messaging-compat.js');

// TODO: Remplace par ta config Firebase (Firebase Console -> Project settings -> General -> Your apps)
firebase.initializeApp({
  apiKey: "REPLACE_ME",
  authDomain: "REPLACE_ME",
  projectId: "REPLACE_ME",
  storageBucket: "REPLACE_ME",
  messagingSenderId: "REPLACE_ME",
  appId: "REPLACE_ME"
});

const messaging = firebase.messaging();

// Optionnel: handler background
messaging.onBackgroundMessage((payload) => {
  // payload.notification { title, body, image }
  const title = payload?.notification?.title || 'Notification';
  const options = {
    body: payload?.notification?.body,
    icon: payload?.notification?.icon,
    image: payload?.notification?.image,
    data: payload?.data
  };

  self.registration.showNotification(title, options);
});
