import { Injectable, inject } from '@angular/core';
import { Firestore, collection, addDoc, deleteDoc, updateDoc, doc, query, where, Timestamp, onSnapshot, orderBy, getDocs } from '@angular/fire/firestore';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class PaymentService {
  private firestore = inject(Firestore);
  private collectionName = 'payments';

  constructor() {}

  // --- Helpers pour éviter 'outside injection context' ---
  private collectionStream(q: any): Observable<any[]> {
    return new Observable(observer => {
      const unsubscribe = onSnapshot(q, (snap: any) => {
        const data = snap.docs.map((doc: any) => ({ id: doc.id, ...doc.data() }));
        observer.next(data);
      }, (err: any) => observer.error(err));
      return () => unsubscribe();
    });
  }

  // --- CRUD ---

  async addPayment(payment: any): Promise<void> {
    const colRef = collection(this.firestore, this.collectionName);
    const data = { ...payment, createdAt: Timestamp.now() };
    await addDoc(colRef, data);
  }

  async add(data: any) { return this.addPayment(data); } // Alias

  getPayments(): Observable<any[]> {
    const colRef = collection(this.firestore, this.collectionName);
    return this.collectionStream(query(colRef, orderBy('createdAt', 'desc')));
  }
  getAll() { return this.getPayments(); } // Alias

  getPaymentsByReservation(reservationId: string): Observable<any[]> {
    const colRef = collection(this.firestore, this.collectionName);
    const q = query(colRef, where('reservationId', '==', reservationId));
    return this.collectionStream(q);
  }
  getByReservation(id: string) { return this.getPaymentsByReservation(id); } // Alias

  async updatePayment(id: string, data: any): Promise<void> {
    const docRef = doc(this.firestore, this.collectionName, id);
    await updateDoc(docRef, data);
  }
  async update(id: string, data: any) { return this.updatePayment(id, data); } // Alias

  async deletePayment(id: string): Promise<void> {
    const docRef = doc(this.firestore, this.collectionName, id);
    await deleteDoc(docRef);
  }
  async delete(id: string) { return this.deletePayment(id); } // Alias

  async getTotalPaid(reservationId: string): Promise<number> {
    const colRef = collection(this.firestore, this.collectionName);
    const q = query(colRef, where('reservationId', '==', reservationId));
    const snap = await getDocs(q);
    if (snap.empty) return 0;
    return snap.docs.reduce((sum, d) => sum + (Number(d.data()['amount']) || 0), 0);
  }
}
