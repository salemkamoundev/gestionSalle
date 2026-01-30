import { Injectable, inject, Injector, runInInjectionContext } from '@angular/core';
import { Firestore, collection, doc, addDoc, updateDoc, deleteDoc, query, orderBy, collectionData, docData } from '@angular/fire/firestore';
import { Observable } from 'rxjs';
import { Pack } from '../models/pack.model';

@Injectable({
  providedIn: 'root'
})
export class PackService {
  private firestore = inject(Firestore);
  private injector = inject(Injector);

  constructor() {}

  // --- LECTURE ---
  getAll(): Observable<Pack[]> {
    return runInInjectionContext(this.injector, () => {
      const ref = collection(this.firestore, 'packs');
      const q = query(ref, orderBy('createdAt', 'desc'));
      return collectionData(q, { idField: 'id' }) as Observable<Pack[]>;
    });
  }

  getById(id: string): Observable<Pack> {
    return runInInjectionContext(this.injector, () => {
        const docRef = doc(this.firestore, `packs/${id}`);
        return docData(docRef, { idField: 'id' }) as Observable<Pack>;
    });
  }

  // --- ÉCRITURE (SANS NOTIFICATIONS) ---
  async add(pack: Pack) {
      // Uniquement l'enregistrement en base, aucune notification n'est envoyée ici.
      const ref = collection(this.firestore, 'packs');
      await addDoc(ref, { 
        ...pack, 
        createdAt: new Date().toISOString(),
        active: pack.active ?? true 
      });
  }

  async update(id: string, pack: Partial<Pack>) {
      const docRef = doc(this.firestore, `packs/${id}`);
      await updateDoc(docRef, { ...pack, updatedAt: new Date().toISOString() });
  }

  async delete(id: string) {
      const docRef = doc(this.firestore, `packs/${id}`);
      await deleteDoc(docRef);
  }
}
