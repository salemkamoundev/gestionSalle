import { Injectable, inject } from '@angular/core';
import { Firestore, collection, collectionData, doc, addDoc, updateDoc, deleteDoc, docData } from '@angular/fire/firestore';
import { Observable } from 'rxjs';
import { Pack } from '../models/pack.model';

@Injectable({
  providedIn: 'root'
})
export class PackService {
  private firestore = inject(Firestore);
  private collectionName = 'packs';

  // Récupère tous les packs en temps réel
  getAll(): Observable<Pack[]> {
    const colRef = collection(this.firestore, this.collectionName);
    return collectionData(colRef, { idField: 'id' }) as Observable<Pack[]>;
  }

  // Récupère un pack spécifique
  getById(id: string): Observable<Pack | undefined> {
    const docRef = doc(this.firestore, `${this.collectionName}/${id}`);
    return docData(docRef, { idField: 'id' }) as Observable<Pack>;
  }

  // Ajoute un pack dans Firestore
  add(pack: Pack): Promise<void> {
    const colRef = collection(this.firestore, this.collectionName);
    // On retire l'ID s'il est présent pour laisser Firestore le générer
    const { id, ...data } = pack;
    return addDoc(colRef, data).then(() => {}); 
  }

  // Met à jour un pack
  update(id: string, pack: Partial<Pack>): Promise<void> {
    const docRef = doc(this.firestore, `${this.collectionName}/${id}`);
    return updateDoc(docRef, pack);
  }

  // Supprime un pack
  delete(id: string): Promise<void> {
    const docRef = doc(this.firestore, `${this.collectionName}/${id}`);
    return deleteDoc(docRef);
  }
}
