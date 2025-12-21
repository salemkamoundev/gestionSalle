import { Injectable, inject } from '@angular/core';
import { Firestore, collection, collectionData, addDoc, deleteDoc, doc, updateDoc, query, where, docData } from '@angular/fire/firestore';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class TeamService {
  private firestore = inject(Firestore);
  private collectionName = 'teams'; // Par défaut pour le CRUD générique

  // --- MÉTHODES SPÉCIFIQUES ---

  getPacks(): Observable<any[]> {
    const col = collection(this.firestore, 'packs');
    return collectionData(col, { idField: 'id' }) as Observable<any[]>;
  }

  getTeams(): Observable<any[]> {
    const col = collection(this.firestore, 'teams');
    return collectionData(col, { idField: 'id' }) as Observable<any[]>;
  }

  getStaff(): Observable<any[]> {
    const col = collection(this.firestore, 'staff');
    return collectionData(col, { idField: 'id' }) as Observable<any[]>;
  }

  // --- MÉTHODES GÉNÉRIQUES (ALIAS pour TeamListComponent / TeamFormComponent) ---

  getAll(): Observable<any[]> {
    return this.getTeams(); // Par défaut, getAll renvoie les équipes
  }

  getById(id: string): Observable<any> {
    const docRef = doc(this.firestore, this.collectionName, id);
    return docData(docRef, { idField: 'id' });
  }

  async add(data: any): Promise<void> {
    const col = collection(this.firestore, this.collectionName);
    await addDoc(col, data);
  }

  async update(id: string, data: any): Promise<void> {
    const docRef = doc(this.firestore, this.collectionName, id);
    await updateDoc(docRef, data);
  }

  async delete(id: string): Promise<void> {
    const docRef = doc(this.firestore, this.collectionName, id);
    await deleteDoc(docRef);
  }
}
