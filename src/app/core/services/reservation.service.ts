import { Injectable, inject } from '@angular/core';
import { Firestore, collection, doc, addDoc, updateDoc, deleteDoc, query, orderBy, onSnapshot, docData, runTransaction } from '@angular/fire/firestore';
import { Observable } from 'rxjs';
import { Reservation } from '../models/reservation.model';

@Injectable({
  providedIn: 'root'
})
export class ReservationService {
  private firestore = inject(Firestore);

  constructor() {}

  // --- LECTURE ---
  getAll(): Observable<any[]> {
    return new Observable(observer => {
      const ref = collection(this.firestore, 'reservations');
      const q = query(ref, orderBy('date', 'asc'));
      
      const unsubscribe = onSnapshot(q, (snap) => {
        const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        observer.next(list);
      }, (error) => {
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

  // --- ECRITURE (Standard) ---
  addReservation(data: any) {
    const ref = collection(this.firestore, 'reservations');
    return addDoc(ref, { ...data, status: 'CONFIRMED', createdAt: new Date().toISOString() });
  }

  updateReservation(id: string, data: any) {
    const docRef = doc(this.firestore, `reservations/${id}`);
    return updateDoc(docRef, { ...data, updatedAt: new Date().toISOString() });
  }

  // --- ALIASES & MÉTHODES COURTES (Pour ReservationFormComponent) ---
  
  // Alias pour addReservation
  async add(data: any) {
      return this.addReservation(data);
  }

  // Alias pour updateReservation
  async update(id: string, data: any) {
      return this.updateReservation(id, data);
  }

  // Suppression physique
  async delete(id: string) {
      if (!id) return;
      const docRef = doc(this.firestore, `reservations/${id}`);
      await deleteDoc(docRef);
  }

  // --- LOGIQUE MÉTIER AVANCÉE ---

  // Utilisation d'un avoir (Crédit)
  async applyCredit(reservationId: string, credit: any): Promise<void> {
      // 1. Créer un paiement de type "BON"
      await addDoc(collection(this.firestore, 'payments'), {
          reservationId: reservationId,
          amount: credit.amount,
          type: 'BON',
          creditId: credit.id,
          date: new Date().toISOString(),
          reference: 'Utilisation Avoir ' + (credit.id || 'N/A')
      });
      
      // 2. Marquer l'avoir comme utilisé
      const creditRef = doc(this.firestore, 'provisional_receipts', credit.id);
      await updateDoc(creditRef, { 
          status: 'USED',
          usedInReservation: reservationId,
          usedAt: new Date().toISOString()
      });
  }

  // Annulation transactionnelle (Gère les paiements -> Avoirs)
  async cancelWithTransaction(reservationId: string, payments: any[], clientId: string, reservationDate: string): Promise<void> {
      if (!reservationId) throw new Error("ID Réservation manquant");

      await runTransaction(this.firestore, async (transaction) => {
          // 1. Traitement des paiements
          for (const p of payments) {
              if (p.type === 'BON' && p.creditId) {
                  // Si c'était un avoir utilisé, on le rend disponible
                  const creditRef = doc(this.firestore, 'provisional_receipts', p.creditId);
                  transaction.update(creditRef, { status: 'AVAILABLE', usedForReservationId: null, usedAt: null });
              } else {
                  // Sinon, on crée un nouvel avoir pour le client
                  const newReceiptRef = doc(collection(this.firestore, 'provisional_receipts'));
                  transaction.set(newReceiptRef, {
                      clientId: clientId,
                      amount: p.amount,
                      createdAt: new Date(),
                      originalPaymentDate: p.date || new Date().toISOString(),
                      originalPaymentType: p.type || 'INCONNU',
                      source: 'CANCELLATION',
                      sourceReservationId: reservationId,
                      description: `Avoir annulation du ${reservationDate}`,
                      status: 'AVAILABLE'
                  });
              }
              // Suppression du paiement lié
              transaction.delete(doc(this.firestore, 'payments', p.id));
          }

          // 2. Annulation de la réservation (Soft Delete ou Statut Annulé)
          const resRef = doc(this.firestore, 'reservations', reservationId);
          // Ici on supprime physiquement comme demandé souvent, ou on met à jour le statut
          // Pour être cohérent avec "delete", on change le statut en CANCELLED
          transaction.update(resRef, { status: 'CANCELLED', updatedAt: new Date().toISOString() });
      });
  }
}
