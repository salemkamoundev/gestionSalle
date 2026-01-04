import { Injectable, inject } from '@angular/core';
import { Firestore, collection, addDoc, deleteDoc, updateDoc, doc, query, where, Timestamp, orderBy, getDocs } from '@angular/fire/firestore';
import { Observable, from } from 'rxjs';
import { map } from 'rxjs/operators';

@Injectable({
  providedIn: 'root'
})
export class PaymentService {
  private firestore = inject(Firestore);
  private collectionName = 'payments';

  constructor() {}

  // --- CRUD ---

  async addPayment(payment: any): Promise<void> {
    const colRef = collection(this.firestore, this.collectionName);
    const data = { ...payment, createdAt: Timestamp.now() };
    await addDoc(colRef, data);
  }

  async add(data: any) { return this.addPayment(data); }

  // FIX: Utilisation de getDocs (Promise) converti en Observable.
  // Cela évite l'erreur "outside injection context" car getDocs ne dépend pas du contexte Angular.
  getPayments(): Observable<any[]> {
    const colRef = collection(this.firestore, this.collectionName);
    const q = query(colRef, orderBy('createdAt', 'desc'));
    
    return from(getDocs(q)).pipe(
      map(snapshot => snapshot.docs.map(d => ({ id: d.id, ...d.data() })))
    );
  }
  getAll() { return this.getPayments(); }

  getPaymentsByReservation(reservationId: string): Observable<any[]> {
    const colRef = collection(this.firestore, this.collectionName);
    const q = query(colRef, where('reservationId', '==', reservationId));
    
    // FIX: Approche stable "One-shot" pour éviter tout risque de boucle ou crash
    return from(getDocs(q)).pipe(
      map(snapshot => snapshot.docs.map(d => ({ id: d.id, ...d.data() })))
    );
  }
  getByReservation(id: string) { return this.getPaymentsByReservation(id); }

  async updatePayment(id: string, data: any): Promise<void> {
    const docRef = doc(this.firestore, this.collectionName, id);
    await updateDoc(docRef, data);
  }
  async update(id: string, data: any) { return this.updatePayment(id, data); }

  async deletePayment(id: string): Promise<void> {
    const docRef = doc(this.firestore, this.collectionName, id);
    await deleteDoc(docRef);
  }
  async delete(id: string) { return this.deletePayment(id); }

  async getTotalPaid(reservationId: string): Promise<number> {
    const colRef = collection(this.firestore, this.collectionName);
    const q = query(colRef, where('reservationId', '==', reservationId));
    const snap = await getDocs(q);
    if (snap.empty) return 0;
    return snap.docs.reduce((sum, d) => sum + (Number(d.data()['amount']) || 0), 0);
  }
}