import { Injectable, inject } from '@angular/core';
import { Firestore, collection, query, where, onSnapshot, addDoc, doc, updateDoc, orderBy, deleteDoc, writeBatch, Timestamp } from '@angular/fire/firestore';
import { Messaging, getToken, onMessage } from '@angular/fire/messaging';
import { Observable, BehaviorSubject } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AppNotification } from '../models/notification.model';

@Injectable({ providedIn: 'root' })
export class NotificationService {
  private firestore = inject(Firestore);
  private messaging = inject(Messaging);
  
  currentMessage = new BehaviorSubject<any>(null);

  constructor() {
    this.listenForMessages();
  }

  private listenForMessages() {
    onMessage(this.messaging, (payload) => {
      this.currentMessage.next(payload);
    });
  }

  async ensurefcmTokensForUser(uid: string) {
    try {
      const currentToken = await getToken(this.messaging, {
        vapidKey: environment.firebase.vapidKey
      });
      if (currentToken) {
        const tokenRef = doc(this.firestore, `users/${uid}/fcmTokens/${currentToken}`);
        const { setDoc } = await import('@angular/fire/firestore');
        await setDoc(tokenRef, { token: currentToken, lastSeen: new Date() }, { merge: true });
      }
    } catch (err) {
      console.warn('FCM Token warning:', err);
    }
  }

  getUnreadCount(uid: string): Observable<number> {
    const q = query(
      collection(this.firestore, 'notifications'),
      where('userId', '==', uid),
      where('read', '==', false)
    );
    return new Observable(observer => {
      return onSnapshot(q, (snap) => observer.next(snap.size), () => observer.next(0));
    });
  }

  getNotifications(uid: string): Observable<AppNotification[]> {
    // Note: Si la page reste vide, vérifiez la console F12 pour un lien d'indexation Firebase
    const q = query(
      collection(this.firestore, 'notifications'),
      where('userId', '==', uid),
      orderBy('createdAt', 'desc')
    );
    return new Observable(observer => {
      return onSnapshot(q, (snap) => {
        const notifs = snap.docs.map(d => ({ 
          id: d.id, 
          ...d.data(),
          body: d.data()['body'] || d.data()['message'] || '',
          createdAt: d.data()['createdAt']
        } as AppNotification));
        observer.next(notifs);
      }, (err) => {
        console.error("Erreur Firestore Notifications:", err);
        observer.next([]);
      });
    });
  }

  getUserNotifications(uid: string): Observable<AppNotification[]> {
    return this.getNotifications(uid);
  }

  async markAsRead(id: string) {
    if (!id) return;
    const ref = doc(this.firestore, 'notifications', id);
    await updateDoc(ref, { read: true });
  }
  
  async markAllAsRead(uid: string, list: AppNotification[]) {
    const unread = list.filter(n => !n.read && n.id);
    if (unread.length === 0) return;
    const batch = writeBatch(this.firestore);
    unread.forEach(n => {
        batch.update(doc(this.firestore, 'notifications', n.id!), { read: true });
    });
    await batch.commit();
  }
}
