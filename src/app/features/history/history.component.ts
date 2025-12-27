import { Component, inject, computed, signal, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ReservationService } from '../../core/services/reservation.service';
import { WeeklyPdfService } from '../../core/services/weekly-pdf.service';
import { toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { Timestamp } from '@angular/fire/firestore'; // Import nécessaire pour les dates

@Component({
  selector: 'app-history',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
    <div class="p-6 max-w-7xl mx-auto space-y-6 relative">
      
      <div class="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 class="text-2xl font-bold text-slate-800 flex items-center">
            <span class="material-icons mr-3 text-slate-400">history_edu</span>
            Historique & Rapports
          </h1>
          <p class="text-slate-500 mt-1">Consultez l'historique des réservations et le chiffre d'affaires.</p>
        </div>

        <button (click)="openWeekModal()" 
                class="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition shadow-sm font-medium">
          <span class="material-icons">print</span>
          Imprimer Semaine
        </button>
      </div>

      <div class="bg-white p-4 rounded-xl shadow-sm border border-slate-200 grid grid-cols-1 md:grid-cols-5 gap-4 items-end">
        
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

        <div>
          <label class="block text-xs font-bold text-transparent mb-1">Action</label>
          <button (click)="resetFilters()" 
                  class="w-full px-3 py-2 bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-800 rounded-lg transition font-bold flex items-center justify-center gap-2 text-sm border border-slate-200"
                  title="Réinitialiser les filtres">
            <span class="material-icons text-lg">filter_alt_off</span>
            Reset
          </button>
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
                    <div class="font-bold text-slate-800">{{ getDateObj(res.date) | date:'dd MMM yyyy' }}</div>
                    <div class="text-xs text-slate-500">{{ res.startTime || '??:??' }} - {{ res.endTime || '??:??' }}</div>
                  </td>
                  <td class="px-6 py-4">
                    <div class="font-medium text-slate-900">{{ res.clientName || res.customerName || 'Client Inconnu' }}</div>
                    <div *ngIf="res.customerPhone" class="text-xs text-slate-400">{{ res.customerPhone }}</div>
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
                    {{ res.advancePayment || res.advance || 0 | number }} DT
                  </td>
                  <td class="px-6 py-4 text-right font-mono text-sm text-red-500">
                    {{ (res.totalPrice || 0) - (res.advancePayment || res.advance || 0) | number }} DT
                  </td>
                  <td class="px-6 py-4 text-right">
                    <a [routerLink]="['/reservations/edit', res.id]" class="text-blue-600 hover:bg-blue-50 p-2 rounded-full transition inline-block" title="Voir détails">
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
      
      <div class="flex items-center justify-between px-6 py-4 border-t border-slate-100 bg-white">
        <div class="text-xs text-slate-500 font-semibold">
          Page <span class="text-slate-800">{{ page() }}</span> / <span class="text-slate-800">{{ totalPages() }}</span>
          • Total: <span class="text-slate-800">{{ filteredReservations().length }}</span>
        </div>

        <div class="flex items-center gap-3">
          <button class="px-3 py-2 rounded-lg border border-slate-200 text-slate-700 font-bold disabled:opacity-40"
                  (click)="prevPage()" [disabled]="page() <= 1">←</button>
          <button class="px-3 py-2 rounded-lg border border-slate-200 text-slate-700 font-bold disabled:opacity-40"
                  (click)="nextPage()" [disabled]="page() >= totalPages()">→</button>
        </div>
      </div>

      <div *ngIf="showWeekModal" class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
        <div class="bg-white rounded-xl shadow-2xl max-w-sm w-full p-6 space-y-4">
          <h3 class="text-lg font-bold text-slate-800 flex items-center gap-2">
            <span class="material-icons text-indigo-600">date_range</span>
            Sélectionner la semaine
          </h3>
          <input type="date" [(ngModel)]="selectedWeekDate" class="w-full px-3 py-2 border border-slate-300 rounded-lg">
          <div class="flex justify-end gap-2 pt-2">
            <button (click)="closeWeekModal()" class="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg text-sm font-medium">Annuler</button>
            <button (click)="generateWeekPdf()" [disabled]="!selectedWeekDate" class="px-4 py-2 bg-indigo-600 text-white hover:bg-indigo-700 rounded-lg text-sm font-medium">Imprimer</button>
          </div>
        </div>
      </div>

    </div>
  `
})
export class HistoryComponent {
  private service = inject(ReservationService);
  private weeklyPdfService = inject(WeeklyPdfService);

  showWeekModal = false;
  selectedWeekDate = new Date().toISOString().split('T')[0];

  page = signal(1);
  pageSize = signal(10);
  
  // Récupération des données brutes
  rawReservations = toSignal(this.service.getAll(), { initialValue: [] });
  
  searchQuery = signal('');
  startDate = signal('');
  endDate = signal('');
  statusFilter = signal('ALL');

  constructor() {
    effect(() => {
      // Réinitialise la page si un filtre change
      this.searchQuery();
      this.statusFilter();
      this.startDate();
      this.endDate();
      this.page.set(1);
    }, { allowSignalWrites: true });
  }

  openWeekModal() { this.showWeekModal = true; }
  closeWeekModal() { this.showWeekModal = false; }
  
  generateWeekPdf() {
    this.weeklyPdfService.printWeek(this.selectedWeekDate);
    this.closeWeekModal();
  }

  // --- LOGIQUE DE FILTRAGE CORRIGÉE ---
  filteredReservations = computed(() => {
    let data = this.rawReservations();
    const query = this.searchQuery().toLowerCase();
    const start = this.startDate();
    const end = this.endDate();
    const status = this.statusFilter();

    // 1. Filtrage
    data = data.filter(r => {
      // Correction Nom : check clientName OU customerName
      const name = (r.clientName || r.customerName || '').toLowerCase();
      const matchesSearch = name.includes(query);
      
      const matchesStatus = status === 'ALL' ? true : r.status === status;
      
      // Correction Dates : conversion sécurisée en YYYY-MM-DD
      let matchesDate = true;
      if (start || end) {
        const dateObj = this.getDateObj(r.date);
        if (dateObj) {
            const dateStr = dateObj.toISOString().split('T')[0]; // "2023-01-01"
            if (start && dateStr < start) matchesDate = false;
            if (end && dateStr > end) matchesDate = false;
        }
      }
      
      return matchesSearch && matchesStatus && matchesDate;
    });

    // 2. Tri (Plus récent en premier)
    data.sort((a, b) => {
        const dateA = this.getDateObj(a.date)?.getTime() || 0;
        const dateB = this.getDateObj(b.date)?.getTime() || 0;
        return dateB - dateA;
    });

    return data;
  });

  // Pagination
  totalPages = computed(() => Math.max(1, Math.ceil(this.filteredReservations().length / this.pageSize())));
  
  paginatedReservations = computed(() => {
    const list = this.filteredReservations();
    const p = Math.min(Math.max(1, this.page()), this.totalPages());
    const start = (p - 1) * this.pageSize();
    return list.slice(start, start + this.pageSize());
  });

  prevPage() { this.page.update(p => Math.max(1, p - 1)); }
  nextPage() { this.page.update(p => Math.min(this.totalPages(), p + 1)); }

  /**
   * Helper robuste pour convertir Timestamp Firebase / Date JS / String en objet Date JS
   */
  getDateObj(val: any): Date | null {
    if (!val) return null;
    if (val instanceof Date) return val;
    // Gestion Timestamp Firebase
    if (typeof val === 'object' && typeof val.toDate === 'function') {
      return val.toDate();
    }
    // Gestion String ou Timestamp {seconds, nanoseconds} brut
    if (typeof val === 'string') return new Date(val);
    if (val.seconds) return new Date(val.seconds * 1000);
    
    return null;
  }


  resetFilters() {
    this.searchQuery.set("");
    this.startDate.set("");
    this.endDate.set("");
    this.statusFilter.set("ALL");
    this.page.set(1);
  }

}