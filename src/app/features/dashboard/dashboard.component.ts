import { Component, inject, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReservationService } from '../../core/services/reservation.service';
import { toSignal } from '@angular/core/rxjs-interop';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="space-y-6">
      <div>
        <h1 class="text-2xl font-bold text-slate-800">Tableau de Bord</h1>
        <p class="text-slate-500">Aperçu de l'activité et de la trésorerie</p>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        <div class="bg-gradient-to-br from-purple-600 to-indigo-700 rounded-2xl p-6 text-white shadow-lg relative overflow-hidden">
          <div class="absolute top-0 right-0 -mt-4 -mr-4 w-24 h-24 bg-white opacity-10 rounded-full blur-xl"></div>
          <div class="relative z-10">
            <p class="text-purple-200 text-sm font-medium uppercase tracking-wider mb-1">Chiffre d'Affaires (Prévision)</p>
            <h3 class="text-3xl font-bold">{{ stats().totalCA | number:'1.0-2' }} <span class="text-lg opacity-70">TND</span></h3>
            <p class="text-xs text-purple-200 mt-2 opacity-80">Sur {{ stats().count }} réservations</p>
          </div>
          <span class="material-icons absolute bottom-4 right-4 text-white opacity-20 text-6xl">savings</span>
        </div>

        <div class="bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl p-6 text-white shadow-lg relative overflow-hidden">
          <div class="absolute top-0 right-0 -mt-4 -mr-4 w-24 h-24 bg-white opacity-10 rounded-full blur-xl"></div>
          <div class="relative z-10">
            <p class="text-emerald-100 text-sm font-medium uppercase tracking-wider mb-1">Trésorerie (Encaissé)</p>
            <h3 class="text-3xl font-bold">{{ stats().totalCollected | number:'1.0-2' }} <span class="text-lg opacity-70">TND</span></h3>
            <div class="w-full bg-black/20 h-1.5 rounded-full mt-3 overflow-hidden">
               <div class="bg-white h-full rounded-full" [style.width.%]="stats().percentCollected"></div>
            </div>
            <p class="text-xs text-emerald-100 mt-1">{{ stats().percentCollected | number:'1.0-0' }}% du total</p>
          </div>
          <span class="material-icons absolute bottom-4 right-4 text-white opacity-20 text-6xl">payments</span>
        </div>

        <div class="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm relative">
          <p class="text-slate-500 text-sm font-medium uppercase tracking-wider mb-1">Reste à Percevoir</p>
          <h3 class="text-3xl font-bold text-slate-800">{{ stats().pending | number:'1.0-2' }} <span class="text-lg text-slate-400">TND</span></h3>
          <p class="text-xs text-slate-400 mt-2">Solde restant des clients</p>
          <span class="material-icons absolute bottom-4 right-4 text-slate-100 text-6xl">account_balance_wallet</span>
        </div>

      </div>

      <div class="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
        <h3 class="font-bold text-slate-800 mb-4">Dernières Activités</h3>
        <p class="text-slate-400 text-sm italic">L'historique détaillé des paiements sera affiché ici prochainement.</p>
      </div>
    </div>
  `
})
export class DashboardComponent {
  private reservationService = inject(ReservationService);
  
  // Chargement des données
  reservations = toSignal(this.reservationService.getAll(), { initialValue: [] });

  // Calcul automatique des stats
  stats = computed(() => {
    const list = this.reservations();
    
    let totalCA = 0;
    let totalCollected = 0;

    list.forEach(r => {
      // On caste en any pour accéder aux nouvelles propriétés pas encore dans l'interface stricte
      const res = r as any; 
      totalCA += Number(res.totalPrice) || 0;
      totalCollected += Number(res.advance) || 0;
    });

    const pending = totalCA - totalCollected;
    const percentCollected = totalCA > 0 ? (totalCollected / totalCA) * 100 : 0;

    return {
      count: list.length,
      totalCA,
      totalCollected,
      pending,
      percentCollected
    };
  });
}
