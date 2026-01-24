#!/bin/bash

# Définition des chemins
TS_FILE="src/app/features/dashboard/dashboard.component.ts"
HTML_FILE="src/app/features/dashboard/dashboard.component.html"

echo "🚀 Mise à jour du Dashboard pour afficher les Notes..."

# 1. Mise à jour du TypeScript
echo "📝 Écriture de $TS_FILE..."
cat << 'EOF' > "$TS_FILE"
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
EOF

# 2. Mise à jour du HTML (Ajout de la colonne Notes)
echo "📝 Écriture de $HTML_FILE..."
cat << 'EOF' > "$HTML_FILE"
<div class="p-6 max-w-7xl mx-auto space-y-8 animate-fade-in">
  
  <div class="flex justify-between items-center">
    <div>
      <h1 class="text-2xl font-black text-slate-800">Tableau de Bord</h1>
      <p class="text-slate-500 text-sm">Vue d'ensemble de l'activité</p>
    </div>
    <a routerLink="/reservations/new" class="px-4 py-2 bg-slate-900 text-white rounded-lg font-bold text-sm shadow hover:bg-slate-800 transition flex items-center gap-2">
      <span class="material-icons text-sm">add</span> Nouvelle Réservation
    </a>
  </div>

  <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
    <div class="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-4">
      <div class="w-12 h-12 rounded-full bg-blue-50 flex items-center justify-center text-blue-600">
        <span class="material-icons">event</span>
      </div>
      <div>
        <div class="text-2xl font-black text-slate-800">{{ totalReservations() }}</div>
        <div class="text-xs font-bold text-slate-400 uppercase">Réservations Actives</div>
      </div>
    </div>

    <div class="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-4">
      <div class="w-12 h-12 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-600">
        <span class="material-icons">payments</span>
      </div>
      <div>
        <div class="text-2xl font-black text-slate-800">{{ totalRevenue() | number:'1.0-0' }} <span class="text-sm font-normal text-slate-400">DT</span></div>
        <div class="text-xs font-bold text-slate-400 uppercase">Chiffre d'Affaires</div>
      </div>
    </div>

    <div class="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-4">
      <div class="w-12 h-12 rounded-full bg-orange-50 flex items-center justify-center text-orange-600">
        <span class="material-icons">today</span>
      </div>
      <div>
        <div class="text-2xl font-black text-slate-800">{{ todayReservations().length }}</div>
        <div class="text-xs font-bold text-slate-400 uppercase">Aujourd'hui</div>
      </div>
    </div>
  </div>

  <div class="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
    <div class="px-6 py-4 border-b border-slate-50 flex justify-between items-center bg-blue-50/30">
      <h3 class="font-bold text-slate-700 flex items-center gap-2">
        <span class="material-icons text-blue-500 text-base">calendar_month</span>
        Prochaines Réservations (7 jours)
      </h3>
    </div>

    <div class="overflow-x-auto">
      <table class="w-full text-sm text-left">
        <thead class="text-xs text-slate-400 uppercase bg-slate-50 font-bold">
          <tr>
            <th class="px-6 py-3">Date</th>
            <th class="px-6 py-3">Client</th>
            <th class="px-6 py-3 w-1/3">Notes</th> 
            <th class="px-6 py-3 text-center">Statut</th>
            <th class="px-6 py-3 text-right">Reste à payer</th>
            <th class="px-6 py-3 text-center">Action</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-50">
          @for (res of upcomingReservations(); track res.id) {
            <tr class="hover:bg-slate-50 transition cursor-pointer" (click)="navigateToReservation(res.id)">
              <td class="px-6 py-4 font-medium text-slate-700">
                {{ res.date | date:'dd MMM yyyy' }}
                <div class="text-xs text-slate-400 font-normal">{{ res.startTime }} - {{ res.endTime }}</div>
              </td>
              <td class="px-6 py-4">
                <div class="font-bold text-slate-800">{{ res.client?.nom }} {{ res.client?.prenom }}</div>
                <div class="text-xs text-slate-400 flex items-center gap-1">
                    <span class="material-icons text-[10px]">phone</span> {{ res.client?.telephone }}
                </div>
              </td>
              <td class="px-6 py-4">
                <div class="text-xs text-slate-500 italic whitespace-pre-wrap line-clamp-2">
                    {{ res.notes || '-' }}
                </div>
              </td>
              <td class="px-6 py-4 text-center">
                <span [class]="'px-2.5 py-1 rounded-full text-[10px] font-bold uppercase border ' + getStatusClass(res.status)">
                  {{ getStatusLabel(res.status) }}
                </span>
              </td>
              <td class="px-6 py-4 text-right">
                @if ((res.totalPrice - (res.advance || 0)) > 0) {
                    <span class="font-bold text-red-500">{{ (res.totalPrice - (res.advance || 0)) | number:'1.0-0' }} DT</span>
                } @else {
                    <span class="font-bold text-emerald-500 text-xs bg-emerald-50 px-2 py-1 rounded">Réglé</span>
                }
              </td>
              <td class="px-6 py-4 text-center" (click)="$event.stopPropagation()">
                <button (click)="navigateToReservation(res.id)" class="px-3 py-1.5 bg-blue-50 text-blue-600 rounded-lg font-bold text-xs hover:bg-blue-100 transition flex items-center justify-center mx-auto gap-1">
                    <span class="material-icons text-xs">visibility</span> Voir
                </button>
              </td>
            </tr>
          }
          @empty {
            <tr>
              <td colspan="6" class="px-6 py-8 text-center text-slate-400 italic">
                Rien de prévu pour les 7 prochains jours.
              </td>
            </tr>
          }
        </tbody>
      </table>
    </div>
  </div>

  <div class="bg-white rounded-2xl border border-red-100 shadow-sm overflow-hidden">
    <div class="px-6 py-4 border-b border-red-50 flex justify-between items-center bg-red-50/30">
      <h3 class="font-bold text-red-700 flex items-center gap-2">
        <span class="material-icons text-red-500 text-base">warning</span>
        Retards de Paiement (Passé)
      </h3>
    </div>

    <div class="overflow-x-auto">
      <table class="w-full text-sm text-left">
        <thead class="text-xs text-red-400 uppercase bg-red-50/50 font-bold">
          <tr>
            <th class="px-6 py-3">Date</th>
            <th class="px-6 py-3">Client</th>
            <th class="px-6 py-3 w-1/3">Notes</th>
            <th class="px-6 py-3 text-center">Statut</th>
            <th class="px-6 py-3 text-right">Reste à payer</th>
            <th class="px-6 py-3 text-center">Action</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-red-50">
          @for (res of pastUnpaidReservations(); track res.id) {
            <tr class="hover:bg-red-50/30 transition cursor-pointer" (click)="navigateToReservation(res.id)">
              <td class="px-6 py-4 font-medium text-slate-700">
                <span class="text-red-600 font-bold">{{ res.date | date:'dd MMM yyyy' }}</span>
              </td>
              <td class="px-6 py-4">
                <div class="font-bold text-slate-800">{{ res.client?.nom }} {{ res.client?.prenom }}</div>
                <div class="text-xs text-slate-400">{{ res.client?.telephone }}</div>
              </td>
              <td class="px-6 py-4">
                <div class="text-xs text-slate-500 italic whitespace-pre-wrap line-clamp-2">
                    {{ res.notes || '-' }}
                </div>
              </td>
              <td class="px-6 py-4 text-center">
                <span [class]="'px-2.5 py-1 rounded-full text-[10px] font-bold uppercase border ' + getStatusClass(res.status)">
                  {{ getStatusLabel(res.status) }}
                </span>
              </td>
              <td class="px-6 py-4 text-right">
                <div class="flex flex-col items-end">
                    <span class="font-black text-red-600 text-lg">{{ (res.totalPrice - (res.advance || 0)) | number:'1.0-0' }} DT</span>
                    <span class="text-[10px] text-red-400 uppercase font-bold">En retard</span>
                </div>
              </td>
              <td class="px-6 py-4 text-center" (click)="$event.stopPropagation()">
                <button (click)="navigateToReservation(res.id)" class="px-3 py-1.5 bg-red-50 text-red-600 rounded-lg font-bold text-xs hover:bg-red-100 transition flex items-center justify-center mx-auto gap-1">
                    <span class="material-icons text-xs">payments</span> Régler
                </button>
              </td>
            </tr>
          }
          @empty {
            <tr>
              <td colspan="6" class="px-6 py-8 text-center text-emerald-500 italic">
                <span class="flex items-center justify-center gap-2">
                    <span class="material-icons">check_circle</span>
                    Aucun impayé en retard ! Bravo.
                </span>
              </td>
            </tr>
          }
        </tbody>
      </table>
    </div>
  </div>

</div>
EOF

echo "✅ Tableau de bord mis à jour avec les notes."