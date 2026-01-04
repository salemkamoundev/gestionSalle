import { Injectable, inject, NgZone } from '@angular/core';
import { Firestore, collection, doc, addDoc, updateDoc, deleteDoc, query, orderBy, onSnapshot, docData, runTransaction } from '@angular/fire/firestore';
import { Observable } from 'rxjs';
import { Reservation } from '../models/reservation.model';

@Injectable({
  providedIn: 'root'
})
export class ReservationService {
  private firestore = inject(Firestore);
  private zone = inject(NgZone); // Pour forcer la mise à jour de l'UI

  constructor() {}

  // --- LECTURE TEMPS RÉEL ---
  getAll(): Observable<any[]> {
    return new Observable(observer => {
      const ref = collection(this.firestore, 'reservations');
      const q = query(ref, orderBy('date', 'asc'));
      
      console.log("📡 Connexion au flux des réservations...");
      
      const unsubscribe = onSnapshot(q, (snap) => {
        // On force l'exécution dans la zone Angular pour mettre à jour l'UI
        this.zone.run(() => {
            const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            console.log(`📥 ${list.length} réservations reçues (Mise à jour)`);
            observer.next(list);
        });
      }, (error) => {
        console.error("Erreur Firestore:", error);
        observer.error(error);
      });
      
      return () => unsubscribe();
    });
  }

  getReservations(): Observable<any[]> { return this.getAll(); }

  getById(id: string): Observable<Reservation> {
    const docRef = doc(this.firestore, `reservations/${id}`);
    return docData(docRef, { idField: 'id' }) as Observable<Reservation>;
  }

  // --- ECRITURE ---
  addReservation(data: any) {
    const ref = collection(this.firestore, 'reservations');
    return addDoc(ref, { ...data, status: 'CONFIRMED', createdAt: new Date().toISOString() });
  }

  updateReservation(id: string, data: any) {
    const docRef = doc(this.firestore, `reservations/${id}`);
    return updateDoc(docRef, { ...data, updatedAt: new Date().toISOString() });
  }

  async add(data: any) { return this.addReservation(data); }
  async update(id: string, data: any) { return this.updateReservation(id, data); }

  // --- SOFT DELETE ---
  async delete(id: string) {
      if (!id) return;
      const docRef = doc(this.firestore, `reservations/${id}`);
      
      console.log(`🗑️ Soft Delete activé pour : ${id}`);
      
      await updateDoc(docRef, { 
          status: 'CANCELLED',
          cancelledAt: new Date().toISOString(),
          cancellationNotified: false 
      });
  }

  // --- LOGIQUE MÉTIER ---
  async applyCredit(reservationId: string, credit: any): Promise<void> {
      await addDoc(collection(this.firestore, 'payments'), {
          reservationId: reservationId,
          amount: credit.amount,
          type: 'BON',
          creditId: credit.id,
          date: new Date().toISOString(),
          reference: 'Utilisation Avoir ' + (credit.id || 'N/A')
      });
      const creditRef = doc(this.firestore, 'provisional_receipts', credit.id);
      await updateDoc(creditRef, { status: 'USED', usedInReservation: reservationId, usedAt: new Date().toISOString() });
  }

  async cancelWithTransaction(reservationId: string, payments: any[], clientId: string, reservationDate: string): Promise<void> {
      if (!reservationId) throw new Error("ID manquant");
      await runTransaction(this.firestore, async (transaction) => {
          for (const p of payments) {
              if (p.type === 'BON' && p.creditId) {
                  const creditRef = doc(this.firestore, 'provisional_receipts', p.creditId);
                  transaction.update(creditRef, { status: 'AVAILABLE', usedForReservationId: null, usedAt: null });
              } else {
                  const newReceiptRef = doc(collection(this.firestore, 'provisional_receipts'));
                  transaction.set(newReceiptRef, {
                      clientId: clientId, amount: p.amount, createdAt: new Date(),
                      originalPaymentDate: p.date || new Date().toISOString(),
                      originalPaymentType: p.type || 'INCONNU',
                      source: 'CANCELLATION', sourceReservationId: reservationId,
                      description: `Avoir annulation du ${reservationDate}`, status: 'AVAILABLE'
                  });
              }
              transaction.delete(doc(this.firestore, 'payments', p.id));
          }
          const resRef = doc(this.firestore, 'reservations', reservationId);
          transaction.update(resRef, { status: 'CANCELLED', updatedAt: new Date().toISOString(), cancellationNotified: false });
      });
  }
}
