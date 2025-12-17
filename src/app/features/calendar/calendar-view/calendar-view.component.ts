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
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-calendar-view',
  standalone: true,
  imports: [CommonModule, RouterLink, FormsModule],
  template: `
    <div class="p-6 bg-white min-h-screen flex flex-col">
      <div class="flex justify-between items-center mb-6">
        <h2 class="text-2xl font-bold text-slate-800 capitalize">{{ currentMonthLabel() }}</h2>
        <div class="flex gap-2">
          <button (click)="previousMonth()" class="p-2 border rounded"><span class="material-icons">chevron_left</span></button>
          <button (click)="nextMonth()" class="p-2 border rounded"><span class="material-icons">chevron_right</span></button>
          <a routerLink="/reservations/new" class="bg-blue-600 text-white px-4 py-2 rounded shadow flex items-center"><span class="material-icons text-sm mr-2">add</span> Réservation</a>
        </div>
      </div>

      <div class="flex-1 border rounded-lg overflow-hidden bg-slate-50 flex flex-col">
        <div class="grid grid-cols-7 bg-white border-b">
          @for (day of weekDays; track day) { <div class="py-2 text-center text-sm font-semibold text-slate-500 uppercase">{{ day }}</div> }
        </div>
        <div class="grid grid-cols-7 flex-1 auto-rows-fr">
          @for (day of calendarDays(); track day) {
            <div class="min-h-[100px] bg-white border-b border-r p-1 relative" [class.bg-blue-50]="isToday(day)">
              <div class="text-right text-xs mb-1 text-slate-400">{{ day | date:'d' }}</div>
              <div class="space-y-1">
                @for (res of getReservationsForDay(day); track res.id) {
                  <div (click)="openDetails(res)" class="text-[10px] p-1 rounded border-l-2 shadow-sm cursor-pointer truncate bg-white border-green-500 hover:brightness-95">
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
      <div class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4" (click)="closeDetails()">
        <div class="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden" (click)="$event.stopPropagation()">
          
          <div class="bg-slate-900 px-6 py-4 flex justify-between items-center text-white">
            <h3 class="font-bold text-lg">{{ selectedReservation()?.clientName }}</h3>
            <button (click)="closeDetails()"><span class="material-icons">close</span></button>
          </div>

          <div class="p-6 space-y-4">
             <div class="bg-purple-50 p-4 rounded-lg border border-purple-100">
               <div class="flex justify-between items-center mb-2">
                 <span class="text-xs font-bold text-purple-700 uppercase">État Financier</span>
                 <span class="material-icons text-purple-300">account_balance_wallet</span>
               </div>
               
               <div class="flex justify-between text-sm">
                 <span class="text-slate-500">Total :</span>
                 <span class="font-bold text-slate-800">{{ getResPrice(selectedReservation()) | number:'1.2-2' }} TND</span>
               </div>
               <div class="flex justify-between text-sm mt-1">
                 <span class="text-slate-500">Payé :</span>
                 <span class="font-bold text-emerald-600">{{ getResAdvance(selectedReservation()) | number:'1.2-2' }} TND</span>
               </div>
               <div class="border-t border-purple-200 mt-2 pt-2 flex justify-between text-sm">
                 <span class="text-slate-500 font-bold">Reste :</span>
                 <span class="font-bold text-red-500">{{ (getResPrice(selectedReservation()) - getResAdvance(selectedReservation())) | number:'1.2-2' }} TND</span>
               </div>

               <button (click)="openPayment()" class="w-full mt-3 bg-emerald-600 hover:bg-emerald-700 text-white py-2 rounded shadow flex justify-center items-center text-sm font-bold transition">
                 <span class="material-icons text-sm mr-2">add_card</span> Encaisser / Ajouter Avance
               </button>
             </div>

             <div class="text-sm space-y-2 text-slate-600">
               <p><span class="font-bold">Date :</span> {{ selectedReservation()?.date | date }}</p>
               <p><span class="font-bold">Heure :</span> {{ selectedReservation()?.startTime }} - {{ selectedReservation()?.endTime }}</p>
             </div>
          </div>

          <div class="bg-slate-50 px-6 py-4 flex justify-between">
            <button (click)="deleteCurrent()" class="text-red-500 hover:bg-red-50 px-3 py-2 rounded text-sm font-bold">Supprimer</button>
            <button (click)="editCurrent()" class="bg-slate-800 text-white px-4 py-2 rounded text-sm font-bold">Modifier</button>
          </div>
        </div>
      </div>
    }

    @if (showPaymentModal()) {
      <div class="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm">
        <div class="bg-white rounded-xl shadow-2xl p-6 w-72 transform scale-100 animate-fade-in">
          <h3 class="font-bold text-lg mb-4 text-center">Ajouter un Paiement</h3>
          
          <div class="mb-4">
            <label class="block text-xs font-bold text-slate-500 uppercase mb-1">Montant à ajouter</label>
            <input type="number" [(ngModel)]="amountToAdd" class="w-full text-center text-2xl font-bold border-b-2 border-emerald-500 outline-none pb-1 focus:border-emerald-700" placeholder="0">
          </div>

          <div class="flex gap-2">
            <button (click)="closePayment()" class="flex-1 py-2 border rounded text-slate-600 hover:bg-slate-50">Annuler</button>
            <button (click)="submitPayment()" class="flex-1 py-2 bg-emerald-600 text-white rounded font-bold hover:bg-emerald-700">Valider</button>
          </div>
        </div>
      </div>
    }
  `,
  styles: [`
    @keyframes fadeIn { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }
    .animate-fade-in { animation: fadeIn 0.2s ease-out; }
  `]
})
export class CalendarViewComponent {
  private reservationService = inject(ReservationService);
  private router = inject(Router);
  authService = inject(AuthService);

  viewDate = signal(new Date());
  weekDays = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
  reservations = toSignal(this.reservationService.getAll(), { initialValue: [] });
  selectedReservation = signal<Reservation | null>(null);

  // Paiement
  showPaymentModal = signal(false);
  amountToAdd = 0;

  getResPrice(res: any) { return Number(res?.totalPrice) || 0; }
  getResAdvance(res: any) { return Number(res?.advance) || 0; }

  openPayment() { this.amountToAdd = 0; this.showPaymentModal.set(true); }
  closePayment() { this.showPaymentModal.set(false); }
  
  async submitPayment() {
    const res = this.selectedReservation();
    if (res && this.amountToAdd > 0) {
      const currentAdvance = this.getResAdvance(res);
      const newAdvance = currentAdvance + this.amountToAdd;
      
      await this.reservationService.update(res.id!, { advance: newAdvance } as any);
      
      // Update local (optionnel car Firestore le fera via le signal, mais bon pour UI immédiate)
      this.closePayment();
      this.closeDetails(); // On ferme tout pour rafraichir
    }
  }

  openDetails(res: Reservation) { this.selectedReservation.set(res); }
  closeDetails() { this.selectedReservation.set(null); }
  editCurrent() { const res = this.selectedReservation(); if (res?.id) this.router.navigate(['/reservations/edit', res.id]); }
  async deleteCurrent() { const res = this.selectedReservation(); if (res?.id && confirm('Supprimer ?')) { await this.reservationService.delete(res.id); this.closeDetails(); } }

  nextMonth() { this.viewDate.update(d => addMonths(d, 1)); }
  previousMonth() { this.viewDate.update(d => subMonths(d, 1)); }
  goToToday() { this.viewDate.set(new Date()); }
  currentMonthLabel = computed(() => format(this.viewDate(), 'MMMM yyyy', { locale: fr }));
  calendarDays = computed(() => eachDayOfInterval({ start: startOfWeek(startOfMonth(this.viewDate()), { weekStartsOn: 1 }), end: endOfWeek(endOfMonth(this.viewDate()), { weekStartsOn: 1 }) }));
  isToday(d: Date) { return isToday(d); }
  getReservationsForDay(date: Date): Reservation[] { return this.reservations().filter(r => r.date === format(date, 'yyyy-MM-dd')); }
}
