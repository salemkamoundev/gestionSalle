import { Injectable, inject } from '@angular/core';
import { Firestore, collection, collectionData, doc, deleteDoc, updateDoc, setDoc, query, where } from '@angular/fire/firestore';
import { Auth, updateProfile } from '@angular/fire/auth';
// Imports nécessaires pour l'instance secondaire
import { initializeApp, deleteApp, FirebaseApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword, signOut } from 'firebase/auth';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../../environments/environment'; // Assurez-vous que le chemin est bon
import { ServerPartenaire } from '../models/partenaire.model'; 

@Injectable({
  providedIn: 'root'
})
export class PartenaireService {
  private firestore = inject(Firestore);
  private auth = inject(Auth); // L'instance principale (Admin connecté)
  
  private collectionName = 'partenaire'; 

  getAll(): Observable<ServerPartenaire[]> {
    const colRef = collection(this.firestore, this.collectionName);
    return collectionData(colRef, { idField: 'id' }) as Observable<ServerPartenaire[]>;
  }

  getById(id: string): Observable<ServerPartenaire | undefined> {
    const colRef = collection(this.firestore, this.collectionName);
    const q = query(colRef, where('__name__', '==', id));
    // @ts-ignore
    return collectionData(q, { idField: 'id' }).pipe(
      // @ts-ignore
      map(docs => docs.length > 0 ? docs[0] : undefined)
    );
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
        // 1. Créer une instance temporaire de l'application Firebase
        // Cela permet d'avoir une instance Auth isolée qui ne touche pas à la session courante
        const secondaryAppName = 'secondaryApp-' + Date.now();
        secondaryApp = initializeApp(environment.firebase, secondaryAppName);
        const secondaryAuth = getAuth(secondaryApp);

        // 2. Créer l'utilisateur sur cette instance secondaire
        const userCredential = await createUserWithEmailAndPassword(secondaryAuth, partenaire.email, password);
        uid = userCredential.user.uid;
        
        // 3. Mise à jour du profil (Nom) sur l'instance secondaire
        await updateProfile(userCredential.user, { displayName: partenaire.nom });

        // 4. Déconnexion explicite de l'instance secondaire (sécurité)
        await signOut(secondaryAuth);

      } catch (e) {
        // Nettoyage en cas d'erreur
        if (secondaryApp) await deleteApp(secondaryApp);
        throw e; 
      }
    } else {
       // Cas sans Auth (génération ID simple)
       const newDoc = doc(collection(this.firestore, this.collectionName));
       uid = newDoc.id;
    }

    // 5. Nettoyage de l'instance secondaire si elle a été créée
    if (secondaryApp) {
        await deleteApp(secondaryApp);
    }

    // 6. Enregistrement des données dans Firestore (via l'instance principale, pas de souci ici)
    const docRef = doc(this.firestore, this.collectionName, uid);
    const dataToSave = { 
        ...partenaire, 
        createdAt: new Date().toISOString(),
        role: partenaire.role || 'SERVER'
    };
    
    await setDoc(docRef, dataToSave);
    return { id: uid, ...dataToSave };
  }

  async update(id: string, partenaire: Partial<ServerPartenaire>, newPassword?: string): Promise<void> {
    const docRef = doc(this.firestore, this.collectionName, id);
    
    await updateDoc(docRef, partenaire);

    if (newPassword) {
        console.warn('⚠️ La modification du mot de passe nécessite une Cloud Function pour ne pas déconnecter l\'admin.');
    }
  }

  async delete(id: string): Promise<void> {
    const docRef = doc(this.firestore, this.collectionName, id);
    await deleteDoc(docRef);
  }
}
