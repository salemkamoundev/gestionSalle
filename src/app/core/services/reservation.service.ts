import { Injectable, inject } from '@angular/core';
import { FirestoreCrudService } from './firestore-crud.service';
import { Reservation } from '../models/reservation.model';
import { where, QueryConstraint } from '@angular/fire/firestore';
import { Observable } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class ReservationService extends FirestoreCrudService<Reservation> {
  protected collectionName = 'reservations';

  // Récupérer les réservations d'une date spécifique (Legacy ou usage spécifique)
  getByDate(dateStr: string): Observable<Reservation[]> {
    return super.getAll([where('date', '==', dateStr)]);
  }

  // Récupérer les réservations sur une plage (ex: tout un mois)
  getRange(startDate: string, endDate: string): Observable<Reservation[]> {
    // Note: Firestore nécessite parfois un index composite pour les requêtes de plage sur des champs multiples
    // Ici on filtre simplement sur la date (string YYYY-MM-DD permet la comparaison lexicographique)
    return super.getAll([
      where('date', '>=', startDate),
      where('date', '<=', endDate)
    ]);
  }
}
