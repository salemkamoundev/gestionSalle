import { Injectable, inject } from '@angular/core';
import { Firestore, collection, addDoc, deleteDoc, updateDoc, doc, collectionData, query, where, Timestamp } from '@angular/fire/firestore';
import { Observable, firstValueFrom } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class PaymentService {
  private firestore = inject(Firestore);
  private collectionName = 'payments';

  constructor() {}

  // =========================================================
  // MÉTHODES PRINCIPALES (LOGIQUE MÉTIER)
  // =========================================================

  /** AJOUTER */
  async addPayment(payment: any): Promise<void> {
    const colRef = collection(this.firestore, this.collectionName);
    const data = {
        ...payment,
        createdAt: Timestamp.now()
    };
    await addDoc(colRef, data);
  }

  /** LIRE TOUT */
  getPayments(): Observable<any[]> {
    const colRef = collection(this.firestore, this.collectionName);
    // On force le type Observable<any[]> pour éviter l'erreur TS2488
    return collectionData(colRef, { idField: 'id' }) as Observable<any[]>;
  }

  /** METTRE À JOUR */
  async updatePayment(id: string, data: any): Promise<void> {
    const docRef = doc(this.firestore, this.collectionName, id);
    await updateDoc(docRef, data);
  }

  /** SUPPRIMER */
  async deletePayment(id: string): Promise<void> {
    const docRef = doc(this.firestore, this.collectionName, id);
    await deleteDoc(docRef);
  }

  /** PAR RÉSERVATION */
  getPaymentsByReservation(reservationId: string): Observable<any[]> {
    const colRef = collection(this.firestore, this.collectionName);
    const q = query(colRef, where('reservationId', '==', reservationId));
    return collectionData(q, { idField: 'id' }) as Observable<any[]>;
  }

  /** TOTAL PAYÉ */
  async getTotalPaid(reservationId: string): Promise<number> {
    const colRef = collection(this.firestore, this.collectionName);
    const q = query(colRef, where('reservationId', '==', reservationId));
    
    // firstValueFrom convertit l'Observable en Promise (one-shot)
    const payments = await firstValueFrom(collectionData(q, { idField: 'id' })) as any[];
    
    if (!payments || payments.length === 0) return 0;
    return payments.reduce((sum: number, p: any) => sum + (Number(p.amount) || 0), 0);
  }

  // =========================================================
  // ALIAS DE COMPATIBILITÉ (Pour faire plaisir aux anciens composants)
  // =========================================================

  // Pour payment-list.component.ts (attend 'getAll')
  getAll(): Observable<any[]> {
    return this.getPayments();
  }

  // Pour payment-modal.component.ts (attend 'add')
  add(data: any): Promise<void> {
    return this.addPayment(data);
  }

  // Pour payment-modal.component.ts (attend 'update')
  update(id: string, data: any): Promise<void> {
    return this.updatePayment(id, data);
  }

  // Pour payment-list.component.ts & payment-modal.component.ts (attend 'delete')
  delete(id: string): Promise<void> {
    return this.deletePayment(id);
  }

  // Pour payment-modal.component.ts & payment-reservation-detail (attend 'getByReservation')
  getByReservation(id: string): Observable<any[]> {
    return this.getPaymentsByReservation(id);
  }
}
