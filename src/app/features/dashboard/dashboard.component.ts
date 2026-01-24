import { Component, inject, computed } from '@angular/core';
import { CommonModule, DatePipe, DecimalPipe } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { ReservationService } from '../../core/services/reservation.service';
import { ClientService } from '../../core/services/client.service';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs/operators';
import { combineLatest } from 'rxjs';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink, DatePipe, DecimalPipe],
  templateUrl: './dashboard.component.html'
})
export class DashboardComponent {
  private reservationService = inject(ReservationService);
  private clientService = inject(ClientService);
  private router = inject(Router);

  // Source Principale : Réservations avec Clients associés
  reservations = toSignal(
    combineLatest([
      this.reservationService.getAll(),
      this.clientService.getAll()
    ]).pipe(
      map(([reservations, clients]) => {
        return reservations
          .filter(r => r.status !== 'CANCELLED')
          .map(r => {
            const client = clients.find(c => c.id === r.clientId);
            return { ...r, client }; 
          })
          .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      })
    ), 
    { initialValue: [] }
  );

  // KPI
  totalReservations = computed(() => this.reservations().length);
  totalRevenue = computed(() => this.reservations().reduce((acc, curr) => acc + (Number(curr.totalPrice) || 0), 0));
  todayReservations = computed(() => {
    const todayStr = new Date().toISOString().split('T')[0];
    return this.reservations().filter(r => r.date === todayStr);
  });

  // LISTE 1 : PROCHAINES RÉSERVATIONS (7 JOURS)
  upcomingReservations = computed(() => {
    const list = this.reservations();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const nextWeek = new Date(today);
    nextWeek.setDate(today.getDate() + 7);
    nextWeek.setHours(23, 59, 59, 999);

    return list.filter(r => {
        const rDate = new Date(r.date);
        const rDateNormalized = new Date(rDate.getFullYear(), rDate.getMonth(), rDate.getDate());
        // Inclut aujourd'hui et les 7 prochains jours
        return rDateNormalized >= today && rDateNormalized <= nextWeek;
    });
  });

  // LISTE 2 : RÉSERVATIONS PASSÉES NON PAYÉES
  pastUnpaidReservations = computed(() => {
    const list = this.reservations();
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return list.filter(r => {
        const rDate = new Date(r.date);
        const rDateNormalized = new Date(rDate.getFullYear(), rDate.getMonth(), rDate.getDate());
        
        // Est passé (strictement avant aujourd'hui)
        const isPast = rDateNormalized < today;
        
        // Est impayé (Reste à payer > 0)
        const total = Number(r.totalPrice) || 0;
        const paid = Number(r.advance) || 0;
        const isUnpaid = total > paid;

        return isPast && isUnpaid;
    });
  });

  constructor() {}

  getStatusClass(status: string): string {
    switch (status) {
      case 'CONFIRMED': return 'bg-emerald-100 text-emerald-700 border-emerald-200';
      case 'COMPLETED': return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'PENDING': return 'bg-amber-100 text-amber-700 border-amber-200';
      default: return 'bg-gray-100 text-gray-600 border-gray-200';
    }
  }

  getStatusLabel(status: string): string {
    switch (status) {
      case 'CONFIRMED': return 'Confirmé';
      case 'COMPLETED': return 'Terminé';
      case 'PENDING': return 'En attente';
      default: return status || 'Nouveau';
    }
  }

  navigateToReservation(id: string) {
    this.router.navigate(['/reservations/edit', id]);
  }
}
