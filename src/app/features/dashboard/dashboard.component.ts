import { Component, inject, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { ReservationService } from '../../core/services/reservation.service';
import { ClientService } from '../../core/services/client.service';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <div class="max-w-6xl mx-auto space-y-8">
      
      <div class="flex items-center justify-between">
        <div>
          <h1 class="text-2xl font-black text-slate-800">Tableau de Bord</h1>
          <p class="text-slate-500 text-sm mt-1">
            {{ today | date:'fullDate' }}
          </p>
        </div>
        <button routerLink="/reservations/new" class="px-4 py-2 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition flex items-center shadow-lg hover:shadow-indigo-500/30">
          <span class="material-icons text-sm mr-2">add</span> Nouvelle Réservation
        </button>
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-2 gap-8">

        <div class="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm flex flex-col h-full">
          <div class="flex items-center justify-between mb-6">
            <h2 class="font-bold text-slate-800 flex items-center gap-2 text-lg">
              <span class="material-icons text-indigo-500 bg-indigo-50 p-1.5 rounded-lg">event</span>
              Aujourd'hui
            </h2>
            <span class="bg-indigo-100 text-indigo-700 text-xs font-bold px-2 py-1 rounded-full">
              {{ todayReservations().length }}
            </span>
          </div>

          <div class="flex-1 overflow-y-auto max-h-[400px] space-y-3 custom-scrollbar pr-1">
            @for (res of todayReservations(); track res.id) {
              <div (click)="goToReservation(res.id)" 
                   class="group p-4 rounded-xl border border-slate-100 hover:border-indigo-300 bg-slate-50 hover:bg-white transition cursor-pointer relative overflow-hidden">
                
                <div class="flex justify-between items-start z-10 relative">
                  <div>
                    <div class="flex items-center gap-2 mb-1">
                      <span class="text-xs font-bold px-2 py-0.5 rounded text-white" 
                            [ngClass]="getSlotColor(res.slotId)">
                        {{ res.slotId || 'Matin' | titlecase }}
                      </span>
                      <span class="text-slate-400 text-xs font-mono">
                        {{ res.startTime }} - {{ res.endTime }}
                      </span>
                    </div>
                    <h3 class="font-bold text-slate-800 group-hover:text-indigo-600 transition">
                      {{ getClientName(res.clientId) }}
                    </h3>
                    <p class="text-xs text-slate-500 mt-1 truncate max-w-[200px]">
                      {{ res.packId ? 'Pack' : (res.services?.length + ' Services' || 'Aucun service') }}
                    </p>
                  </div>

                  <div class="text-right">
                     <div class="text-sm font-bold text-slate-800">{{ res.totalPrice | number }} TND</div>
                     @if (getRestToPay(res) > 0) {
                        <div class="text-[10px] text-red-500 font-bold bg-red-50 px-1.5 py-0.5 rounded mt-1 inline-block">
                          Reste: {{ getRestToPay(res) }}
                        </div>
                     } @else {
                        <div class="text-[10px] text-emerald-600 font-bold bg-emerald-50 px-1.5 py-0.5 rounded mt-1 inline-block">
                          Payé
                        </div>
                     }
                  </div>
                </div>
              </div>
            }
            @if (todayReservations().length === 0) {
              <div class="flex flex-col items-center justify-center h-48 text-slate-400 border-2 border-dashed border-slate-100 rounded-xl">
                <span class="material-icons text-4xl mb-2 opacity-50">event_busy</span>
                <span class="text-sm">Rien de prévu aujourd'hui</span>
              </div>
            }
          </div>
        </div>

        <div class="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm flex flex-col h-full">
          <div class="flex items-center justify-between mb-6">
            <h2 class="font-bold text-slate-800 flex items-center gap-2 text-lg">
              <span class="material-icons text-orange-500 bg-orange-50 p-1.5 rounded-lg">payments</span>
              À solder (Semaine)
            </h2>
            <span class="bg-orange-100 text-orange-700 text-xs font-bold px-2 py-1 rounded-full">
              {{ pendingWeekReservations().length }}
            </span>
          </div>

          <div class="flex-1 overflow-y-auto max-h-[400px] space-y-3 custom-scrollbar pr-1">
            @for (res of pendingWeekReservations(); track res.id) {
              <div (click)="goToReservation(res.id)" 
                   class="group p-4 rounded-xl border border-l-4 border-l-orange-400 border-slate-100 hover:border-orange-300 hover:shadow-sm bg-white transition cursor-pointer">
                
                <div class="flex justify-between items-center">
                  <div>
                    <div class="text-xs font-bold text-slate-400 mb-0.5 uppercase tracking-wider">
                      {{ parseDate(res.date) | date:'EEEE d MMMM' }}
                    </div>
                    <h3 class="font-bold text-slate-800 text-sm">
                      {{ getClientName(res.clientId) }}
                    </h3>
                  </div>
                  
                  <div class="text-right">
                    <div class="text-xs text-slate-400">Reste à payer</div>
                    <div class="text-lg font-black text-red-500">
                      {{ getRestToPay(res) | number }} <span class="text-xs font-normal text-slate-400">TND</span>
                    </div>
                  </div>
                </div>

                <div class="mt-3 w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                  <div class="bg-emerald-500 h-1.5 rounded-full" 
                       [style.width.%]="getPaymentPercentage(res)"></div>
                </div>
                <div class="flex justify-between text-[10px] text-slate-400 mt-1 font-medium">
                  <span>Avance: {{ res.advance || 0 }}</span>
                  <span>Total: {{ res.totalPrice || 0 }}</span>
                </div>

              </div>
            }
            @if (pendingWeekReservations().length === 0) {
              <div class="flex flex-col items-center justify-center h-48 text-slate-400 border-2 border-dashed border-slate-100 rounded-xl">
                <span class="material-icons text-4xl mb-2 opacity-50">check_circle</span>
                <span class="text-sm">Tout est à jour cette semaine !</span>
              </div>
            }
          </div>
        </div>

      </div>
    </div>
  `,
  styles: [`
    .custom-scrollbar::-webkit-scrollbar { width: 4px; }
    .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
    .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 4px; }
  `]
})
export class DashboardComponent implements OnInit {
  private router = inject(Router);
  private reservationService = inject(ReservationService);
  private clientService = inject(ClientService);

  today = new Date();

  // Signals Data
  reservations = toSignal(this.reservationService.getReservations(), { initialValue: [] });
  clients = toSignal(this.clientService.getAll(), { initialValue: [] });

  // --- FILTRE : AUJOURD'HUI ---
  todayReservations = computed(() => {
    const list = this.reservations() as any[];
    const todayStr = this.dateToString(new Date());

    return list.filter(r => {
      const rDateStr = this.dateToString(this.parseDate(r.date));
      return rDateStr === todayStr;
    }).sort((a, b) => (a.startTime || '').localeCompare(b.startTime || ''));
  });

  // --- FILTRE : SEMAINE EN COURS + NON PAYÉ ---
  pendingWeekReservations = computed(() => {
    const list = this.reservations() as any[];
    const now = new Date();
    
    // Calcul début/fin semaine (Lundi - Dimanche)
    const day = now.getDay() || 7; // Dimanche devient 7
    if (day !== 1) now.setHours(-24 * (day - 1));
    const startOfWeek = new Date(now);
    startOfWeek.setHours(0,0,0,0);
    
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(endOfWeek.getDate() + 6);
    endOfWeek.setHours(23,59,59,999);

    return list.filter(r => {
      const d = this.parseDate(r.date);
      if (!d) return false;
      
      // Filtre Date (Semaine)
      const isInWeek = d >= startOfWeek && d <= endOfWeek;
      if (!isInWeek) return false;

      // Filtre Financier (Non clôturé)
      const total = Number(r.totalPrice || 0);
      const advance = Number(r.advance || 0);
      return advance < total; // Reste à payer > 0

    }).sort((a, b) => this.parseDate(a.date).getTime() - this.parseDate(b.date).getTime());
  });

  ngOnInit() {
    // Force refresh if needed
  }

  // --- HELPERS ---

  goToReservation(id: string) {
    this.router.navigate(['/reservations/edit', id]);
  }

  getClientName(clientId: string): string {
    const client = (this.clients() as any[]).find(c => c.id === clientId);
    if (!client) return 'Client inconnu';
    return `${client.nom || ''} ${client.prenom || ''}`.trim() || 'Sans nom';
  }

  getRestToPay(res: any): number {
    return Math.max(0, Number(res.totalPrice || 0) - Number(res.advance || 0));
  }

  getPaymentPercentage(res: any): number {
    const total = Number(res.totalPrice || 0);
    if (total === 0) return 0;
    const advance = Number(res.advance || 0);
    return Math.min(100, (advance / total) * 100);
  }

  getSlotColor(slotId: string): string {
    switch (String(slotId).toLowerCase()) {
      case 'matin': return 'bg-amber-400';
      case 'aprem': return 'bg-orange-500';
      case 'soir': return 'bg-indigo-600';
      default: return 'bg-slate-400';
    }
  }

  parseDate(value: any): any {
    if (!value) return null;
    if (value.toDate) return value.toDate(); // Firebase Timestamp
    if (value instanceof Date) return value;
    if (typeof value === 'string') return new Date(value);
    return null;
  }

  dateToString(date: any): string {
    if (!date) return '';
    const d = new Date(date);
    return d.toISOString().split('T')[0]; // yyyy-mm-dd
  }
}
