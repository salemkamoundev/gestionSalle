import { Injectable, inject, Injector, runInInjectionContext } from '@angular/core';
import { Firestore, collection, doc, addDoc, updateDoc, query, where, orderBy, collectionData, docData, runTransaction, getDocs } from '@angular/fire/firestore';
import { Observable } from 'rxjs';
import { Reservation } from '../models/reservation.model';

@Injectable({
  providedIn: 'root'
})
export class ReservationService {
  private firestore = inject(Firestore);
  private injector = inject(Injector);

  constructor() {}

  getAll(): Observable<any[]> {
    return runInInjectionContext(this.injector, () => {
      const ref = collection(this.firestore, 'reservations');
      const q = query(ref, orderBy('date', 'desc'));
      return collectionData(q, { idField: 'id' });
    });
  }

  getReservations(): Observable<any[]> { return this.getAll(); }

  getById(id: string): Observable<Reservation> {
    return runInInjectionContext(this.injector, () => {
        const docRef = doc(this.firestore, `reservations/${id}`);
        return docData(docRef, { idField: 'id' }) as Observable<Reservation>;
    });
  }

  // --- CRÉATION ---
  async add(data: any) {
    const ref = collection(this.firestore, 'reservations');
    const now = new Date().toISOString();
    
    // On ne force plus triggerPush ici. C'est le composant qui décide via 'data.triggerPush'
    // Si c'est une création, on force quand même une première notif si le composant ne l'a pas précisé
    const trigger = (data.triggerPush !== undefined) ? data.triggerPush : true;

    const docRef = await addDoc(ref, { 
        ...data, 
        status: 'CONFIRMED', 
        createdAt: now,
        updatedAt: now,
        triggerPush: trigger
    });
    return docRef;
  }

  // --- MISE À JOUR ---
  async update(id: string, data: any) {
    const docRef = doc(this.firestore, `reservations/${id}`);
    
    // On respecte strictement la décision du composant
    // Si data.triggerPush est absent, on considère que c'est false (pas de notif par défaut sur update)
    const payload = { 
        ...data, 
        updatedAt: new Date().toISOString()
    };
    
    // On s'assure que triggerPush est bien transmis s'il est présent
    if (data.triggerPush !== undefined) {
        payload.triggerPush = data.triggerPush;
    }

    await updateDoc(docRef, payload);
  }

  async delete(id: string) {
      if (!id) return;
      try {
          await runTransaction(this.firestore, async (transaction) => {
              const resRef = doc(this.firestore, 'reservations', id);
              const resSnap = await transaction.get(resRef);
              if (!resSnap.exists()) throw "Réservation introuvable";
              const resData = resSnap.data();
              
              // Gestion des avoirs (Code conservé)
              const clientId = resData['clientId'];
              let clientName = 'Client';
              if (clientId) {
                  const clientRef = doc(this.firestore, 'clients', clientId);
                  const clientSnap = await transaction.get(clientRef);
                  if (clientSnap.exists()) {
                      const c = clientSnap.data();
                      clientName = `${c['nom'] || ''} ${c['prenom'] || ''}`.trim();
                  }
              }
              const paymentsQuery = query(collection(this.firestore, 'payments'), where('reservationId', '==', id));
              const paymentsSnap = await getDocs(paymentsQuery);
              paymentsSnap.forEach((pDoc) => {
                  const pData = pDoc.data();
                  if (pData['type'] !== 'BON') {
                      const newCreditRef = doc(collection(this.firestore, 'provisional_receipts'));
                      transaction.set(newCreditRef, {
                          clientId: clientId, clientName: clientName, amount: pData['amount'],
                          source: 'ANNULATION', originalPaymentType: pData['type'], sourceReservationId: id,
                          description: `Avoir suite annulation réservation du ${resData['date']}`,
                          reference: resData['date'], createdAt: new Date().toISOString(), status: 'AVAILABLE'
                      });
                  } else if (pData['creditId']) {
                      const oldCreditRef = doc(this.firestore, 'provisional_receipts', pData['creditId']);
                      transaction.update(oldCreditRef, { status: 'AVAILABLE', usedAt: null, usedInReservation: null });
                  }
                  transaction.delete(pDoc.ref);
              });

              // Annulation : Ici on force la notif car c'est une action critique
              transaction.update(resRef, { 
                  status: 'CANCELLED', 
                  cancelledAt: new Date().toISOString(),
                  triggerPush: true 
              });
          });
      } catch (e) { throw e; }
  }

  async applyCredit(reservationId: string, credit: any): Promise<void> {
      const refText = credit.reference ? `Avoir du ${credit.reference}` : `Utilisation Avoir ${credit.id}`;
      await addDoc(collection(this.firestore, 'payments'), {
          reservationId: reservationId, amount: credit.amount, type: 'BON', creditId: credit.id,
          date: new Date().toISOString(), reference: refText
      });
      await updateDoc(doc(this.firestore, 'provisional_receipts', credit.id), { 
          status: 'USED', usedInReservation: reservationId, usedAt: new Date().toISOString() 
      });
  }

  addReservation(d:any) { return this.add(d); }
  updateReservation(id:string, d:any) { return this.update(id, d); }
}
