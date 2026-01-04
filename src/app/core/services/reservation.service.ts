import { Injectable, inject, Injector, runInInjectionContext } from '@angular/core';
import { Firestore, collection, doc, addDoc, updateDoc, deleteDoc, query, orderBy, collectionData, docData, runTransaction, getDoc } from '@angular/fire/firestore';
import { Observable, BehaviorSubject } from 'rxjs';
import { switchMap } from 'rxjs/operators';
import { Reservation } from '../models/reservation.model';

@Injectable({
  providedIn: 'root'
})
export class ReservationService {
  private firestore = inject(Firestore);
  private injector = inject(Injector);
  
  // Un "déclencheur" pour forcer le rechargement si nécessaire
  private refreshTrigger = new BehaviorSubject<number>(0);

  constructor() {}

  // --- LECTURE ---
  getAll(): Observable<any[]> {
    // On utilise switchMap pour pouvoir re-souscrire sur demande (refreshTrigger)
    return this.refreshTrigger.pipe(
      switchMap(() => runInInjectionContext(this.injector, () => {
        const ref = collection(this.firestore, 'reservations');
        const q = query(ref, orderBy('date', 'desc'));
        // Utilisation de collectionData qui écoute en temps réel
        return collectionData(q, { idField: 'id' });
      }))
    );
  }

  getReservations(): Observable<any[]> { return this.getAll(); }

  getById(id: string): Observable<Reservation> {
    return runInInjectionContext(this.injector, () => {
        const docRef = doc(this.firestore, `reservations/${id}`);
        return docData(docRef, { idField: 'id' }) as Observable<Reservation>;
    });
  }

  // --- ECRITURE ---
  async add(data: any) {
    const ref = collection(this.firestore, 'reservations');
    const res = await addDoc(ref, { ...data, status: 'CONFIRMED', createdAt: new Date().toISOString() });
    return res;
  }

  async update(id: string, data: any) {
    const docRef = doc(this.firestore, `reservations/${id}`);
    await updateDoc(docRef, { ...data, updatedAt: new Date().toISOString() });
  }

  // --- DELETE / ANNULATION ---
  async delete(id: string) {
      if (!id) return;
      console.log(`🗑️ Tentative d'annulation pour l'ID : ${id}`);
      
      const docRef = doc(this.firestore, `reservations/${id}`);
      
      // 1. Mise à jour du statut
      await updateDoc(docRef, { 
          status: 'CANCELLED',
          cancelledAt: new Date().toISOString(),
          cancellationNotified: false
      });

      console.log(`✅ Statut passé à CANCELLED pour ${id}`);

      // 2. Forcer un petit délai et vérifier (Debug)
      /* const snap = await getDoc(docRef);
      console.log("🔍 Vérification post-update :", snap.data()?.['status']); 
      */
      
      // 3. Déclencher un rafraîchissement (au cas où le stream est bloqué)
      this.refreshTrigger.next(Date.now());
  }

  // Méthodes de compatibilité
  addReservation(d:any) { return this.add(d); }
  updateReservation(id:string, d:any) { return this.update(id, d); }

  async applyCredit(reservationId: string, credit: any): Promise<void> {
      await addDoc(collection(this.firestore, 'payments'), {
          reservationId: reservationId, amount: credit.amount, type: 'BON', creditId: credit.id, date: new Date().toISOString()
      });
      await updateDoc(doc(this.firestore, 'provisional_receipts', credit.id), { status: 'USED' });
  }
}
