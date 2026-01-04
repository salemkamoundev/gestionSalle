import { Component, inject, signal, computed } from '@angular/core';
import { CommonModule, DatePipe, CurrencyPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ReservationService } from '../../core/services/reservation.service';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs/operators';

@Component({
  selector: 'app-history',
  standalone: true,
  imports: [CommonModule, FormsModule, DatePipe, CurrencyPipe],
  templateUrl: './history.component.html'
})
export class HistoryComponent {
  private reservationService = inject(ReservationService);

  // --- FILTRES (Signaux) ---
  searchTerm = signal('');
  statusFilter = signal('ALL');
  startDate = signal('');
  endDate = signal('');

  // --- CHARGEMENT DES DONNÉES ---
  // On récupère TOUTES les réservations (triées par date décroissante pour l'historique)
  rawReservations = toSignal(
    this.reservationService.getAll().pipe(
      map(list => list.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()))
    ), 
    { initialValue: [] }
  );

  // --- DONNÉES FILTRÉES (Computed) ---
  filteredReservations = computed(() => {
    let list = this.rawReservations();
    const term = this.searchTerm().toLowerCase();
    const status = this.statusFilter();
    const start = this.startDate();
    const end = this.endDate();

    return list.filter((r: any) => {
      // 1. Filtre Recherche (Nom client ou Téléphone)
      const matchesTerm = !term || 
        (r.clientName && r.clientName.toLowerCase().includes(term)) ||
        (r.customerPhone && r.customerPhone.includes(term));

      // 2. Filtre Statut
      const matchesStatus = status === 'ALL' || r.status === status;

      // 3. Filtre Date Début
      const matchesStart = !start || r.date >= start;

      // 4. Filtre Date Fin
      const matchesEnd = !end || r.date <= end;

      return matchesTerm && matchesStatus && matchesStart && matchesEnd;
    });
  });

  // --- STATISTIQUES FILTRÉES ---
  totalRevenue = computed(() => this.filteredReservations().reduce((acc, r) => acc + (r.status !== 'CANCELLED' ? (Number(r.totalPrice) || 0) : 0), 0));
  countCancelled = computed(() => this.filteredReservations().filter(r => r.status === 'CANCELLED').length);
  countConfirmed = computed(() => this.filteredReservations().filter(r => r.status !== 'CANCELLED').length);

  constructor() {}

  // --- ACTIONS ---
  
  resetFilters() {
    this.searchTerm.set('');
    this.statusFilter.set('ALL');
    this.startDate.set('');
    this.endDate.set('');
  }

  getStatusLabel(status: string): string {
    switch (status) {
      case 'CONFIRMED': return 'Confirmé';
      case 'CANCELLED': return 'Annulé';
      case 'COMPLETED': return 'Terminé';
      case 'PENDING': return 'En attente';
      default: return status;
    }
  }

  getStatusClass(status: string): string {
    switch (status) {
      case 'CONFIRMED': return 'bg-emerald-100 text-emerald-700 border-emerald-200';
      case 'CANCELLED': return 'bg-red-100 text-red-700 border-red-200';
      case 'COMPLETED': return 'bg-slate-100 text-slate-700 border-slate-200';
      case 'PENDING': return 'bg-amber-100 text-amber-700 border-amber-200';
      default: return 'bg-gray-100 text-gray-600';
    }
  }
}