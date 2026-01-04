import { Injectable, inject, Injector, runInInjectionContext } from '@angular/core';
import { Firestore, collection, doc, addDoc, updateDoc, deleteDoc, query, where, orderBy, collectionData, docData, runTransaction, getDocs } from '@angular/fire/firestore';
import { Observable } from 'rxjs';
import { Reservation } from '../models/reservation.model';

@Injectable({
  providedIn: 'root'
})
export class ReservationService {
  private firestore = inject(Firestore);
  private injector = inject(Injector);

  constructor() {}

  // --- LECTURE ---
  getAll(): Observable<any[]> {
    return runInInjectionContext(this.injector, () => {
      const ref = collection(this.firestore, 'reservations');
      const q = query(ref, orderBy('date', 'desc'));
      return collectionData(q, { idField: 'id' });
    });
  }

  // Alias pour compatibilité
  getReservations(): Observable<any[]> {
      return this.getAll();
  }

  getById(id: string): Observable<Reservation> {
    return runInInjectionContext(this.injector, () => {
        const docRef = doc(this.firestore, `reservations/${id}`);
        return docData(docRef, { idField: 'id' }) as Observable<Reservation>;
    });
  }

  // --- ECRITURE ---
  async add(data: any) {
    const ref = collection(this.firestore, 'reservations');
    return addDoc(ref, { ...data, status: 'CONFIRMED', createdAt: new Date().toISOString() });
  }

  async update(id: string, data: any) {
    const docRef = doc(this.firestore, `reservations/${id}`);
    return updateDoc(docRef, { ...data, updatedAt: new Date().toISOString() });
  }

  // --- SUPPRESSION INTELLIGENTE (Transaction) ---
  async delete(id: string) {
      if (!id) return;
      console.log(`🗑️ Début transaction annulation pour : ${id}`);

      try {
          await runTransaction(this.firestore, async (transaction) => {
              // 1. Lire la réservation pour obtenir le Client ID
              const resRef = doc(this.firestore, 'reservations', id);
              const resSnap = await transaction.get(resRef);
              
              if (!resSnap.exists()) throw "Réservation introuvable";
              const resData = resSnap.data();
              const clientId = resData['clientId'];

              // 2. Récupérer tous les paiements liés (Lecture avant modification)
              const paymentsQuery = query(collection(this.firestore, 'payments'), where('reservationId', '==', id));
              const paymentsSnap = await getDocs(paymentsQuery);

              // 3. Traiter chaque paiement
              paymentsSnap.forEach((pDoc) => {
                  const pData = pDoc.data();
                  
                  // CAS A : C'est un paiement réel (Espèces/Chèque/Virement) -> On crée un NOUVEL Avoir
                  if (pData['type'] !== 'BON') {
                      const newCreditRef = doc(collection(this.firestore, 'provisional_receipts'));
                      transaction.set(newCreditRef, {
                          clientId: clientId,
                          amount: pData['amount'],
                          source: 'ANNULATION',
                          originalPaymentType: pData['type'],
                          sourceReservationId: id,
                          description: `Avoir suite annulation réservation du ${resData['date']}`,
                          createdAt: new Date().toISOString(),
                          status: 'AVAILABLE'
                      });
                  } 
                  // CAS B : C'était déjà un Bon utilisé -> On le RÉACTIVE
                  else if (pData['creditId']) {
                      const oldCreditRef = doc(this.firestore, 'provisional_receipts', pData['creditId']);
                      transaction.update(oldCreditRef, { 
                          status: 'AVAILABLE', 
                          usedAt: null, 
                          usedInReservation: null 
                      });
                  }

                  // 4. Supprimer le paiement de la base (puisqu'il est converti ou annulé)
                  transaction.delete(pDoc.ref);
              });

              // 5. Marquer la réservation comme annulée et remettre l'avance à 0
              transaction.update(resRef, { 
                  status: 'CANCELLED',
                  cancelledAt: new Date().toISOString(),
                  cancellationNotified: false,
                  advance: 0 // Important : on remet à 0 car l'argent est parti en Avoir
              });
          });
          
          console.log("✅ Transaction terminée : Paiements convertis en avoirs.");

      } catch (e) {
          console.error("❌ Erreur transaction annulation :", e);
          throw e;
      }
  }

  // --- GESTION DES AVOIRS ---
  async applyCredit(reservationId: string, credit: any): Promise<void> {
      // Créer une trace de paiement "BON"
      await addDoc(collection(this.firestore, 'payments'), {
          reservationId: reservationId,
          amount: credit.amount,
          type: 'BON',
          creditId: credit.id,
          date: new Date().toISOString(),
          reference: `Utilisation Avoir ${credit.id.substring(0,6)}...`
      });
      
      // Marquer le bon comme utilisé
      await updateDoc(doc(this.firestore, 'provisional_receipts', credit.id), { 
          status: 'USED',
          usedInReservation: reservationId,
          usedAt: new Date().toISOString()
      });
  }

  // Alias
  addReservation(d:any) { return this.add(d); }
  updateReservation(id:string, d:any) { return this.update(id, d); }
}
