import { Component, computed, effect, inject, input, output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { PaymentService } from '../../../core/services/payment.service';
import { ReservationService } from '../../../core/services/reservation.service';
import { UiService } from '../../../core/services/ui.service';
import { PdfService } from '../../../core/services/pdf.service';
import { Payment } from '../../../core/models/payment.model';
import { Reservation } from '../../../core/models/reservation.model';
import { toSignal } from '@angular/core/rxjs-interop';
import { DatePipe } from '@angular/common';

@Component({
  selector: 'app-payment-modal',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  providers: [DatePipe],
  template: `
    <div class="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in" (click)="close()">
      <div class="bg-white rounded-lg shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col max-h-[90vh]" (click)="$event.stopPropagation()">
        
        <div class="bg-white px-6 py-4 border-b border-slate-200 flex justify-between items-center">
          <div>
            <h3 class="font-bold text-xl text-slate-800">Gestion des Règlements</h3>
            <p class="text-sm text-slate-500">
              @if (currentRes()) { Réservation : {{ currentRes()?.clientName }} } 
              @else { Sélectionnez une réservation }
            </p>
          </div>
          <div class="flex gap-2">
            @if(currentRes()) {
              <button (click)="printContract()" class="flex items-center px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-sm font-bold transition border border-slate-300">
                <span class="material-icons text-sm mr-2">print</span> Contrat
              </button>
            }
            <button (click)="close()" class="text-slate-400 hover:text-slate-600 transition"><span class="material-icons">close</span></button>
          </div>
        </div>

        <div class="p-6 overflow-y-auto bg-slate-50 flex-1 space-y-6">
          
          @if (!reservationInput() && !paymentToEdit()) {
            <div class="bg-white p-4 rounded-lg shadow-sm border border-slate-200 border-l-4 border-l-purple-500">
              <label class="block text-xs font-bold text-slate-500 mb-2">Rechercher une réservation</label>
              <div class="relative group">
                <span class="material-icons absolute left-3 top-2.5 text-slate-400 text-sm">search</span>
                <input type="text" [value]="searchRes()" (input)="onSearchInput($event)" (change)="onResSelected($event)" list="reservationsOptions" placeholder="Tapez le nom du client..." class="w-full pl-9 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none text-sm font-bold text-slate-700">
                <datalist id="reservationsOptions">@for (res of allReservations(); track res.id) { <option [value]="formatResLabel(res)"></option> }</datalist>
                @if(searchRes()) { <button (click)="clearSelection()" class="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600"><span class="material-icons text-sm">close</span></button> }
              </div>
            </div>
          }

          @if (currentRes()) {
            <div class="animate-fade-in space-y-6">
              
              <div class="bg-white p-4 rounded-lg shadow-sm border border-slate-200">
                <h4 class="font-bold text-slate-700 mb-3 text-sm uppercase tracking-wide border-b pb-2">{{ isEditMode() ? 'Modifier le règlement' : 'Ajouter règlement' }}</h4>
                <form [formGroup]="form" (ngSubmit)="submit()">
                  <div class="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
                    <div class="md:col-span-3"><label class="block text-xs font-bold text-slate-500 mb-1">Type</label><select formControlName="type" class="w-full px-3 py-2 border border-slate-300 rounded focus:ring-2 focus:ring-purple-500 outline-none text-sm bg-white"><option value="ESPECES">Espèces</option><option value="CHEQUE">Chèque</option><option value="VIREMENT">Virement</option></select></div>
                    <div class="md:col-span-3"><label class="block text-xs font-bold text-slate-500 mb-1">Montant (DT)</label><input type="number" formControlName="amount" class="w-full px-3 py-2 border border-slate-300 rounded focus:ring-2 focus:ring-purple-500 outline-none text-sm font-bold text-right"></div>
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
                              <button (click)="printReceipt(pay)" class="text-slate-500 hover:text-purple-600" title="Imprimer Reçu"><span class="material-icons text-lg">receipt</span></button>
                              
                              <button (click)="edit(pay)" class="text-blue-400 hover:text-blue-600" title="Modifier"><span class="material-icons text-lg">edit</span></button>
                              <button (click)="delete(pay)" class="text-red-400 hover:text-red-600" title="Supprimer"><span class="material-icons text-lg">delete</span></button>
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
  `
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
  private pdfService = inject(PdfService);

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

  formatResLabel(res: Reservation): string { const dateStr = this.datePipe.transform(res.date, 'dd/MM/yyyy'); return `${res.clientName} - ${dateStr} (${res.totalPrice} DT)`; }
  onSearchInput(event: any) { this.searchRes.set(event.target.value); }
  onResSelected(event: any) { const found = this.allReservations().find(r => this.formatResLabel(r) === event.target.value); if (found) this.selectReservation(found); }
  clearSelection() { this.searchRes.set(''); this.currentRes.set(null); this.payments.set([]); }
  
  selectReservation(res: Reservation) { 
    this.currentRes.set(res); 
    this.searchRes.set(this.formatResLabel(res)); 
    this.loadPayments(res.id!); 
    const total = Number(res.totalPrice) || 0;
    const paid = Number(res.advance) || 0; const toPay = Math.max(0, total - paid);
    this.form.patchValue({ amount: toPay, receiptNumber: `${new Date().getFullYear()}-${Math.floor(Math.random() * 10000)}` }); 
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
        const updatedPaid = this.totalPaid() + (this.isEditMode() ? 0 : Number(data.amount));
        const newRemaining = Math.max(0, this.totalResPrice() - updatedPaid);
        this.form.patchValue({ amount: newRemaining });
      } catch (e) { this.ui.showToast('error', 'Erreur sauvegarde'); } finally { this.isSubmitting.set(false); }
    }
  }

  printContract() {
    const res = this.currentRes();
    if (res) this.pdfService.generateContract(res);
  }

  // --- NOUVEAU BOUTON D'ACTION ---
  printReceipt(pay: Payment) {
    const res = this.currentRes();
    if (res) this.pdfService.generateReceipt(pay, res);
  }

  edit(pay: Payment) { this.isEditMode.set(true); this.editId = pay.id!; this.form.patchValue({ type: pay.type, amount: pay.amount, date: pay.date, receiptNumber: pay.receiptNumber, checkNumber: pay.checkNumber, checkDate: pay.checkDate }); }
  async delete(pay: Payment) { const confirm = await this.ui.confirm('Supprimer ?', 'Supprimer ?', 'Oui', 'Non'); if (confirm && pay.id) { await this.paymentService.delete(pay.id); this.ui.showToast('success', 'Supprimé'); } }
  resetForm() { this.isEditMode.set(false); this.editId = null; const toPay = Math.max(0, this.remaining()); this.form.reset({ type: 'ESPECES', amount: toPay, date: new Date().toISOString().split('T')[0], receiptNumber: `${new Date().getFullYear()}-${Math.floor(Math.random() * 10000)}` }); }
  close() { this.onClose.emit(); }
}
