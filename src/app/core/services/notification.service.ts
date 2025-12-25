import { Injectable, inject } from '@angular/core';
import { Firestore, doc, setDoc, serverTimestamp, arrayUnion, collection, query, orderBy, limit, collectionData, writeBatch } from '@angular/fire/firestore';
import { Messaging } from '@angular/fire/messaging';
import { getToken, isSupported } from 'firebase/messaging';
import { environment } from '../../../environments/environment';
import { Observable, map } from 'rxjs';
import { AppNotification } from '../models/notification.model';

@Injectable({ providedIn: 'root' })
export class NotificationService {
  private firestore = inject(Firestore);
  private messaging = inject(Messaging);

  // --- GESTION FCM ---

  async ensurefcmTokensForUser(uid: string): Promise<string | null> {
    return await this.ensurePermissionAndSaveToken(uid);
  }

  private async registerFcmServiceWorker(): Promise<ServiceWorkerRegistration | null> {
    if (!('serviceWorker' in navigator)) return null;
    try {
      const reg = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
      await navigator.serviceWorker.ready;
      return reg;
    } catch (e) {
      console.warn('[FCM] Service worker registration failed:', e);
      return null;
    }
  }

  async ensurePermissionAndSaveToken(uid: string): Promise<string | null> {
    try {
      const supported = await isSupported();
      if (!supported) return null;

      if (!('Notification' in window)) return null;

      const current = Notification.permission;
      const permission = (current === "default") ? await Notification.requestPermission() : current;

      const userRef = doc(this.firestore, `users/${uid}`);
      await setDoc(userRef, {
          notifications: {
            permission,
            accepted: permission === 'granted',
            updatedAt: serverTimestamp()
          }
        }, { merge: true }
      );

      if (permission !== 'granted') return null;

      const vapidKeyRaw = (environment as any)?.firebase?.vapidKey;
      const vapidKey = typeof vapidKeyRaw === 'string' ? vapidKeyRaw.trim() : '';

      if (!vapidKey || vapidKey.includes('YOUR_')) return null;

      const swReg = await this.registerFcmServiceWorker();
      if (!swReg) return null;

      const token = await getToken(this.messaging, { vapidKey, serviceWorkerRegistration: swReg });

      if (!token) return null;

      try { localStorage.setItem('fcmTokens', token); } catch (e) { }

      await setDoc(userRef, {
          fcmTokenss: arrayUnion(token),
          lastfcmTokens: token,
          notifications: { permission: 'granted', accepted: true, updatedAt: serverTimestamp() },
          updatedAt: serverTimestamp()
        }, { merge: true }
      );
      return token;
    } catch (e) {
      console.error('[FCM] Erreur permission/token:', e);
    }
    return null;
  }

  // --- NOUVELLES MÉTHODES : Gestion de l'historique ---

  /** Récupère les notifications en temps réel pour un utilisateur */
  getUserNotifications(uid: string): Observable<AppNotification[]> {
    const notifsRef = collection(this.firestore, `users/${uid}/user_notifications`);
    const q = query(notifsRef, orderBy('createdAt', 'desc'), limit(50));
    return collectionData(q, { idField: 'id' }) as Observable<AppNotification[]>;
  }

  /** Compte les non-lues */
  getUnreadCount(uid: string): Observable<number> {
    return this.getUserNotifications(uid).pipe(
      map(notifs => notifs.filter(n => !n.read).length)
    );
  }

  /** Marquer une notification comme lue */
  async markAsRead(uid: string, notificationId: string) {
    const docRef = doc(this.firestore, `users/${uid}/user_notifications/${notificationId}`);
    await setDoc(docRef, { read: true }, { merge: true });
  }

  /** Marquer tout comme lu */
  async markAllAsRead(uid: string, notifications: AppNotification[]) {
    const batch = writeBatch(this.firestore);
    notifications.forEach(n => {
      if (!n.read && n.id) {
        const ref = doc(this.firestore, `users/${uid}/user_notifications/${n.id}`);
        batch.update(ref, { read: true });
      }
    });
    await batch.commit();
  }
}
