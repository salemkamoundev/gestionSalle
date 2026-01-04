import { Component, inject, computed } from '@angular/core';
import { CommonModule, DatePipe, DecimalPipe } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { ReservationService } from '../../core/services/reservation.service';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs/operators';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink, DatePipe, DecimalPipe],
  templateUrl: './dashboard.component.html'
})
export class DashboardComponent {
  private reservationService = inject(ReservationService);
  private router = inject(Router);

  // Source : Toutes les réservations actives (non annulées), triées par date décroissante
  reservations = toSignal(
    this.reservationService.getAll().pipe(
      map(list => 
        list
          .filter(r => r.status !== 'CANCELLED')
          .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      )
    ), 
    { initialValue: [] }
  );

  // KPI : Total
  totalReservations = computed(() => this.reservations().length);
  
  // KPI : Chiffre d'affaire
  totalRevenue = computed(() => 
    this.reservations().reduce((acc, curr) => acc + (Number(curr.totalPrice) || 0), 0)
  );

  // KPI : Aujourd'hui (Comptage strict)
  todayReservations = computed(() => {
    const todayStr = new Date().toISOString().split('T')[0];
    return this.reservations().filter(r => r.date === todayStr);
  });

  // LISTE PRINCIPALE : "Aujourd'hui" + "Impayés Récents (7j)"
  recentActivity = computed(() => {
    const list = this.reservations();
    
    // Date d'aujourd'hui
    const todayStr = new Date().toISOString().split('T')[0];

    // Date limite (il y a 7 jours)
    const limitDate = new Date();
    limitDate.setDate(limitDate.getDate() - 7);
    limitDate.setHours(0, 0, 0, 0);

    return list.filter(r => {
        // 1. Est-ce aujourd'hui ?
        const isToday = r.date === todayStr;

        // 2. Est-ce dans les 7 derniers jours ?
        const rDate = new Date(r.date);
        const isRecent = rDate >= limitDate;

        // 3. Est-ce non payé à 100% ?
        const total = Number(r.totalPrice) || 0;
        const paid = Number(r.advance) || 0;
        const isUnpaid = total > paid; 

        // CONDITION : (C'est aujourd'hui) OU (C'est récent ET pas totalement payé)
        return isToday || (isRecent && isUnpaid);
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
