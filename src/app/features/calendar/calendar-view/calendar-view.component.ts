import { Component, inject, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReservationService } from '../../../core/services/reservation.service';
import { AuthService } from '../../../core/services/auth.service';
import { StaffService } from '../../../core/services/staff.service';
import { RouterLink, Router } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { startOfMonth, endOfMonth, startOfWeek, endOfWeek, format, addMonths, subMonths, eachDayOfInterval, isSameMonth, isSameDay, isToday } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Reservation } from '../../../core/models/reservation.model';
import { ServerStaff } from '../../../core/models/staff.model';

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
          <h2 class="text-2xl font-bold text-slate-800 capitalize min-w-[200px] text-center">
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

      <div class="flex-1 border rounded-lg overflow-hidden bg-slate-50 flex flex-col">
        <div class="grid grid-cols-7 bg-white border-b">
          @for (day of weekDays; track day) {
            <div class="py-2 text-center text-sm font-semibold text-slate-500 uppercase tracking-wide">
              {{ day }}
            </div>
          }
        </div>

        <div class="grid grid-cols-7 flex-1 auto-rows-fr">
          @for (day of calendarDays(); track day) {
            <div class="min-h-[120px] bg-white border-b border-r p-2 transition hover:bg-slate-50 flex flex-col relative"
                 [class.bg-slate-50]="!isCurrentMonth(day)"
                 [class.bg-blue-50]="isToday(day)">
              
              <div class="text-right text-sm font-medium mb-1" 
                   [class.text-slate-400]="!isCurrentMonth(day)"
                   [class.text-blue-600]="isToday(day)">
                {{ day | date:'d' }}
              </div>

              <div class="flex-1 space-y-1 overflow-y-auto custom-scrollbar">
                @for (res of getReservationsForDay(day); track res.id) {
                  <div (click)="openDetails(res)" 
                       class="text-xs p-1.5 rounded border-l-4 shadow-sm truncate cursor-pointer hover:brightness-95 transition"
                       [class.border-green-500]="res.status === 'CONFIRMED'"
                       [class.bg-green-100]="res.status === 'CONFIRMED'"
                       [class.text-green-900]="res.status === 'CONFIRMED'"
                       [class.border-yellow-500]="res.status === 'PENDING'"
                       [class.bg-yellow-100]="res.status === 'PENDING'"
                       [class.text-yellow-900]="res.status === 'PENDING'">
                    <span class="font-bold">{{ res.startTime }}</span> {{ res.clientName }}
                  </div>
                }
              </div>
            </div>
          }
        </div>
      </div>
    </div>

    @if (selectedReservation()) {
      <div class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm animate-fade-in p-4" (click)="closeDetails()">
        <div class="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden transform transition-all scale-100 flex flex-col max-h-[90vh]" (click)="$event.stopPropagation()">
          
          <div class="bg-gradient-to-r from-slate-800 to-slate-900 px-6 py-5 flex justify-between items-start shrink-0">
            <div>
              <h3 class="text-white font-bold text-xl">{{ selectedReservation()?.clientName }}</h3>
              <p class="text-slate-300 text-sm mt-1 flex items-center opacity-80">
                <span class="material-icons text-sm mr-1">event</span> 
                {{ selectedReservation()?.date | date:'fullDate' }}
              </p>
            </div>
            <button (click)="closeDetails()" class="text-slate-400 hover:text-white transition">
              <span class="material-icons">close</span>
            </button>
          </div>

          <div class="p-6 space-y-6 overflow-y-auto custom-scrollbar">
            
            <div class="flex items-center justify-between bg-slate-50 p-4 rounded-lg border border-slate-100">
              <div>
                <p class="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Horaire</p>
                <div class="flex items-center text-slate-800 font-bold text-lg">
                  <span class="material-icons text-slate-400 mr-2">schedule</span>
                  {{ selectedReservation()?.startTime }} <span class="mx-2 text-slate-300">➔</span> {{ selectedReservation()?.endTime }}
                </div>
              </div>
              <div class="px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide border"
                   [class.bg-green-100]="selectedReservation()?.status === 'CONFIRMED'"
                   [class.text-green-800]="selectedReservation()?.status === 'CONFIRMED'"
                   [class.border-green-200]="selectedReservation()?.status === 'CONFIRMED'"
                   [class.bg-yellow-100]="selectedReservation()?.status === 'PENDING'"
                   [class.text-yellow-800]="selectedReservation()?.status === 'PENDING'"
                   [class.border-yellow-200]="selectedReservation()?.status === 'PENDING'">
                {{ selectedReservation()?.status }}
              </div>
            </div>

            <div>
               <div class="flex items-center justify-between mb-3">
                 <p class="text-xs font-bold text-slate-500 uppercase tracking-wider">Équipe Assignée</p>
                 <span class="text-xs bg-slate-100 px-2 py-0.5 rounded text-slate-600 font-bold">{{ getAssignedStaffDetails(selectedReservation()!).length }} membres</span>
               </div>
               
               <div class="space-y-3">
                 @for (staff of getAssignedStaffDetails(selectedReservation()!); track staff.id) {
                   <div class="flex items-center p-3 bg-white rounded-lg border border-slate-200 shadow-sm hover:shadow-md transition">
                     
                     <div class="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold text-sm shadow mr-3">
                       {{ staff.nom.charAt(0) }}
                     </div>
                     
                     <div class="flex-1 min-w-0">
                       <p class="text-sm font-bold text-slate-800 truncate">{{ staff.nom }}</p>
                       <div class="flex items-center gap-2 mt-0.5">
                         <span class="text-[10px] px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded font-medium border border-slate-200 uppercase">
                           {{ staff.specialite || 'Staff' }}
                         </span>
                         <span class="text-xs text-slate-400 truncate">{{ staff.email }}</span>
                       </div>
                     </div>

                     @if (staff.telephone) {
                       <a [href]="'tel:' + staff.telephone" class="w-8 h-8 rounded-full bg-green-50 text-green-600 flex items-center justify-center hover:bg-green-100 transition" title="Appeler">
                         <span class="material-icons text-sm">call</span>
                       </a>
                     }
                   </div>
                 } @empty {
                   <div class="text-center py-6 bg-slate-50 rounded-lg border border-dashed border-slate-300">
                     <p class="text-slate-400 text-sm italic">Aucun serveur assigné pour le moment.</p>
                   </div>
                 }
               </div>
            </div>
          </div>

          <div class="bg-slate-50 px-6 py-4 border-t border-slate-200 flex justify-between shrink-0">
            <button (click)="deleteCurrent()" class="text-red-500 hover:text-red-700 font-medium text-sm flex items-center transition hover:bg-red-50 px-3 py-2 rounded-lg">
              <span class="material-icons text-lg mr-2">delete_forever</span> Supprimer
            </button>
            
            <button (click)="editCurrent()" class="bg-slate-800 hover:bg-slate-700 text-white px-5 py-2.5 rounded-lg font-medium shadow flex items-center transition">
              <span class="material-icons text-sm mr-2">edit</span> Modifier
            </button>
          </div>

        </div>
      </div>
    }
  `,
  styles: [`
    .custom-scrollbar::-webkit-scrollbar { width: 4px; }
    .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
    .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 2px; }
    @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
    .animate-fade-in { animation: fadeIn 0.2s ease-out; }
  `]
})
export class CalendarViewComponent {
  private reservationService = inject(ReservationService);
  private staffService = inject(StaffService);
  private router = inject(Router);
  authService = inject(AuthService);

  viewDate = signal(new Date());
  weekDays = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
  
  // Chargement des données
  reservations = toSignal(this.reservationService.getAll(), { initialValue: [] });
  allStaff = toSignal(this.staffService.getAll(), { initialValue: [] });

  // État Modale
  selectedReservation = signal<Reservation | null>(null);

  // --- LOGIQUE STAFF DETAILS ---
  getAssignedStaffDetails(reservation: Reservation): any[] {
    const ids = reservation.assignedServerIds || [];
    if (ids.length === 0) return [];
    const staffList = this.allStaff();
    return staffList.filter(s => ids.includes(s.id!));
  }

  // --- ACTIONS ---
  openDetails(res: Reservation) { this.selectedReservation.set(res); }
  closeDetails() { this.selectedReservation.set(null); }

  editCurrent() {
    const res = this.selectedReservation();
    if (res && res.id) this.router.navigate(['/reservations/edit', res.id]);
  }

  async deleteCurrent() {
    const res = this.selectedReservation();
    if (res && res.id) {
      if (confirm('Êtes-vous sûr de vouloir supprimer cette réservation ?')) {
        await this.reservationService.delete(res.id);
        this.closeDetails();
      }
    }
  }

  // Navigation
  nextMonth() { this.viewDate.update(d => addMonths(d, 1)); }
  previousMonth() { this.viewDate.update(d => subMonths(d, 1)); }
  goToToday() { this.viewDate.set(new Date()); }

  // Helpers
  currentMonthLabel = computed(() => format(this.viewDate(), 'MMMM yyyy', { locale: fr }));
  calendarDays = computed(() => {
    const current = this.viewDate();
    return eachDayOfInterval({ 
      start: startOfWeek(startOfMonth(current), { weekStartsOn: 1 }), 
      end: endOfWeek(endOfMonth(current), { weekStartsOn: 1 }) 
    });
  });

  isCurrentMonth(d: Date) { return isSameMonth(d, this.viewDate()); }
  isToday(d: Date) { return isToday(d); }
  
  getReservationsForDay(date: Date): Reservation[] {
    const dateStr = format(date, 'yyyy-MM-dd');
    const user = this.authService.userState();
    return this.reservations().filter(r => {
      if (r.date !== dateStr) return false;
      if (user?.role === 'ADMIN') return true;
      if (user?.role === 'SERVER') return r.assignedServerIds.includes(user.uid);
      return false;
    });
  }
}
