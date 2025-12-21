import { Injectable, inject } from '@angular/core';
import { Firestore, collection, collectionData, addDoc, deleteDoc, doc, updateDoc, query, where, Timestamp, docData } from '@angular/fire/firestore';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class ReservationService {
  private firestore = inject(Firestore);
  private collectionName = 'reservations';

  // Alias pour les composants qui appellent getAll()
  getAll(): Observable<any[]> {
    return this.getReservations();
  }

  getReservations(): Observable<any[]> {
    const col = collection(this.firestore, this.collectionName);
    return collectionData(col, { idField: 'id' }) as Observable<any[]>;
  }

  getById(id: string): Observable<any> {
    const docRef = doc(this.firestore, this.collectionName, id);
    return docData(docRef, { idField: 'id' });
  }

  async addReservation(data: any): Promise<string> {
    const col = collection(this.firestore, this.collectionName);
    const cleanData = this.sanitizeDates(data);
    const ref = await addDoc(col, cleanData);
    return ref.id;
  }

  async updateReservation(id: string, data: any): Promise<void> {
    const docRef = doc(this.firestore, this.collectionName, id);
    const cleanData = this.sanitizeDates(data);
    await updateDoc(docRef, cleanData);
  }

  async deleteReservation(id: string): Promise<void> {
    const docRef = doc(this.firestore, this.collectionName, id);
    await deleteDoc(docRef);
  }

  // Utilitaire date
  private sanitizeDates(data: any): any {
    if (data.date && data.date instanceof Date) {
        data.date = Timestamp.fromDate(data.date);
    }
    return data;
  }
}
