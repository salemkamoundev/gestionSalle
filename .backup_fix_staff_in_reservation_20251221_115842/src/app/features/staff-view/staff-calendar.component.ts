import { Component, inject, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReservationService } from '../../core/services/reservation.service';
import { AuthService } from '../../core/services/auth.service';
import { Router } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { startOfMonth, endOfMonth, startOfWeek, endOfWeek, format, addMonths, subMonths, eachDayOfInterval, isSameMonth, isToday } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Reservation } from '../../core/models/reservation.model';

@Component({
  selector: 'app-staff-calendar',
  standalone: true,
  imports: [CommonModule],
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
        
        <button (click)="logout()" class="flex items-center gap-2 bg-slate-800 hover:bg-red-600 text-white px-4 py-2 rounded-lg transition text-sm font-bold">
          <span class="material-icons text-sm">logout</span> <span class="hidden sm:inline">Déconnexion</span>
        </button>
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
                   [class.bg-slate-50]="!isCurrentMonth(day)">
                
                <div class="text-right text-xs font-bold mb-1" 
                     [class.text-blue-600]="isToday(day)" 
                     [class.text-slate-400]="!isCurrentMonth(day)">
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
  private reservationService = inject(ReservationService);
  private router = inject(Router);

  viewDate = signal(new Date());
  weekDays = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
  
  // Chargement de TOUTES les réservations (optimisation possible : charger par range de date)
  reservations = toSignal(this.reservationService.getAll(), { initialValue: [] });
  
  selectedReservation = signal<Reservation | null>(null);

  // --- LOGIQUE FILTRAGE STAFF ---
  getMyShifts(date: Date): Reservation[] {
    const dateStr = format(date, 'yyyy-MM-dd');
    const myUid = this.authService.userState()?.uid;

    if (!myUid) return [];

    return this.reservations().filter(r => {
      // 1. La date correspond
      if (r.date !== dateStr) return false;
      // 2. Je suis dans la liste des serveurs assignés
      return r.assignedServerIds && r.assignedServerIds.includes(myUid);
    });
  }

  // --- NAVIGATION ---
  nextMonth() { this.viewDate.update(d => addMonths(d, 1)); }
  previousMonth() { this.viewDate.update(d => subMonths(d, 1)); }
  
  currentMonthLabel = computed(() => format(this.viewDate(), 'MMMM yyyy', { locale: fr }));
  calendarDays = computed(() => eachDayOfInterval({ 
    start: startOfWeek(startOfMonth(this.viewDate()), { weekStartsOn: 1 }), 
    end: endOfWeek(endOfMonth(this.viewDate()), { weekStartsOn: 1 }) 
  }));

  isToday(d: Date) { return isToday(d); }
  isCurrentMonth(d: Date) { return isSameMonth(d, this.viewDate()); }

  // --- ACTIONS ---
  openDetails(res: Reservation) { this.selectedReservation.set(res); }
  closeDetails() { this.selectedReservation.set(null); }
  
  async logout() {
    await this.authService.logout();
    this.router.navigate(['/login']);
  }
}
