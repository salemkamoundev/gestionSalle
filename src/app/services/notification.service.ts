import { Injectable, inject } from '@angular/core';
import { Firestore, doc, setDoc, arrayUnion } from '@angular/fire/firestore';
import { getMessaging, getToken, isSupported } from 'firebase/messaging';
import { FirebaseApp } from '@angular/fire/app';
import { environment } from '../../environments/environment';
import { AuthService } from '../core/services/auth.service'; // Assurez-vous d'avoir accès au user courant

@Injectable({ providedIn: 'root' })
export class NotificationService {
  private readonly firestore = inject(Firestore);
  private readonly app = inject(FirebaseApp);
  private readonly authService = inject(AuthService); // Pour savoir qui est connecté

  async registerFcmServiceWorker(): Promise<ServiceWorkerRegistration | null> {
    if (!('serviceWorker' in navigator)) return null;
    try {
        const reg = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
        return reg;
    } catch (e) {
        console.error("SW Register Fail", e);
        return null;
    }
  }

  async ensurefcmTokensForUser(uid: string): Promise<string | null> {
    const supported = await isSupported().catch(() => false);
    if (!supported) return null;

    const permission = await Notification.requestPermission();
    if (permission !== 'granted') return null;

    const reg = await this.registerFcmServiceWorker();
    if (!reg) return null;

    const messaging = getMessaging(this.app);
    // VAPID Key
    const vapidKey = 'BM2RBmBWpexF8AuEX7bJ34DVvtbPi0-9pbP8yYZ7nU8hfR6vSQZvUuZoAF-V96X05k0-ujJLEM55aH9BFLqtNuA';

    try {
        const token = await getToken(messaging, { vapidKey, serviceWorkerRegistration: reg });
        if (!token) return null;

        console.log('[FCM] Token obtenu:', token);

        // DETERMINER LA COLLECTION CIBLE
        // Si c'est un admin ou un partenaire, on stocke souvent dans 'partenaire' ou 'users'
        // Pour que le script Node fonctionne, si cet UID est utilisé dans 'assignedServerIds',
        // il DOIT être dans la collection visée par le script (CONFIG.COLLECTION_USERS = 'partenaire').
        
        // On écrit dans les deux pour être sûr (ou adaptez selon votre logique Auth)
        const collectionName = 'partenaire'; 

        const userRef = doc(this.firestore, `${collectionName}/${uid}`);
        
        // Format compatible avec le script Node.js
        await setDoc(userRef, {
            fcmTokens: arrayUnion(token), // Ajoute au tableau sans doublon
            lastfcmTokens: token          // Met à jour le dernier token
        }, { merge: true });

        return token;
    } catch (e) {
        console.error('[FCM] Erreur récupération token', e);
        return null;
    }
  }
}