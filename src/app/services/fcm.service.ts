import { Injectable } from '@angular/core';
import { Firestore, collection, doc, setDoc, query, where, getDocs, arrayUnion } from '@angular/fire/firestore';

@Injectable({
  providedIn: 'root'
})
export class FcmService {

  constructor(private firestore: Firestore) {}

  // Recherche UID par email
  async findUidByEmail(email: string): Promise<string | null> {
    try {
      const usersRef = collection(this.firestore, 'users');
      const q = query(usersRef, where('email', '==', email));
      const querySnapshot = await getDocs(q);

      if (!querySnapshot.empty) {
        return querySnapshot.docs[0].id;
      }
      return null;
    } catch (e) {
      console.error('Erreur recherche user:', e);
      return null;
    }
  }

  // Sauvegarde Token
  async saveTokenToUser(uid: string, token: string) {
    if (!uid || !token) return;
    const userRef = doc(this.firestore, `users/${uid}`);
    try {
      await setDoc(userRef, { 
        fcmTokens: arrayUnion(token),
        lastfcmTokens: token
      }, { merge: true });
    } catch (err) { console.error(err); }
  }
}
