import { Component, inject, signal, computed } from '@angular/core';
import { CommonModule, DatePipe, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ReservationService } from '../../core/services/reservation.service';
import { ClientService } from '../../core/services/client.service';
import { toSignal } from '@angular/core/rxjs-interop';
import { map, tap } from 'rxjs/operators';
import { combineLatest } from 'rxjs';

@Component({
  selector: 'app-history',
  standalone: true,
  imports: [CommonModule, FormsModule, DatePipe, DecimalPipe],
  templateUrl: './history.component.html'
})
export class HistoryComponent {
  private router = inject(Router);
  private reservationService = inject(ReservationService);
  private clientService = inject(ClientService);

  // Filtres
  searchTerm = signal('');
  statusFilter = signal('ALL');
  startDate = signal('');
  endDate = signal('');

  // Pagination
  currentPage = signal(1);
  itemsPerPage = signal(10);

  // Données enrichies (Jointure Réservations + Clients)
  rawReservations = toSignal(
    combineLatest([
      this.reservationService.getAll(),
      this.clientService.getAll() // Récupère aussi les clients
    ]).pipe(
      map(([reservations, clients]) => {
        // On fusionne les données
        return reservations.map((r: any) => {
          // Trouver le client correspondant au clientId de la réservation
          const client = (clients as any[]).find(c => c.id === r.clientId);
          
          return {
            ...r,
            // On injecte l'objet client complet pour l'accès à .prenom, etc.
            client: client, 
            // On définit clientName pour l'affichage et le filtre (Nom de famille)
            clientName: client ? client.nom : (r.clientName || 'Inconnu'),
            // On sécurise le prénom pour l'affichage
            clientPrenom: client ? client.prenom : ''
          };
        });
      }),
      tap(list => console.log(`📜 Historique enrichi: ${list.length} items chargés`))
    ), 
    { initialValue: [] }
  );

  // 1. Liste filtrée (Recherche/Date/Statut)
  filteredReservations = computed(() => {
    let list = this.rawReservations();
    const term = this.searchTerm().toLowerCase();
    const status = this.statusFilter();
    const start = this.startDate();
    const end = this.endDate();

    return list.filter((r: any) => {
      // Recherche sur le Nom (clientName), le Prénom (client.prenom) ou le Téléphone
      const matchesTerm = !term || 
        (r.clientName && r.clientName.toLowerCase().includes(term)) ||
        (r.client && r.client.prenom && r.client.prenom.toLowerCase().includes(term)) ||
        (r.customerPhone && r.customerPhone.includes(term));
      
      const matchesStatus = status === 'ALL' || r.status === status;
      const matchesStart = !start || r.date >= start;
      const matchesEnd = !end || r.date <= end;

      return matchesTerm && matchesStatus && matchesStart && matchesEnd;
    });
  });

  // 2. Pagination
  totalPages = computed(() => Math.ceil(this.filteredReservations().length / this.itemsPerPage()));
  
  paginatedReservations = computed(() => {
    const list = this.filteredReservations();
    const page = this.currentPage();
    const limit = this.itemsPerPage();
    const start = (page - 1) * limit;
    return list.slice(start, start + limit);
  });

  // KPI
  totalRevenue = computed(() => this.filteredReservations().reduce((acc, r) => acc + (r.status !== 'CANCELLED' ? (Number(r.totalPrice) || 0) : 0), 0));
  countCancelled = computed(() => this.filteredReservations().filter(r => r.status === 'CANCELLED').length);

  constructor() {}

  // Méthodes de filtre (avec reset page)
  updateSearch(term: string) {
      this.searchTerm.set(term);
      this.currentPage.set(1);
  }
  
  updateStatus(status: string) {
      this.statusFilter.set(status);
      this.currentPage.set(1);
  }

  updateDate() {
      this.currentPage.set(1);
  }

  resetFilters() {
    this.searchTerm.set('');
    this.statusFilter.set('ALL');
    this.startDate.set('');
    this.endDate.set('');
    this.currentPage.set(1);
  }

  // Navigation Pagination
  nextPage() {
      if (this.currentPage() < this.totalPages()) {
          this.currentPage.update(p => p + 1);
      }
  }

  prevPage() {
      if (this.currentPage() > 1) {
          this.currentPage.update(p => p - 1);
      }
  }
  
  setPage(p: number) {
      this.currentPage.set(p);
  }

  viewReservation(id: string) {
    this.router.navigate(['/reservations/edit', id]);
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
