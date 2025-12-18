#!/bin/bash

# 1. Mise à jour de la MODALE DE PAIEMENT (Pré-remplissage)
TARGET_MODAL="src/app/features/payments/payment-modal/payment-modal.component.ts"

cat > $TARGET_MODAL <<EOF
import { Component, inject, input, output, signal, computed, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { PaymentService } from '../../../core/services/payment.service';
import { ReservationService } from '../../../core/services/reservation.service';
import { UiService } from '../../../core/services/ui.service';
import { Payment } from '../../../core/models/payment.model';
import { Reservation } from '../../../core/models/reservation.model';
import { toSignal } from '@angular/core/rxjs-interop';
import { DatePipe } from '@angular/common';

@Component({
  selector: 'app-payment-modal',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  providers: [DatePipe],
  template: \`
    <div class="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in" (click)="close()">
      <div class="bg-white rounded-lg shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col max-h-[90vh]" (click)="\$event.stopPropagation()">
        
        <div class="bg-white px-6 py-4 border-b border-slate-200 flex justify-between items-center">
          <div>
            <h3 class="font-bold text-xl text-slate-800">Gestion des Règlements</h3>
            <p class="text-sm text-slate-500">
              @if (currentRes()) {
                Réservation : {{ currentRes()?.clientName }}
              } @else {
                Sélectionnez une réservation
              }
            </p>
          </div>
          <button (click)="close()" class="text-slate-400 hover:text-slate-600 transition"><span class="material-icons">close</span></button>
        </div>

        <div class="p-6 overflow-y-auto bg-slate-50 flex-1 space-y-6">
          
          @if (!reservationInput() && !paymentToEdit()) {
            <div class="bg-white p-4 rounded-lg shadow-sm border border-slate-200 border-l-4 border-l-purple-500">
              <label class="block text-xs font-bold text-slate-500 mb-2">Rechercher une réservation</label>
              <div class="relative group">
                <span class="material-icons absolute left-3 top-2.5 text-slate-400 text-sm">search</span>
                <input type="text" [value]="searchRes()" (input)="onSearchInput(\$event)" (change)="onResSelected(\$event)" list="reservationsOptions" placeholder="Tapez le nom du client..." class="w-full pl-9 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none text-sm font-bold text-slate-700">
                <datalist id="reservationsOptions">
                  @for (res of allReservations(); track res.id) { <option [value]="formatResLabel(res)"></option> }
                </datalist>
                @if(searchRes()) { <button (click)="clearSelection()" class="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600"><span class="material-icons text-sm">close</span></button> }
              </div>
            </div>
          }

          @if (currentRes()) {
            <div class="animate-fade-in space-y-6">
              
              <div class="bg-white p-4 rounded-lg shadow-sm border border-slate-200">
                <h4 class="font-bold text-slate-700 mb-3 text-sm uppercase tracking-wide border-b pb-2">
                  {{ isEditMode() ? 'Modifier le règlement' : 'Ajouter règlement' }}
                </h4>
                
                <form [formGroup]="form" (ngSubmit)="submit()">
                  <div class="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
                    <div class="md:col-span-3"><label class="block text-xs font-bold text-slate-500 mb-1">Type</label><select formControlName="type" class="w-full px-3 py-2 border border-slate-300 rounded focus:ring-2 focus:ring-purple-500 outline-none text-sm bg-white"><option value="ESPECES">Espèces</option><option value="CHEQUE">Chèque</option><option value="VIREMENT">Virement</option></select></div>
                    
                    <div class="md:col-span-3">
                      <label class="block text-xs font-bold text-slate-500 mb-1">Montant (DT)</label>
                      <input type="number" formControlName="amount" placeholder="0.00" class="w-full px-3 py-2 border border-slate-300 rounded focus:ring-2 focus:ring-purple-500 outline-none text-sm font-bold text-right">
                    </div>

                    <div class="md:col-span-3"><label class="block text-xs font-bold text-slate-500 mb-1">Date</label><input type="date" formControlName="date" class="w-full px-3 py-2 border border-slate-300 rounded focus:ring-2 focus:ring-purple-500 outline-none text-sm"></div>
                    <div class="md:col-span-3"><label class="block text-xs font-bold text-slate-500 mb-1">N° Reçu</label><input type="text" formControlName="receiptNumber" placeholder="Auto" class="w-full px-3 py-2 border border-slate-300 rounded focus:ring-2 focus:ring-purple-500 outline-none text-sm"></div>
                    @if (form.value.type === 'CHEQUE') {
                      <div class="md:col-span-4 animate-fade-in"><label class="block text-xs font-bold text-slate-500 mb-1">N° Chèque</label><input type="text" formControlName="checkNumber" class="w-full px-3 py-2 border border-slate-300 rounded focus:ring-2 focus:ring-purple-500 outline-none text-sm"></div>
                      <div class="md:col-span-4 animate-fade-in"><label class="block text-xs font-bold text-slate-500 mb-1">Date Échéance</label><input type="date" formControlName="checkDate" class="w-full px-3 py-2 border border-slate-300 rounded focus:ring-2 focus:ring-purple-500 outline-none text-sm"></div>
                      <div class="md:col-span-4"></div>
                    }
                    <div class="md:col-span-12 flex justify-end gap-2 mt-2">
                      @if(isEditMode()) { <button type="button" (click)="resetForm()" class="px-3 py-2 bg-slate-100 text-slate-600 rounded text-xs font-bold hover:bg-slate-200 transition">Annuler</button> }
                      <button type="submit" [disabled]="form.invalid || isSubmitting()" class="px-4 py-2 bg-blue-600 text-white rounded text-sm font-bold shadow hover:bg-blue-700 transition flex items-center disabled:opacity-50">
                        @if(isSubmitting()){ <span class="material-icons text-sm animate-spin mr-2">refresh</span> } {{ isEditMode() ? 'Mettre à jour' : 'Ajouter' }}
                      </button>
                    </div>
                  </div>
                </form>
              </div>

              <div>
                <h4 class="font-bold text-slate-700 mb-2 text-sm">Historique pour cette réservation</h4>
                <div class="bg-white border border-slate-200 rounded-lg overflow-hidden shadow-sm">
                  <table class="w-full text-left">
                    <thead class="bg-purple-700 text-white"><tr><th class="px-4 py-2 text-xs font-semibold uppercase">Date</th><th class="px-4 py-2 text-xs font-semibold uppercase">Type</th><th class="px-4 py-2 text-xs font-semibold uppercase">Info</th><th class="px-4 py-2 text-xs font-semibold uppercase text-right">Montant</th><th class="px-4 py-2 text-xs font-semibold uppercase text-center">Actions</th></tr></thead>
                    <tbody class="divide-y divide-slate-100">
                      @for (pay of payments(); track pay.id) {
                        <tr class="hover:bg-purple-50/30 transition text-sm" [class.bg-yellow-50]="editId === pay.id">
                          <td class="px-4 py-3 text-slate-700">{{ pay.date | date:'dd/MM/yyyy' }}</td>
                          <td class="px-4 py-3"><span class="px-2 py-0.5 rounded text-[10px] font-bold uppercase border">{{ pay.type }}</span></td>
                          <td class="px-4 py-3 text-slate-600 text-xs">{{ pay.type === 'CHEQUE' ? (pay.checkNumber || 'N/A') : (pay.receiptNumber || '-') }}</td>
                          <td class="px-4 py-3 text-right font-bold text-slate-800">{{ pay.amount | number:'1.0-2' }} DT</td>
                          <td class="px-4 py-3 text-center">
                            <div class="flex justify-center gap-2">
                              <button (click)="edit(pay)" class="text-blue-400 hover:text-blue-600"><span class="material-icons text-lg">edit</span></button>
                              <button (click)="delete(pay)" class="text-red-400 hover:text-red-600"><span class="material-icons text-lg">delete</span></button>
                            </div>
                          </td>
                        </tr>
                      } @empty { <tr><td colspan="5" class="px-4 py-8 text-center text-slate-400 italic">Aucun règlement.</td></tr> }
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          } @else {
             <div class="flex flex-col items-center justify-center py-12 text-slate-400"><span class="material-icons text-5xl mb-4 opacity-20">search</span><p>Veuillez sélectionner une réservation.</p></div>
          }
        </div>
        
        @if (currentRes()) {
          <div class="bg-slate-50 px-6 py-4 border-t border-slate-200 flex justify-between items-center gap-4 animate-fade-in">
             <button (click)="close()" class="px-4 py-2 border border-slate-300 rounded bg-white text-slate-600 font-bold hover:bg-slate-100">Fermer</button>
             <div class="flex gap-4 text-right">
               <div><p class="text-xs text-slate-500 uppercase font-bold">Total</p><p class="text-lg font-bold text-slate-800">{{ totalResPrice() | number:'1.0-2' }}</p></div>
               <div><p class="text-xs text-purple-600 uppercase font-bold">Total Payé</p><p class="text-lg font-bold text-purple-700">{{ totalPaid() | number:'1.0-2' }}</p></div>
               <div><p class="text-xs text-red-500 uppercase font-bold">Reste</p><p class="text-xl font-bold text-red-600">{{ remaining() | number:'1.0-2' }}</p></div>
             </div>
          </div>
        } @else { <div class="bg-slate-50 px-6 py-4 border-t border-slate-200 flex justify-end"><button (click)="close()" class="px-4 py-2 border border-slate-300 rounded bg-white text-slate-600 font-bold">Fermer</button></div> }
      </div>
    </div>
  \`
})
export class PaymentModalComponent {
  reservationInput = input<Reservation | null>(null, { alias: 'reservation' });
  paymentToEdit = input<Payment | null>(null, { alias: 'paymentToEdit' });
  onClose = output<void>();

  private fb = inject(FormBuilder);
  private paymentService = inject(PaymentService);
  private reservationService = inject(ReservationService);
  private ui = inject(UiService);
  private datePipe = inject(DatePipe);

  currentRes = signal<Reservation | null>(null);
  allReservations = toSignal(this.reservationService.getAll(), { initialValue: [] });
  searchRes = signal('');
  
  payments = signal<Payment[]>([]);
  isEditMode = signal(false);
  isSubmitting = signal(false);
  editId: string | null = null;

  form = this.fb.group({ type: ['ESPECES', Validators.required], amount: [0, [Validators.required, Validators.min(1)]], date: [new Date().toISOString().split('T')[0], Validators.required], receiptNumber: [''], checkNumber: [''], checkDate: [''] });
  
  totalResPrice = computed(() => Number(this.currentRes()?.totalPrice) || 0);
  totalPaid = computed(() => this.payments().reduce((sum, p) => sum + Number(p.amount), 0));
  remaining = computed(() => this.totalResPrice() - this.totalPaid());

  constructor() {
    effect(() => {
      const inputRes = this.reservationInput();
      if (inputRes) { this.selectReservation(inputRes); }

      const payEdit = this.paymentToEdit();
      if (payEdit) {
        this.reservationService.getById(payEdit.reservationId).subscribe(res => {
          if (res) { this.selectReservation(res as Reservation); setTimeout(() => this.edit(payEdit), 100); }
        });
      }
    }, { allowSignalWrites: true });
  }

  formatResLabel(res: Reservation): string { const dateStr = this.datePipe.transform(res.date, 'dd/MM/yyyy'); return \`\${res.clientName} - \${dateStr} (\${res.totalPrice} DT)\`; }
  onSearchInput(event: any) { this.searchRes.set(event.target.value); }
  onResSelected(event: any) { const found = this.allReservations().find(r => this.formatResLabel(r) === event.target.value); if (found) this.selectReservation(found); }
  clearSelection() { this.searchRes.set(''); this.currentRes.set(null); this.payments.set([]); }
  
  selectReservation(res: Reservation) { 
    this.currentRes.set(res); 
    this.searchRes.set(this.formatResLabel(res)); 
    this.loadPayments(res.id!); 
    
    // CALCUL DU RESTE À PAYER POUR PRÉ-REMPLIR
    const total = Number(res.totalPrice) || 0;
    const paid = Number(res.advance) || 0;
    const toPay = Math.max(0, total - paid);

    this.form.patchValue({ 
      amount: toPay, // <--- PRÉ-REMPLISSAGE ICI
      receiptNumber: \`\${new Date().getFullYear()}-\${Math.floor(Math.random() * 10000)}\` 
    }); 
  }
  
  loadPayments(resId: string) { this.paymentService.getByReservation(resId).subscribe(data => { this.payments.set(data); }); }

  async submit() {
    if (this.form.valid && this.currentRes()?.id) {
      this.isSubmitting.set(true);
      try {
        const data = { ...this.form.value, reservationId: this.currentRes()!.id } as Payment;
        if (this.isEditMode() && this.editId) { await this.paymentService.update(this.editId, data); this.ui.showToast('success', 'Règlement mis à jour'); } 
        else { await this.paymentService.add(data); this.ui.showToast('success', 'Règlement ajouté'); }
        this.resetForm();
        
        // Mettre à jour le reste à payer pour le prochain ajout
        const updatedPaid = this.totalPaid() + (this.isEditMode() ? 0 : Number(data.amount));
        const newRemaining = Math.max(0, this.totalResPrice() - updatedPaid);
        this.form.patchValue({ amount: newRemaining });

      } catch (e) { this.ui.showToast('error', 'Erreur sauvegarde'); } finally { this.isSubmitting.set(false); }
    }
  }

  edit(pay: Payment) { this.isEditMode.set(true); this.editId = pay.id!; this.form.patchValue({ type: pay.type, amount: pay.amount, date: pay.date, receiptNumber: pay.receiptNumber, checkNumber: pay.checkNumber, checkDate: pay.checkDate }); }
  async delete(pay: Payment) { const confirm = await this.ui.confirm('Supprimer ?', 'Supprimer ?', 'Oui', 'Non'); if (confirm && pay.id) { await this.paymentService.delete(pay.id); this.ui.showToast('success', 'Supprimé'); } }
  resetForm() { this.isEditMode.set(false); this.editId = null; 
    // Reset avec le reste à payer calculé
    const toPay = Math.max(0, this.remaining());
    this.form.reset({ type: 'ESPECES', amount: toPay, date: new Date().toISOString().split('T')[0], receiptNumber: \`\${new Date().getFullYear()}-\${Math.floor(Math.random() * 10000)}\` }); 
  }
  close() { this.onClose.emit(); }
}
EOF

# 2. Mise à jour du CALENDRIER pour l'affichage ORANGE (Résa Payée)
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
import { PaymentModalComponent } from '../../payments/payment-modal/payment-modal.component';

@Component({
  selector: 'app-calendar-view',
  standalone: true,
  imports: [CommonModule, RouterLink, FormsModule, PaymentModalComponent],
  template: \`
    <div class="p-4 md:p-6 bg-white min-h-screen flex flex-col">
      <div class="flex flex-col lg:flex-row justify-between items-center mb-4 gap-4">
        <div class="flex items-center bg-slate-50 p-1 rounded-xl border border-slate-200 shadow-sm">
          <button (click)="previousMonth()" class="p-2 rounded-lg hover:bg-white hover:shadow-sm text-slate-500 hover:text-slate-800 transition"><span class="material-icons">chevron_left</span></button>
          <div class="flex items-center gap-2 mx-2">
            <div class="relative"><select [ngModel]="currentMonthIndex()" (ngModelChange)="onMonthChange(\$event)" class="appearance-none bg-white border border-slate-200 text-slate-800 font-bold py-1.5 pl-3 pr-8 rounded-lg cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500 hover:border-blue-300 transition capitalize text-sm">@for (m of monthsList; track \$index) { <option [value]="\$index">{{ m }}</option> }</select><span class="material-icons absolute right-2 top-2 text-slate-400 pointer-events-none text-sm">arrow_drop_down</span></div>
            <div class="relative"><select [ngModel]="currentYear()" (ngModelChange)="onYearChange(\$event)" class="appearance-none bg-white border border-slate-200 text-slate-800 font-bold py-1.5 pl-3 pr-8 rounded-lg cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500 hover:border-blue-300 transition text-sm">@for (y of yearsList(); track y) { <option [value]="y">{{ y }}</option> }</select><span class="material-icons absolute right-2 top-2 text-slate-400 pointer-events-none text-sm">arrow_drop_down</span></div>
          </div>
          <button (click)="nextMonth()" class="p-2 rounded-lg hover:bg-white hover:shadow-sm text-slate-500 hover:text-slate-800 transition"><span class="material-icons">chevron_right</span></button>
        </div>
        <div class="flex items-center gap-3 w-full lg:w-auto justify-end"><button (click)="goToToday()" class="px-3 py-1.5 text-sm font-medium text-slate-600 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg transition flex items-center"><span class="material-icons text-sm mr-1">today</span> Aujourd'hui</button><a routerLink="/reservations/new" class="bg-blue-600 hover:bg-blue-700 text-white px-4 py-1.5 rounded-lg shadow-md hover:shadow-lg transition flex items-center font-bold whitespace-nowrap text-sm"><span class="material-icons text-sm mr-2">add</span> Réservation</a></div>
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
                  <div (click)="openDetails(res); \$event.stopPropagation()" 
                       class="absolute inset-0.5 rounded shadow-sm flex flex-col justify-center px-1 hover:brightness-95 transition"
                       [class.bg-orange-500]="isPaid(res)" [class.text-white]="isPaid(res)" [class.border-l-4]="isPaid(res)" [class.border-orange-700]="isPaid(res)"
                       [class.bg-yellow-100]="!isPaid(res)" [class.text-yellow-900]="!isPaid(res)" [class.border-l-2]="!isPaid(res)" [class.border-yellow-400]="!isPaid(res)">
                    <div class="text-[9px] font-bold truncate leading-tight">{{ res.clientName }}</div>
                    <div class="text-[8px] leading-tight" [class.text-orange-100]="isPaid(res)" [class.text-yellow-700]="!isPaid(res)">{{ res.startTime }}</div>
                    @if(isPaid(res)){ <div class="absolute top-0.5 right-0.5 text-[8px] font-bold">✓ PAYÉ</div> }
                  </div>
                }
              </div>

              <div (click)="onSlotClick(day, '13:00')" class="flex-1 border-b border-dashed border-slate-100 relative cursor-pointer hover:bg-orange-50/50 transition-colors p-0.5">
                <span class="absolute top-0.5 left-1 text-[7px] text-slate-300 font-bold uppercase tracking-widest pointer-events-none group-hover:text-slate-400">Aprèm</span>
                @for (res of getResForSlot(day, 2); track res.id) {
                  <div (click)="openDetails(res); \$event.stopPropagation()" 
                       class="absolute inset-0.5 rounded shadow-sm flex flex-col justify-center px-1 hover:brightness-95 transition"
                       [class.bg-orange-500]="isPaid(res)" [class.text-white]="isPaid(res)" [class.border-l-4]="isPaid(res)" [class.border-orange-700]="isPaid(res)"
                       [class.bg-orange-100]="!isPaid(res)" [class.text-orange-900]="!isPaid(res)" [class.border-l-2]="!isPaid(res)" [class.border-orange-400]="!isPaid(res)">
                    <div class="text-[9px] font-bold truncate leading-tight">{{ res.clientName }}</div>
                    <div class="text-[8px] leading-tight" [class.text-orange-100]="isPaid(res)" [class.text-orange-700]="!isPaid(res)">{{ res.startTime }}</div>
                    @if(isPaid(res)){ <div class="absolute top-0.5 right-0.5 text-[8px] font-bold">✓ PAYÉ</div> }
                  </div>
                }
              </div>

              <div (click)="onSlotClick(day, '19:00')" class="flex-1 relative cursor-pointer hover:bg-indigo-50/50 transition-colors p-0.5">
                <span class="absolute top-0.5 left-1 text-[7px] text-slate-300 font-bold uppercase tracking-widest pointer-events-none group-hover:text-slate-400">Soir</span>
                @for (res of getResForSlot(day, 3); track res.id) {
                  <div (click)="openDetails(res); \$event.stopPropagation()" 
                       class="absolute inset-0.5 rounded shadow-sm flex flex-col justify-center px-1 hover:brightness-95 transition"
                       [class.bg-orange-500]="isPaid(res)" [class.text-white]="isPaid(res)" [class.border-l-4]="isPaid(res)" [class.border-orange-700]="isPaid(res)"
                       [class.bg-indigo-100]="!isPaid(res)" [class.text-indigo-900]="!isPaid(res)" [class.border-l-2]="!isPaid(res)" [class.border-indigo-400]="!isPaid(res)">
                    <div class="text-[9px] font-bold truncate leading-tight">{{ res.clientName }}</div>
                    <div class="text-[8px] leading-tight" [class.text-orange-100]="isPaid(res)" [class.text-indigo-700]="!isPaid(res)">{{ res.startTime }}</div>
                    @if(isPaid(res)){ <div class="absolute top-0.5 right-0.5 text-[8px] font-bold">✓ PAYÉ</div> }
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
          <div class="bg-gradient-to-r from-slate-800 to-slate-900 px-6 py-4 flex justify-between items-center text-white shrink-0"><div><h3 class="font-bold text-xl">{{ selectedReservation()?.clientName }}</h3><p class="text-slate-400 text-xs mt-1">{{ selectedReservation()?.date | date:'fullDate' }}</p></div><button (click)="closeDetails()" class="text-slate-400 hover:text-white"><span class="material-icons">close</span></button></div>
          <div class="p-6 space-y-6 overflow-y-auto custom-scrollbar">
             <div class="bg-purple-50 p-4 rounded-xl border border-purple-100 shadow-sm"><div class="flex justify-between items-center mb-3 border-b border-purple-200 pb-2"><span class="text-xs font-bold text-purple-700 uppercase tracking-wider">Trésorerie</span><button (click)="openPayment()" class="text-purple-600 hover:bg-purple-100 p-1 rounded transition flex items-center" title="Gérer"><span class="material-icons text-sm mr-1">payments</span><span class="text-xs font-bold">Gérer</span></button></div><div class="grid grid-cols-3 gap-2 text-center"><div><p class="text-[10px] text-slate-500 uppercase">Total</p><p class="font-bold text-slate-800">{{ getResPrice(selectedReservation()) }} DT</p></div><div><p class="text-[10px] text-slate-500 uppercase">Reçu</p><p class="font-bold text-emerald-600">{{ getResAdvance(selectedReservation()) }} DT</p></div><div><p class="text-[10px] text-slate-500 uppercase">Reste</p><p class="font-bold text-red-500">{{ (getResPrice(selectedReservation()) - getResAdvance(selectedReservation())) }} DT</p></div></div></div>
             <div><div class="flex items-center justify-between mb-3"><h4 class="text-xs font-bold text-slate-500 uppercase tracking-wider">Affectation Équipe</h4><span class="text-xs bg-slate-100 px-2 py-1 rounded text-slate-600 font-bold">{{ (selectedReservation()?.assignedServerIds || []).length }} membres</span></div><div class="grid grid-cols-1 sm:grid-cols-2 gap-2">@for (staff of allStaff(); track staff.id) { <div (click)="toggleStaffAssignment(staff.id!)" class="flex items-center p-2 rounded-lg border cursor-pointer select-none transition-all duration-200 hover:shadow-sm" [class.border-emerald-500]="isStaffAssigned(staff.id!)" [class.bg-emerald-50]="isStaffAssigned(staff.id!)" [class.border-slate-200]="!isStaffAssigned(staff.id!)"><div class="w-6 h-6 rounded-full flex items-center justify-center text-[10px] mr-2 transition-colors" [class.bg-emerald-500]="isStaffAssigned(staff.id!)" [class.text-white]="isStaffAssigned(staff.id!)" [class.bg-slate-200]="!isStaffAssigned(staff.id!)" [class.text-slate-400]="!isStaffAssigned(staff.id!)">@if(isStaffAssigned(staff.id!)){ <span class="material-icons text-[14px]">check</span> }</div><div class="flex-1 min-w-0"><p class="text-sm font-bold truncate" [class.text-emerald-900]="isStaffAssigned(staff.id!)">{{ staff.nom }}</p><p class="text-[10px] truncate" [class.text-emerald-700]="isStaffAssigned(staff.id!)" [class.text-slate-500]="!isStaffAssigned(staff.id!)">{{ staff.specialite }}</p></div></div> }</div></div>
          </div>
          <div class="bg-slate-50 px-6 py-4 border-t border-slate-200 flex justify-between shrink-0"><button (click)="openDeleteModal()" class="text-red-500 hover:bg-red-50 px-3 py-2 rounded text-sm font-bold transition flex items-center"><span class="material-icons text-sm mr-2">delete</span> Supprimer</button><button (click)="editCurrent()" class="bg-slate-800 hover:bg-slate-700 text-white px-5 py-2 rounded text-sm font-bold transition flex items-center"><span class="material-icons text-sm mr-2">edit</span> Éditer tout</button></div>
        </div>
      </div>
    }
    @if (showDeleteModal()) { <div class="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 backdrop-blur-md animate-fade-in"><div class="bg-white rounded-xl shadow-2xl p-6 w-80 md:w-96 border-t-4 border-red-600"><div class="text-center mb-6"><div class="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-3"><span class="material-icons text-red-600">lock</span></div><h3 class="font-bold text-lg text-slate-800">Sécurité Requise</h3><p class="text-sm text-slate-500 mt-1">Veuillez saisir votre mot de passe administrateur pour confirmer la suppression.</p></div><div class="mb-6"><input type="password" [(ngModel)]="deletePassword" class="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-red-500 outline-none text-center" placeholder="Mot de passe" (keyup.enter)="confirmDeleteWithPassword()">@if (deleteError()) { <p class="text-xs text-red-500 text-center mt-2 font-bold">{{ deleteError() }}</p> }</div><div class="flex gap-3"><button (click)="closeDeleteModal()" class="flex-1 py-2 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 font-medium transition">Annuler</button><button (click)="confirmDeleteWithPassword()" [disabled]="isVerifying()" class="flex-1 py-2 bg-red-600 text-white rounded-lg font-bold hover:bg-red-700 shadow-md disabled:opacity-50 transition flex items-center justify-center">@if(isVerifying()) { <span class="material-icons animate-spin text-sm">refresh</span> } @else { <span>Confirmer</span> }</button></div></div></div> }
    @if (showPaymentModal()) { <app-payment-modal [reservation]="selectedReservation()" (onClose)="closePayment()"></app-payment-modal> }
  \`,
  styles: [\` .custom-scrollbar::-webkit-scrollbar { width: 4px; } .custom-scrollbar::-webkit-scrollbar-track { background: transparent; } .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 2px; } @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } } .animate-fade-in { animation: fadeIn 0.2s ease-out; } \`]
})
export class CalendarViewComponent {
  private reservationService = inject(ReservationService);
  private staffService = inject(StaffService);
  private activityService = inject(ActivityService);
  private authService = inject(AuthService);
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
  showPaymentModal = signal(false);
  
  // Suppression sécurisée
  showDeleteModal = signal(false); deletePassword = ''; deleteError = signal(''); isVerifying = signal(false);

  isToday(d: Date) { return isToday(d); }
  isCurrentMonth(d: Date) { return isSameMonth(d, this.viewDate()); }
  
  // HELPER POUR VERIFIER SI PAYÉ
  isPaid(res: Reservation): boolean {
    const total = Number(res.totalPrice) || 0;
    const paid = Number(res.advance) || 0;
    return paid >= total && total > 0;
  }

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

  onSlotClick(day: Date, timeHint: string) { const dateStr = format(day, 'yyyy-MM-dd'); this.router.navigate(['/reservations/new'], { queryParams: { date: dateStr, startTime: timeHint } }); }
  openDetails(res: Reservation) { this.selectedReservation.set(res); }
  closeDetails() { this.selectedReservation.set(null); }
  editCurrent() { const res = this.selectedReservation(); if (res?.id) this.router.navigate(['/reservations/edit', res.id]); }
  openPayment() { this.showPaymentModal.set(true); } closePayment() { this.showPaymentModal.set(false); }
  openDeleteModal() { this.deletePassword = ''; this.deleteError.set(''); this.showDeleteModal.set(true); } closeDeleteModal() { this.showDeleteModal.set(false); }
  async confirmDeleteWithPassword() { if (!this.deletePassword) { this.deleteError.set('Mot de passe requis'); return; } this.isVerifying.set(true); this.deleteError.set(''); const isValid = await this.authService.verifyPassword(this.deletePassword); if (isValid) { const res = this.selectedReservation(); if (res && res.id) { await this.reservationService.delete(res.id); this.activityService.log('DELETE', 'RESERVATION', \`Suppression résa par Admin\`); this.ui.showToast('success', 'Réservation supprimée'); this.closeDeleteModal(); this.closeDetails(); } } else { this.deleteError.set('Mot de passe incorrect'); } this.isVerifying.set(false); }
  isStaffAssigned(staffId: string): boolean { const res = this.selectedReservation(); if (!res || !res.assignedServerIds) return false; return res.assignedServerIds.includes(staffId); }
  async toggleStaffAssignment(staffId: string) { const res = this.selectedReservation(); if (!res || !res.id) return; const currentIds = res.assignedServerIds || []; let newIds = currentIds.includes(staffId) ? currentIds.filter(id => id !== staffId) : [...currentIds, staffId]; await this.reservationService.update(res.id, { assignedServerIds: newIds } as any); this.selectedReservation.update(prev => { if (!prev) return null; return { ...prev, assignedServerIds: newIds }; }); }
  getResPrice(res: any) { return Number(res?.totalPrice) || 0; }
  getResAdvance(res: any) { return Number(res?.advance) || 0; }
}
EOF

echo "Modifications UX appliquées : Pré-remplissage du montant et couleur Orange pour les réservations soldées."