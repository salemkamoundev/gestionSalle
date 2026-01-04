#!/bin/bash

echo "📄 Ajout de la pagination sur la page Historique..."

# 1. HISTORY COMPONENT (TS) : Logique de pagination
cat <<EOF > src/app/features/history/history.component.ts
import { Component, inject, signal, computed } from '@angular/core';
import { CommonModule, DatePipe, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ReservationService } from '../../core/services/reservation.service';
import { ClientService } from '../../core/services/client.service';
import { toSignal } from '@angular/core/rxjs-interop';
import { map, tap } from 'rxjs/operators';

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

  // Données brutes (Tout charger)
  rawReservations = toSignal(
    this.reservationService.getAll().pipe(
      tap(list => console.log(\`📜 Historique: \${list.length} items chargés\`)),
      map(list => list) // On garde tout, même les annulés
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

    // Reset page si filtre change
    // Note: computed est pur, on ne peut pas set un signal ici directement, 
    // mais Angular gère bien le recalcul. L'idéal est de reset currentPage dans les méthodes de filtre.

    return list.filter((r: any) => {
      const matchesTerm = !term || 
        (r.clientName && r.clientName.toLowerCase().includes(term)) ||
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
EOF

# 2. HISTORY HTML : Tableau + Contrôles de Pagination
cat <<EOF > src/app/features/history/history.component.html
<div class="p-6 max-w-7xl mx-auto space-y-6 animate-fade-in">
  
  <div class="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
    <div>
      <h1 class="text-2xl font-bold text-gray-800">Historique des Réservations</h1>
      <p class="text-gray-500 text-sm">Consultez et gérez l'ensemble des réservations passées et futures.</p>
    </div>
    
    <div class="flex gap-4">
        <div class="bg-white px-4 py-2 rounded-xl shadow-sm border border-gray-100 flex flex-col items-end">
            <span class="text-xs text-gray-400 font-bold uppercase">CA Total (Visible)</span>
            <span class="text-lg font-black text-emerald-600">{{ totalRevenue() | number:'1.0-0' }} <span class="text-xs text-gray-400">DT</span></span>
        </div>
        <div class="bg-white px-4 py-2 rounded-xl shadow-sm border border-gray-100 flex flex-col items-end">
            <span class="text-xs text-gray-400 font-bold uppercase">Annulations</span>
            <span class="text-lg font-black text-red-500">{{ countCancelled() }}</span>
        </div>
    </div>
  </div>

  <div class="bg-white p-4 rounded-xl shadow-sm border border-gray-100 grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
    
    <div class="relative">
      <label class="text-xs font-bold text-gray-500 uppercase mb-1 block">Recherche</label>
      <input type="text" 
             [ngModel]="searchTerm()" 
             (ngModelChange)="updateSearch(\$event)"
             placeholder="Nom, Téléphone..." 
             class="w-full pl-9 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all">
      <span class="material-icons absolute left-3 top-[34px] text-gray-400 text-sm">search</span>
    </div>

    <div>
      <label class="text-xs font-bold text-gray-500 uppercase mb-1 block">Statut</label>
      <select [ngModel]="statusFilter()" (ngModelChange)="updateStatus(\$event)"
              class="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none">
        <option value="ALL">Tous les statuts</option>
        <option value="CONFIRMED">Confirmé</option>
        <option value="COMPLETED">Terminé</option>
        <option value="CANCELLED">Annulé</option>
      </select>
    </div>

    <div>
      <label class="text-xs font-bold text-gray-500 uppercase mb-1 block">Du</label>
      <input type="date" [(ngModel)]="startDate" (change)="updateDate()"
             class="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none">
    </div>

    <div class="flex gap-2">
      <div class="flex-1">
        <label class="text-xs font-bold text-gray-500 uppercase mb-1 block">Au</label>
        <input type="date" [(ngModel)]="endDate" (change)="updateDate()"
               class="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none">
      </div>
      <button (click)="resetFilters()" class="px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-lg self-end" title="Réinitialiser">
        <span class="material-icons">restart_alt</span>
      </button>
    </div>
  </div>

  <div class="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
    <table class="w-full text-sm text-left">
      <thead class="bg-gray-50 text-gray-500 font-bold uppercase text-xs">
        <tr>
          <th class="px-6 py-4">Date / Créneau</th>
          <th class="px-6 py-4">Client</th>
          <th class="px-6 py-4 text-center">Services</th>
          <th class="px-6 py-4 text-center">Statut</th>
          <th class="px-6 py-4 text-right">Montant</th>
          <th class="px-6 py-4 text-right">Reste</th>
          <th class="px-6 py-4 text-center">Action</th>
        </tr>
      </thead>
      <tbody class="divide-y divide-gray-100">
        <tr *ngFor="let res of paginatedReservations()" 
            class="hover:bg-blue-50/50 transition-colors cursor-pointer group"
            (click)="viewReservation(res.id)">
          
          <td class="px-6 py-4">
            <div class="font-bold text-gray-800">{{ res.date | date:'dd MMM yyyy' }}</div>
            <div class="text-xs text-gray-500">{{ res.startTime }} - {{ res.endTime }}</div>
          </td>

          <td class="px-6 py-4">
            <div class="font-bold text-gray-800">{{ res.client?.nom }} {{ res.client?.prenom }}</div>
            <div class="text-xs text-gray-500">{{ res.client?.telephone }}</div>
          </td>

          <td class="px-6 py-4 text-center">
            <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
              {{ res.services?.length || 0 }}
            </span>
          </td>

          <td class="px-6 py-4 text-center">
            <span [class]="'px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide border ' + getStatusClass(res.status)">
              {{ getStatusLabel(res.status) }}
            </span>
          </td>

          <td class="px-6 py-4 text-right font-bold text-gray-800">
            {{ res.totalPrice | number:'1.0-0' }} DT
          </td>

          <td class="px-6 py-4 text-right">
            <span [class]="(res.totalPrice - (res.advance || 0)) <= 0 ? 'text-emerald-500 font-bold' : 'text-red-500 font-bold'">
              {{ (res.totalPrice - (res.advance || 0)) | number:'1.0-0' }} DT
            </span>
          </td>

          <td class="px-6 py-4 text-center">
            <button class="text-gray-400 hover:text-blue-600 p-2 rounded-full hover:bg-blue-100 transition-all">
              <span class="material-icons">arrow_forward</span>
            </button>
          </td>
        </tr>

        <tr *ngIf="paginatedReservations().length === 0">
          <td colspan="7" class="px-6 py-12 text-center">
            <div class="flex flex-col items-center justify-center text-gray-400">
              <span class="material-icons text-4xl mb-2">search_off</span>
              <p>Aucune réservation trouvée pour ces critères.</p>
            </div>
          </td>
        </tr>
      </tbody>
    </table>

    <div *ngIf="filteredReservations().length > 0" class="bg-gray-50 px-6 py-4 border-t border-gray-100 flex items-center justify-between">
      
      <div class="text-sm text-gray-500">
        Affichage de <span class="font-bold">{{ (currentPage() - 1) * itemsPerPage() + 1 }}</span> à 
        <span class="font-bold">{{ (currentPage() * itemsPerPage()) > filteredReservations().length ? filteredReservations().length : (currentPage() * itemsPerPage()) }}</span> 
        sur <span class="font-bold">{{ filteredReservations().length }}</span> résultats
      </div>

      <div class="flex items-center gap-2">
        <button (click)="prevPage()" [disabled]="currentPage() === 1"
                class="p-2 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition text-gray-600">
          <span class="material-icons text-sm">chevron_left</span>
        </button>

        <div class="flex items-center gap-1">
            <span class="px-3 py-1 bg-blue-600 text-white rounded-md text-sm font-bold shadow-sm">
                {{ currentPage() }}
            </span>
            <span class="text-gray-400 text-sm">/</span>
            <span class="px-3 py-1 text-gray-600 text-sm font-medium cursor-pointer hover:bg-gray-100 rounded-md" 
                  (click)="setPage(totalPages())">
                {{ totalPages() }}
            </span>
        </div>

        <button (click)="nextPage()" [disabled]="currentPage() === totalPages()"
                class="p-2 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition text-gray-600">
          <span class="material-icons text-sm">chevron_right</span>
        </button>
      </div>
    </div>

  </div>
</div>
EOF

echo "✅ Pagination activée sur l'historique (10 éléments par page)."