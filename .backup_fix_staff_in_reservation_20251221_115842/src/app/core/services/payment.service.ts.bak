import { Injectable, inject } from '@angular/core';
import { FirestoreCrudService } from './firestore-crud.service';
import { Payment } from '../models/payment.model';
import { ReservationService } from './reservation.service';
import { where } from '@angular/fire/firestore';
import { ActivityService } from './activity.service';
import { firstValueFrom } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class PaymentService extends FirestoreCrudService<Payment> {
  protected collectionName = 'payments';
  private reservationService = inject(ReservationService);
  private logger = inject(ActivityService);

  // Récupérer les paiements d'une réservation spécifique
  getByReservation(reservationId: string) {
    return super.getAll([where('reservationId', '==', reservationId)]);
  }

  // Surcharge de l'ajout pour mettre à jour le total de la réservation
  override async add(item: Payment): Promise<any> {
    const docRef = await super.add(item);
    await this.updateReservationTotal(item.reservationId);
    this.logger.log('PAYMENT', 'RESERVATION', `Règlement ajouté : ${item.amount} TND (${item.type})`, { paymentId: docRef.id, reservationId: item.reservationId });
    return docRef;
  }

  // Surcharge de la suppression pour mettre à jour le total
  override async delete(id: string): Promise<void> {
    // On doit d'abord récupérer le paiement pour avoir l'ID de la résa
    const payment = await firstValueFrom(this.getById(id));
    await super.delete(id);
    if (payment) {
      await this.updateReservationTotal(payment.reservationId);
      this.logger.log('DELETE', 'RESERVATION', `Règlement supprimé : ${payment.amount} TND`, { reservationId: payment.reservationId });
    }
  }

  // Recalcule et met à jour le champ 'advance' de la réservation
  private async updateReservationTotal(reservationId: string) {
    const payments = await firstValueFrom(this.getByReservation(reservationId));
    const totalPaid = payments.reduce((sum, p) => sum + Number(p.amount), 0);
    
    // Mise à jour de la réservation (flag advanceOnly pour éviter les logs en boucle si nécessaire)
    await this.reservationService.update(reservationId, { advance: totalPaid, advanceOnly: true } as any);
  }
}
