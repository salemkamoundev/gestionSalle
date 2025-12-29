import { Injectable, inject } from '@angular/core';
import { Firestore, collection, doc, addDoc, updateDoc, deleteDoc, query, orderBy, onSnapshot, docData } from '@angular/fire/firestore';
import { Observable } from 'rxjs';
import { Reservation } from '../models/reservation.model';

@Injectable({
  providedIn: 'root'
})
export class ReservationService {
  private firestore = inject(Firestore);

  constructor() {}

  // Méthode principale observable
  getAll(): Observable<any[]> {
    return new Observable(observer => {
      const ref = collection(this.firestore, 'reservations');
      const q = query(ref, orderBy('date', 'asc'));
      const unsubscribe = onSnapshot(q, (snap) => {
        const list = snap.docs
          .map(d => ({ id: d.id, ...d.data() } as any))
          .filter(r => r.status !== 'CANCELLED');
        observer.next(list);
      });
      return () => unsubscribe();
    });
  }

  // ALIAS CRITIQUE POUR LA COMPATIBILITÉ (Manquait précédemment)
  getReservations(): Observable<any[]> {
    return this.getAll();
  }

  getById(id: string): Observable<Reservation> {
    const docRef = doc(this.firestore, `reservations/${id}`);
    return docData(docRef, { idField: 'id' }) as Observable<Reservation>;
  }

  addReservation(data: any) {
    const ref = collection(this.firestore, 'reservations');
    return addDoc(ref, { ...data, status: 'CONFIRMED', createdAt: new Date().toISOString() });
  }

  updateReservation(id: string, data: any) {
    const docRef = doc(this.firestore, `reservations/${id}`);
    return updateDoc(docRef, { ...data, updatedAt: new Date().toISOString() });
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
