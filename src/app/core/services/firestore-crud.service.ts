import { inject } from '@angular/core';
import { 
  Firestore, 
  collection, 
  collectionData, 
  addDoc, 
  doc, 
  deleteDoc, 
  updateDoc,
  query,
  QueryConstraint
} from '@angular/fire/firestore';
import { Observable } from 'rxjs';

export abstract class FirestoreCrudService<T> {
  protected firestore = inject(Firestore);
  protected abstract collectionName: string;

  getAll(constraints: QueryConstraint[] = []): Observable<T[]> {
    const col = collection(this.firestore, this.collectionName);
    const q = query(col, ...constraints);
    return collectionData(q, { idField: 'id' }) as Observable<T[]>;
  }

  add(item: T): Promise<any> {
    const col = collection(this.firestore, this.collectionName);
    return addDoc(col, item as any);
  }

  delete(id: string): Promise<void> {
    const docRef = doc(this.firestore, this.collectionName, id);
    return deleteDoc(docRef);
  }

  update(id: string, item: Partial<T>): Promise<void> {
    const docRef = doc(this.firestore, this.collectionName, id);
    return updateDoc(docRef, item as any);
  }
}
