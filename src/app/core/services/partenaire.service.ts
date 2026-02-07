import { Injectable, inject, NgZone } from '@angular/core';
import { Firestore } from '@angular/fire/firestore'; // Seulement pour l'injection
import { Auth, updateProfile } from '@angular/fire/auth';
// Import du SDK Natif pour contourner les erreurs d'injection
import * as FS from 'firebase/firestore';

// Imports pour l'instance secondaire (Auth)
import { initializeApp, deleteApp, FirebaseApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword, signOut } from 'firebase/auth';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ServerPartenaire } from '../models/partenaire.model';

@Injectable({
  providedIn: 'root'
})
export class PartenaireService {
  private firestore = inject(Firestore);
  private auth = inject(Auth);
  private zone = inject(NgZone); // Pour rafraîchir l'UI
  
  private collectionName = 'partenaire'; 

  getAll(): Observable<ServerPartenaire[]> {
    const colRef = FS.collection(this.firestore as any, this.collectionName);
    
    return new Observable((observer) => {
      const unsubscribe = FS.onSnapshot(colRef, (snapshot) => {
        this.zone.run(() => {
          const data = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as ServerPartenaire));
          observer.next(data);
        });
      }, (error) => this.zone.run(() => observer.error(error)));

      return () => unsubscribe();
    });
  }

  getById(id: string): Observable<ServerPartenaire | undefined> {
    const docRef = FS.doc(this.firestore as any, this.collectionName, id);
    
    return new Observable((observer) => {
      const unsubscribe = FS.onSnapshot(docRef, (snapshot) => {
        this.zone.run(() => {
          if (snapshot.exists()) {
            observer.next({ id: snapshot.id, ...snapshot.data() } as ServerPartenaire);
          } else {
            observer.next(undefined);
          }
        });
      }, (error) => this.zone.run(() => observer.error(error)));

      return () => unsubscribe();
    });
  }

  /**
   * Crée un partenaire.
   * Utilise une instance Firebase SECONDAIRE pour ne pas déconnecter l'admin.
   */
  async add(partenaire: ServerPartenaire, password?: string): Promise<any> {
    let uid = '';
    let secondaryApp: FirebaseApp | null = null;
    
    if (password && partenaire.email) {
      try {
        const secondaryAppName = 'secondaryApp-' + Date.now();
        secondaryApp = initializeApp(environment.firebase, secondaryAppName);
        const secondaryAuth = getAuth(secondaryApp);

        const userCredential = await createUserWithEmailAndPassword(secondaryAuth, partenaire.email, password);
        uid = userCredential.user.uid;
        
        await updateProfile(userCredential.user, { displayName: partenaire.nom });
        await signOut(secondaryAuth);

      } catch (e) {
        if (secondaryApp) await deleteApp(secondaryApp);
        throw e; 
      }
    } else {
       // Création ID natif
       const newDoc = FS.doc(FS.collection(this.firestore as any, this.collectionName));
       uid = newDoc.id;
    }

    if (secondaryApp) {
        await deleteApp(secondaryApp);
    }

    const docRef = FS.doc(this.firestore as any, this.collectionName, uid);
    const dataToSave = { 
        ...partenaire, 
        createdAt: new Date().toISOString(),
        role: partenaire.role || 'SERVER'
    };
    
    await FS.setDoc(docRef, dataToSave);
    return { id: uid, ...dataToSave };
  }

  async update(id: string, partenaire: Partial<ServerPartenaire>, newPassword?: string): Promise<void> {
    const docRef = FS.doc(this.firestore as any, this.collectionName, id);
    await FS.updateDoc(docRef, partenaire);

    if (newPassword) {
        console.warn('⚠️ La modification du mot de passe nécessite une Cloud Function.');
    }
  }

  async delete(id: string): Promise<void> {
    const docRef = FS.doc(this.firestore as any, this.collectionName, id);
    await FS.deleteDoc(docRef);
  }
}