import { Component, inject, computed, signal, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ReservationService } from '../../core/services/reservation.service';
import { toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-history',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
    <div class="p-6 max-w-7xl mx-auto space-y-6">
      
      <div class="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 class="text-2xl font-bold text-slate-800 flex items-center">
            <span class="material-icons mr-3 text-slate-400">history_edu</span>
            Historique & Rapports
          </h1>
          <p class="text-slate-500 mt-1">Consultez l'historique des réservations et le chiffre d'affaires.</p>
        </div>
        
      </div>

      <div class="bg-white p-4 rounded-xl shadow-sm border border-slate-200 grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
        
        <div class="md:col-span-1">
          <label class="block text-xs font-bold text-slate-500 mb-1">Recherche Client</label>
          <div class="relative">
            <span class="material-icons absolute left-3 top-2 text-slate-400 text-sm">search</span>
            <input type="text" [(ngModel)]="searchQuery" placeholder="Nom, Prénom..." class="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm">
          </div>
        </div>

        <div>
          <label class="block text-xs font-bold text-slate-500 mb-1">Du</label>
          <input type="date" [(ngModel)]="startDate" class="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm">
        </div>

        <div>
          <label class="block text-xs font-bold text-slate-500 mb-1">Au</label>
          <input type="date" [(ngModel)]="endDate" class="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm">
        </div>

        <div>
          <label class="block text-xs font-bold text-slate-500 mb-1">Statut</label>
          <select [(ngModel)]="statusFilter" class="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm bg-white">
            <option value="ALL">Tous les statuts</option>
            <option value="CONFIRMED">✅ Confirmés</option>
            <option value="PENDING">⏳ En attente</option>
            <option value="CANCELLED">🚫 Annulés</option>
          </select>
        </div>
      </div>

      <div class="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div class="overflow-x-auto">
          <table class="w-full text-left">
            <thead class="bg-slate-50 border-b border-slate-200">
              <tr>
                <th class="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Date / Heure</th>
                <th class="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Client</th>
                <th class="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Statut</th>
                <th class="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider text-right">Prix Total</th>
                <th class="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider text-right">Avance</th>
                <th class="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider text-right">Reste</th>
                <th class="px-6 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">Action</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100">
              @for (res of paginatedReservations(); track res.id) {
                <tr class="hover:bg-slate-50 transition group">
                  <td class="px-6 py-4">
                    <div class="font-bold text-slate-800">{{ toDate(res.date) | date:'dd MMM yyyy' }}</div>
                    <div class="text-xs text-slate-500">{{ res.startTime }} - {{ res.endTime }}</div>
                  </td>
                  <td class="px-6 py-4">
                    <div class="font-medium text-slate-900">{{ res.clientName }}</div>
                  </td>
                  <td class="px-6 py-4">
                    <span class="px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide border"
                      [class.bg-emerald-50]="res.status === 'CONFIRMED'" [class.text-emerald-700]="res.status === 'CONFIRMED'" [class.border-emerald-100]="res.status === 'CONFIRMED'"
                      [class.bg-amber-50]="res.status === 'PENDING'" [class.text-amber-700]="res.status === 'PENDING'" [class.border-amber-100]="res.status === 'PENDING'"
                      [class.bg-red-50]="res.status === 'CANCELLED'" [class.text-red-700]="res.status === 'CANCELLED'" [class.border-red-100]="res.status === 'CANCELLED'">
                      {{ res.status === 'CONFIRMED' ? 'Confirmé' : (res.status === 'PENDING' ? 'En Attente' : 'Annulé') }}
                    </span>
                  </td>
                  <td class="px-6 py-4 text-right font-mono text-sm text-slate-600">
                    {{ res.totalPrice | number }} DT
                  </td>
                  <td class="px-6 py-4 text-right font-mono text-sm text-emerald-600 font-bold">
                    {{ res.advance | number }} DT
                  </td>
                  <td class="px-6 py-4 text-right font-mono text-sm text-red-500">
                    {{ (res.totalPrice || 0) - (res.advance || 0) | number }} DT
                  </td>
                  <td class="px-6 py-4 text-right">
                    <a [routerLink]="['/reservations/edit', res.id]" class="text-blue-600 hover:bg-blue-50 p-2 rounded-full transition inline-block">
                      <span class="material-icons text-lg">visibility</span>
                    </a>
                  </td>
                </tr>
              } @empty {
                <tr>
                  <td colspan="7" class="px-6 py-12 text-center text-slate-400">
                    <span class="material-icons text-4xl mb-2">filter_list_off</span>
                    <p>Aucune réservation trouvée pour ces critères.</p>
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      </div>
        <!-- Pagination -->
        <div class="flex items-center justify-between px-6 py-4 border-t border-slate-100 bg-white">
          <div class="text-xs text-slate-500 font-semibold">
            Page <span class="text-slate-800">{{ page() }}</span> / <span class="text-slate-800">{{ totalPages() }}</span>
            • Total: <span class="text-slate-800">{{ filteredReservations().length }}</span>
          </div>

          <div class="flex items-center gap-3">
            <label class="text-xs font-bold text-slate-500">Lignes</label>
            <select class="border border-slate-200 rounded-lg px-2 py-1 text-sm"
                    [ngModel]="pageSize()"
                    (ngModelChange)="pageSize.set($event); page.set(1)">
              <option [ngValue]="5">5</option>
              <option [ngValue]="10">10</option>
              <option [ngValue]="20">20</option>
              <option [ngValue]="50">50</option>
            </select>

            <button class="px-3 py-2 rounded-lg border border-slate-200 text-slate-700 font-bold disabled:opacity-40"
                    (click)="prevPage()"
                    [disabled]="page() <= 1">
              ←
            </button>
            <button class="px-3 py-2 rounded-lg border border-slate-200 text-slate-700 font-bold disabled:opacity-40"
                    (click)="nextPage()"
                    [disabled]="page() >= totalPages()">
              →
            </button>
          </div>
        </div>

    </div>
  `
})
export class HistoryComponent {

  // --- PAGINATION ---
  page = signal(1);
  pageSize = signal(10);

  totalPages = computed(() => {
    const total = this.filteredReservations().length;
    return Math.max(1, Math.ceil(total / this.pageSize()));
  });

  paginatedReservations = computed(() => {
    const list = this.filteredReservations();
    const p = Math.min(Math.max(1, this.page()), this.totalPages());
    const start = (p - 1) * this.pageSize();
    return list.slice(start, start + this.pageSize());
  });

  prevPage() { this.page.update(p => Math.max(1, p - 1)); }
  nextPage() { this.page.update(p => Math.min(this.totalPages(), p + 1)); }

  // Revenir à la page 1 dès qu'un filtre change
  constructor() {
    effect(() => {
      this.searchQuery();
      this.statusFilter();
      this.startDate();
      this.endDate();
      this.page.set(1);
    }, { allowSignalWrites: true });
  }

  private service = inject(ReservationService);
  
  // Données brutes
  rawReservations = toSignal(this.service.getAll(), { initialValue: [] });
  
  // Filtres (Signals)
  searchQuery = signal('');
  startDate = signal('');
  endDate = signal('');
  statusFilter = signal('ALL');

  // Logique de filtrage
  filteredReservations = computed(() => {
    let data = this.rawReservations();
    const query = this.searchQuery().toLowerCase();
    const start = this.startDate();
    const end = this.endDate();
    const status = this.statusFilter();

    // Tri par date décroissante (le plus récent en haut)
    data = [...data].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    return data.filter(r => {
      // Filtre Recherche Texte
      const matchesSearch = r.clientName?.toLowerCase().includes(query);
      
      // Filtre Statut
      const matchesStatus = status === 'ALL' ? true : r.status === status;
      
      // Filtre Date
      let matchesDate = true;
      if (start) matchesDate = matchesDate && r.date >= start;
      if (end) matchesDate = matchesDate && r.date <= end;

      return matchesSearch && matchesStatus && matchesDate;
    });
  });

  // Calcul des totaux sur les données FILTRÉES
  totalRevenue = computed(() => this.filteredReservations().reduce((sum, r) => sum + (Number(r.totalPrice) || 0), 0));
  totalAdvance = computed(() => this.filteredReservations().reduce((sum, r) => sum + (Number(r.advance) || 0), 0));

  // Helper: Conversion Timestamp Firestore -> Date JS
  toDate(val: any): any {
    if (!val) return null;
    // Duck typing pour détecter un Timestamp Firestore
    if (typeof val === 'object' && typeof val.toDate === 'function') {
      return val.toDate();
    }
    return val;
  }
}
