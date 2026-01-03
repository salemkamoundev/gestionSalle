#!/bin/bash

# 1. Mise à jour du TypeScript (Logique détaillée pour les partenaires)
cat > src/app/features/partenaire-view/partenaire-calendar.component.ts << 'EOF'
import { Component, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReservationService } from '../../core/services/reservation.service';
import { AuthService } from '../../core/services/auth.service';
import { ClientService } from '../../core/services/client.service';
import { PartenaireService } from '../../core/services/partenaire.service';
import { toSignal } from '@angular/core/rxjs-interop';

@Component({
  selector: 'app-partenaire-calendar',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './partenaire-calendar.component.html',
  styles: [`
    .animate-fade-in { animation: fadeIn 0.2s ease-out; }
    @keyframes fadeIn { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }
  `]
})
export class PartenaireCalendarComponent {
  private auth = inject(AuthService);
  private reservationService = inject(ReservationService);
  private clientService = inject(ClientService);
  private partenaireService = inject(PartenaireService);

  viewDate = signal(new Date());
  selectedReservation = signal<any>(null);

  userInfo = this.auth.userState;
  
  rawReservations = toSignal(this.reservationService.getReservations(), { initialValue: [] });
  clients = toSignal(this.clientService.getAll(), { initialValue: [] });
  partenaire = toSignal(this.partenaireService.getAll(), { initialValue: [] });

  // FILTRE : Réservations assignées à ce partenaire uniquement
  myReservations = computed(() => {
    const user = this.userInfo();
    const uid = user ? user.uid : null;
    
    const all = this.rawReservations() as any[];
    
    if (!uid || !all) return [];

    return all.filter(r => {
      // Exclure les annulées
      if (r.status === 'CANCELLED') return false;
      
      // Vérifier si l'ID du partenaire est dans la liste des serveurs assignés
      return (r.assignedServerIds || []).includes(uid);
    });
  });

  // --- Helpers pour le Popup ---
  
  getClientName(res: any): string {
    if (res.clientId) {
      const list = this.clients() as any[];
      const client = list.find(c => c.id === res.clientId);
      if (client) return `${client.nom} ${client.prenom}`;
    }
    return res.clientName || res.customerName || 'Client Inconnu';
  }

  getClientPhone(res: any): string {
    if (res.clientId) {
      const list = this.clients() as any[];
      const client = list.find(c => c.id === res.clientId);
      if (client) return (client.telephone || client.phone || '');
    }
    return res.customerPhone || '';
  }

  getServiceLabel(s: any): string {
    if (!s) return '';
    if (typeof s === 'string') return s;
    return s.nom || s.name || 'Service';
  }

  // NOUVEAU : Récupère les détails complets des partenaires
  getAssignedPartners(ids: string[]): any[] {
    if (!ids || ids.length === 0) return [];
    const list = this.partenaire() as any[];
    return ids.map(id => {
      const s = list.find(st => st.id === id);
      if (!s) return null;
      return {
        name: `${s.nom} ${s.prenom || ''}`,
        phone: s.telephone || s.phone || '',
        email: s.email || ''
      };
    }).filter(p => p !== null);
  }

  // --- Gestion Calendrier ---

  goToToday() { this.viewDate.set(new Date()); }
  prevMonth() { const d = this.viewDate(); this.viewDate.set(new Date(d.getFullYear(), d.getMonth() - 1, 1)); }
  nextMonth() { const d = this.viewDate(); this.viewDate.set(new Date(d.getFullYear(), d.getMonth() + 1, 1)); }

  // Ouverture du Popup
  onReservationClick(res: any, event: Event) {
    event.stopPropagation();
    const enrichedRes = {
      ...res,
      clientName: this.getClientName(res),
      clientPhone: this.getClientPhone(res),
      // On charge la liste détaillée au lieu d'une simple string
      assignedPartners: this.getAssignedPartners(res.assignedServerIds)
    };
    this.selectedReservation.set(enrichedRes);
  }

  closeModal() { this.selectedReservation.set(null); }

  // --- Calculs Grille ---

  calendarDays = computed(() => {
    const year = this.viewDate().getFullYear();
    const month = this.viewDate().getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const days: any[] = [];

    // Jours vides début mois
    for (let i = 0; i < firstDay.getDay(); i++) {
      days.push({ id: `pad-${i}`, date: null, isPast: false });
    }

    // Jours du mois
    for (let i = 1; i <= lastDay.getDate(); i++) {
      const current = new Date(year, month, i);
      const isToday = new Date().toDateString() === current.toDateString();
      const isPast = current < new Date(new Date().setHours(0,0,0,0));

      // Filtrer les résas du jour
      const dailyRes = this.myReservations().filter(r => {
        const d = this.parseDate(r.date);
        return d && d.getDate() === i && d.getMonth() === month && d.getFullYear() === year;
      }).map(r => ({
        ...r,
        clientName: this.getClientName(r)
      }));

      days.push({ id: `day-${i}`, date: current, isToday, isPast, reservations: dailyRes });
    }
    return days;
  });

  private parseDate(val: any): Date | null {
    if (!val) return null;
    if (val.toDate) return val.toDate();
    if (val instanceof Date) return val;
    return new Date(val);
  }

  getReservationsForSlot(day: any, slot: string): any[] {
    if (!day.reservations) return [];
    return day.reservations.filter((r: any) => 
      (r.slotId || '').toLowerCase().includes(slot) || 
      (r.selectedSlotId || '').toLowerCase().includes(slot)
    );
  }

  getSlotClass(day: any, slot: string): string {
    if (day.isPast) return 'bg-slate-50 text-slate-300';
    const hasRes = this.getReservationsForSlot(day, slot).length > 0;
    return hasRes ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'bg-white border-slate-100 text-slate-300';
  }
}
EOF

# 2. Mise à jour du Template HTML (Affichage détaillé Partenaires)
cat > src/app/features/partenaire-view/partenaire-calendar.component.html << 'EOF'
<div class="flex flex-col bg-white rounded-xl shadow-sm border border-slate-200 relative h-full">
  
  <div class="flex justify-between items-center p-4 border-b border-slate-100 bg-slate-50">
    <button (click)="goToToday()" class="px-3 py-1.5 text-xs font-bold text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition">
      Aujourd'hui
    </button>
    <div class="flex items-center gap-4">
      <button (click)="prevMonth()" class="p-2 hover:bg-white rounded-full text-slate-600"><span class="material-icons">chevron_left</span></button>
      <h2 class="text-lg font-bold text-slate-800 capitalize flex items-center gap-2">
        <span class="material-icons text-indigo-500">event_note</span>
        {{ viewDate() | date:'MMMM yyyy' }}
      </h2>
      <button (click)="nextMonth()" class="p-2 hover:bg-white rounded-full text-slate-600"><span class="material-icons">chevron_right</span></button>
    </div>
    <div class="w-[85px]"></div>
  </div>

  <div class="grid grid-cols-7 border-b border-slate-100 bg-slate-50/50">
    <div *ngFor="let d of ['Dim','Lun','Mar','Mer','Jeu','Ven','Sam']" class="py-2 text-center text-xs font-bold text-slate-400 uppercase tracking-wider">{{ d }}</div>
  </div>

  <div class="grid grid-cols-7 bg-slate-100 gap-px border-b border-slate-200 flex-1 overflow-y-auto">
    @for (day of calendarDays(); track day.id) {
      <div class="bg-white min-h-[150px] p-2 flex flex-col gap-2 relative group transition"
           [class.bg-slate-50]="!day.date || day.isPast"
           [class.opacity-60]="day.isPast">
        
        @if (day.date) {
          <div class="flex justify-between items-start">
            <span class="text-xs font-semibold px-2 py-0.5 rounded-full"
                  [class.bg-indigo-600]="day.isToday" [class.text-white]="day.isToday" [class.text-slate-700]="!day.isToday">
              {{ day.date | date:'d' }}
            </span>
          </div>

          <div class="flex flex-col gap-1 flex-1 mt-1">
            @for (slot of ['matin', 'aprem', 'soir']; track slot) {
              <div class="flex-1 rounded border border-dashed flex items-center justify-center relative overflow-hidden transition-colors min-h-[30px]"
                   [ngClass]="getSlotClass(day, slot)">
                
                <span class="text-[9px] font-bold uppercase tracking-wider opacity-40 z-10">{{ slot }}</span>
                
                @for (res of getReservationsForSlot(day, slot); track res.id) {
                  <div class="absolute inset-0 z-20 flex items-center justify-center text-[10px] font-bold shadow-sm cursor-pointer hover:scale-[1.02] transition-transform p-1 text-center bg-indigo-600 text-white border border-indigo-700 leading-tight"
                       (click)="onReservationClick(res, $event)">
                    {{ res.clientName }}
                  </div>
                }
              </div>
            }
          </div>
        }
      </div>
    }
  </div>

  @if (selectedReservation()) {
    <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in" (click)="closeModal()">
      <div class="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden relative" (click)="$event.stopPropagation()">
        
        <div class="bg-indigo-600 p-4 text-white flex justify-between items-start">
          <div>
            <h3 class="text-lg font-bold flex items-center gap-2">
              <span class="material-icons">assignment_ind</span> Détails Mission
            </h3>
            <p class="text-indigo-100 text-sm mt-1">
              {{ selectedReservation().date | date:'fullDate' }}
            </p>
          </div>
          <button (click)="closeModal()" class="text-white/80 hover:text-white bg-white/10 hover:bg-white/20 rounded-full p-1 transition">
            <span class="material-icons">close</span>
          </button>
        </div>

        <div class="p-6 space-y-5">
          
          <div class="flex items-start gap-4">
            <div class="bg-blue-50 p-2.5 rounded-xl text-blue-600">
              <span class="material-icons text-xl">person</span>
            </div>
            <div>
              <p class="text-xs font-bold text-slate-500 uppercase tracking-wide mb-0.5">Client</p>
              <p class="text-slate-900 font-bold text-lg leading-tight">{{ selectedReservation().clientName }}</p>
              @if (selectedReservation().clientPhone) {
                <p class="text-slate-600 text-sm flex items-center gap-1 mt-1">
                  <span class="material-icons text-[14px]">phone</span> 
                  {{ selectedReservation().clientPhone }}
                </p>
              }
            </div>
          </div>

          <div class="h-px bg-slate-100 w-full"></div>

          @if (selectedReservation().services && selectedReservation().services.length > 0) {
            <div class="bg-indigo-50/50 border border-indigo-100 rounded-xl p-4">
              <p class="text-xs font-bold text-indigo-600 uppercase tracking-wide mb-2 flex items-center gap-1">
                <span class="material-icons text-[14px]">cleaning_services</span> Services à effectuer
              </p>
              <div class="space-y-2">
                @for (service of selectedReservation().services; track $index) {
                  <div class="flex items-start gap-2">
                    <span class="material-icons text-[10px] text-indigo-400 mt-1">circle</span>
                    <span class="text-sm text-slate-700 font-medium leading-tight">
                      {{ getServiceLabel(service) }}
                    </span>
                  </div>
                }
              </div>
            </div>
          }

          <div>
            <p class="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2 flex items-center gap-1">
              <span class="material-icons text-[14px]">badge</span> Partenaire(s)
            </p>
            
            @if (selectedReservation().assignedPartners && selectedReservation().assignedPartners.length > 0) {
              <div class="grid gap-2">
                @for (p of selectedReservation().assignedPartners; track $index) {
                  <div class="bg-slate-50 p-3 rounded-lg border border-slate-100 flex flex-col gap-1">
                    <p class="text-sm font-bold text-slate-800">{{ p.name }}</p>
                    
                    @if (p.phone) {
                      <p class="text-xs text-slate-600 flex items-center gap-1.5">
                        <span class="material-icons text-[12px] text-slate-400">phone</span>
                        {{ p.phone }}
                      </p>
                    }
                    
                    @if (p.email) {
                      <p class="text-xs text-slate-600 flex items-center gap-1.5">
                        <span class="material-icons text-[12px] text-slate-400">email</span>
                        {{ p.email }}
                      </p>
                    }
                  </div>
                }
              </div>
            } @else {
               <div class="bg-slate-50 p-2.5 rounded-lg text-sm text-slate-500 italic border border-slate-100">
                 Non assigné
               </div>
            }
          </div>

          @if (selectedReservation().notes) {
            <div class="bg-amber-50 border border-amber-100 rounded-xl p-4">
              <p class="text-xs font-bold text-amber-600 uppercase tracking-wide mb-1 flex items-center gap-1">
                <span class="material-icons text-[14px]">sticky_note_2</span> Note / Commentaire
              </p>
              <p class="text-amber-900 text-sm italic leading-relaxed">
                "{{ selectedReservation().notes }}"
              </p>
            </div>
          } @else {
            <p class="text-center text-slate-400 text-sm italic py-2">Aucun commentaire pour cette réservation.</p>
          }

        </div>

        <div class="p-4 bg-slate-50 border-t border-slate-100 flex justify-end">
          <button (click)="closeModal()" class="px-5 py-2.5 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold rounded-lg transition text-sm">
            Fermer
          </button>
        </div>

      </div>
    </div>
  }
</div>
EOF