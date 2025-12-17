import { Component, inject, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReservationService } from '../../../core/services/reservation.service';
import { AuthService } from '../../../core/services/auth.service';
import { StaffService } from '../../../core/services/staff.service';
import { ActivityService } from '../../../core/services/activity.service';
import { RouterLink, Router } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { startOfMonth, endOfMonth, startOfWeek, endOfWeek, format, addMonths, subMonths, eachDayOfInterval, isSameMonth, isSameDay, isToday, setMonth, setYear } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Reservation } from '../../../core/models/reservation.model';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-calendar-view',
  standalone: true,
  imports: [CommonModule, RouterLink, FormsModule],
  template: `
    <div class="p-6 bg-white min-h-screen flex flex-col">
      
      <div class="flex flex-col lg:flex-row justify-between items-center mb-6 gap-4">
        
        <div class="flex items-center bg-slate-50 p-1.5 rounded-xl border border-slate-200 shadow-sm">
          
          <button (click)="previousMonth()" class="p-2 rounded-lg hover:bg-white hover:shadow-sm text-slate-500 hover:text-slate-800 transition border border-transparent hover:border-slate-100">
            <span class="material-icons">chevron_left</span>
          </button>
          
          <div class="flex items-center gap-2 mx-2">
            <div class="relative">
              <select [ngModel]="currentMonthIndex()" (ngModelChange)="onMonthChange($event)" 
                      class="appearance-none bg-white border border-slate-200 text-slate-800 font-bold py-2 pl-3 pr-8 rounded-lg cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500 hover:border-blue-300 transition capitalize">
                @for (m of monthsList; track $index) {
                  <option [value]="$index">{{ m }}</option>
                }
              </select>
              <span class="material-icons absolute right-2 top-2.5 text-slate-400 pointer-events-none text-sm">arrow_drop_down</span>
            </div>

            <div class="relative">
              <select [ngModel]="currentYear()" (ngModelChange)="onYearChange($event)" 
                      class="appearance-none bg-white border border-slate-200 text-slate-800 font-bold py-2 pl-3 pr-8 rounded-lg cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500 hover:border-blue-300 transition">
                @for (y of yearsList(); track y) {
                  <option [value]="y">{{ y }}</option>
                }
              </select>
              <span class="material-icons absolute right-2 top-2.5 text-slate-400 pointer-events-none text-sm">arrow_drop_down</span>
            </div>
          </div>

          <button (click)="nextMonth()" class="p-2 rounded-lg hover:bg-white hover:shadow-sm text-slate-500 hover:text-slate-800 transition border border-transparent hover:border-slate-100">
            <span class="material-icons">chevron_right</span>
          </button>
        </div>
        
        <div class="flex items-center gap-3 w-full lg:w-auto justify-end">
          <button (click)="goToToday()" class="px-4 py-2 text-sm font-medium text-slate-600 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg transition flex items-center">
            <span class="material-icons text-sm mr-1">today</span> Aujourd'hui
          </button>
          <a routerLink="/reservations/new" class="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded-lg shadow-md hover:shadow-lg transition flex items-center font-bold whitespace-nowrap">
            <span class="material-icons text-sm mr-2">add</span> Réservation
          </a>
        </div>
      </div>

      <div class="flex-1 border rounded-lg overflow-hidden bg-slate-50 flex flex-col shadow-sm">
        <div class="grid grid-cols-7 bg-white border-b divide-x divide-slate-100">
          @for (day of weekDays; track day) { 
            <div class="py-3 text-center text-xs font-bold text-slate-500 uppercase tracking-wider bg-slate-50/50">
              {{ day }}
            </div> 
          }
        </div>
        <div class="grid grid-cols-7 flex-1 auto-rows-fr divide-x divide-y divide-slate-100">
          @for (day of calendarDays(); track day) {
            <div (click)="onDayClick(day)" 
                 class="min-h-[120px] bg-white p-2 relative flex flex-col cursor-pointer transition hover:bg-blue-50/30 group"
                 [class.bg-blue-50]="isToday(day)" 
                 [class.bg-slate-50]="!isCurrentMonth(day)">
              
              <div class="flex justify-end mb-1">
                <span class="text-xs font-medium w-6 h-6 flex items-center justify-center rounded-full transition-colors"
                      [class.bg-blue-600]="isToday(day)" 
                      [class.text-white]="isToday(day)"
                      [class.text-slate-400]="!isCurrentMonth(day)"
                      [class.text-slate-700]="isCurrentMonth(day) && !isToday(day)">
                  {{ day | date:'d' }}
                </span>
              </div>
              
              <div class="flex-1 overflow-y-auto space-y-1 custom-scrollbar">
                @for (res of getReservationsForDay(day); track res.id) {
                  <div (click)="openDetails(res); $event.stopPropagation()" 
                       class="text-[10px] px-2 py-1.5 rounded border-l-[3px] shadow-sm cursor-pointer truncate bg-white hover:shadow-md hover:-translate-y-0.5 transition-all duration-200"
                       [class.border-green-500]="res.status === 'CONFIRMED'" 
                       [class.border-yellow-500]="res.status === 'PENDING'" 
                       [class.border-red-500]="res.status === 'CANCELLED'">
                    <span class="font-bold mr-1">{{ res.startTime }}</span> {{ res.clientName }}
                  </div>
                }
              </div>
              
              <div class="absolute bottom-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity">
                 <span class="material-icons text-blue-300 text-sm">add_circle</span>
              </div>
            </div>
          }
        </div>
      </div>
    </div>

    @if (selectedReservation()) {
      <div class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-fade-in" (click)="closeDetails()">
        <div class="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]" (click)="$event.stopPropagation()">
          <div class="bg-gradient-to-r from-slate-800 to-slate-900 px-6 py-4 flex justify-between items-center text-white shrink-0">
            <div><h3 class="font-bold text-xl">{{ selectedReservation()?.clientName }}</h3><p class="text-slate-400 text-xs mt-1">{{ selectedReservation()?.date | date:'fullDate' }}</p></div>
            <button (click)="closeDetails()" class="text-slate-400 hover:text-white"><span class="material-icons">close</span></button>
          </div>
          <div class="p-6 space-y-6 overflow-y-auto custom-scrollbar">
             <div class="bg-purple-50 p-4 rounded-xl border border-purple-100 shadow-sm">
               <div class="flex justify-between items-center mb-3 border-b border-purple-200 pb-2"><span class="text-xs font-bold text-purple-700 uppercase tracking-wider">Trésorerie</span><button (click)="openPayment()" class="text-purple-600 hover:bg-purple-100 p-1 rounded transition"><span class="material-icons text-sm">add</span></button></div>
               <div class="grid grid-cols-3 gap-2 text-center"><div><p class="text-[10px] text-slate-500 uppercase">Total</p><p class="font-bold text-slate-800">{{ getResPrice(selectedReservation()) }} DT</p></div><div><p class="text-[10px] text-slate-500 uppercase">Reçu</p><p class="font-bold text-emerald-600">{{ getResAdvance(selectedReservation()) }} DT</p></div><div><p class="text-[10px] text-slate-500 uppercase">Reste</p><p class="font-bold text-red-500">{{ (getResPrice(selectedReservation()) - getResAdvance(selectedReservation())) }} DT</p></div></div>
             </div>
             <div>
               <div class="flex items-center justify-between mb-3"><h4 class="text-xs font-bold text-slate-500 uppercase tracking-wider">Affectation Équipe</h4><span class="text-xs bg-slate-100 px-2 py-1 rounded text-slate-600 font-bold">{{ (selectedReservation()?.assignedServerIds || []).length }} membres</span></div>
               <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
                 @for (staff of allStaff(); track staff.id) {
                   <div (click)="toggleStaffAssignment(staff.id!)" class="flex items-center p-2 rounded-lg border cursor-pointer select-none transition-all duration-200 hover:shadow-sm" [class.border-emerald-500]="isStaffAssigned(staff.id!)" [class.bg-emerald-50]="isStaffAssigned(staff.id!)" [class.border-slate-200]="!isStaffAssigned(staff.id!)">
                     <div class="w-6 h-6 rounded-full flex items-center justify-center text-[10px] mr-2 transition-colors" [class.bg-emerald-500]="isStaffAssigned(staff.id!)" [class.text-white]="isStaffAssigned(staff.id!)" [class.bg-slate-200]="!isStaffAssigned(staff.id!)" [class.text-slate-400]="!isStaffAssigned(staff.id!)">@if(isStaffAssigned(staff.id!)){ <span class="material-icons text-[14px]">check</span> }</div>
                     <div class="flex-1 min-w-0"><p class="text-sm font-bold truncate" [class.text-emerald-900]="isStaffAssigned(staff.id!)">{{ staff.nom }}</p><p class="text-[10px] truncate" [class.text-emerald-700]="isStaffAssigned(staff.id!)" [class.text-slate-500]="!isStaffAssigned(staff.id!)">{{ staff.specialite }}</p></div>
                   </div>
                 }
               </div>
             </div>
          </div>
          <div class="bg-slate-50 px-6 py-4 border-t border-slate-200 flex justify-between shrink-0"><button (click)="initiateDelete()" class="text-red-500 hover:bg-red-50 px-3 py-2 rounded text-sm font-bold transition flex items-center"><span class="material-icons text-sm mr-2">delete</span> Supprimer</button><button (click)="editCurrent()" class="bg-slate-800 hover:bg-slate-700 text-white px-5 py-2 rounded text-sm font-bold transition flex items-center"><span class="material-icons text-sm mr-2">edit</span> Éditer tout</button></div>
        </div>
      </div>
    }

    @if (selectedDayForMenu()) {
      <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm animate-fade-in" (click)="closeDayMenu()">
        <div class="bg-white rounded-xl shadow-2xl w-80 overflow-hidden transform scale-100" (click)="$event.stopPropagation()">
          <div class="bg-blue-600 px-6 py-4 flex justify-between items-center text-white"><h3 class="font-bold text-lg">{{ selectedDayForMenu() | date:'fullDate' }}</h3><button (click)="closeDayMenu()" class="text-blue-200 hover:text-white"><span class="material-icons">close</span></button></div>
          <div class="p-4 bg-slate-50 border-b border-slate-200"><button (click)="addNewOnDay()" class="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-lg shadow font-bold flex justify-center items-center transition"><span class="material-icons mr-2">add_circle</span> Nouvelle Réservation</button></div>
          <div class="p-4 space-y-2 max-h-60 overflow-y-auto">
            <p class="text-xs font-bold text-slate-500 uppercase mb-2">Réservations existantes</p>
            @for (res of getReservationsForDay(selectedDayForMenu()!); track res.id) {
              <div (click)="openDetails(res); closeDayMenu()" class="p-3 bg-white border border-slate-200 rounded-lg shadow-sm hover:border-blue-300 hover:shadow-md cursor-pointer transition">
                <div class="flex justify-between items-center"><span class="font-bold text-slate-800">{{ res.clientName }}</span><span class="text-xs font-bold px-2 py-0.5 rounded" [class.bg-green-100]="res.status === 'CONFIRMED'" [class.text-green-800]="res.status === 'CONFIRMED'">{{ res.status }}</span></div>
                <div class="text-xs text-slate-500 mt-1 flex items-center"><span class="material-icons text-[12px] mr-1">schedule</span> {{ res.startTime }} - {{ res.endTime }}</div>
              </div>
            }
          </div>
        </div>
      </div>
    }

    @if (showPaymentModal()) { <div class="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm animate-fade-in"><div class="bg-white rounded-xl shadow-2xl p-6 w-72"><h3 class="font-bold text-lg mb-4 text-center">Ajouter Paiement</h3><div class="mb-4"><input type="number" [(ngModel)]="amountToAdd" class="w-full text-center text-3xl font-bold border-b-2 border-emerald-500 outline-none pb-2 text-slate-800" placeholder="0"><p class="text-center text-xs text-slate-400 mt-1">Montant en TND</p></div><div class="flex gap-2"><button (click)="closePayment()" class="flex-1 py-2 border rounded text-slate-600 hover:bg-slate-50">Annuler</button><button (click)="submitPayment()" class="flex-1 py-2 bg-emerald-600 text-white rounded font-bold hover:bg-emerald-700">Valider</button></div></div></div> }
    @if (showDeleteModal()) { <div class="fixed inset-0 z-[70] flex items-center justify-center bg-red-900/80 backdrop-blur-sm animate-fade-in"><div class="bg-white rounded-xl shadow-2xl p-8 w-96 transform scale-100"><div class="flex flex-col items-center mb-6"><div class="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4"><span class="material-icons text-red-600 text-3xl">gpp_maybe</span></div><h3 class="font-bold text-xl text-slate-800 text-center">Zone de Danger</h3><p class="text-sm text-slate-500 text-center mt-2">Vous êtes sur le point de supprimer définitivement cette réservation.</p></div><div class="space-y-4"><div><label class="block text-xs font-bold text-slate-700 uppercase mb-1">Mot de passe Admin</label><input type="password" [(ngModel)]="deletePassword" class="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-red-500 outline-none transition" placeholder="••••••••" (keyup.enter)="confirmDelete()">@if (deleteError()) { <p class="text-xs text-red-600 mt-1 flex items-center animate-pulse"><span class="material-icons text-xs mr-1">error</span> Mot de passe incorrect</p> }</div><button (click)="confirmDelete()" [disabled]="isDeleting()" class="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-3 rounded-lg shadow-lg transition flex justify-center items-center disabled:opacity-70 disabled:cursor-not-allowed">@if (isDeleting()) { <span class="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full mr-2"></span> } Confirmer la suppression</button><button (click)="closeDeleteModal()" class="w-full text-slate-500 hover:text-slate-800 font-medium py-2">Annuler</button></div></div></div> }
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
  private activityService = inject(ActivityService);
  private router = inject(Router);
  authService = inject(AuthService);

  viewDate = signal(new Date());
  weekDays = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
  monthsList = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];
  
  reservations = toSignal(this.reservationService.getAll(), { initialValue: [] });
  allStaff = toSignal(this.staffService.getAll(), { initialValue: [] });
  
  // SIGNALS POUR DROPDOWNS
  currentMonthIndex = computed(() => this.viewDate().getMonth());
  currentYear = computed(() => this.viewDate().getFullYear());
  
  // Génère liste années dynamique (Année actuelle - 2 jusqu'à + 5)
  yearsList = computed(() => {
    const current = new Date().getFullYear();
    const years = [];
    for (let i = current - 2; i <= current + 5; i++) {
      years.push(i);
    }
    return years;
  });

  calendarDays = computed(() => eachDayOfInterval({ start: startOfWeek(startOfMonth(this.viewDate()), { weekStartsOn: 1 }), end: endOfWeek(endOfMonth(this.viewDate()), { weekStartsOn: 1 }) }));

  // --- ACTIONS NAVIGATION ---
  
  nextMonth() { this.viewDate.update(d => addMonths(d, 1)); }
  previousMonth() { this.viewDate.update(d => subMonths(d, 1)); }
  goToToday() { this.viewDate.set(new Date()); }

  onMonthChange(monthIndex: string) {
    // Convertir string en number
    const m = parseInt(monthIndex, 10);
    this.viewDate.update(d => setMonth(d, m));
  }

  onYearChange(yearStr: string) {
    const y = parseInt(yearStr, 10);
    this.viewDate.update(d => setYear(d, y));
  }

  // --- RESTE DU CODE (Interactions) ---
  selectedDayForMenu = signal<Date | null>(null);
  onDayClick(day: Date) { const events = this.getReservationsForDay(day); if (events.length === 0) { const dateStr = format(day, 'yyyy-MM-dd'); this.router.navigate(['/reservations/new'], { queryParams: { date: dateStr } }); } else { this.selectedDayForMenu.set(day); } }
  closeDayMenu() { this.selectedDayForMenu.set(null); }
  addNewOnDay() { const day = this.selectedDayForMenu(); if (day) { const dateStr = format(day, 'yyyy-MM-dd'); this.router.navigate(['/reservations/new'], { queryParams: { date: dateStr } }); } }

  selectedReservation = signal<Reservation | null>(null);
  showPaymentModal = signal(false); amountToAdd = 0; showDeleteModal = signal(false); deletePassword = signal(''); deleteError = signal(false); isDeleting = signal(false);

  isToday(d: Date) { return isToday(d); }
  isCurrentMonth(d: Date) { return isSameMonth(d, this.viewDate()); }
  getReservationsForDay(date: Date): Reservation[] { return this.reservations().filter(r => r.date === format(date, 'yyyy-MM-dd')); }
  
  openDetails(res: Reservation) { this.selectedReservation.set(res); }
  closeDetails() { this.selectedReservation.set(null); }
  editCurrent() { const res = this.selectedReservation(); if (res?.id) this.router.navigate(['/reservations/edit', res.id]); }
  initiateDelete() { this.deletePassword.set(''); this.deleteError.set(false); this.showDeleteModal.set(true); }
  closeDeleteModal() { this.showDeleteModal.set(false); }
  async confirmDelete() { if (!this.deletePassword()) return; this.isDeleting.set(true); this.deleteError.set(false); const isValid = await this.authService.verifyPassword(this.deletePassword()); if (isValid) { const res = this.selectedReservation(); if (res?.id) { await this.reservationService.delete(res.id); this.closeDeleteModal(); this.closeDetails(); } } else { this.deleteError.set(true); } this.isDeleting.set(false); }
  
  isStaffAssigned(staffId: string): boolean { const res = this.selectedReservation(); if (!res || !res.assignedServerIds) return false; return res.assignedServerIds.includes(staffId); }
  async toggleStaffAssignment(staffId: string) { const res = this.selectedReservation(); if (!res || !res.id) return; const currentIds = res.assignedServerIds || []; let newIds = currentIds.includes(staffId) ? currentIds.filter(id => id !== staffId) : [...currentIds, staffId]; await this.reservationService.update(res.id, { assignedServerIds: newIds } as any); this.selectedReservation.update(prev => { if (!prev) return null; return { ...prev, assignedServerIds: newIds }; }); }
  
  getResPrice(res: any) { return Number(res?.totalPrice) || 0; }
  getResAdvance(res: any) { return Number(res?.advance) || 0; }
  openPayment() { this.amountToAdd = 0; this.showPaymentModal.set(true); }
  closePayment() { this.showPaymentModal.set(false); }
  async submitPayment() { const res = this.selectedReservation(); if (res && this.amountToAdd > 0) { const newAdvance = this.getResAdvance(res) + this.amountToAdd; await this.reservationService.update(res.id!, { advance: newAdvance, advanceOnly: true } as any); this.activityService.log('PAYMENT', 'RESERVATION', `Paiement reçu : ${this.amountToAdd} TND (Client: ${res.clientName})`); this.closePayment(); this.selectedReservation.update(prev => { if (!prev) return null; return { ...prev, advance: newAdvance } as any; }); } }
}
