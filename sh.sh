#!/bin/bash

# add_weekly_print_feature.sh

# 1. CRÉATION DU SERVICE PDF (Logique de génération Paysage avec détails mariés/tél)
echo "Création du service WeeklyPdfService..."
cat > src/app/core/services/weekly-pdf.service.ts << 'EOF'
import { Injectable, inject } from '@angular/core';
import { ReservationService } from './reservation.service';
import { ClientService } from './client.service';
import { firstValueFrom } from 'rxjs';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

@Injectable({
  providedIn: 'root'
})
export class WeeklyPdfService {
  private reservationService = inject(ReservationService);
  private clientService = inject(ClientService);

  async printWeek(referenceDateStr: string) {
    if (!referenceDateStr) return;

    // 1. Calcul des dates de la semaine (Lundi au Dimanche) basées sur la date choisie
    const refDate = new Date(referenceDateStr);
    const currentDay = refDate.getDay(); // 0=Dim, 1=Lun
    // Si Dimanche (0), on recule de 6 jours pour avoir le Lundi précédent, sinon on recule de (jour - 1)
    const diff = refDate.getDate() - currentDay + (currentDay === 0 ? -6 : 1);
    
    const monday = new Date(refDate);
    monday.setDate(diff);
    monday.setHours(0, 0, 0, 0);
    
    const weekDates: Date[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      weekDates.push(d);
    }
    const sunday = weekDates[6];

    // 2. Récupération des données
    const reservations = await firstValueFrom(this.reservationService.getReservations());
    const clients = await firstValueFrom(this.clientService.getAll());

    // 3. Filtrage pour la semaine
    const weekReservations = reservations.filter((r: any) => {
      if (!r.date) return false;
      const rDate = this.parseDate(r.date);
      // Comparaison simple des timestamps jour
      const rTime = rDate.setHours(0,0,0,0);
      return rTime >= monday.getTime() && rTime <= sunday.getTime();
    });

    // 4. Initialisation PDF (Paysage A4)
    const doc = new jsPDF('l', 'mm', 'a4');

    // Titre
    doc.setFontSize(16);
    doc.text(`Planning des Fêtes : Semaine du ${this.formatDateShort(monday)} au ${this.formatDateShort(sunday)}`, 14, 15);
    doc.setFontSize(10);
    doc.text(`Généré le ${new Date().toLocaleDateString()}`, 250, 15);

    // 5. Construction du Tableau
    // En-tête : Les jours
    const head = [weekDates.map(d => this.formatDateFull(d))];

    // Corps : 3 Lignes (Matin, Aprem, Soir)
    const rowMatin: string[] = [];
    const rowAprem: string[] = [];
    const rowSoir: string[] = [];

    weekDates.forEach(date => {
      const dailyRes = weekReservations.filter((r: any) => 
        this.isSameDay(this.parseDate(r.date), date)
      );

      rowMatin.push(this.getCellContent(dailyRes, 'matin', clients));
      rowAprem.push(this.getCellContent(dailyRes, 'aprem', clients));
      rowSoir.push(this.getCellContent(dailyRes, 'soir', clients));
    });

    const body = [rowMatin, rowAprem, rowSoir];

    autoTable(doc, {
      head: head,
      body: body,
      startY: 25,
      theme: 'grid',
      headStyles: {
        fillColor: [79, 70, 229],
        textColor: 255,
        fontStyle: 'bold',
        halign: 'center',
        valign: 'middle'
      },
      styles: {
        fontSize: 8,
        cellPadding: 2,
        overflow: 'linebreak',
        valign: 'top',
        lineColor: [200, 200, 200],
        lineWidth: 0.1,
      },
      // Force une hauteur minimale pour la lisibilité
      bodyStyles: {
        minCellHeight: 40
      },
      // Personnalisation des lignes pour afficher le nom du créneau (Matin/Aprem/Soir) ?
      // Ici on laisse le contenu parler, mais on pourrait ajouter une première colonne "Créneau" si besoin.
      // Pour l'instant, c'est implicite par la position (Ligne 1 = Matin, etc)
    });

    doc.save(`Semaine_${this.formatDateShort(monday)}.pdf`);
  }

  // --- HELPERS ---

  private getCellContent(reservations: any[], slotType: string, clients: any[]): string {
    // Trouve les résa qui correspondent au slot (ex: slotId contient 'matin' ou startTime correspond)
    // Ici on suppose que slotId ou le contexte permet de filtrer. 
    // Si slotId n'est pas fiable, il faudrait filtrer par heure.
    // On va utiliser une recherche large sur slotId.
    const slotRes = reservations.filter((r: any) => {
      const s = (r.slotId || '').toLowerCase();
      // Si pas de slotId, on peut essayer de deviner avec l'heure (optionnel)
      return s.includes(slotType);
    });

    if (slotRes.length === 0) return '';

    return slotRes.map((r: any) => {
      const client = clients.find(c => c.id === r.clientId);
      
      // Infos de base
      let content = `• ${r.startTime || ''}-${r.endTime || ''}`;
      
      if (client) {
        content += `\nCLT: ${client.nom?.toUpperCase()} ${client.prenom}`;
        
        // Mariés
        if (client.prenomMarie1 || client.prenomMarie2) {
           content += `\nMariés: ${client.prenomMarie1 || ''} & ${client.prenomMarie2 || ''}`;
        }
        
        // Téléphone
        if (client.telephone) {
          content += `\nTel: ${client.telephone}`;
        }
      } else {
        content += `\n${r.clientName || 'Client Inconnu'}`;
      }

      // Note éventuelle courte
      if (r.status === 'PENDING') content += `\n(En attente)`;

      return content;
    }).join('\n\n----------------\n\n');
  }

  private parseDate(value: any): Date {
    if (value?.toDate) return value.toDate();
    if (typeof value === 'string') return new Date(value);
    return new Date();
  }

  private isSameDay(d1: Date, d2: Date): boolean {
    return d1.getDate() === d2.getDate() && 
           d1.getMonth() === d2.getMonth() && 
           d1.getFullYear() === d2.getFullYear();
  }

  private formatDateShort(d: Date): string {
    return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' });
  }

  private formatDateFull(d: Date): string {
    const str = d.toLocaleDateString('fr-FR', { weekday: 'long', day: '2-digit', month: '2-digit' });
    // Met la première lettre en majuscule
    return str.charAt(0).toUpperCase() + str.slice(1);
  }
}
EOF

# 2. MISE À JOUR DE HISTORY COMPONENT
# On garde TOUT le code existant, on ajoute juste le bouton, la modal, et l'injection du service.

echo "Mise à jour de HistoryComponent avec Popup..."
cat > src/app/features/history/history.component.ts << 'EOF'
import { Component, inject, computed, signal, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ReservationService } from '../../core/services/reservation.service';
import { WeeklyPdfService } from '../../core/services/weekly-pdf.service';
import { toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';

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

      <div *ngIf="showWeekModal" class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
        <div class="bg-white rounded-xl shadow-2xl max-w-sm w-full p-6 space-y-4">
          <h3 class="text-lg font-bold text-slate-800 flex items-center gap-2">
            <span class="material-icons text-indigo-600">date_range</span>
            Sélectionner la semaine
          </h3>
          <p class="text-sm text-slate-500">Choisissez une date. Le système imprimera automatiquement la semaine complète (Lun-Dim) contenant cette date.</p>
          
          <div>
            <label class="block text-xs font-bold text-slate-500 mb-1">Date de référence</label>
            <input type="date" [(ngModel)]="selectedWeekDate" class="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none">
          </div>

          <div class="flex justify-end gap-2 pt-2">
            <button (click)="closeWeekModal()" class="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg text-sm font-medium">Annuler</button>
            <button (click)="generateWeekPdf()" [disabled]="!selectedWeekDate" class="px-4 py-2 bg-indigo-600 text-white hover:bg-indigo-700 rounded-lg text-sm font-medium disabled:opacity-50 flex items-center gap-2">
              <span class="material-icons text-sm">print</span> Générer PDF
            </button>
          </div>
        </div>
      </div>

    </div>
  `
})
export class HistoryComponent {
  private service = inject(ReservationService);
  private weeklyPdfService = inject(WeeklyPdfService); // Injection du service PDF

  // --- LOGIQUE MODALE SEMAINE ---
  showWeekModal = false;
  selectedWeekDate = new Date().toISOString().split('T')[0]; // Aujourd'hui par défaut

  openWeekModal() { this.showWeekModal = true; }
  closeWeekModal() { this.showWeekModal = false; }
  
  generateWeekPdf() {
    this.weeklyPdfService.printWeek(this.selectedWeekDate);
    this.closeWeekModal();
  }

  // --- EXISTANT (Filtrage, Pagination...) ---
  
  page = signal(1);
  pageSize = signal(10);
  
  rawReservations = toSignal(this.service.getAll(), { initialValue: [] });
  
  searchQuery = signal('');
  startDate = signal('');
  endDate = signal('');
  statusFilter = signal('ALL');

  constructor() {
    effect(() => {
      this.searchQuery();
      this.statusFilter();
      this.startDate();
      this.endDate();
      this.page.set(1);
    }, { allowSignalWrites: true });
  }

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

  filteredReservations = computed(() => {
    let data = this.rawReservations();
    const query = this.searchQuery().toLowerCase();
    const start = this.startDate();
    const end = this.endDate();
    const status = this.statusFilter();

    data = [...data].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    return data.filter(r => {
      const matchesSearch = r.clientName?.toLowerCase().includes(query);
      const matchesStatus = status === 'ALL' ? true : r.status === status;
      let matchesDate = true;
      if (start) matchesDate = matchesDate && r.date >= start;
      if (end) matchesDate = matchesDate && r.date <= end;
      return matchesSearch && matchesStatus && matchesDate;
    });
  });

  toDate(val: any): any {
    if (!val) return null;
    if (typeof val === 'object' && typeof val.toDate === 'function') return val.toDate();
    return val;
  }
}
EOF