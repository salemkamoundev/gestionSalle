#!/bin/bash

echo "=== DÉBUT DE LA RÉPARATION (Mode Écriture Complète) ==="

# ---------------------------------------------------------
# 1. RÉPARATION DE NOTIFICATION SERVICE
# ---------------------------------------------------------
echo "Réécriture de src/app/core/services/notification.service.ts..."
cat << 'EOF' > src/app/core/services/notification.service.ts
import { Injectable, inject, Injector, runInInjectionContext } from '@angular/core';
import { Firestore, collection, query, where, orderBy, limit, doc, getDoc, setDoc, updateDoc, collectionData, writeBatch, addDoc } from '@angular/fire/firestore';
import { Observable, of } from 'rxjs';
import { map } from 'rxjs/operators';

@Injectable({
  providedIn: 'root'
})
export class NotificationService {
  private firestore = inject(Firestore);
  private injector = inject(Injector);

  constructor() {}

  async ensurefcmTokensForUser(uid: string): Promise<void> {
    if (!uid) return;
    try {
      const userRef = doc(this.firestore, 'users', uid);
      const snap = await getDoc(userRef);
      if (!snap.exists()) {
          await setDoc(userRef, { uid, fcmTokens: [], createdAt: new Date().toISOString() });
      }
    } catch (e) { console.warn("Erreur ensurefcmTokensForUser:", e); }
  }

  getUserNotifications(uid: string): Observable<any[]> {
    if (!uid) return of([]);
    const notifRef = collection(this.firestore, `users/${uid}/notifications`);
    const q = query(notifRef, orderBy('createdAt', 'desc'), limit(50));
    
    return runInInjectionContext(this.injector, () => {
        return collectionData(q, { idField: 'id' });
    });
  }

  getUnreadCount(uid?: string): Observable<number> {
    if (!uid) return of(0);
    const notifRef = collection(this.firestore, `users/${uid}/notifications`);
    const q = query(notifRef, where('read', '==', false));

    return runInInjectionContext(this.injector, () => {
        return collectionData(q, { idField: 'id' }).pipe(map(list => list.length));
    });
  }

  async markAsRead(uid: string, notifId: string) {
      if(!uid || !notifId) return;
      await updateDoc(doc(this.firestore, `users/${uid}/notifications/${notifId}`), { read: true });
  }

  async markAllAsRead(uid: string, notifications: any[]) {
      if(!uid || !notifications?.length) return;
      const batch = writeBatch(this.firestore);
      notifications.filter(n => !n.read).forEach(n => {
          batch.update(doc(this.firestore, `users/${uid}/notifications/${n.id}`), { read: true });
      });
      await batch.commit();
  }

  // --- LOGIQUE PARTENAIRES ---
  async notifyReservationPartners(reservation: any) {
    const partnerIds = new Set<string>();

    // 1. Partenaires des services individuels
    if (reservation.services && Array.isArray(reservation.services)) {
      reservation.services.forEach((s: any) => {
        if (s.partenaireId) partnerIds.add(s.partenaireId);
      });
    }

    // 2. Partenaires des services du PACK
    if (reservation.pack && reservation.pack.services && Array.isArray(reservation.pack.services)) {
      reservation.pack.services.forEach((s: any) => {
        if (s.partenaireId) partnerIds.add(s.partenaireId);
      });
    }

    // 3. Envoi
    const pIds = Array.from(partnerIds);
    if (pIds.length === 0) return;

    const dateStr = reservation.dateDebut || reservation.date || "une date à venir";
    const message = `Nouvelle réservation confirmée pour le ${dateStr}`;
    
    for (const pid of pIds) {
        await this.sendToUser(pid, {
            title: "Nouvelle Réservation",
            message: message,
            type: "reservation",
            linkId: reservation.id || null,
            reservationDate: dateStr
        });
    }
  }

  private async sendToUser(uid: string, data: any) {
      try {
        const notifRef = collection(this.firestore, `users/${uid}/notifications`);
        await addDoc(notifRef, {
            ...data,
            read: false,
            createdAt: new Date().toISOString()
        });
      } catch(e) {
          console.error("Erreur envoi notif:", e);
      }
  }
}
EOF

# ---------------------------------------------------------
# 2. RÉPARATION DE RESERVATION SERVICE
# ---------------------------------------------------------
echo "Réécriture de src/app/core/services/reservation.service.ts..."
cat << 'EOF' > src/app/core/services/reservation.service.ts
import { Injectable, inject, Injector, runInInjectionContext } from '@angular/core';
import { Firestore, collection, doc, addDoc, updateDoc, deleteDoc, query, where, orderBy, collectionData, docData, runTransaction, getDocs } from '@angular/fire/firestore';
import { Observable } from 'rxjs';
import { Reservation } from '../models/reservation.model';
import { NotificationService } from './notification.service';

@Injectable({
  providedIn: 'root'
})
export class ReservationService {
  private firestore = inject(Firestore);
  private injector = inject(Injector);
  private notificationService = inject(NotificationService);

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

  async add(data: any) {
    const ref = collection(this.firestore, 'reservations');
    const docRef = await addDoc(ref, { ...data, status: 'CONFIRMED', createdAt: new Date().toISOString() });
    
    // Notification Partenaires
    this.notificationService.notifyReservationPartners({ ...data, id: docRef.id });
    
    return docRef;
  }

  async update(id: string, data: any) {
    const docRef = doc(this.firestore, `reservations/${id}`);
    await updateDoc(docRef, { ...data, updatedAt: new Date().toISOString() });
    
    // Notification Partenaires (Mise à jour)
    this.notificationService.notifyReservationPartners({ ...data, id });
  }

  async delete(id: string) {
      if (!id) return;
      try {
          await runTransaction(this.firestore, async (transaction) => {
              const resRef = doc(this.firestore, 'reservations', id);
              const resSnap = await transaction.get(resRef);
              
              if (!resSnap.exists()) throw "Réservation introuvable";
              const resData = resSnap.data();
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
                          clientId: clientId,
                          clientName: clientName,
                          amount: pData['amount'],
                          source: 'ANNULATION',
                          originalPaymentType: pData['type'],
                          sourceReservationId: id,
                          description: `Avoir suite annulation réservation du ${resData['date']}`,
                          reference: resData['date'],
                          createdAt: new Date().toISOString(),
                          status: 'AVAILABLE'
                      });
                  } else if (pData['creditId']) {
                      const oldCreditRef = doc(this.firestore, 'provisional_receipts', pData['creditId']);
                      transaction.update(oldCreditRef, { status: 'AVAILABLE', usedAt: null, usedInReservation: null });
                  }
                  transaction.delete(pDoc.ref);
              });

              transaction.update(resRef, { status: 'CANCELLED', cancelledAt: new Date().toISOString() });
          });
      } catch (e) {
          console.error("Erreur annulation:", e);
          throw e;
      }
  }

  async applyCredit(reservationId: string, credit: any): Promise<void> {
      const refText = credit.reference ? `Avoir du ${credit.reference}` : `Utilisation Avoir ${credit.id}`;
      await addDoc(collection(this.firestore, 'payments'), {
          reservationId: reservationId,
          amount: credit.amount,
          type: 'BON',
          creditId: credit.id,
          date: new Date().toISOString(),
          reference: refText
      });
      await updateDoc(doc(this.firestore, 'provisional_receipts', credit.id), { 
          status: 'USED', usedInReservation: reservationId, usedAt: new Date().toISOString() 
      });
  }

  addReservation(d:any) { return this.add(d); }
  updateReservation(id:string, d:any) { return this.update(id, d); }
}
EOF

# ---------------------------------------------------------
# 3. RÉPARATION DE PACK SERVICE (Sans notifications)
# ---------------------------------------------------------
echo "Réécriture de src/app/core/services/pack.service.ts..."
cat << 'EOF' > src/app/core/services/pack.service.ts
import { Injectable, inject, Injector, runInInjectionContext } from '@angular/core';
import { Firestore, collection, doc, addDoc, updateDoc, deleteDoc, query, orderBy, collectionData, docData } from '@angular/fire/firestore';
import { Observable } from 'rxjs';
import { Pack } from '../models/pack.model';
import { UiService } from './ui.service';

@Injectable({
  providedIn: 'root'
})
export class PackService {
  private firestore = inject(Firestore);
  private ui = inject(UiService);
  private injector = inject(Injector);

  constructor() {}

  getAll(): Observable<Pack[]> {
    return runInInjectionContext(this.injector, () => {
      const ref = collection(this.firestore, 'packs');
      const q = query(ref, orderBy('createdAt', 'desc'));
      return collectionData(q, { idField: 'id' }) as Observable<Pack[]>;
    });
  }

  getById(id: string): Observable<Pack> {
    return runInInjectionContext(this.injector, () => {
        const docRef = doc(this.firestore, `packs/${id}`);
        return docData(docRef, { idField: 'id' }) as Observable<Pack>;
    });
  }

  async add(pack: Pack) {
    try {
      const ref = collection(this.firestore, 'packs');
      await addDoc(ref, { ...pack, createdAt: new Date().toISOString() });
      // Notifications gérées par le composant
    } catch (e) { throw e; }
  }

  async update(id: string, pack: Partial<Pack>) {
    try {
      const docRef = doc(this.firestore, `packs/${id}`);
      await updateDoc(docRef, { ...pack, updatedAt: new Date().toISOString() });
      // Notifications gérées par le composant
    } catch (e) { throw e; }
  }

  async delete(id: string) {
    try {
      const docRef = doc(this.firestore, `packs/${id}`);
      await deleteDoc(docRef);
    } catch (e) { throw e; }
  }
}
EOF

echo "=== FIN DE LA RÉPARATION. Vos fichiers sont propres et corrigés. ==="