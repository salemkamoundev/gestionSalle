import { Injectable } from '@angular/core';
import { Messaging, getToken, onMessage } from '@angular/fire/messaging';
import { Firestore, doc, setDoc } from '@angular/fire/firestore';
import { Auth, authState } from '@angular/fire/auth';
import { filter, take, switchMap } from 'rxjs/operators';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class FcmFixedService {

  constructor(
    private messaging: Messaging,
    private firestore: Firestore,
    private auth: Auth
  ) { }

  /**
   * Demande la permission et enregistre le token si l'utilisateur est connecté.
   * @param vapidKey Votre clé VAPID disponible dans la console Firebase
   */
  async requestPermission(vapidKey: string) {
    try {
      console.log('Demande de permission FCM...');
      const token = await getToken(this.messaging, { vapidKey });

      if (token) {
        console.log('Token FCM obtenu :', token);
        await this.saveTokenToFirestore(token);
      } else {
        console.log('Impossible de récupérer le token FCM.');
      }
    } catch (error) {
      console.error('Erreur lors de la récupération du token FCM', error);
    }
  }

  /**
   * Écoute les messages quand l'app est au premier plan
   */
  listenForMessages() {
    onMessage(this.messaging, (payload) => {
      console.log('Message reçu au premier plan :', payload);
      // Ici vous pouvez afficher un Toast ou une alerte
    });
  }

  /**
   * Sauvegarde le token dans la collection 'users' de Firestore
   * Vérifie d'abord que l'utilisateur est bien authentifié.
   */
  private async saveTokenToFirestore(token: string) {
    const user = this.auth.currentUser;

    if (!user) {
      console.warn('ATTENTION : Utilisateur non connecté. Le token ne sera pas sauvegardé en base.');
      // Optionnel : On peut attendre que l'utilisateur se connecte via RxJS si besoin
      return;
    }

    const userDocRef = doc(this.firestore, `users/${user.uid}`);

    try {
      // Utilisation de setDoc avec merge: true pour ne pas écraser les autres données (nom, email, etc.)
      await setDoc(userDocRef, { fcmToken: token }, { merge: true });
      console.log(`Succès : Token enregistré dans Firestore pour l'UID ${user.uid}`);
    } catch (error) {
      console.error('ERREUR CRITIQUE : Impossible d\'écrire dans Firestore.', error);
      console.error('Vérifiez vos règles de sécurité Firestore.');
    }
  }
}
