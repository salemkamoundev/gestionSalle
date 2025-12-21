import { Injectable, inject } from '@angular/core';
import { Firestore, doc, setDoc, serverTimestamp, arrayUnion } from '@angular/fire/firestore';
import { Messaging } from '@angular/fire/messaging';
import { getToken, isSupported } from 'firebase/messaging';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class NotificationService {
  /**
   * Alias (utilisé par AuthService) : demande la permission + récupère le token + le sauvegarde.
   */
  async ensurefcmTokensForUser(uid: string): Promise<void> {
    return this.ensurePermissionAndSaveToken(uid);
  }

  private firestore = inject(Firestore);
  private messaging = inject(Messaging);

  private async registerFcmServiceWorker(): Promise<ServiceWorkerRegistration | null> {
    if (!('serviceWorker' in navigator)) return null;

    // ✅ FCM recommande /firebase-messaging-sw.js à la racine
    // Angular va le servir via assets (angular.json)
    try {
      const reg = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
      await navigator.serviceWorker.ready;
      return reg;
    } catch (e) {
      console.warn('[FCM] Service worker registration failed:', e);
      return null;
    }
  }

  async ensurePermissionAndSaveToken(uid: string) {
    try {
      const supported = await isSupported();
      if (!supported) {
        console.warn('[FCM] Messaging non supporté sur ce navigateur.');
        return;
      }

      if (!('Notification' in window)) {
        console.warn('[FCM] Notification API indisponible.');
        return;
      }

      // 1) Permission (ne redemande pas si déja fixé)
      const current = Notification.permission;
      const permission = (current === "default") ? await Notification.requestPermission() : current;

      if (permission === "denied") {
        console.warn("[FCM] Permission déjà bloquée dans le navigateur.");
      }
// 2) Sauver l’état (même si refusé)
      const userRef = doc(this.firestore, `users/${uid}`);
      await setDoc(
        userRef,
        {
          notifications: {
            permission,
            accepted: permission === 'granted',
            updatedAt: serverTimestamp()
          }
        },
        { merge: true }
      );

      if (permission !== 'granted') {
        console.warn('[FCM] Permission refusée. Token non récupéré.');
        return;
      }

      // 3) VAPID key (⚠️ doit venir de Firebase Console -> Cloud Messaging -> Web Push certificates)
      // ✅ On TRIM pour enlever les espaces invisibles (cause classique du 401) :contentReference[oaicite:1]{index=1}
      const vapidKeyRaw = (environment as any)?.firebase?.vapidKey;
      const vapidKey = typeof vapidKeyRaw === 'string' ? vapidKeyRaw.trim() : '';

      if (!vapidKey || vapidKey.includes('YOUR_') || vapidKey.includes('REPLACE_ME')) {
        console.warn('[FCM] vapidKey manquante/placeholder. Mets environment.firebase.vapidKey (sans espaces).');
        return;
      }

      // 4) Enregistrer le SW et le passer à getToken()
      const swReg = await this.registerFcmServiceWorker();
      if (!swReg) {
        console.warn('[FCM] Service worker non prêt. Impossible de récupérer le token.');
        return;
      }

      // 5) Token
      const token = await getToken(this.messaging, {
        vapidKey,
        serviceWorkerRegistration: swReg
      });

      if (!token) {
        console.warn('[FCM] Token vide. Vérifie SW + config Firebase + VAPID key.');
        return;
      }

      // 6) Sauver token (multi-devices)
      await setDoc(
        userRef,
        {
          fcmTokenss: arrayUnion(token),
          lastfcmTokens: token,
          notifications: {
            permission: 'granted',
            accepted: true,
            updatedAt: serverTimestamp()
          },
          updatedAt: serverTimestamp()
        },
        { merge: true }
      );
      console.log(arrayUnion(token));
      
      console.log('[FCM] Token enregistré ✅');
    } catch (e) {
      console.error('[FCM] Erreur permission/token:', e);
      console.error('[FCM] Astuce: vérifie que la VAPID key vient bien de Firebase Console et qu’elle n’a AUCUN espace.');
    }
  }
}
