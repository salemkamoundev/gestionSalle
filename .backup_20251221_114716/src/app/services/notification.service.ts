import { Injectable, inject } from '@angular/core';
import { Firestore, doc, setDoc } from '@angular/fire/firestore';
import { getMessaging, getToken, isSupported } from 'firebase/messaging';
import { FirebaseApp } from '@angular/fire/app';
import { environment } from '../../environments/environment';

@Injectable({ providedIn: 'root' })
export class NotificationService {
  private readonly firestore = inject(Firestore);
  private readonly app = inject(FirebaseApp);

  private swReg: ServiceWorkerRegistration | null = null;

  /** Enregistre le SW FCM si possible */
  async registerFcmServiceWorker(): Promise<ServiceWorkerRegistration | null> {
    if (!('serviceWorker' in navigator)) return null;

    // IMPORTANT: le fichier doit être servi à la racine
    this.swReg = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
    await navigator.serviceWorker.ready;
    return this.swReg;
  }

  /**
   * Demande la permission + récupère le token FCM et le stocke dans Firestore.
   * - uid: uid Firebase Auth
   */
  async ensureFcmTokenForUser(uid: string): Promise<string | null> {
    const supported = await isSupported().catch(() => false);
    if (!supported) {
      console.warn('[FCM] Messaging non supporté sur ce navigateur.');
      return null;
    }

    // Demande permission
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      console.warn('[FCM] Permission refusée.');
      return null;
    }

    // SW
    const reg = await this.registerFcmServiceWorker();
    if (!reg) {
      console.warn('[FCM] Service worker indisponible.');
      return null;
    }

    // Token (NE PAS faire de fetch direct vers fcmregistrations.googleapis.com)
    const messaging = getMessaging(this.app);
    const vapidKey = (environment as any).vapidKey || (environment as any).VAPID_KEY || 'BM2RBmBWpexF8AuEX7bJ34DVvtbPi0-9pbP8yYZ7nU8hfR6vSQZvUuZoAF-V96X05k0-ujJLEM55aH9BFLqtNuA	';

    const token = await getToken(messaging, {
      vapidKey,
      serviceWorkerRegistration: reg
    });

    if (!token) {
      console.warn('[FCM] Token vide. Vérifie la VAPID key + config Firebase + SW.');
      return null;
    }

    // Stockage Firestore
    // Reco: stocker en map pour éviter doublons
    const userRef = doc(this.firestore, `users/${uid}`);
    await setDoc(userRef, {
      fcmTokens: {
        [token]: {
          token,
          createdAt: new Date().toISOString(),
          userAgent: navigator.userAgent
        }
      }
    }, { merge: true });

    console.log('[FCM] Token enregistré dans Firestore (users/%s).', uid);
    return token;
  }
}
