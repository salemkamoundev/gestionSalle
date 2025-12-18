#!/bin/bash

# 1. Mise à jour de AuthService pour inclure la vérification du mot de passe
# On ajoute la méthode 'verifyPassword'
cat > src/app/core/services/auth.service.ts <<EOF
import { Injectable, inject, signal } from '@angular/core';
import { Auth, signInWithEmailAndPassword, signOut, user, User, reauthenticateWithCredential, EmailAuthProvider } from '@angular/fire/auth';
import { Router } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private auth = inject(Auth);
  private router = inject(Router);

  userState = toSignal(user(this.auth));

  async login(email: string, pass: string) {
    return await signInWithEmailAndPassword(this.auth, email, pass);
  }

  async logout() {
    await signOut(this.auth);
    this.router.navigate(['/login']);
  }

  // NOUVELLE MÉTHODE : Vérifie le mot de passe de l'utilisateur actuel
  async verifyPassword(password: string): Promise<boolean> {
    const user = this.auth.currentUser;
    if (!user || !user.email) return false;

    try {
      // On crée les crédentials avec l'email actuel et le mot de passe saisi
      const credential = EmailAuthProvider.credential(user.email, password);
      // On tente de ré-authentifier
      await reauthenticateWithCredential(user, credential);
      return true;
    } catch (e) {
      console.error('Erreur vérification mot de passe', e);
      return false;
    }
  }
}
EOF

# 2. Mise à jour du Calendrier pour demander le mot de passe
TARGET_CALENDAR="src/app/features/calendar/calendar-view/calendar-view.component.ts"

cat > $TARGET_CALENDAR <<EOF
import { Component, inject, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReservationService } from '../../../core/services/reservation.service';
import { AuthService } from '../../../core/services/auth.service';
import { StaffService } from '../../../core/services/staff.service';
import { ActivityService } from '../../../core/services/activity.service';
import { UiService } from '../../../core/services/ui.service';
import { RouterLink, Router } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { startOfMonth, endOfMonth, startOfWeek, endOfWeek, format, addMonths, subMonths, eachDayOfInterval, isSameMonth, isToday, setMonth, setYear } from 'date-fns';
import { Reservation } from '../../../core/models/reservation.model';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-calendar-view',
  standalone: true,
  imports: [CommonModule, RouterLink, FormsModule],
  template: \`
    <div class="p-4 md:p-6 bg-white min-h-screen flex flex-col">
      
      <div class="flex flex-col lg:flex-row justify-between items-center mb-4 gap-4">
        <div class="flex items-center bg-slate-50 p-1 rounded-xl border border-slate-200 shadow-sm">
          <button (click)="previousMonth()" class="p-2 rounded-lg hover:bg-white hover:shadow-sm text-slate-500 hover:text-slate-800 transition"><span class="material-icons">chevron_left</span></button>
          <div class="flex items-center gap-2 mx-2">
            <div class="relative">
              <select [ngModel]="currentMonthIndex()" (ngModelChange)="onMonthChange(\$event)" class="appearance-none bg-white border border-slate-200 text-slate-800 font-bold py-1.5 pl-3 pr-8 rounded-lg cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500 hover:border-blue-300 transition capitalize text-sm">
                @for (m of monthsList; track \$index) { <option [value]="\$index">{{ m }}</option> }
              </select>
              <span class="material-icons absolute right-2 top-2 text-slate-400 pointer-events-none text-sm">arrow_drop_down</span>
            </div>
            <div class="relative">
              <select [ngModel]="currentYear()" (ngModelChange)="onYearChange(\$event)" class="appearance-none bg-white border border-slate-200 text-slate-800 font-bold py-1.5 pl-3 pr-8 rounded-lg cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500 hover:border-blue-300 transition text-sm">
                @for (y of yearsList(); track y) { <option [value]="y">{{ y }}</option> }
              </select>
              <span class="material-icons absolute right-2 top-2 text-slate-400 pointer-events-none text-sm">arrow_drop_down</span>
            </div>
          </div>
          <button (click)="nextMonth()" class="p-2 rounded-lg hover:bg-white hover:shadow-sm text-slate-500 hover:text-slate-800 transition"><span class="material-icons">chevron_right</span></button>
        </div>
        <div class="flex items-center gap-3 w-full lg:w-auto justify-end">
          <button (click)="goToToday()" class="px-3 py-1.5 text-sm font-medium text-slate-600 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg transition flex items-center"><span class="material-icons text-sm mr-1">today</span> Aujourd'hui</button>
          <a routerLink="/reservations/new" class="bg-blue-600 hover:bg-blue-700 text-white px-4 py-1.5 rounded-lg shadow-md hover:shadow-lg transition flex items-center font-bold whitespace-nowrap text-sm"><span class="material-icons text-sm mr-2">add</span> Réservation</a>
        </div>
      </div>

      <div class="flex-1 border rounded-lg overflow-hidden bg-slate-50 flex flex-col shadow-sm">
        <div class="grid grid-cols-7 bg-white border-b divide-x divide-slate-100">
          @for (day of weekDays; track day) { <div class="py-2 text-center text-[10px] font-bold text-slate-500 uppercase tracking-wider bg-slate-50/50">{{ day }}</div> }
        </div>
        <div class="grid grid-cols-7 flex-1 auto-rows-fr divide-x divide-y divide-slate-100">
          @for (day of calendarDays(); track day) {
            <div class="min-h-[150px] bg-white relative flex flex-col group transition hover:shadow-inner" [class.bg-blue-50]="isToday(day)" [class.bg-slate-50]="!isCurrentMonth(day)">
              <div class="absolute top-0.5 right-0.5 z-10 pointer-events-none"><span class="text-[9px] font-bold w-4 h-4 flex items-center justify-center rounded-full" [class.bg-blue-600]="isToday(day)" [class.text-white]="isToday(day)" [class.text-slate-400]="!isCurrentMonth(day)" [class.text-slate-600]="isCurrentMonth(day) && !isToday(day)">{{ day | date:'d' }}</span></div>
              
              <div (click)="onSlotClick(day, '08:00')" class="flex-1 border-b border-dashed border-slate-100 relative cursor-pointer hover:bg-yellow-50/50 transition-colors p-0.5">
                <span class="absolute top-0.5 left-1 text-[7px] text-slate-300 font-bold uppercase tracking-widest pointer-events-none group-hover:text-slate-400">Matin</span>
                @for (res of getResForSlot(day, 1); track res.id) {
                  <div (click)="openDetails(res); \$event.stopPropagation()" class="absolute inset-0.5 rounded bg-yellow-100 border-l-2 border-yellow-400 shadow-sm flex flex-col justify-center px-1 hover:brightness-95 transition">
                    <div class="text-[9px] font-bold text-yellow-900 truncate leading-tight">{{ res.clientName }}</div>
                    <div class="text-[8px] text-yellow-700 leading-tight">{{ res.startTime }}</div>
                  </div>
                }
              </div>

              <div (click)="onSlotClick(day, '13:00')" class="flex-1 border-b border-dashed border-slate-100 relative cursor-pointer hover:bg-orange-50/50 transition-colors p-0.5">
                <span class="absolute top-0.5 left-1 text-[7px] text-slate-300 font-bold uppercase tracking-widest pointer-events-none group-hover:text-slate-400">Aprèm</span>
                @for (res of getResForSlot(day, 2); track res.id) {
                  <div (click)="openDetails(res); \$event.stopPropagation()" class="absolute inset-0.5 rounded bg-orange-100 border-l-2 border-orange-400 shadow-sm flex flex-col justify-center px-1 hover:brightness-95 transition">
                    <div class="text-[9px] font-bold text-orange-900 truncate leading-tight">{{ res.clientName }}</div>
                    <div class="text-[8px] text-orange-700 leading-tight">{{ res.startTime }}</div>
                  </div>
                }
              </div>

              <div (click)="onSlotClick(day, '19:00')" class="flex-1 relative cursor-pointer hover:bg-indigo-50/50 transition-colors p-0.5">
                <span class="absolute top-0.5 left-1 text-[7px] text-slate-300 font-bold uppercase tracking-widest pointer-events-none group-hover:text-slate-400">Soir</span>
                @for (res of getResForSlot(day, 3); track res.id) {
                  <div (click)="openDetails(res); \$event.stopPropagation()" class="absolute inset-0.5 rounded bg-indigo-100 border-l-2 border-indigo-400 shadow-sm flex flex-col justify-center px-1 hover:brightness-95 transition">
                    <div class="text-[9px] font-bold text-indigo-900 truncate leading-tight">{{ res.clientName }}</div>
                    <div class="text-[8px] text-indigo-700 leading-tight">{{ res.startTime }}</div>
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
        <div class="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]" (click)="\$event.stopPropagation()">
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
          <div class="bg-slate-50 px-6 py-4 border-t border-slate-200 flex justify-between shrink-0">
            <button (click)="openDeleteModal()" class="text-red-500 hover:bg-red-50 px-3 py-2 rounded text-sm font-bold transition flex items-center"><span class="material-icons text-sm mr-2">delete</span> Supprimer</button>
            <button (click)="editCurrent()" class="bg-slate-800 hover:bg-slate-700 text-white px-5 py-2 rounded text-sm font-bold transition flex items-center"><span class="material-icons text-sm mr-2">edit</span> Éditer tout</button>
          </div>
        </div>
      </div>
    }

    @if (showPaymentModal()) { 
      <div class="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm animate-fade-in"><div class="bg-white rounded-xl shadow-2xl p-6 w-72"><h3 class="font-bold text-lg mb-4 text-center">Ajouter Paiement</h3><div class="mb-4"><input type="number" [(ngModel)]="amountToAdd" class="w-full text-center text-3xl font-bold border-b-2 border-emerald-500 outline-none pb-2 text-slate-800" placeholder="0"><p class="text-center text-xs text-slate-400 mt-1">Montant en TND</p></div><div class="flex gap-2"><button (click)="closePayment()" class="flex-1 py-2 border rounded text-slate-600 hover:bg-slate-50">Annuler</button><button (click)="submitPayment()" class="flex-1 py-2 bg-emerald-600 text-white rounded font-bold hover:bg-emerald-700">Valider</button></div></div></div> 
    }

    @if (showDeleteModal()) {
      <div class="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 backdrop-blur-md animate-fade-in">
        <div class="bg-white rounded-xl shadow-2xl p-6 w-80 md:w-96 border-t-4 border-red-600">
          <div class="text-center mb-6">
            <div class="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-3">
              <span class="material-icons text-red-600">lock</span>
            </div>
            <h3 class="font-bold text-lg text-slate-800">Sécurité Requise</h3>
            <p class="text-sm text-slate-500 mt-1">Veuillez saisir votre mot de passe administrateur pour confirmer la suppression.</p>
          </div>
          
          <div class="mb-6">
            <input type="password" [(ngModel)]="deletePassword" class="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-red-500 outline-none text-center" placeholder="Mot de passe" (keyup.enter)="confirmDeleteWithPassword()">
            @if (deleteError()) { <p class="text-xs text-red-500 text-center mt-2 font-bold">{{ deleteError() }}</p> }
          </div>

          <div class="flex gap-3">
            <button (click)="closeDeleteModal()" class="flex-1 py-2 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 font-medium transition">Annuler</button>
            <button (click)="confirmDeleteWithPassword()" [disabled]="isVerifying()" class="flex-1 py-2 bg-red-600 text-white rounded-lg font-bold hover:bg-red-700 shadow-md disabled:opacity-50 transition flex items-center justify-center">
              @if(isVerifying()) { <span class="material-icons animate-spin text-sm">refresh</span> } 
              @else { <span>Confirmer</span> }
            </button>
          </div>
        </div>
      </div>
    }

  \`,
  styles: [\` .custom-scrollbar::-webkit-scrollbar { width: 4px; } .custom-scrollbar::-webkit-scrollbar-track { background: transparent; } .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 2px; } @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } } .animate-fade-in { animation: fadeIn 0.2s ease-out; } \`]
})
export class CalendarViewComponent {
  private reservationService = inject(ReservationService);
  private staffService = inject(StaffService);
  private activityService = inject(ActivityService);
  private authService = inject(AuthService); // Inject Auth Service
  private ui = inject(UiService);
  private router = inject(Router);

  viewDate = signal(new Date());
  weekDays = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
  monthsList = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];
  reservations = toSignal(this.reservationService.getAll(), { initialValue: [] });
  allStaff = toSignal(this.staffService.getAll(), { initialValue: [] });
  
  currentMonthIndex = computed(() => this.viewDate().getMonth());
  currentYear = computed(() => this.viewDate().getFullYear());
  yearsList = computed(() => { const current = new Date().getFullYear(); const years = []; for (let i = current - 2; i <= current + 5; i++) { years.push(i); } return years; });
  calendarDays = computed(() => eachDayOfInterval({ start: startOfWeek(startOfMonth(this.viewDate()), { weekStartsOn: 1 }), end: endOfWeek(endOfMonth(this.viewDate()), { weekStartsOn: 1 }) }));
  
  nextMonth() { this.viewDate.update(d => addMonths(d, 1)); }
  previousMonth() { this.viewDate.update(d => subMonths(d, 1)); }
  goToToday() { this.viewDate.set(new Date()); }
  onMonthChange(m: string) { this.viewDate.update(d => setMonth(d, parseInt(m, 10))); }
  onYearChange(y: string) { this.viewDate.update(d => setYear(d, parseInt(y, 10))); }

  selectedReservation = signal<Reservation | null>(null);
  
  // States Modal Paiement
  showPaymentModal = signal(false); amountToAdd = 0;

  // States Modal Password Delete
  showDeleteModal = signal(false);
  deletePassword = '';
  deleteError = signal('');
  isVerifying = signal(false);

  isToday(d: Date) { return isToday(d); }
  isCurrentMonth(d: Date) { return isSameMonth(d, this.viewDate()); }
  
  getResForSlot(day: Date, slot: number): Reservation[] {
    const dayStr = format(day, 'yyyy-MM-dd');
    const dayRes = this.reservations().filter(r => r.date === dayStr);
    return dayRes.filter(r => {
      const hour = parseInt(r.startTime.split(':')[0], 10);
      if (slot === 1) return hour < 12;
      if (slot === 2) return hour >= 12 && hour < 18;
      if (slot === 3) return hour >= 18;
      return false;
    });
  }

  onSlotClick(day: Date, timeHint: string) { 
    const dateStr = format(day, 'yyyy-MM-dd');
    this.router.navigate(['/reservations/new'], { queryParams: { date: dateStr, startTime: timeHint } }); 
  }
  openDetails(res: Reservation) { this.selectedReservation.set(res); }
  closeDetails() { this.selectedReservation.set(null); }
  editCurrent() { const res = this.selectedReservation(); if (res?.id) this.router.navigate(['/reservations/edit', res.id]); }

  // --- LOGIQUE SUPPRESSION SÉCURISÉE ---
  openDeleteModal() {
    this.deletePassword = '';
    this.deleteError.set('');
    this.showDeleteModal.set(true);
  }

  closeDeleteModal() {
    this.showDeleteModal.set(false);
  }

  async confirmDeleteWithPassword() {
    if (!this.deletePassword) {
      this.deleteError.set('Mot de passe requis');
      return;
    }

    this.isVerifying.set(true);
    this.deleteError.set('');

    const isValid = await this.authService.verifyPassword(this.deletePassword);

    if (isValid) {
      const res = this.selectedReservation();
      if (res && res.id) {
        await this.reservationService.delete(res.id);
        this.activityService.log('DELETE', 'RESERVATION', \`Suppression résa par Admin\`);
        this.ui.showToast('success', 'Réservation supprimée définitivement');
        this.closeDeleteModal();
        this.closeDetails();
      }
    } else {
      this.deleteError.set('Mot de passe incorrect');
    }
    this.isVerifying.set(false);
  }
  // -------------------------------------

  isStaffAssigned(staffId: string): boolean { const res = this.selectedReservation(); if (!res || !res.assignedServerIds) return false; return res.assignedServerIds.includes(staffId); }
  async toggleStaffAssignment(staffId: string) { const res = this.selectedReservation(); if (!res || !res.id) return; const currentIds = res.assignedServerIds || []; let newIds = currentIds.includes(staffId) ? currentIds.filter(id => id !== staffId) : [...currentIds, staffId]; await this.reservationService.update(res.id, { assignedServerIds: newIds } as any); this.selectedReservation.update(prev => { if (!prev) return null; return { ...prev, assignedServerIds: newIds }; }); }
  getResPrice(res: any) { return Number(res?.totalPrice) || 0; }
  getResAdvance(res: any) { return Number(res?.advance) || 0; }
  openPayment() { this.amountToAdd = 0; this.showPaymentModal.set(true); }
  closePayment() { this.showPaymentModal.set(false); }
  async submitPayment() { const res = this.selectedReservation(); if (res && this.amountToAdd > 0) { const newAdvance = this.getResAdvance(res) + this.amountToAdd; await this.reservationService.update(res.id!, { advance: newAdvance, advanceOnly: true } as any); this.activityService.log('PAYMENT', 'RESERVATION', \`Paiement reçu : \${this.amountToAdd} TND (Client: \${res.clientName})\`); this.ui.showToast('success', 'Paiement enregistré'); this.closePayment(); this.selectedReservation.update(prev => { if (!prev) return null; return { ...prev, advance: newAdvance } as any; }); } }
}
EOF

echo "Sécurité renforcée : Demande de mot de passe activée pour la suppression."