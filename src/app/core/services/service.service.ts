import { Injectable, inject } from '@angular/core';
import { Firestore, collection, collectionData, addDoc, deleteDoc, doc, updateDoc } from '@angular/fire/firestore';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class ServiceService {
  private firestore = inject(Firestore);
  private collectionName = 'services';

  constructor() {}

  /** Récupérer tous les services */
  getAll(): Observable<any[]> {
    const colRef = collection(this.firestore, this.collectionName);
    return collectionData(colRef, { idField: 'id' }) as Observable<any[]>;
  }

  /** Ajouter un service */
  async add(service: any): Promise<void> {
    const colRef = collection(this.firestore, this.collectionName);
    await addDoc(colRef, service);
  }

  /** Modifier un service */
  async update(id: string, data: any): Promise<void> {
    const docRef = doc(this.firestore, this.collectionName, id);
    await updateDoc(docRef, data);
  }

  /** Supprimer un service */
  async delete(id: string): Promise<void> {
    const docRef = doc(this.firestore, this.collectionName, id);
    await deleteDoc(docRef);
  }
}
