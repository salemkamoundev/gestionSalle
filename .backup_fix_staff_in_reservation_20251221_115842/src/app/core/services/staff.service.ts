import { Injectable, inject } from '@angular/core';
import { Firestore, collection, doc, setDoc, updateDoc, deleteDoc, docData, collectionData } from '@angular/fire/firestore';
import { Auth } from '@angular/fire/auth';
import { FirebaseApp, initializeApp, deleteApp } from '@angular/fire/app';
import { getAuth, createUserWithEmailAndPassword, signOut } from 'firebase/auth';
import { ServerStaff } from '../models/staff.model';
import { ActivityService } from './activity.service';
import { Observable } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class StaffService {
  private firestore = inject(Firestore);
  private app = inject(FirebaseApp);
  private logger = inject(ActivityService);
  
  protected collectionName = 'users';

  getAll(): Observable<ServerStaff[]> {
    const col = collection(this.firestore, this.collectionName);
    return collectionData(col, { idField: 'id' }) as Observable<ServerStaff[]>;
  }

  getById(id: string): Observable<ServerStaff | undefined> {
    const docRef = doc(this.firestore, this.collectionName, id);
    return docData(docRef, { idField: 'id' }) as Observable<ServerStaff>;
  }

  async add(item: ServerStaff, password?: string): Promise<any> {
    if (!password) throw new Error("Mot de passe requis");

    // Création App Secondaire pour ne pas déconnecter l'admin
    const secondaryApp = initializeApp(this.app.options, 'SecondaryApp');
    const secondaryAuth = getAuth(secondaryApp);
    let newUid = '';

    try {
      const cred = await createUserWithEmailAndPassword(secondaryAuth, item.email, password);
      newUid = cred.user.uid;
      await signOut(secondaryAuth);
    } catch (e) {
      await deleteApp(secondaryApp);
      throw e;
    }
    await deleteApp(secondaryApp);

    // Sauvegarde Firestore avec l'UID Auth
    const userDoc = doc(this.firestore, this.collectionName, newUid);
    await setDoc(userDoc, { ...item }); // Le mot de passe n'est pas dans 'item' ici normalement

    this.logger.log('CREATE', 'STAFF', `Nouveau membre : ${item.nom}`, { id: newUid });
    return { id: newUid };
  }

  async update(id: string, item: Partial<ServerStaff>): Promise<void> {
    const docRef = doc(this.firestore, this.collectionName, id);
    await updateDoc(docRef, item);
    this.logger.log('UPDATE', 'STAFF', `Mise à jour staff : ${item.nom || id}`, { id });
  }

  async delete(id: string): Promise<void> {
    // Suppression doc seulement (Auth nécessiterait Cloud Function Admin SDK)
    const docRef = doc(this.firestore, this.collectionName, id);
    await deleteDoc(docRef);
    this.logger.log('DELETE', 'STAFF', `Suppression staff ID: ${id}`, { id });
  }
}
