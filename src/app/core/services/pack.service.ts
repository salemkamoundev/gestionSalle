import { Injectable, inject, Injector, runInInjectionContext } from '@angular/core';
import { Firestore, collection, doc, addDoc, updateDoc, deleteDoc, query, orderBy, collectionData, docData } from '@angular/fire/firestore';
import { Observable } from 'rxjs';
import { Pack } from '../models/pack.model';
import { UiService } from './ui.service';

@Injectable({
  providedIn: 'root'
})
export class PackService {
  private firestore = inject(Firestore);
  private ui = inject(UiService);
  private injector = inject(Injector);

  constructor() {}

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

  async add(pack: Pack) {
    try {
      const ref = collection(this.firestore, 'packs');
      await addDoc(ref, { ...pack, createdAt: new Date().toISOString() });
      // Notifications gérées par le composant
    } catch (e) { throw e; }
  }

  async update(id: string, pack: Partial<Pack>) {
    try {
      const docRef = doc(this.firestore, `packs/${id}`);
      await updateDoc(docRef, { ...pack, updatedAt: new Date().toISOString() });
      // Notifications gérées par le composant
    } catch (e) { throw e; }
  }

  async delete(id: string) {
    try {
      const docRef = doc(this.firestore, `packs/${id}`);
      await deleteDoc(docRef);
    } catch (e) { throw e; }
  }
}
