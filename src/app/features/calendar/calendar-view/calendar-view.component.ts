import { Component, inject, computed, signal, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReservationService } from '../../../core/services/reservation.service';
import { AuthService } from '../../../core/services/auth.service';
import { RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { startOfMonth, endOfMonth, startOfWeek, endOfWeek, format, addMonths, subMonths, eachDayOfInterval, isSameMonth, isSameDay, isToday } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Reservation } from '../../../core/models/reservation.model';

@Component({
  selector: 'app-calendar-view',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <div class="p-6 bg-white min-h-screen flex flex-col">
      
      <div class="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
        <div class="flex items-center gap-4">
          <button (click)="previousMonth()" class="p-2 rounded-full hover:bg-gray-100 transition">
            <span class="material-icons text-gray-600">chevron_left</span>
          </button>
          <h2 class="text-2xl font-bold text-gray-800 capitalize min-w-[200px] text-center">
            {{ currentMonthLabel() }}
          </h2>
          <button (click)="nextMonth()" class="p-2 rounded-full hover:bg-gray-100 transition">
            <span class="material-icons text-gray-600">chevron_right</span>
          </button>
        </div>
        
        <div class="flex items-center gap-3">
          <button (click)="goToToday()" class="px-3 py-1 text-sm border rounded hover:bg-gray-50 text-gray-600">Aujourd'hui</button>
          <a routerLink="/reservations/new" class="bg-blue-600 text-white px-4 py-2 rounded shadow hover:bg-blue-700 transition flex items-center">
            <span class="material-icons text-sm mr-2">add</span> Réservation
          </a>
        </div>
      </div>

      @if (authService.isServer()) {
        <div class="bg-blue-50 text-blue-800 text-xs p-2 rounded mb-4 border-l-4 border-blue-500 flex items-center">
          <span class="material-icons text-sm mr-2">visibility</span>
          Vue filtrée : Vous ne voyez que vos assignations.
        </div>
      }

      <div class="flex-1 border rounded-lg overflow-hidden bg-gray-50 flex flex-col">
        
        <div class="grid grid-cols-7 bg-white border-b">
          @for (day of weekDays; track day) {
            <div class="py-2 text-center text-sm font-semibold text-gray-500 uppercase tracking-wide">
              {{ day }}
            </div>
          }
        </div>

        <div class="grid grid-cols-7 flex-1 auto-rows-fr">
          @for (day of calendarDays(); track day) {
            <div class="min-h-[120px] bg-white border-b border-r p-2 transition hover:bg-gray-50 flex flex-col relative"
                 [class.bg-gray-50]="!isCurrentMonth(day)"
                 [class.bg-blue-50]="isToday(day)">
              
              <div class="text-right text-sm font-medium mb-1" 
                   [class.text-gray-400]="!isCurrentMonth(day)"
                   [class.text-blue-600]="isToday(day)">
                {{ day | date:'d' }}
              </div>

              <div class="flex-1 space-y-1 overflow-y-auto custom-scrollbar">
                @for (res of getReservationsForDay(day); track res.id) {
                  <div class="text-xs p-1.5 rounded border-l-2 shadow-sm truncate cursor-pointer hover:opacity-80 transition"
                       [class.border-green-500]="res.status === 'CONFIRMED'"
                       [class.bg-green-100]="res.status === 'CONFIRMED'"
                       [class.text-green-900]="res.status === 'CONFIRMED'"
                       [class.border-yellow-500]="res.status === 'PENDING'"
                       [class.bg-yellow-100]="res.status === 'PENDING'"
                       [class.text-yellow-900]="res.status === 'PENDING'"
                       [title]="res.clientName + ' (' + res.startTime + ')'">
                    <span class="font-bold">{{ res.startTime }}</span> {{ res.clientName }}
                  </div>
                }
              </div>

            </div>
          }
        </div>
      </div>
    </div>
  `,
  styles: [`
    .custom-scrollbar::-webkit-scrollbar { width: 4px; }
    .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
    .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 2px; }
  `]
})
export class CalendarViewComponent {
  private reservationService = inject(ReservationService);
  authService = inject(AuthService);

  // État local
  viewDate = signal(new Date());
  weekDays = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];

  // Récupération automatique des données
  // Note: On charge large (tout le mois affiché)
  reservations = toSignal(this.reservationService.getAll(), { initialValue: [] });

  // --- ACTIONS NAVIGATION ---

  nextMonth() {
    this.viewDate.update(d => addMonths(d, 1));
  }

  previousMonth() {
    this.viewDate.update(d => subMonths(d, 1));
  }

  goToToday() {
    this.viewDate.set(new Date());
  }

  // --- CALCULS AFFICHAGE ---

  currentMonthLabel = computed(() => {
    return format(this.viewDate(), 'MMMM yyyy', { locale: fr });
  });

  calendarDays = computed(() => {
    const current = this.viewDate();
    const start = startOfWeek(startOfMonth(current), { weekStartsOn: 1 }); // Semaine commence Lundi
    const end = endOfWeek(endOfMonth(current), { weekStartsOn: 1 });
    
    return eachDayOfInterval({ start, end });
  });

  // --- LOGIQUE FILTRAGE ---

  isCurrentMonth(date: Date): boolean {
    return isSameMonth(date, this.viewDate());
  }

  isToday(date: Date): boolean {
    return isToday(date);
  }

  getReservationsForDay(date: Date): Reservation[] {
    const dateStr = format(date, 'yyyy-MM-dd');
    const all = this.reservations();
    const user = this.authService.userState();

    return all.filter(r => {
      // 1. Filtre date
      const matchDate = r.date === dateStr;
      if (!matchDate) return false;

      // 2. Filtre Rôle
      if (user?.role === 'ADMIN') return true;
      if (user?.role === 'SERVER') return r.assignedServerIds.includes(user.uid);
      
      return false;
    });
  }
}
