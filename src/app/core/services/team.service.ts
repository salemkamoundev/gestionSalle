import { Injectable, inject } from '@angular/core';
import { Firestore, collection, addDoc, deleteDoc, doc, updateDoc, onSnapshot, docData } from '@angular/fire/firestore';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class TeamService {
  private firestore = inject(Firestore);
  private collectionName = 'teams';

  private getCollectionStream(colName: string): Observable<any[]> {
    return new Observable(observer => {
      const unsubscribe = onSnapshot(collection(this.firestore, colName), 
        (snap) => observer.next(snap.docs.map(d => ({ id: d.id, ...d.data() }))),
        (err) => observer.error(err)
      );
      return () => unsubscribe();
    });
  }

  getPacks(): Observable<any[]> { return this.getCollectionStream('packs'); }
  getTeams(): Observable<any[]> { return this.getCollectionStream('teams'); }
  getStaff(): Observable<any[]> { return this.getCollectionStream('staff'); }
  getAll(): Observable<any[]> { return this.getTeams(); }

  getById(id: string): Observable<any> {
    const docRef = doc(this.firestore, this.collectionName, id);
    return docData(docRef, { idField: 'id' });
  }

  async add(data: any) { await addDoc(collection(this.firestore, this.collectionName), data); }
  async update(id: string, data: any) { await updateDoc(doc(this.firestore, this.collectionName, id), data); }
  async delete(id: string) { await deleteDoc(doc(this.firestore, this.collectionName, id)); }
}
