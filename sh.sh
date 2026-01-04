#!/bin/bash

echo "🔘 Ajout du bouton d'action sur le Dashboard..."

# 1. DASHBOARD TS : On garde la logique "Aujourd'hui + Impayés"
cat <<EOF > src/app/features/dashboard/dashboard.component.ts
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
EOF

# 2. DASHBOARD HTML : Ajout du bouton dans la colonne Action
cat <<EOF > src/app/features/dashboard/dashboard.component.html
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
    <div class="px-6 py-4 border-b border-slate-50 flex justify-between items-center bg-slate-50/50">
      <h3 class="font-bold text-slate-700 flex items-center gap-2">
        <span class="material-icons text-blue-500 text-base">notifications_active</span>
        Aujourd'hui & Impayés (7j)
      </h3>
      <a routerLink="/history" class="text-xs font-bold text-blue-600 hover:underline">Voir tout l'historique</a>
    </div>

    <div class="overflow-x-auto">
      <table class="w-full text-sm text-left">
        <thead class="text-xs text-slate-400 uppercase bg-slate-50 font-bold">
          <tr>
            <th class="px-6 py-3">Date</th>
            <th class="px-6 py-3">Client</th>
            <th class="px-6 py-3 text-center">Statut</th>
            <th class="px-6 py-3 text-right">Reste à payer</th>
            <th class="px-6 py-3 text-center">Action</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-50">
          @for (res of recentActivity(); track res.id) {
            <tr class="hover:bg-slate-50 transition cursor-pointer" (click)="navigateToReservation(res.id)">
              <td class="px-6 py-4 font-medium text-slate-700">
                {{ res.date | date:'dd MMM yyyy' }}
                <div class="text-xs text-slate-400 font-normal">{{ res.startTime }} - {{ res.endTime }}</div>
              </td>
              <td class="px-6 py-4">
                <div class="font-bold text-slate-800">{{ res.client?.nom }} {{ res.client?.prenom }}</div>
                <div class="text-xs text-slate-400">{{ res.client?.telephone }}</div>
              </td>
              <td class="px-6 py-4 text-center">
                <span [class]="'px-2.5 py-1 rounded-full text-[10px] font-bold uppercase border ' + getStatusClass(res.status)">
                  {{ getStatusLabel(res.status) }}
                </span>
              </td>
              <td class="px-6 py-4 text-right">
                @if ((res.totalPrice - (res.advance || 0)) > 0) {
                    <span class="font-black text-red-500">
                        {{ (res.totalPrice - (res.advance || 0)) | number:'1.0-0' }} DT
                    </span>
                } @else {
                    <span class="font-bold text-emerald-500 text-xs bg-emerald-50 px-2 py-1 rounded">Réglé</span>
                }
              </td>
              <td class="px-6 py-4 text-center" (click)="\$event.stopPropagation()">
                <button (click)="navigateToReservation(res.id)" 
                        class="mx-auto flex items-center justify-center gap-1 px-3 py-1.5 bg-blue-50 text-blue-600 rounded-lg font-bold text-xs hover:bg-blue-100 hover:text-blue-700 transition">
                    <span class="material-icons text-xs">visibility</span>
                    Voir
                </button>
              </td>
            </tr>
          }
          @empty {
            <tr>
              <td colspan="5" class="px-6 py-12 text-center text-slate-400">
                <div class="flex flex-col items-center gap-2">
                    <span class="material-icons text-4xl opacity-20">check_circle</span>
                    <span>Tout est à jour pour aujourd'hui et les 7 derniers jours !</span>
                </div>
              </td>
            </tr>
          }
        </tbody>
      </table>
    </div>
  </div>
</div>
EOF

echo "✅ Bouton 'Voir' ajouté au Dashboard."