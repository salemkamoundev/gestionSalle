import { inject } from '@angular/core';
import { 
  Firestore, 
  collection as firestoreCollection, // Renommé pour clarté
  addDoc, 
  doc, 
  deleteDoc, 
  updateDoc,
  query,
  onSnapshot,
  QueryConstraint,
  docData // On garde docData qui est souvent moins capricieux, sinon on passera en natif aussi
} from '@angular/fire/firestore';
import { Observable } from 'rxjs';

// NOTE: Pour les fonctions impératives (add, delete, update), on utilise les fonctions du SDK
// Pour les Observables, on utilise onSnapshot manuel pour éviter "outside injection context".

export abstract class FirestoreCrudService<T> {
  protected firestore = inject(Firestore);
  protected abstract collectionName: string;

  getAll(constraints: QueryConstraint[] = []): Observable<T[]> {
    return new Observable(observer => {
      const col = firestoreCollection(this.firestore, this.collectionName);
      const q = query(col, ...constraints);
      
      const unsubscribe = onSnapshot(q, 
        (snapshot) => {
          const data = snapshot.docs.map(d => ({ id: d.id, ...d.data() })) as T[];
          observer.next(data);
        },
        (error) => {
          observer.error(error);
        }
      );

      return () => unsubscribe();
    });
  }

  getById(id: string): Observable<T | undefined> {
    const docRef = doc(this.firestore, this.collectionName, id);
    return docData(docRef, { idField: 'id' }) as Observable<T>;
  }

  add(item: T): Promise<any> {
    const col = firestoreCollection(this.firestore, this.collectionName);
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
