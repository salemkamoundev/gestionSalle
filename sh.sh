#!/bin/bash

echo "🎨 AMÉLIORATION AFFICHAGE DÉTAILS PAIEMENTS (Check/Ref)..."

cat > src/app/features/clients/client-history/client-history.component.ts <<'EOF'
import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { forkJoin, from } from 'rxjs';
import { take, map } from 'rxjs/operators';
import { Firestore, collection, getDocs } from '@angular/fire/firestore';

import { ClientService } from '../../../core/services/client.service';
import { ReservationService } from '../../../core/services/reservation.service';

@Component({
  selector: 'app-client-history',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="max-w-6xl mx-auto space-y-6 pb-20 p-4 md:p-6">
      
      <div class="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-2">
        <div class="flex items-center gap-4">
          <button (click)="goBack()" class="p-2.5 rounded-full bg-white border border-slate-200 hover:bg-slate-100 text-slate-500 transition shadow-sm" title="Retour">
            <span class="material-icons text-xl">arrow_back</span>
          </button>
          <div>
            <h1 class="text-2xl font-bold text-slate-800 flex items-center gap-2">
              <span class="material-icons text-indigo-600">folder_shared</span>
              Dossier Client
            </h1>
            <p class="text-slate-500 text-sm">Vue consolidée des activités</p>
          </div>
        </div>
      </div>

      <div *ngIf="loading()" class="py-24 text-center bg-white rounded-xl border border-slate-100 shadow-sm mx-auto max-w-2xl">
        <div class="inline-block relative">
             <span class="material-icons animate-spin text-5xl text-indigo-500 mb-4">autorenew</span>
        </div>
        <h3 class="text-lg font-semibold text-slate-700">Chargement du dossier...</h3>
        <p class="text-slate-400 text-sm">Récupération des données en cours</p>
      </div>

      <div *ngIf="!loading() && !client()" class="py-20 text-center bg-white rounded-xl border border-red-100 shadow-sm">
        <span class="material-icons text-5xl text-red-300 mb-3">error_outline</span>
        <h3 class="text-lg font-semibold text-red-700">Client introuvable</h3>
        <p class="text-slate-500">Impossible de récupérer les informations de ce client.</p>
        <button (click)="goBack()" class="mt-4 text-indigo-600 hover:underline font-medium">Retourner à la liste</button>
      </div>

      <div *ngIf="!loading() && client()" class="space-y-6 animate-fade-in">
        
        <div class="bg-white rounded-xl shadow-sm border border-slate-200 p-6 relative overflow-hidden">
          <div class="absolute top-0 right-0 p-4 opacity-10">
            <span class="material-icons text-9xl text-indigo-900">person</span>
          </div>

          <div class="flex flex-col md:flex-row justify-between gap-6 relative z-10">
            <div class="flex items-start gap-5">
              <div class="h-20 w-20 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold text-3xl shadow-lg shadow-indigo-200">
                {{ client()?.nom?.charAt(0) || '?' }}{{ client()?.prenom?.charAt(0) || '?' }}
              </div>
              <div>
                <h2 class="text-2xl font-bold text-slate-800 uppercase tracking-tight">
                  {{ client()?.nom }} <span class="text-indigo-600">{{ client()?.prenom }}</span>
                </h2>
                <div class="flex flex-wrap gap-4 mt-3 text-sm text-slate-600">
                  <span class="flex items-center gap-1.5 px-3 py-1 bg-slate-50 rounded-lg border border-slate-100">
                    <span class="material-icons text-[18px] text-slate-400">badge</span> 
                    <span class="font-medium">{{ client()?.cin || 'Non renseigné' }}</span>
                  </span>
                  <span class="flex items-center gap-1.5 px-3 py-1 bg-slate-50 rounded-lg border border-slate-100">
                    <span class="material-icons text-[18px] text-slate-400">phone</span> 
                    <span class="font-medium">{{ client()?.telephone || 'Non renseigné' }}</span>
                  </span>
                  <span *ngIf="client()?.email" class="flex items-center gap-1.5 px-3 py-1 bg-slate-50 rounded-lg border border-slate-100">
                    <span class="material-icons text-[18px] text-slate-400">email</span> 
                    <span class="font-medium">{{ client()?.email }}</span>
                  </span>
                </div>
              </div>
            </div>
            
            <div class="flex gap-4 items-center">
              <div class="px-6 py-4 bg-slate-50 rounded-xl border border-slate-100 text-center min-w-[120px]">
                <div class="text-xs text-slate-400 uppercase font-bold tracking-wider mb-1">Réservations</div>
                <div class="text-3xl font-bold text-slate-800">{{ reservations().length }}</div>
              </div>
              <div class="px-6 py-4 bg-slate-50 rounded-xl border border-slate-100 text-center min-w-[120px]">
                <div class="text-xs text-slate-400 uppercase font-bold tracking-wider mb-1">Total Payé</div>
                <div class="text-3xl font-bold text-emerald-600">{{ totalPaid() | number:'1.0-0' }} <span class="text-sm font-normal text-emerald-500">TND</span></div>
              </div>
            </div>
          </div>
        </div>

        <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
          
          <div class="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col h-full">
            <div class="bg-gradient-to-r from-blue-50 to-white px-6 py-4 border-b border-blue-100 flex justify-between items-center">
              <h3 class="font-bold text-blue-900 flex items-center gap-2">
                <span class="material-icons text-blue-500">event_note</span> 
                Historique Réservations
              </h3>
              <span class="bg-blue-100 text-blue-700 text-xs font-bold px-2 py-1 rounded-full">{{ reservations().length }}</span>
            </div>
            
            <div class="overflow-x-auto">
              <table class="w-full text-sm text-left">
                <thead class="bg-slate-50 text-slate-500 text-xs uppercase font-semibold">
                  <tr>
                    <th class="px-6 py-3 w-32">Date</th>
                    <th class="px-6 py-3">Détail</th>
                    <th class="px-6 py-3 text-right">Montant</th>
                    <th class="px-6 py-3 w-10"></th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-slate-100">
                  <tr *ngFor="let r of reservations()" class="hover:bg-slate-50 transition group">
                    <td class="px-6 py-4 align-top">
                      <div class="font-bold text-slate-700">{{ toDate(r.date) | date:'dd MMM yyyy' }}</div>
                      <div class="text-xs text-slate-400 mt-1 flex items-center gap-1">
                        <span class="material-icons text-[12px]">schedule</span> {{ r.time || 'Journée' }}
                      </div>
                    </td>
                    <td class="px-6 py-4 align-top">
                      <div class="font-medium text-slate-800 mb-1">{{ r.packName || 'Location Salle' }}</div>
                      <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide border"
                        [ngClass]="{
                          'bg-green-100 text-green-700 border-green-200': r.status === 'CONFIRMED' || r.status === 'PAYE',
                          'bg-yellow-100 text-yellow-700 border-yellow-200': r.status === 'PENDING' || r.status === 'EN_ATTENTE',
                          'bg-red-50 text-red-700 border-red-100': r.status === 'CANCELLED' || r.status === 'ANNULE'
                        }">
                        {{ r.status || 'EN ATTENTE' }}
                      </span>
                    </td>
                    <td class="px-6 py-4 text-right align-top">
                      <div class="font-bold text-slate-700 text-base">{{ r.totalPrice | number:'1.2-2' }} <small>TND</small></div>
                    </td>
                    <td class="px-6 py-4 text-right">
                      <button (click)="editReservation(r.id)" class="text-blue-400 hover:text-blue-600 p-2 rounded-full hover:bg-blue-50 transition" title="Modifier">
                        <span class="material-icons text-lg">edit</span>
                      </button>
                    </td>
                  </tr>
                  <tr *ngIf="reservations().length === 0">
                    <td colspan="3" class="px-6 py-12 text-center text-slate-400">Aucune réservation.</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <div class="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col h-full">
            <div class="bg-gradient-to-r from-emerald-50 to-white px-6 py-4 border-b border-emerald-100 flex justify-between items-center">
              <h3 class="font-bold text-emerald-900 flex items-center gap-2">
                <span class="material-icons text-emerald-500">payments</span> 
                Historique Règlements
              </h3>
              <span class="bg-emerald-100 text-emerald-700 text-xs font-bold px-2 py-1 rounded-full">{{ payments().length }}</span>
            </div>
            
            <div class="overflow-x-auto">
              <table class="w-full text-sm text-left">
                <thead class="bg-slate-50 text-slate-500 text-xs uppercase font-semibold">
                  <tr>
                    <th class="px-6 py-3 w-32">Date</th>
                    <th class="px-6 py-3">Mode de règlement</th>
                    <th class="px-6 py-3 text-right">Montant</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-slate-100">
                  <tr *ngFor="let p of payments()" class="hover:bg-slate-50 transition">
                    <td class="px-6 py-4 text-slate-600 font-medium align-top">
                      {{ toDate(p.date) | date:'dd MMM yyyy' }}
                    </td>
                    
                    <td class="px-6 py-4 align-top">
                      <div class="flex items-center gap-2 mb-1">
                        <span class="material-icons text-slate-400 text-lg" [ngSwitch]="p.type || p.method">
                          <ng-container *ngSwitchCase="'ESPECES'">payments</ng-container>
                          <ng-container *ngSwitchCase="'ESPECE'">payments</ng-container>
                          <ng-container *ngSwitchCase="'VIREMENT'">account_balance</ng-container>
                          <ng-container *ngSwitchCase="'CHEQUE'">style</ng-container>
                          <ng-container *ngSwitchCase="'BON'">confirmation_number</ng-container>
                          <ng-container *ngSwitchDefault>credit_card</ng-container>
                        </span>
                        <span class="capitalize text-slate-700 font-bold">
                          {{ (p.type || p.method || 'Autre') | lowercase }}
                        </span>
                      </div>

                      <div class="text-xs text-slate-500 space-y-0.5 ml-7">
                        <div *ngIf="p.checkNumber">
                           <span class="font-semibold text-slate-400">N°:</span> {{ p.checkNumber }}
                        </div>
                        <div *ngIf="p.checkDate">
                           <span class="font-semibold text-slate-400">Échéance:</span> {{ p.checkDate | date:'dd/MM/yyyy' }}
                        </div>
                        <div *ngIf="p.reference">
                           <span class="font-semibold text-slate-400">Réf:</span> {{ p.reference }}
                        </div>
                        <div *ngIf="p.description">
                           <span class="italic text-slate-400">{{ p.description }}</span>
                        </div>
                      </div>
                    </td>

                    <td class="px-6 py-4 text-right align-top">
                      <div class="font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-lg inline-block border border-emerald-100 whitespace-nowrap">
                        + {{ p.amount | number:'1.2-2' }} TND
                      </div>
                    </td>
                  </tr>
                  
                  <tr *ngIf="payments().length === 0">
                    <td colspan="3" class="px-6 py-12 text-center text-slate-400">Aucun règlement trouvé.</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

        </div>
      </div>
    </div>
  `,
  styles: [`
    .animate-fade-in { animation: fadeIn 0.4s ease-out forwards; }
    @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
  `]
})
export class ClientHistoryComponent implements OnInit {
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private location = inject(Location);
  private firestore = inject(Firestore); 
  
  private clientService = inject(ClientService);
  private reservationService = inject(ReservationService);

  client = signal<any>(null);
  reservations = signal<any[]>([]);
  payments = signal<any[]>([]);
  loading = signal(true);
  totalPaid = signal(0);

  ngOnInit() {
    const clientId = this.route.snapshot.paramMap.get('id');
    if (clientId) {
      this.loadData(clientId);
    } else {
      this.loading.set(false);
    }
  }

  goBack() {
    this.location.back();
  }

  private loadData(id: string) {
    this.loading.set(true);
    
    forkJoin({
      clients: this.clientService.getAll().pipe(take(1)),
      reservations: this.reservationService.getReservations().pipe(take(1)),
      payments: from(getDocs(collection(this.firestore, 'payments'))).pipe(
          map(snap => snap.docs.map(d => ({ id: d.id, ...d.data() }))),
          take(1)
      )
    }).subscribe({
      next: (data: any) => {
        const foundClient = (data.clients || []).find((c: any) => c.id === id);
        
        if (foundClient) {
          this.client.set(foundClient);

          const userRes = (data.reservations || []).filter((r: any) => 
            r.clientId === id || (r.client && r.client.id === id)
          );
          userRes.sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime());
          this.reservations.set(userRes);

          const resIds = userRes.map((r: any) => r.id);
          const collectionPayments = (data.payments || []).filter((p: any) => 
            p.clientId === id || (p.reservationId && resIds.includes(p.reservationId))
          );

          const embeddedPayments = userRes.flatMap((r: any) => {
              if (!r.payments || !Array.isArray(r.payments)) return [];
              return r.payments.map((p: any) => ({
                  ...p,
                  id: p.id || ('emb_' + Math.random()),
                  reservationId: r.id,
                  clientId: id,
                  date: p.date || r.date
              }));
          });

          const allPayments = [...collectionPayments];
          embeddedPayments.forEach((ep: any) => {
              const exists = allPayments.some((cp: any) => 
                  (cp.id && cp.id === ep.id) || 
                  (cp.reservationId === ep.reservationId && cp.amount == ep.amount && cp.date == ep.date)
              );
              if (!exists) {
                  allPayments.push(ep);
              }
          });

          allPayments.sort((a: any, b: any) => {
              const tA = a.date ? new Date(a.date).getTime() : 0;
              const tB = b.date ? new Date(b.date).getTime() : 0;
              return tB - tA;
          });

          this.payments.set(allPayments);
          const total = allPayments.reduce((sum: number, p: any) => sum + (Number(p.amount) || 0), 0);
          this.totalPaid.set(total);
        }
        
        this.loading.set(false);
      },
      error: (err) => {
        console.error('Erreur chargement dossier', err);
        this.loading.set(false);
      }
    });
  }

  editReservation(id: string) {
    this.router.navigate(['/reservations/edit', id]); 
  }

  toDate(val: any): any {
    if (!val) return null;
    if (typeof val === 'object' && typeof val.toDate === 'function') {
      return val.toDate();
    }
    return val;
  }
}
EOF

echo "✅ Historique Règlements corrigé avec détails (Check/Ref)."