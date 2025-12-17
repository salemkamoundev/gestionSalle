import { Injectable, inject } from '@angular/core';
import { FirestoreCrudService } from './firestore-crud.service';
import { Reservation } from '../models/reservation.model';
import { where, QueryConstraint } from '@angular/fire/firestore';
import { Observable } from 'rxjs';
import { ActivityService } from './activity.service';

@Injectable({ providedIn: 'root' })
export class ReservationService extends FirestoreCrudService<Reservation> {
  protected collectionName = 'reservations';
  private logger = inject(ActivityService);

  override async add(item: Reservation): Promise<any> {
    const docRef = await super.add(item);
    this.logger.log('CREATE', 'RESERVATION', `Nouvelle réservation : ${item.clientName} le ${item.date}`);
    return docRef;
  }

  override async update(id: string, item: Partial<Reservation>): Promise<void> {
    await super.update(id, item);
    // On ne loggue ici que les modifs génériques. 
    // Les paiements spécifiques sont gérés par le composant pour avoir un message précis.
    if (!(item as any).advanceOnly) {
       this.logger.log('UPDATE', 'RESERVATION', `Modification réservation ID: ${id}`);
    }
  }

  override async delete(id: string): Promise<void> {
    await super.delete(id);
    this.logger.log('DELETE', 'RESERVATION', `Suppression réservation ID: ${id}`);
  }

  getByDate(dateStr: string): Observable<Reservation[]> {
    return super.getAll([where('date', '==', dateStr)]);
  }

  getRange(startDate: string, endDate: string): Observable<Reservation[]> {
    return super.getAll([where('date', '>=', startDate), where('date', '<=', endDate)]);
  }
}
