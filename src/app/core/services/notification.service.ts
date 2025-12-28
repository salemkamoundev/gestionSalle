import { Injectable, inject } from '@angular/core';
import { Firestore, collection, query, where, onSnapshot, doc, updateDoc, orderBy, writeBatch } from '@angular/fire/firestore';
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
        // Garde le token stocké au niveau de l'user (inchangé)
        const tokenRef = doc(this.firestore, `users/${uid}/fcmTokens/${currentToken}`);
        const { setDoc } = await import('@angular/fire/firestore');
        await setDoc(tokenRef, { token: currentToken, lastSeen: new Date() }, { merge: true });
      }
    } catch (err) {
      console.warn('FCM Token warning:', err);
    }
  }

  // MODIFICATION : Cible users/{uid}/notifications
  getUnreadCount(uid: string): Observable<number> {
    if (!uid) return new Observable(obs => obs.next(0));

    const q = query(
      collection(this.firestore, `users/${uid}/notifications`),
      where('read', '==', false)
    );
    return new Observable(observer => {
      return onSnapshot(q, (snap) => observer.next(snap.size), () => observer.next(0));
    });
  }

  // MODIFICATION : Cible users/{uid}/notifications
  getNotifications(uid: string): Observable<AppNotification[]> {
    if (!uid) return new Observable(obs => obs.next([]));

    const q = query(
      collection(this.firestore, `users/${uid}/notifications`),
      orderBy('createdAt', 'desc')
    );

    return new Observable(observer => {
      return onSnapshot(q, (snap) => {
        const notifs = snap.docs.map(d => ({ 
          id: d.id, 
          ...d.data(),
          // Gestion robuste des différents noms de champs possibles
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

  // MODIFICATION : Ajout de uid en paramètre car le chemin dépend de l'utilisateur
  async markAsRead(uid: string, id: string) {
    if (!id || !uid) return;
    // Chemin : users/{uid}/notifications/{id}
    const ref = doc(this.firestore, `users/${uid}/notifications`, id);
    await updateDoc(ref, { read: true });
  }
  
  // MODIFICATION : Utilise le chemin de sous-collection dans le batch
  async markAllAsRead(uid: string, list: AppNotification[]) {
    if (!uid) return;
    const unread = list.filter(n => !n.read && n.id);
    if (unread.length === 0) return;

    const batch = writeBatch(this.firestore);
    unread.forEach(n => {
        const ref = doc(this.firestore, `users/${uid}/notifications`, n.id!);
        batch.update(ref, { read: true });
    });
    await batch.commit();
  }
}