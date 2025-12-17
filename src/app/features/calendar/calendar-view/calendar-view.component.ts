import { Component, inject, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReservationService } from '../../../core/services/reservation.service';
import { AuthService } from '../../../core/services/auth.service';
import { StaffService } from '../../../core/services/staff.service';
import { ActivityService } from '../../../core/services/activity.service'; // <--- NEW
import { RouterLink, Router } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { startOfMonth, endOfMonth, startOfWeek, endOfWeek, format, addMonths, subMonths, eachDayOfInterval, isSameMonth, isSameDay, isToday } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Reservation } from '../../../core/models/reservation.model';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-calendar-view',
  standalone: true,
  imports: [CommonModule, RouterLink, FormsModule],
  template: `
    <div class="p-6 bg-white min-h-screen flex flex-col">
      <div class="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
        <div class="flex items-center gap-4">
          <button (click)="previousMonth()" class="p-2 rounded-full hover:bg-gray-100 border transition"><span class="material-icons text-gray-600">chevron_left</span></button>
          <h2 class="text-2xl font-bold text-slate-800 capitalize min-w-[200px] text-center">{{ currentMonthLabel() }}</h2>
          <button (click)="nextMonth()" class="p-2 rounded-full hover:bg-gray-100 border transition"><span class="material-icons text-gray-600">chevron_right</span></button>
        </div>
        <div class="flex items-center gap-3">
          <button (click)="goToToday()" class="px-3 py-1 text-sm border rounded hover:bg-gray-50 text-gray-600">Aujourd'hui</button>
          <a routerLink="/reservations/new" class="bg-blue-600 text-white px-4 py-2 rounded shadow hover:bg-blue-700 transition flex items-center"><span class="material-icons text-sm mr-2">add</span> Réservation</a>
        </div>
      </div>

      <div class="flex-1 border rounded-lg overflow-hidden bg-slate-50 flex flex-col">
        <div class="grid grid-cols-7 bg-white border-b">
          @for (day of weekDays; track day) { <div class="py-2 text-center text-sm font-semibold text-slate-500 uppercase">{{ day }}</div> }
        </div>
        <div class="grid grid-cols-7 flex-1 auto-rows-fr">
          @for (day of calendarDays(); track day) {
            <div class="min-h-[120px] bg-white border-b border-r p-1 relative flex flex-col" [class.bg-blue-50]="isToday(day)" [class.bg-slate-50]="!isCurrentMonth(day)">
              <div class="text-right text-xs mb-1 font-medium" [class.text-blue-600]="isToday(day)" [class.text-slate-400]="!isCurrentMonth(day)">{{ day | date:'d' }}</div>
              <div class="flex-1 overflow-y-auto space-y-1 custom-scrollbar">
                @for (res of getReservationsForDay(day); track res.id) {
                  <div (click)="openDetails(res)" class="text-[10px] p-1.5 rounded border-l-4 shadow-sm cursor-pointer truncate bg-white hover:brightness-95 transition"
                       [class.border-green-500]="res.status === 'CONFIRMED'" [class.border-yellow-500]="res.status === 'PENDING'" [class.border-red-500]="res.status === 'CANCELLED'">
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
      <div class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-fade-in" (click)="closeDetails()">
        <div class="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]" (click)="$event.stopPropagation()">
          <div class="bg-gradient-to-r from-slate-800 to-slate-900 px-6 py-4 flex justify-between items-center text-white shrink-0">
            <div><h3 class="font-bold text-xl">{{ selectedReservation()?.clientName }}</h3><p class="text-slate-400 text-xs mt-1">{{ selectedReservation()?.date | date:'fullDate' }}</p></div>
            <button (click)="closeDetails()" class="text-slate-400 hover:text-white"><span class="material-icons">close</span></button>
          </div>
          <div class="p-6 space-y-6 overflow-y-auto custom-scrollbar">
             <div class="bg-purple-50 p-4 rounded-xl border border-purple-100 shadow-sm">
               <div class="flex justify-between items-center mb-3 border-b border-purple-200 pb-2">
                 <span class="text-xs font-bold text-purple-700 uppercase tracking-wider">Trésorerie</span>
                 <button (click)="openPayment()" class="text-purple-600 hover:bg-purple-100 p-1 rounded transition" title="Ajouter paiement"><span class="material-icons text-sm">add</span></button>
               </div>
               <div class="grid grid-cols-3 gap-2 text-center">
                 <div><p class="text-[10px] text-slate-500 uppercase">Total</p><p class="font-bold text-slate-800">{{ getResPrice(selectedReservation()) }} DT</p></div>
                 <div><p class="text-[10px] text-slate-500 uppercase">Reçu</p><p class="font-bold text-emerald-600">{{ getResAdvance(selectedReservation()) }} DT</p></div>
                 <div><p class="text-[10px] text-slate-500 uppercase">Reste</p><p class="font-bold text-red-500">{{ (getResPrice(selectedReservation()) - getResAdvance(selectedReservation())) }} DT</p></div>
               </div>
             </div>
             <div>
               <div class="flex items-center justify-between mb-3">
                 <h4 class="text-xs font-bold text-slate-500 uppercase tracking-wider">Affectation Équipe</h4>
                 <span class="text-xs bg-slate-100 px-2 py-1 rounded text-slate-600 font-bold">{{ (selectedReservation()?.assignedServerIds || []).length }} membres</span>
               </div>
               <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
                 @for (staff of allStaff(); track staff.id) {
                   <div (click)="toggleStaffAssignment(staff.id!)" class="flex items-center p-2 rounded-lg border cursor-pointer select-none transition-all duration-200 hover:shadow-sm"
                        [class.border-emerald-500]="isStaffAssigned(staff.id!)" [class.bg-emerald-50]="isStaffAssigned(staff.id!)" [class.border-slate-200]="!isStaffAssigned(staff.id!)">
                     <div class="w-6 h-6 rounded-full flex items-center justify-center text-[10px] mr-2 transition-colors"
                          [class.bg-emerald-500]="isStaffAssigned(staff.id!)" [class.text-white]="isStaffAssigned(staff.id!)" [class.bg-slate-200]="!isStaffAssigned(staff.id!)" [class.text-slate-400]="!isStaffAssigned(staff.id!)">
                        @if(isStaffAssigned(staff.id!)){ <span class="material-icons text-[14px]">check</span> }
                     </div>
                     <div class="flex-1 min-w-0">
                       <p class="text-sm font-bold truncate" [class.text-emerald-900]="isStaffAssigned(staff.id!)">{{ staff.nom }}</p>
                       <p class="text-[10px] truncate" [class.text-emerald-700]="isStaffAssigned(staff.id!)" [class.text-slate-500]="!isStaffAssigned(staff.id!)">{{ staff.specialite }}</p>
                     </div>
                   </div>
                 }
               </div>
             </div>
          </div>
          <div class="bg-slate-50 px-6 py-4 border-t border-slate-200 flex justify-between shrink-0">
            <button (click)="initiateDelete()" class="text-red-500 hover:bg-red-50 px-3 py-2 rounded text-sm font-bold transition flex items-center"><span class="material-icons text-sm mr-2">delete</span> Supprimer</button>
            <button (click)="editCurrent()" class="bg-slate-800 hover:bg-slate-700 text-white px-5 py-2 rounded text-sm font-bold transition flex items-center"><span class="material-icons text-sm mr-2">edit</span> Éditer tout</button>
          </div>
        </div>
      </div>
    }

    @if (showPaymentModal()) {
      <div class="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm animate-fade-in">
        <div class="bg-white rounded-xl shadow-2xl p-6 w-72">
          <h3 class="font-bold text-lg mb-4 text-center">Ajouter Paiement</h3>
          <div class="mb-4"><input type="number" [(ngModel)]="amountToAdd" class="w-full text-center text-3xl font-bold border-b-2 border-emerald-500 outline-none pb-2 text-slate-800" placeholder="0"><p class="text-center text-xs text-slate-400 mt-1">Montant en TND</p></div>
          <div class="flex gap-2"><button (click)="closePayment()" class="flex-1 py-2 border rounded text-slate-600 hover:bg-slate-50">Annuler</button><button (click)="submitPayment()" class="flex-1 py-2 bg-emerald-600 text-white rounded font-bold hover:bg-emerald-700">Valider</button></div>
        </div>
      </div>
    }

    @if (showDeleteModal()) {
      <div class="fixed inset-0 z-[70] flex items-center justify-center bg-red-900/80 backdrop-blur-sm animate-fade-in">
        <div class="bg-white rounded-xl shadow-2xl p-8 w-96 transform scale-100">
          <div class="flex flex-col items-center mb-6"><div class="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4"><span class="material-icons text-red-600 text-3xl">gpp_maybe</span></div><h3 class="font-bold text-xl text-slate-800 text-center">Zone de Danger</h3><p class="text-sm text-slate-500 text-center mt-2">Vous êtes sur le point de supprimer définitivement cette réservation.</p></div>
          <div class="space-y-4"><div><label class="block text-xs font-bold text-slate-700 uppercase mb-1">Mot de passe Admin</label><input type="password" [(ngModel)]="deletePassword" class="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-red-500 outline-none transition" placeholder="••••••••" (keyup.enter)="confirmDelete()">@if (deleteError()) { <p class="text-xs text-red-600 mt-1 flex items-center animate-pulse"><span class="material-icons text-xs mr-1">error</span> Mot de passe incorrect</p> }</div><button (click)="confirmDelete()" [disabled]="isDeleting()" class="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-3 rounded-lg shadow-lg transition flex justify-center items-center disabled:opacity-70 disabled:cursor-not-allowed">@if (isDeleting()) { <span class="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full mr-2"></span> } Confirmer la suppression</button><button (click)="closeDeleteModal()" class="w-full text-slate-500 hover:text-slate-800 font-medium py-2">Annuler</button></div>
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
  private activityService = inject(ActivityService); // <--- LOGGING
  private router = inject(Router);
  authService = inject(AuthService);

  viewDate = signal(new Date());
  weekDays = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
  reservations = toSignal(this.reservationService.getAll(), { initialValue: [] });
  allStaff = toSignal(this.staffService.getAll(), { initialValue: [] });
  selectedReservation = signal<Reservation | null>(null);

  showPaymentModal = signal(false);
  amountToAdd = 0;
  showDeleteModal = signal(false);
  deletePassword = signal('');
  deleteError = signal(false);
  isDeleting = signal(false);

  // --- ACTIONS ---
  openDetails(res: Reservation) { this.selectedReservation.set(res); }
  closeDetails() { this.selectedReservation.set(null); }
  editCurrent() { const res = this.selectedReservation(); if (res?.id) this.router.navigate(['/reservations/edit', res.id]); }
  
  initiateDelete() { this.deletePassword.set(''); this.deleteError.set(false); this.showDeleteModal.set(true); }
  closeDeleteModal() { this.showDeleteModal.set(false); }
  async confirmDelete() {
    if (!this.deletePassword()) return;
    this.isDeleting.set(true);
    this.deleteError.set(false);
    const isValid = await this.authService.verifyPassword(this.deletePassword());
    if (isValid) {
      const res = this.selectedReservation();
      if (res && res.id) {
        await this.reservationService.delete(res.id);
        this.closeDeleteModal();
        this.closeDetails();
      }
    } else { this.deleteError.set(true); }
    this.isDeleting.set(false);
  }

  isStaffAssigned(staffId: string): boolean { const res = this.selectedReservation(); if (!res || !res.assignedServerIds) return false; return res.assignedServerIds.includes(staffId); }
  async toggleStaffAssignment(staffId: string) { const res = this.selectedReservation(); if (!res || !res.id) return; const currentIds = res.assignedServerIds || []; let newIds = currentIds.includes(staffId) ? currentIds.filter(id => id !== staffId) : [...currentIds, staffId]; await this.reservationService.update(res.id, { assignedServerIds: newIds } as any); this.selectedReservation.update(prev => { if (!prev) return null; return { ...prev, assignedServerIds: newIds }; }); }
  
  getResPrice(res: any) { return Number(res?.totalPrice) || 0; }
  getResAdvance(res: any) { return Number(res?.advance) || 0; }
  openPayment() { this.amountToAdd = 0; this.showPaymentModal.set(true); }
  closePayment() { this.showPaymentModal.set(false); }
  
  async submitPayment() { 
    const res = this.selectedReservation(); 
    if (res && this.amountToAdd > 0) { 
      const newAdvance = this.getResAdvance(res) + this.amountToAdd; 
      // Flag advanceOnly pour éviter le double log générique
      await this.reservationService.update(res.id!, { advance: newAdvance, advanceOnly: true } as any);
      
      // LOGGING EXPLICTE DU PAIEMENT
      this.activityService.log('PAYMENT', 'RESERVATION', `Paiement reçu : ${this.amountToAdd} TND (Client: ${res.clientName})`);

      this.closePayment(); 
      this.selectedReservation.update(prev => { if (!prev) return null; return { ...prev, advance: newAdvance } as any; }); 
    } 
  }

  nextMonth() { this.viewDate.update(d => addMonths(d, 1)); }
  previousMonth() { this.viewDate.update(d => subMonths(d, 1)); }
  goToToday() { this.viewDate.set(new Date()); }
  currentMonthLabel = computed(() => format(this.viewDate(), 'MMMM yyyy', { locale: fr }));
  calendarDays = computed(() => eachDayOfInterval({ start: startOfWeek(startOfMonth(this.viewDate()), { weekStartsOn: 1 }), end: endOfWeek(endOfMonth(this.viewDate()), { weekStartsOn: 1 }) }));
  isToday(d: Date) { return isToday(d); }
  isCurrentMonth(d: Date) { return isSameMonth(d, this.viewDate()); }
  getReservationsForDay(date: Date): Reservation[] { return this.reservations().filter(r => r.date === format(date, 'yyyy-MM-dd')); }
}
