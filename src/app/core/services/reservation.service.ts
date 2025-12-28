import { Injectable } from '@angular/core';
import { 
  Firestore, 
  collection, 
  collectionData, 
  doc, 
  docData,
  addDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  orderBy 
} from '@angular/fire/firestore';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { Reservation } from '../models/reservation.model';

@Injectable({
  providedIn: 'root'
})
export class ReservationService {

  constructor(private firestore: Firestore) {}

  getAll(): Observable<Reservation[]> {
    return this.getReservations();
  }

  getReservations(): Observable<Reservation[]> {
    const ref = collection(this.firestore, 'reservations');
    const q = query(ref, orderBy('date', 'asc'));
    
    return collectionData(q, { idField: 'id' }).pipe(
      map((list: any[]) => {
        // Filtre les annulés et cast en Reservation[]
        return list.filter(r => r.status !== 'CANCELLED') as Reservation[];
      })
    );
  }

  getById(id: string): Observable<Reservation> {
    const docRef = doc(this.firestore, `reservations/${id}`);
    return docData(docRef, { idField: 'id' }) as Observable<Reservation>;
  }

  addReservation(data: any) {
    const ref = collection(this.firestore, 'reservations');
    return addDoc(ref, { 
      ...data, 
      status: 'CONFIRMED',
      createdAt: new Date().toISOString() 
    });
  }

  updateReservation(id: string, data: any) {
    const docRef = doc(this.firestore, `reservations/${id}`);
    return updateDoc(docRef, { 
      ...data, 
      updatedAt: new Date().toISOString() 
    });
  }

  async cancelReservation(id: string): Promise<void> {
    if (!id) return;
    await this.updateReservation(id, { status: 'CANCELLED' });
  }

  deleteReservation(id: string) {
    const docRef = doc(this.firestore, `reservations/${id}`);
    return deleteDoc(docRef);
  }
}
