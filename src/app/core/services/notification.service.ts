import { Injectable, inject, Injector, runInInjectionContext } from '@angular/core';
import { Firestore, collection, query, where, orderBy, limit, doc, getDoc, setDoc, updateDoc, collectionData, writeBatch } from '@angular/fire/firestore';
import { Observable, of } from 'rxjs';
import { map } from 'rxjs/operators';

@Injectable({
  providedIn: 'root'
})
export class NotificationService {
  private firestore = inject(Firestore);
  private injector = inject(Injector); // Capture du contexte d'injection

  constructor() {}

  // Initialisation doc user
  async ensurefcmTokensForUser(uid: string): Promise<void> {
    if (!uid) return;
    try {
      const userRef = doc(this.firestore, 'users', uid);
      const snap = await getDoc(userRef);
      if (!snap.exists()) {
          await setDoc(userRef, { uid, fcmTokens: [], createdAt: new Date().toISOString() });
      }
    } catch (e) { console.warn("Erreur ensurefcmTokensForUser:", e); }
  }

  // Récupération des notifs (Sécurisé avec runInInjectionContext)
  getUserNotifications(uid: string): Observable<any[]> {
    if (!uid) return of([]);
    const notifRef = collection(this.firestore, `users/${uid}/notifications`);
    const q = query(notifRef, orderBy('createdAt', 'desc'), limit(50));
    
    return runInInjectionContext(this.injector, () => {
        return collectionData(q, { idField: 'id' });
    });
  }

  // Compteur non lu (Sécurisé)
  getUnreadCount(uid?: string): Observable<number> {
    if (!uid) return of(0);
    const notifRef = collection(this.firestore, `users/${uid}/notifications`);
    const q = query(notifRef, where('read', '==', false));

    return runInInjectionContext(this.injector, () => {
        return collectionData(q, { idField: 'id' }).pipe(map(list => list.length));
    });
  }

  async markAsRead(uid: string, notifId: string) {
      if(!uid || !notifId) return;
      await updateDoc(doc(this.firestore, `users/${uid}/notifications/${notifId}`), { read: true });
  }

  async markAllAsRead(uid: string, notifications: any[]) {
      if(!uid || !notifications?.length) return;
      const batch = writeBatch(this.firestore);
      notifications.filter(n => !n.read).forEach(n => {
          batch.update(doc(this.firestore, `users/${uid}/notifications/${n.id}`), { read: true });
      });
      await batch.commit();
  }
}
