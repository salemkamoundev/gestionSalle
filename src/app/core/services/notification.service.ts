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

  // --- GESTION UTILISATEUR ---

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

  // --- LOGIQUE DE CIBLAGE (UNIQUEMENT RÉSERVATION) ---
  
  async notifyReservationPartners(reservation: any) {
    const partnerIds = new Set<string>();

    // 1. Récupérer les partenaires des services sélectionnés individuellement
    if (reservation.services && Array.isArray(reservation.services)) {
      reservation.services.forEach((s: any) => {
        if (s.partenaireId) partnerIds.add(s.partenaireId);
      });
    }

    // 2. Récupérer les partenaires des services inclus dans le PACK sélectionné
    if (reservation.pack && reservation.pack.services && Array.isArray(reservation.pack.services)) {
      reservation.pack.services.forEach((s: any) => {
        if (s.partenaireId) partnerIds.add(s.partenaireId);
      });
    }

    // 3. Envoi de la notification UNIQUEMENT aux partenaires concernés
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

  // Méthode interne pour écrire la notification dans la sous-collection de l'utilisateur
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
