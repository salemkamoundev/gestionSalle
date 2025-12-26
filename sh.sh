#!/bin/bash

# 1. Mise à jour de CalendarViewComponent (Admin)
# - Ajout du gris pour les jours passés dans getSlotClass

cat << 'EOF' > src/app/features/calendar/calendar-view/calendar-view.component.ts
import { Component, inject, signal, computed } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { toSignal } from '@angular/core/rxjs-interop';
import { ReservationService } from '../../../core/services/reservation.service';
import { ClientService } from '../../../core/services/client.service';
import { UiService } from '../../../core/services/ui.service';

@Component({
  selector: 'app-calendar-view',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="flex flex-col bg-white rounded-xl shadow-sm border border-slate-200">
      
      <div class="flex justify-between items-center p-4 border-b border-slate-100 bg-slate-50">
        
        <button (click)="goToToday()" 
                class="px-3 py-1.5 text-xs font-bold text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 shadow-sm transition">
          Aujourd'hui
        </button>

        <div class="flex items-center gap-4">
          <button (click)="prevMonth()" class="p-2 hover:bg-white hover:shadow-sm rounded-full transition text-slate-600">
            <span class="material-icons">chevron_left</span>
          </button>
          
          <h2 class="text-lg font-bold text-slate-800 capitalize flex items-center gap-2">
            <span class="material-icons text-indigo-500">calendar_month</span>
            {{ viewDate() | date:'MMMM yyyy' }}
          </h2>

          <button (click)="nextMonth()" class="p-2 hover:bg-white hover:shadow-sm rounded-full transition text-slate-600">
            <span class="material-icons">chevron_right</span>
          </button>
        </div>

        <div class="w-[85px]"></div>
      </div>

      <div class="grid grid-cols-7 border-b border-slate-100 bg-slate-50/50">
        <div *ngFor="let d of ['Dim','Lun','Mar','Mer','Jeu','Ven','Sam']"
             class="py-2 text-center text-xs font-bold text-slate-400 uppercase tracking-wider">
          {{ d }}
        </div>
      </div>

      <div class="grid grid-cols-7 bg-slate-100 gap-px border-b border-slate-200">
        @for (day of calendarDays(); track day.id) {
          
          <div class="bg-white min-h-[170px] h-full p-2 flex flex-col gap-2 transition relative group"
               [class.bg-slate-50]="!day.date || day.isPast"
               [class.opacity-60]="day.isPast">
            
            @if (day.date) {
              <div class="flex justify-between items-start">
                <span class="text-xs font-semibold px-2 py-0.5 rounded-full"
                      [class.bg-indigo-600]="day.isToday"
                      [class.text-white]="day.isToday"
                      [class.text-slate-700]="!day.isToday">
                  {{ day.date | date:'d' }}
                </span>
              </div>

              <div class="flex flex-col gap-1 flex-1 h-full mt-1">
                
                <div class="flex-1 h-full rounded border border-dashed flex items-center justify-center relative overflow-hidden transition-colors"
                     [ngClass]="getSlotClass(day, 'matin')" (click)="onSlotClick(day, 'matin')">
                  
                  <span class="text-[9px] font-bold uppercase tracking-wider opacity-60 z-10">Matin</span>
                  
                  @for (res of getReservationsForSlot(day, 'matin'); track res.id) {
                    <div class="absolute inset-0 z-20 flex items-center justify-center text-[10px] font-bold shadow-sm cursor-pointer hover:scale-[1.02] transition-transform p-1 text-center leading-tight"
                         [ngClass]="getReservationClass(res)" (click)="onReservationClick(res, $event)">
                      {{ res.clientName || 'Réservé' }}
                    </div>
                  }
                </div>

                <div class="flex-1 h-full rounded border border-dashed flex items-center justify-center relative overflow-hidden transition-colors"
                     [ngClass]="getSlotClass(day, 'aprem')" (click)="onSlotClick(day, 'aprem')">
                  
                  <span class="text-[9px] font-bold uppercase tracking-wider opacity-60 z-10">Aprem</span>

                  @for (res of getReservationsForSlot(day, 'aprem'); track res.id) {
                    <div class="absolute inset-0 z-20 flex items-center justify-center text-[10px] font-bold shadow-sm cursor-pointer hover:scale-[1.02] transition-transform p-1 text-center leading-tight"
                         [ngClass]="getReservationClass(res)" (click)="onReservationClick(res, $event)">
                      {{ res.clientName || 'Réservé' }}
                    </div>
                  }
                </div>

                <div class="flex-1 h-full rounded border border-dashed flex items-center justify-center relative overflow-hidden transition-colors"
                     [ngClass]="getSlotClass(day, 'soir')" (click)="onSlotClick(day, 'soir')">
                  
                  <span class="text-[9px] font-bold uppercase tracking-wider opacity-60 z-10">Soir</span>

                  @for (res of getReservationsForSlot(day, 'soir'); track res.id) {
                    <div class="absolute inset-0 z-20 flex items-center justify-center text-[10px] font-bold shadow-sm cursor-pointer hover:scale-[1.02] transition-transform p-1 text-center leading-tight"
                         [ngClass]="getReservationClass(res)" (click)="onReservationClick(res, $event)">
                      {{ res.clientName || 'Réservé' }}
                    </div>
                  }
                </div>

              </div>
            }
          </div>
        }
      </div>
    </div>
  `,
  styles: []
})
export class CalendarViewComponent {

  private router = inject(Router);
  private reservationService = inject(ReservationService);
  private clientService = inject(ClientService);
  private ui = inject(UiService);

  viewDate = signal(new Date());
  rawReservations = toSignal(this.reservationService.getReservations(), { initialValue: [] });
  rawClients = toSignal(this.clientService.getAll(), { initialValue: [] });

  private parseReservationDate(value: any): Date | null {
    if (!value) return null;
    if (value?.toDate) return value.toDate();
    if (value instanceof Date) return value;
    if (typeof value === 'string') {
      if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
        return new Date(value + 'T00:00:00');
      }
      const d = new Date(value);
      return isNaN(d.getTime()) ? null : d;
    }
    return null;
  }

  private isSameDay(a: Date, b: Date): boolean {
    return a.getFullYear() === b.getFullYear()
        && a.getMonth() === b.getMonth()
        && a.getDate() === b.getDate();
  }

  private isPastDate(d: Date): boolean {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const target = new Date(d);
    target.setHours(0, 0, 0, 0);
    return target < today;
  }

  goToToday() {
    this.viewDate.set(new Date());
  }

  onSlotClick(day: any, slot: string) {
    if (!day.date) return;
    
    // Bloque le clic sur le passé
    if (day.isPast) {
      this.ui.showToast('info', 'Impossible de réserver une date passée');
      return;
    }

    const dateStr = new Date(day.date.getTime() - (day.date.getTimezoneOffset() * 60000))
      .toISOString().split('T')[0];

    this.router.navigate(['/reservations/new'], {
      queryParams: { date: dateStr, slotId: slot }
    });
  }

  onReservationClick(res: any, event: Event) {
    event.stopPropagation();
    this.router.navigate(['/reservations/edit', res.id]);
  }

  calendarDays = computed(() => {
    const year = this.viewDate().getFullYear();
    const month = this.viewDate().getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);

    const days: any[] = [];
    const clients = this.rawClients();

    for (let i = 0; i < firstDay.getDay(); i++) {
      days.push({ id: `pad-prev-${i}`, date: null, isToday: false, isPast: false, reservations: [] });
    }

    for (let i = 1; i <= lastDay.getDate(); i++) {
      const current = new Date(year, month, i);
      const isToday = new Date().toDateString() === current.toDateString();
      const isPast = this.isPastDate(current); // Calcul ici

      const dailyRes = this.rawReservations()
        .filter((r: any) => {
          const rDate = this.parseReservationDate(r.date);
          return !!rDate && this.isSameDay(rDate, current);
        })
        .map((r: any) => {
          const client = clients.find((c: any) => c.id === r.clientId);
          let name = 'Réservé';
          if (client) name = `${client.nom || ''} ${client.prenom || ''}`.trim() || 'Client sans nom';
          return { ...r, clientName: name };
        });

      days.push({
        id: `day-${i}`,
        date: current,
        isToday,
        isPast, // Ajouté à l'objet jour
        reservations: dailyRes
      });
    }

    return days;
  });

  prevMonth() {
    const d = this.viewDate();
    this.viewDate.set(new Date(d.getFullYear(), d.getMonth() - 1, 1));
  }

  nextMonth() {
    const d = this.viewDate();
    this.viewDate.set(new Date(d.getFullYear(), d.getMonth() + 1, 1));
  }

  getReservationsForSlot(day: any, slot: string): any[] {
    if (!day.reservations) return [];
    return day.reservations.filter((r: any) => {
      if (!r.slotId) return true;
      const id = String(r.slotId || '').toLowerCase();
      const s = String(slot || '').toLowerCase();
      return id === s || id.includes(s);
    });
  }

  getSlotClass(day: any, slotType: string): string {
    // Si le jour est passé, on force le gris
    if (day.isPast) {
      return 'bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed';
    }

    const res = this.getReservationsForSlot(day, slotType);
    const isOccupied = res.length > 0;
    
    // Le style "grisé" est géré par l'opacité sur le parent (la div du jour)
    // On garde ici les couleurs standard pour les créneaux, qui seront affectées par l'opacité parent
    return !isOccupied
      ? 'bg-green-50 border-green-200 hover:bg-green-100 text-green-700'
      : 'bg-white border-slate-100 text-slate-300';
  }

  getReservationClass(res: any): string {
    if (res.type === 'PACK' || res.packId || (res.packs && res.packs.length > 0)) {
      return 'bg-blue-600 text-white border border-blue-700';
    }
    if (res.services && res.services.length > 0) {
      return 'bg-orange-500 text-white border border-orange-600';
    }
    return 'bg-red-500 text-white border border-red-600';
  }
}
EOF

# 2. Mise à jour de StaffCalendarComponent (Staff)
# - Ajout de la méthode isPast
# - Mise à jour du template pour griser les jours passés

cat << 'EOF' > src/app/features/staff-view/staff-calendar.component.ts
import { Component, inject, computed, signal, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { ReservationService } from '../../core/services/reservation.service';
import { AuthService } from '../../core/services/auth.service';
import { NotificationService } from '../../core/services/notification.service';
import { toSignal } from '@angular/core/rxjs-interop';
import { startOfMonth, endOfMonth, startOfWeek, endOfWeek, format, addMonths, subMonths, eachDayOfInterval, isSameMonth, isToday } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Reservation } from '../../core/models/reservation.model';

@Component({
  selector: 'app-staff-calendar',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <div class="min-h-screen bg-slate-50 flex flex-col">
      
      <header class="bg-slate-900 text-white p-4 shadow-md flex justify-between items-center z-20">
        
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center font-bold text-lg">
            {{ (authService.userState()?.email?.charAt(0) || 'S') | uppercase }}
          </div>
          <div>
            <h1 class="font-bold text-lg leading-tight">Mon Planning</h1>
            <p class="text-xs text-slate-400">{{ authService.userState()?.email }}</p>
          </div>
        </div>
        
        <div class="flex items-center gap-3">
          
          <button routerLink="/my-chat" class="relative p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-full transition group">
            <span class="material-icons">chat</span>
            <span class="absolute -bottom-8 left-1/2 -translate-x-1/2 bg-slate-800 text-white text-[10px] px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition whitespace-nowrap z-50 pointer-events-none">
              Messages
            </span>
          </button>

          <button routerLink="/my-notifications" class="relative p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-full transition group">
            <span class="material-icons">notifications</span>
            
            <span *ngIf="unreadCount() > 0" class="absolute top-1 right-2 w-3 h-3 bg-red-500 border-2 border-slate-900 rounded-full animate-pulse"></span>
            
            <span class="absolute -bottom-8 left-1/2 -translate-x-1/2 bg-slate-800 text-white text-[10px] px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition whitespace-nowrap z-50 pointer-events-none">
              {{ unreadCount() > 0 ? unreadCount() + ' nouvelle(s)' : 'Notifications' }}
            </span>
          </button>

          <button (click)="logout()" class="flex items-center gap-2 bg-slate-800 hover:bg-red-600 text-white px-4 py-2 rounded-lg transition text-sm font-bold">
            <span class="material-icons text-sm">logout</span> <span class="hidden sm:inline">Déconnexion</span>
          </button>
        </div>
      </header>

      <main class="flex-1 flex flex-col p-4 md:p-6 max-w-7xl mx-auto w-full">
        
        <div class="flex justify-between items-center mb-6 bg-white p-3 rounded-xl shadow-sm border border-slate-200">
          <button (click)="previousMonth()" class="p-2 hover:bg-slate-100 rounded-full transition"><span class="material-icons">chevron_left</span></button>
          <h2 class="text-xl font-bold text-slate-800 capitalize">{{ currentMonthLabel() }}</h2>
          <button (click)="nextMonth()" class="p-2 hover:bg-slate-100 rounded-full transition"><span class="material-icons">chevron_right</span></button>
        </div>

        <div class="flex-1 bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col min-h-[600px]">
          
          <div class="grid grid-cols-7 border-b bg-slate-50">
            @for (day of weekDays; track day) {
              <div class="py-3 text-center text-xs font-bold text-slate-500 uppercase tracking-wider">{{ day }}</div>
            }
          </div>

          <div class="grid grid-cols-7 flex-1 auto-rows-fr divide-x divide-y divide-slate-100">
            @for (day of calendarDays(); track day) {
              <div class="min-h-[100px] p-2 relative transition hover:bg-slate-50"
                   [class.bg-blue-50]="isToday(day)"
                   [class.bg-slate-50]="!isCurrentMonth(day) || isPast(day)"
                   [class.text-slate-400]="isPast(day) && !isToday(day)"
                   [class.opacity-75]="isPast(day) && !isToday(day)">
                
                <div class="text-right text-xs font-bold mb-1" 
                     [class.text-blue-600]="isToday(day)" 
                     [class.text-slate-400]="!isCurrentMonth(day) || isPast(day)">
                  {{ day | date:'d' }}
                </div>

                <div class="space-y-1">
                  @for (res of getMyShifts(day); track res.id) {
                    <div (click)="openDetails(res)" class="px-2 py-1.5 rounded bg-blue-100 border-l-4 border-blue-500 text-blue-900 text-[11px] font-medium shadow-sm cursor-pointer hover:brightness-95 transition truncate">
                      {{ res.startTime }} - {{ res.endTime }}
                    </div>
                  }
                </div>
              </div>
            }
          </div>
        </div>
      </main>
    </div>

    @if (selectedReservation()) {
      <div class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/80 backdrop-blur-sm p-4 animate-fade-in" (click)="closeDetails()">
        <div class="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden" (click)="$event.stopPropagation()">
          
          <div class="bg-blue-600 px-6 py-4 flex justify-between items-center text-white">
            <h3 class="font-bold text-lg">Détails Shift</h3>
            <button (click)="closeDetails()" class="text-blue-200 hover:text-white"><span class="material-icons">close</span></button>
          </div>

          <div class="p-6 space-y-4">
            
            <div class="text-center mb-4">
              <p class="text-sm text-slate-500 uppercase font-bold tracking-wider mb-1">Date</p>
              <p class="text-xl font-bold text-slate-800 capitalize">{{ selectedReservation()?.date | date:'fullDate':'':'fr' }}</p>
            </div>

            <div class="bg-slate-50 p-4 rounded-xl border border-slate-100 flex items-center justify-between">
              <div>
                <p class="text-xs text-slate-400 uppercase font-bold">Début</p>
                <p class="text-lg font-bold text-slate-700">{{ selectedReservation()?.startTime }}</p>
              </div>
              <span class="material-icons text-slate-300">arrow_forward</span>
              <div class="text-right">
                <p class="text-xs text-slate-400 uppercase font-bold">Fin</p>
                <p class="text-lg font-bold text-slate-700">{{ selectedReservation()?.endTime }}</p>
              </div>
            </div>

            <div>
              <p class="text-xs text-slate-500 uppercase font-bold mb-1">Client / Événement</p>
              <p class="font-medium text-slate-800">{{ selectedReservation()?.clientName }}</p>
            </div>

            <div class="pt-4 border-t border-slate-100">
              <button (click)="closeDetails()" class="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-3 rounded-lg transition">
                Fermer
              </button>
            </div>

          </div>
        </div>
      </div>
    }
  `,
  styles: [`
    @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
    .animate-fade-in { animation: fadeIn 0.2s ease-out; }
  `]
})
export class StaffCalendarComponent {
  authService = inject(AuthService);
  notificationService = inject(NotificationService);
  private reservationService = inject(ReservationService);
  private router = inject(Router);

  viewDate = signal(new Date());
  weekDays = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
  unreadCount = signal(0);
  
  reservations = toSignal(this.reservationService.getAll(), { initialValue: [] });
  selectedReservation = signal<Reservation | null>(null);

  constructor() {
    effect((onCleanup) => {
      const u = this.authService.userState();
      const uid = u?.uid;
      
      if (uid) {
        const key = 'MY_PLANNING_FCM_INIT_V1';
        if (sessionStorage.getItem(key) !== '1') {
          sessionStorage.setItem(key, '1');
          void this.notificationService.ensurefcmTokensForUser(uid).catch(console.warn);
        }
        const sub = this.notificationService.getUnreadCount(uid).subscribe(count => {
          this.unreadCount.set(count);
        });
        onCleanup(() => sub.unsubscribe());
      } else {
        this.unreadCount.set(0);
      }
    });
  }

  getMyShifts(date: Date): Reservation[] {
    const dateStr = format(date, 'yyyy-MM-dd');
    const myUid = this.authService.userState()?.uid;
    if (!myUid) return [];
    return this.reservations().filter(r => {
      if (r.date !== dateStr) return false;
      return r.assignedServerIds && r.assignedServerIds.includes(myUid);
    });
  }

  nextMonth() { this.viewDate.update(d => addMonths(d, 1)); }
  previousMonth() { this.viewDate.update(d => subMonths(d, 1)); }
  
  currentMonthLabel = computed(() => format(this.viewDate(), 'MMMM yyyy', { locale: fr }));
  calendarDays = computed(() => eachDayOfInterval({ 
    start: startOfWeek(startOfMonth(this.viewDate()), { weekStartsOn: 1 }), 
    end: endOfWeek(endOfMonth(this.viewDate()), { weekStartsOn: 1 }) 
  }));

  isToday(d: Date) { return isToday(d); }
  isCurrentMonth(d: Date) { return isSameMonth(d, this.viewDate()); }
  
  // Méthode ajoutée pour vérifier si un jour est passé
  isPast(date: Date): boolean {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return date < today;
  }

  openDetails(res: Reservation) { this.selectedReservation.set(res); }
  closeDetails() { this.selectedReservation.set(null); }
  
  goToAdminChat() { this.router.navigate(['/admin/chat']); }

  async logout() {
    await this.authService.logout();
    this.router.navigate(['/login']);
  }
}
EOF

echo "Mise à jour terminée avec succès."