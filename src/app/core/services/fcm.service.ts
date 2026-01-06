import { Injectable, inject } from '@angular/core';
import { Messaging, getToken, onMessage } from '@angular/fire/messaging';
import { Firestore, doc, updateDoc, arrayUnion } from '@angular/fire/firestore';
import { environment } from '../../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class FcmService {
  private messaging = inject(Messaging);
  private firestore = inject(Firestore);

  constructor() {
    this.listenToMessages();
  }

  async requestPermission(userId: string) {
    console.log('🔔 Demande de permission FCM...');
    try {
      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
        const token = await getToken(this.messaging, { 
          vapidKey: environment.firebase?.vapidKey 
        });
        
        if (token) {
          console.log('✅ Token FCM:', token);
          await this.saveToken(userId, token);
        }
      } else {
        console.warn('❌ Permission refusée.');
      }
    } catch (error) {
      console.error('❌ Erreur FCM:', error);
    }
  }

  private async saveToken(userId: string, token: string) {
    if (!userId) return;
    const userRef = doc(this.firestore, 'users', userId);
    try {
      await updateDoc(userRef, { fcmTokens: arrayUnion(token) });
      console.log('💾 Token sauvegardé.');
    } catch (e) {
      console.error('⚠️ Erreur sauvegarde token:', e);
    }
  }

  listenToMessages() {
    onMessage(this.messaging, (payload) => {
      console.log('📩 Message reçu:', payload);
      if (payload.notification) {
        new Notification(payload.notification.title || 'Notification', {
          body: payload.notification.body,
          icon: '/assets/icons/icon-72x72.png'
        });
      }
    });
  }
}
