#!/bin/bash

# fix_notification_type.sh
# Corrige l'erreur TS2322 : Remplace 'null' par 'undefined' pour la propriété 'link'.

cat > src/app/core/services/notification.service.ts << 'EOF'
import { Injectable } from '@angular/core';
import { Messaging, getToken, onMessage } from '@angular/fire/messaging';
import { 
  Firestore, 
  collection, 
  collectionData, 
  query, 
  where, 
  orderBy, 
  limit, 
  doc, 
  setDoc, 
  updateDoc, 
  addDoc,
  writeBatch,
  serverTimestamp 
} from '@angular/fire/firestore';
import { Auth, authState } from '@angular/fire/auth';
import { filter, take, tap, map } from 'rxjs/operators';
import { Observable, of } from 'rxjs';

// IMPORT MODÈLE
import { AppNotification } from '../models/notification.model';

@Injectable({
  providedIn: 'root'
})
export class NotificationService {

  constructor(
    private messaging: Messaging,
    private firestore: Firestore,
    private auth: Auth
  ) { }

  /**
   * --- GESTION DES TOKENS ---
   */
  async initNotification(vapidKey: string) {
    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') return;

      const token = await getToken(this.messaging, { vapidKey });
      if (token) {
        console.log('Token FCM :', token);
        this.saveTokenToFirestore(token);
      }
    } catch (error) {
      console.error('Erreur init notification:', error);
    }
    this.listenForMessages();
  }

  async ensurefcmTokensForUser(uid: string) {
    // Compatibilité existante
  }

  private saveTokenToFirestore(token: string) {
    authState(this.auth).pipe(
      filter(user => !!user),
      take(1),
      tap(async (user) => {
        if (!user) return;
        const userRef = doc(this.firestore, `users/${user.uid}`);
        try {
          await setDoc(userRef, { fcmToken: token }, { merge: true });
        } catch (err) {
          console.error('Erreur sauvegarde token:', err);
        }
      })
    ).subscribe();
  }

  private listenForMessages() {
    onMessage(this.messaging, (payload) => {
      console.log('Message reçu (Foreground):', payload);
      
      const user = this.auth.currentUser;
      if (user && payload.notification) {
        this.addNotification(user.uid, {
          title: payload.notification.title || 'Notification',
          body: payload.notification.body || '',
          icon: payload.notification.icon || 'notifications',
          type: 'info',
          // CORRECTION ICI : utiliser 'undefined' au lieu de 'null'
          link: payload.data?.['link'] || undefined 
        });
      }
    });
  }

  /**
   * --- CRUD NOTIFICATIONS ---
   */

  async addNotification(uid: string, notification: Partial<AppNotification>) {
    if (!uid) return;
    try {
      const notifRef = collection(this.firestore, `users/${uid}/notifications`);
      await addDoc(notifRef, {
        ...notification,
        read: false,
        createdAt: serverTimestamp()
      });
    } catch (e) {
      console.error('Erreur addNotification:', e);
    }
  }

  getUserNotifications(uid: string): Observable<AppNotification[]> {
    if (!uid) return of([]);
    const notifRef = collection(this.firestore, `users/${uid}/notifications`);
    const q = query(notifRef, orderBy('createdAt', 'desc'), limit(50));
    return collectionData(q, { idField: 'id' }) as Observable<AppNotification[]>;
  }

  getUnreadCount(uid: string): Observable<number> {
    if (!uid) return of(0);
    const notifRef = collection(this.firestore, `users/${uid}/notifications`);
    const q = query(notifRef, where('read', '==', false));
    return collectionData(q).pipe(map(list => list.length));
  }

  async markAsRead(uid: string, notificationId: string) {
    if (!uid || !notificationId) return;
    try {
      const ref = doc(this.firestore, `users/${uid}/notifications/${notificationId}`);
      await updateDoc(ref, { read: true });
    } catch (e) {
      console.error('Erreur markAsRead:', e);
    }
  }

  async markAllAsRead(uid: string, notifications: AppNotification[]) {
    if (!uid || !notifications || notifications.length === 0) return;
    
    const batch = writeBatch(this.firestore);
    let count = 0;

    notifications.forEach(n => {
      if (!n.read && n.id) {
        const ref = doc(this.firestore, `users/${uid}/notifications/${n.id}`);
        batch.update(ref, { read: true });
        count++;
      }
    });

    if (count > 0) {
      await batch.commit();
    }
  }
}
EOF