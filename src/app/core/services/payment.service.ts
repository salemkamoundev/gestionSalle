import { Injectable, inject, Injector, runInInjectionContext } from '@angular/core';
import { Firestore, collection, addDoc, deleteDoc, updateDoc, doc, query, where, Timestamp, orderBy, getDocs, collectionData } from '@angular/fire/firestore';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class PaymentService {
  private firestore = inject(Firestore);
  private injector = inject(Injector);

  constructor() {}

  async addPayment(payment: any): Promise<void> {
    const colRef = collection(this.firestore, 'payments');
    const data = { ...payment, createdAt: Timestamp.now(), date: payment.date || new Date().toISOString() };
    await addDoc(colRef, data);
  }
  async add(data: any) { return this.addPayment(data); }

  getPayments(): Observable<any[]> {
    return runInInjectionContext(this.injector, () => {
        const colRef = collection(this.firestore, 'payments');
        const q = query(colRef, orderBy('createdAt', 'desc'));
        return collectionData(q, { idField: 'id' });
    });
  }
  getAll() { return this.getPayments(); }

  getPaymentsByReservation(reservationId: string): Observable<any[]> {
    return runInInjectionContext(this.injector, () => {
        const colRef = collection(this.firestore, 'payments');
        const q = query(colRef, where('reservationId', '==', reservationId));
        return collectionData(q, { idField: 'id' });
    });
  }
  getByReservation(id: string) { return this.getPaymentsByReservation(id); }

  async updatePayment(id: string, data: any): Promise<void> {
    const docRef = doc(this.firestore, 'payments', id);
    await updateDoc(docRef, data);
  }
  async update(id: string, data: any) { return this.updatePayment(id, data); }

  async deletePayment(id: string): Promise<void> {
    const docRef = doc(this.firestore, 'payments', id);
    await deleteDoc(docRef);
  }
  async delete(id: string) { return this.deletePayment(id); }

  async getTotalPaid(reservationId: string): Promise<number> {
    const colRef = collection(this.firestore, 'payments');
    const q = query(colRef, where('reservationId', '==', reservationId));
    const snap = await getDocs(q);
    if (snap.empty) return 0;
    return snap.docs.reduce((sum, d) => sum + (Number(d.data()['amount']) || 0), 0);
  }
}
