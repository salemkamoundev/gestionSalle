#!/bin/bash

# Définition des chemins
BASE_DIR="src/app/features/calendar/reservation-form"
COMPONENTS_DIR="$BASE_DIR/components"

echo "🚀 Démarrage du refactoring du module Reservation Form (Version Corrigée)..."

# 1. Création des dossiers
mkdir -p "$COMPONENTS_DIR/partner-finance"
mkdir -p "$COMPONENTS_DIR/client-billing"

# 2. Nettoyage
if [ -f "$COMPONENTS_DIR/payment-dialog/payment-dialog.component.ts" ]; then
    echo "🗑️ Suppression de l'ancien payment-dialog..."
    rm -rf "$COMPONENTS_DIR/payment-dialog"
fi

# ---------------------------------------------------------
# 3. Création du composant Client Billing (TS)
# ---------------------------------------------------------
echo "📝 Création de ReservationClientBillingComponent (TS)..."
cat << 'END_TS' > "$COMPONENTS_DIR/client-billing/client-billing.component.ts"
import { Component, EventEmitter, Input, Output, computed, inject, signal } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { ReservationService } from '../../../../../core/services/reservation.service';
import { PaymentService } from '../../../../../core/services/payment.service';
import { UiService } from '../../../../../core/services/ui.service';

@Component({
  selector: 'app-reservation-client-billing',
  standalone: true,
  imports: [CommonModule, DatePipe],
  templateUrl: './client-billing.component.html'
})
export class ReservationClientBillingComponent {
  private reservationService = inject(ReservationService);
  private paymentService = inject(PaymentService);
  private ui = inject(UiService);

  @Input() reservationId: string | null = null;
  @Input() totalPrice = 0;
  @Input() advance = 0;
  @Input() payments: any[] = [];
  
  @Input() availableCredits: any[] = [];
  @Input() globalCredits: any[] = [];

  @Output() openPaymentModal = new EventEmitter<void>();
  @Output() reloadPayments = new EventEmitter<void>();
  @Output() creditUsed = new EventEmitter<void>();

  showClientCredits = signal(false);
  showGlobalCredits = signal(false);
  availableCreditSearch = signal('');
  globalCreditSearch = signal('');
  availableCreditPage = signal(1);
  globalCreditsPage = signal(1);
  readonly ITEMS_PER_PAGE = 5;

  toggleClientCredits() { this.showClientCredits.update(v => !v); }
  toggleGlobalCredits() { this.showGlobalCredits.update(v => !v); }

  filteredAvailableCredits = computed(() => {
    const term = this.availableCreditSearch().toLowerCase();
    return this.availableCredits.filter(c => 
        !term || (c.description?.toLowerCase().includes(term)) || (c.amount?.toString().includes(term))
    );
  });
  
  paginatedAvailableCredits = computed(() => {
    const start = (this.availableCreditPage() - 1) * this.ITEMS_PER_PAGE;
    return this.filteredAvailableCredits().slice(start, start + this.ITEMS_PER_PAGE);
  });
  
  totalAvailablePages = computed(() => Math.ceil(this.filteredAvailableCredits().length / this.ITEMS_PER_PAGE));

  filteredGlobalCredits = computed(() => {
    const term = this.globalCreditSearch().toLowerCase();
    const clientIds = this.availableCredits.map(c => c.id);
    return this.globalCredits.filter(c => 
        !clientIds.includes(c.id) && (!term || c.description?.toLowerCase().includes(term) || c.amount?.toString().includes(term))
    );
  });

  paginatedGlobalCredits = computed(() => {
    const start = (this.globalCreditsPage() - 1) * this.ITEMS_PER_PAGE;
    return this.filteredGlobalCredits().slice(start, start + this.ITEMS_PER_PAGE);
  });

  totalGlobalPages = computed(() => Math.ceil(this.filteredGlobalCredits().length / this.ITEMS_PER_PAGE));

  async useCredit(credit: any) {
    if (!this.reservationId) return;
    if (!confirm('Utiliser cet avoir ?')) return;
    try {
      await this.reservationService.applyCredit(this.reservationId, credit);
      this.ui.showToast('success', 'Avoir appliqué');
      this.creditUsed.emit();
      this.reloadPayments.emit();
    } catch (e) { this.ui.showToast('error', 'Erreur lors de l\'application de l\'avoir'); }
  }

  async deletePayment(p: any) {
    if(confirm('Supprimer ce paiement ?')) {
      await this.paymentService.delete(p.id);
      this.ui.showToast('success', 'Paiement supprimé');
      this.reloadPayments.emit();
    }
  }

  prevAvPage() { if (this.availableCreditPage() > 1) this.availableCreditPage.update(p => p - 1); }
  nextAvPage() { if (this.availableCreditPage() < this.totalAvailablePages()) this.availableCreditPage.update(p => p + 1); }
  prevGlPage() { if (this.globalCreditsPage() > 1) this.globalCreditsPage.update(p => p - 1); }
  nextGlPage() { if (this.globalCreditsPage() < this.totalGlobalPages()) this.globalCreditsPage.update(p => p + 1); }

  getDateObject(ts: any): Date { return ts?.toDate ? ts.toDate() : new Date(ts || new Date()); }
}
END_TS

# ---------------------------------------------------------
# 4. Création du composant Client Billing (HTML)
# ---------------------------------------------------------
echo "📝 Création de ReservationClientBillingComponent (HTML)..."
cat << 'END_HTML' > "$COMPONENTS_DIR/client-billing/client-billing.component.html"
<div class="space-y-8 max-w-4xl mx-auto">
  <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
    <div class="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm text-center">
      <div class="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Total Dossier</div>
      <div class="text-2xl font-black text-slate-700">{{ totalPrice }} DT</div>
    </div>
    <div class="bg-emerald-50 p-5 rounded-2xl border border-emerald-100 shadow-sm text-center">
      <div class="text-xs font-bold text-emerald-600 uppercase tracking-widest mb-2">Déjà Payé</div>
      <div class="text-2xl font-black text-emerald-700">{{ advance }} DT</div>
    </div>
    <div class="bg-slate-800 p-5 rounded-2xl shadow-lg text-center text-white">
      <div class="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Reste à payer</div>
      <div class="font-black text-2xl">{{ totalPrice - advance }} DT</div>
    </div>
  </div>

  <div *ngIf="availableCredits.length > 0" class="bg-purple-50 rounded-2xl border border-purple-100 shadow-sm overflow-hidden">
      <div (click)="toggleClientCredits()" class="p-6 flex justify-between items-center cursor-pointer hover:bg-purple-100 transition select-none">
          <h4 class="font-black text-purple-800 flex items-center gap-2">
              <span class="material-icons">card_giftcard</span> Bons & Avoirs Disponibles (Client)
              <span class="text-xs bg-purple-200 text-purple-800 px-2 py-0.5 rounded-full ml-2">{{ availableCredits.length }}</span>
          </h4>
          <span class="material-icons text-purple-600 transition-transform duration-300" [class.rotate-180]="showClientCredits()">expand_more</span>
      </div>

      <div *ngIf="showClientCredits()" class="p-6 pt-0 border-t border-purple-100">
          <div class="mb-4 mt-4">
             <input type="text" [value]="availableCreditSearch()" (input)="availableCreditSearch.set($any($event.target).value)" 
                    placeholder="Filtrer..." class="w-full px-4 py-2 rounded-lg border border-purple-200 text-sm focus:ring-2 focus:ring-purple-500 outline-none">
          </div>

          <div class="space-y-3">
              <div *ngFor="let credit of paginatedAvailableCredits()" class="bg-white p-4 rounded-xl border border-purple-100 shadow-sm flex items-center justify-between group hover:border-purple-300 transition">
                  <div class="flex-1">
                      <div class="flex items-center gap-2 mb-1">
                          <span class="text-[10px] font-bold bg-purple-100 text-purple-700 px-2 py-0.5 rounded">AVOIR</span>
                          <span class="font-black text-slate-800">{{ credit.amount }} DT</span>
                          <span class="text-xs text-slate-400">- {{ getDateObject(credit.createdAt) | date:'dd/MM/yyyy' }}</span>
                      </div>
                      <div class="text-xs text-slate-500 italic">{{ credit.description }}</div>
                  </div>
                  <button type="button" (click)="useCredit(credit)" class="px-3 py-1.5 bg-purple-600 text-white rounded-lg font-bold text-xs hover:bg-purple-700 transition">Utiliser</button>
              </div>
          </div>
           <div *ngIf="totalAvailablePages() > 1" class="flex justify-center gap-4 mt-4">
               <button (click)="prevAvPage()" [disabled]="availableCreditPage()===1" class="text-purple-700 disabled:opacity-30"><span class="material-icons">chevron_left</span></button>
               <span class="text-xs font-bold text-purple-800">{{ availableCreditPage() }} / {{ totalAvailablePages() }}</span>
               <button (click)="nextAvPage()" [disabled]="availableCreditPage()===totalAvailablePages()" class="text-purple-700 disabled:opacity-30"><span class="material-icons">chevron_right</span></button>
           </div>
      </div>
  </div>

  <div class="bg-indigo-50 rounded-2xl border border-indigo-100 shadow-sm overflow-hidden">
    <div (click)="toggleGlobalCredits()" class="p-6 flex justify-between items-center cursor-pointer hover:bg-indigo-100 transition select-none">
        <h4 class="font-black text-indigo-800 flex items-center gap-2">
            <span class="material-icons">all_inclusive</span> Bons & Avoirs (Tous Clients)
        </h4>
        <span class="material-icons text-indigo-600 transition-transform duration-300" [class.rotate-180]="showGlobalCredits()">expand_more</span>
    </div>
    <div *ngIf="showGlobalCredits()" class="p-6 pt-0 border-t border-indigo-100">
        <div class="mb-4 mt-4">
           <input type="text" [value]="globalCreditSearch()" (input)="globalCreditSearch.set($any($event.target).value)" 
                  placeholder="Rechercher client, montant..." class="w-full px-4 py-2 rounded-lg border border-indigo-200 text-sm focus:ring-2 focus:ring-indigo-500 outline-none">
        </div>
        <div class="space-y-3">
            <div *ngFor="let gCredit of paginatedGlobalCredits()" class="bg-white p-4 rounded-xl border border-indigo-100 shadow-sm flex items-center justify-between group hover:border-indigo-400 transition">
                <div class="flex-1">
                    <div class="flex items-center gap-2 mb-1">
                        <span class="text-[10px] font-black bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded uppercase">Global</span>
                        <span class="font-black text-slate-800">{{ gCredit.amount }} DT</span>
                        <span class="text-xs text-slate-400">- {{ getDateObject(gCredit.createdAt) | date:'dd/MM/yyyy' }}</span>
                    </div>
                </div>
                <button type="button" (click)="useCredit(gCredit)" class="px-3 py-1.5 bg-indigo-600 text-white rounded-lg font-bold text-xs hover:bg-indigo-700 transition">Utiliser</button>
            </div>
        </div>
        <div *ngIf="totalGlobalPages() > 1" class="flex justify-center gap-4 mt-4">
           <button (click)="prevGlPage()" [disabled]="globalCreditsPage()===1" class="text-indigo-700 disabled:opacity-30"><span class="material-icons">chevron_left</span></button>
           <span class="text-xs font-bold text-indigo-800">{{ globalCreditsPage() }} / {{ totalGlobalPages() }}</span>
           <button (click)="nextGlPage()" [disabled]="globalCreditsPage()===totalGlobalPages()" class="text-indigo-700 disabled:opacity-30"><span class="material-icons">chevron_right</span></button>
       </div>
    </div>
  </div>

  <div class="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
    <div class="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
      <h3 class="font-bold text-slate-700 flex items-center gap-2">
        <span class="material-icons text-emerald-500">receipt_long</span> Historique des Règlements
      </h3>
      <button *ngIf="reservationId" type="button" (click)="openPaymentModal.emit()" class="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg font-bold shadow hover:bg-emerald-700 transition text-sm">
        <span class="material-icons text-sm">add</span> Ajouter
      </button>
    </div>
    <div class="overflow-x-auto">
      <table class="w-full text-sm text-left">
        <thead class="bg-slate-50 text-slate-500 font-bold text-xs uppercase">
          <tr><th class="px-6 py-3">Date</th><th class="px-6 py-3">Mode</th><th class="px-6 py-3 text-right">Montant</th><th class="px-6 py-3 text-center">Actions</th></tr>
        </thead>
        <tbody class="divide-y divide-slate-100">
          <tr *ngFor="let pay of payments" class="hover:bg-slate-50 transition">
            <td class="px-6 py-3 font-medium text-slate-700">{{ getDateObject(pay.date) | date:'dd/MM/yyyy' }}</td>
            <td class="px-6 py-3"><span class="font-bold">{{ pay.type }}</span></td>
            <td class="px-6 py-3 text-right font-bold text-emerald-600">+{{ pay.amount }} DT</td>
            <td class="px-6 py-3 text-center">
              <button type="button" (click)="deletePayment(pay)" class="text-slate-400 hover:text-red-600"><span class="material-icons text-sm">delete</span></button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</div>
END_HTML

# ---------------------------------------------------------
# 5. Création du composant Partner Finance (TS)
# ---------------------------------------------------------
echo "📝 Création de ReservationPartnerFinanceComponent (TS)..."
cat << 'END_TS' > "$COMPONENTS_DIR/partner-finance/partner-finance.component.ts"
import { Component, EventEmitter, Input, Output, computed, inject, signal } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { UiService } from '../../../../../core/services/ui.service';
import { ContractPdfService } from '../../../../../core/services/contract-pdf.service';

@Component({
  selector: 'app-reservation-partner-finance',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, DatePipe],
  templateUrl: './partner-finance.component.html'
})
export class ReservationPartnerFinanceComponent {
  private fb = inject(FormBuilder);
  private ui = inject(UiService);
  private contractPdfService = inject(ContractPdfService);

  @Input() reservationId: string | null = null;
  @Input() fullReservationData: any = {};
  @Input() clientName: string = 'Client';
  @Input() assignedServerIds: string[] = [];
  @Input() selectedServices: any[] = [];
  @Input() allPartenaires: any[] = [];
  @Input() partnerPayments: any[] = [];

  @Output() paymentsUpdated = new EventEmitter<any[]>();

  partnerPaymentForm: FormGroup;

  constructor() {
    this.partnerPaymentForm = this.fb.group({
      partnerId: ['', Validators.required],
      amount: [0, [Validators.required, Validators.min(1)]],
      method: ['ESPECES', Validators.required],
      reference: ['']
    });
  }

  groupedPartners = computed(() => {
    const pIds = this.assignedServerIds || [];
    const services = this.selectedServices || [];
    const payments = this.partnerPayments || [];
    const partnersList = this.allPartenaires || [];

    return pIds.map((pid: string) => {
        const partnerDef = partnersList.find((p: any) => p.id === pid);
        const partnerServices = services.filter(s => 
            (partnerDef?.serviceIds && partnerDef.serviceIds.includes(s.id)) || (s.partnerId === pid)
        );
        const totalCost = partnerServices.reduce((acc, s) => acc + (Number(s.cost || s.price || 0)), 0);
        const totalPaid = payments.filter(pay => pay.partnerId === pid).reduce((acc, pay) => acc + (Number(pay.amount) || 0), 0);

        return {
            partnerId: pid,
            partnerName: partnerDef ? `${partnerDef.nom} ${partnerDef.prenom || ''}` : 'Inconnu',
            services: partnerServices.map(s => s.name || s.nom),
            totalCost: totalCost,
            totalPaid: totalPaid,
            remaining: totalCost - totalPaid
        };
    });
  });

  addPartnerPayment() {
    if (this.partnerPaymentForm.invalid) return;
    const val = this.partnerPaymentForm.value;
    const partner = this.allPartenaires.find(p => p.id === val.partnerId);
    
    const newPay = {
        partnerId: val.partnerId,
        partnerName: partner ? `${partner.nom}` : 'Inconnu',
        amount: val.amount,
        method: val.method,
        reference: val.reference,
        date: new Date()
    };

    const updatedPayments = [...this.partnerPayments, newPay];
    this.paymentsUpdated.emit(updatedPayments);
    
    this.partnerPaymentForm.patchValue({ amount: 0, reference: '' });
    this.ui.showToast('success', 'Règlement partenaire ajouté');
  }

  printPartnerReceipt(payment: any) {
    const resData = { ...this.fullReservationData, clientName: this.clientName };
    this.contractPdfService.generatePartnerReceipt(resData, payment);
  }

  printGlobalPartnerReport() {
    const resData = { ...this.fullReservationData, clientName: this.clientName };
    this.contractPdfService.generatePartnersSummary(resData, this.groupedPartners());
  }

  printSinglePartnerReport(partner: any) {
    const resData = { ...this.fullReservationData, clientName: this.clientName, id: this.reservationId };
    this.contractPdfService.generateSinglePartnerReport(resData, partner);
  }

  getDateObject(ts: any): Date { return ts?.toDate ? ts.toDate() : new Date(ts || new Date()); }
}
END_TS

# ---------------------------------------------------------
# 6. Création du composant Partner Finance (HTML)
# ---------------------------------------------------------
echo "📝 Création de ReservationPartnerFinanceComponent (HTML)..."
cat << 'END_HTML' > "$COMPONENTS_DIR/partner-finance/partner-finance.component.html"
<div class="max-w-4xl mx-auto space-y-6">
    <div class="flex justify-between items-center mb-4 border-l-4 border-purple-500 pl-4">
        <h3 class="text-xl font-black text-slate-700">Suivi des Règlements Partenaires</h3>
        <button (click)="printGlobalPartnerReport()" class="text-xs bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 px-4 py-2 rounded-lg shadow-sm flex items-center gap-2 transition font-bold">
            <span class="material-icons text-sm">print</span> Imprimer Bilan Global
        </button>
    </div>

    <div *ngIf="groupedPartners().length === 0" class="text-center py-12 text-slate-400 italic bg-white rounded-2xl border-2 border-dashed border-slate-200">
        <span class="material-icons text-4xl mb-2 text-slate-300">people_outline</span>
        <p class="text-lg font-medium">Aucun partenaire détecté.</p>
        <p class="text-sm">Assurez-vous d'avoir assigné du personnel avec des services associés.</p>
    </div>

    <div *ngFor="let p of groupedPartners()" class="border border-slate-200 rounded-2xl overflow-hidden shadow-sm mb-6 bg-white">
        <div class="bg-slate-50 px-6 py-4 border-b border-slate-100 flex justify-between items-start">
            <div>
                <span class="block font-black text-slate-800 text-lg">{{ p.partnerName }}</span>
                <div class="flex flex-wrap gap-1 mt-2">
                    <span *ngFor="let srv of p.services" class="text-[10px] font-bold uppercase bg-white border border-slate-200 text-slate-500 px-2 py-0.5 rounded">{{ srv }}</span>
                </div>
            </div>
            <div class="text-right flex flex-col items-end gap-2">
                <div>
                    <span class="block text-xs text-slate-400 font-bold uppercase tracking-wider">Total Dû</span>
                    <span class="block font-black text-slate-800 text-xl">{{ p.totalCost }} DT</span>
                </div>
                <button type="button" (click)="printSinglePartnerReport(p)" class="flex items-center gap-1 text-xs font-bold text-slate-500 bg-white border border-slate-200 px-2 py-1 rounded hover:bg-slate-50 transition">
                    <span class="material-icons text-xs">print</span> Bilan
                </button>
            </div>
        </div>

        <div class="p-6">
            <div class="flex items-center gap-6 text-sm mb-6 p-4 bg-slate-50 rounded-xl border border-slate-100">
                <div class="text-emerald-700 font-bold flex items-center gap-2">
                    <span class="material-icons text-emerald-500">check_circle</span> Déjà payé: <span class="text-lg">{{ p.totalPaid }} DT</span>
                </div>
                <div class="font-black flex items-center gap-2" [ngClass]="{'text-red-600': p.remaining > 0, 'text-emerald-600': p.remaining <= 0}">
                    <span class="material-icons">account_balance_wallet</span> Reste à payer: <span class="text-lg">{{ p.remaining }} DT</span>
                </div>
            </div>

            <form [formGroup]="partnerPaymentForm" (ngSubmit)="addPartnerPayment()" class="bg-purple-50 p-5 rounded-xl mb-6 border border-purple-100">
                <p class="text-xs font-black text-purple-800 mb-3 uppercase tracking-wider flex items-center gap-2">
                    <span class="material-icons text-sm">add_card</span> Nouveau Règlement
                </p>
                <div class="flex flex-col gap-3">
                    <div class="flex gap-3" (click)="partnerPaymentForm.patchValue({partnerId: p.partnerId})">
                        <div class="w-1/3">
                            <input type="number" formControlName="amount" placeholder="Montant" class="w-full text-sm font-bold border-slate-200 rounded-lg p-2.5 focus:ring-2 focus:ring-purple-500 border outline-none">
                        </div>
                        <div class="flex-1">
                            <select formControlName="method" class="w-full text-sm font-medium border-slate-200 rounded-lg p-2.5 focus:ring-2 focus:ring-purple-500 border outline-none bg-white">
                                <option value="ESPECES">Espèces</option>
                                <option value="CHEQUE">Chèque</option>
                                <option value="VIREMENT">Virement</option>
                            </select>
                        </div>
                    </div>
                    <div class="flex gap-3">
                         <input type="text" formControlName="reference" placeholder="Référence" class="flex-1 text-sm border-slate-200 rounded-lg p-2.5 focus:ring-2 focus:ring-purple-500 border outline-none">
                         <button type="submit" [disabled]="partnerPaymentForm.invalid || partnerPaymentForm.value.partnerId !== p.partnerId" class="bg-purple-600 hover:bg-purple-700 text-white text-sm font-black px-6 py-2 rounded-lg shadow-md transition disabled:opacity-50 flex items-center gap-2">PAYER</button>
                    </div>
                </div>
            </form>

            <div *ngIf="partnerPayments.length > 0" class="mt-4 border-t border-slate-100 pt-4">
                <p class="text-xs font-bold text-slate-400 uppercase mb-3">Historique des transactions</p>
                <div class="space-y-2">
                    <ng-container *ngFor="let pay of partnerPayments">
                        <div *ngIf="pay.partnerId === p.partnerId" class="flex justify-between items-center text-xs py-2 px-3 bg-slate-50 rounded-lg border border-slate-100 hover:border-purple-200 transition group">
                            <span class="text-slate-600 flex items-center gap-3">
                                <span class="font-medium">{{ getDateObject(pay.date) | date:'dd/MM HH:mm' }}</span>
                                <span class="px-2 py-0.5 bg-white border border-slate-200 rounded text-slate-500 text-[10px] uppercase font-bold tracking-wide">{{ pay.method }}</span>
                            </span>
                            <div class="flex items-center gap-4">
                                <span class="font-black text-slate-800 text-sm">{{ pay.amount }} DT</span>
                                <button (click)="printPartnerReceipt(pay)" class="text-slate-400 hover:text-purple-600 p-1 rounded transition"><span class="material-icons text-sm">print</span></button>
                            </div>
                        </div>
                    </ng-container>
                </div>
            </div>
        </div>
    </div>
</div>
END_HTML

# ---------------------------------------------------------
# 7. Correction du Payment Modal (TS)
# ---------------------------------------------------------
echo "🔧 Correction de PaymentModalComponent..."
cat << 'END_TS' > "$COMPONENTS_DIR/payment-modal/payment-modal.component.ts"
import { Component, EventEmitter, Input, Output, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Firestore, doc, updateDoc, increment, collection, addDoc } from '@angular/fire/firestore';
import { ReceiptService } from '../../../../../core/services/receipt.service';
import { UiService } from '../../../../../core/services/ui.service';

@Component({
  selector: 'app-payment-modal',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './payment-modal.component.html'
})
export class PaymentModalComponent implements OnInit {
  @Input() reservation: any;
  @Output() close = new EventEmitter<void>();
  @Output() paymentSuccess = new EventEmitter<void>();

  private fb = inject(FormBuilder);
  private firestore = inject(Firestore);
  private receiptService = inject(ReceiptService);
  private ui = inject(UiService);

  form: FormGroup;
  isProcessing = false;
  remainingAmount = 0;

  constructor() {
    this.form = this.fb.group({
      amount: [0, [Validators.required, Validators.min(1)]],
      type: ['ESPECES', Validators.required],
      date: [new Date().toISOString().split('T')[0], Validators.required],
      checkNumber: [''],
      checkDate: [''],
      notes: ['']
    });
  }

  ngOnInit() {
    if (this.reservation) {
      const total = this.reservation.totalPrice || 0;
      const paid = this.reservation.advance || 0;
      this.remainingAmount = Math.max(0, total - paid);
      if (this.remainingAmount > 0) this.form.patchValue({ amount: this.remainingAmount });
    }
    this.form.get('type')?.valueChanges.subscribe(val => {
      const checkNumberControl = this.form.get('checkNumber');
      const checkDateControl = this.form.get('checkDate');
      if (val === 'CHEQUE') {
        checkNumberControl?.setValidators([Validators.required]);
        checkDateControl?.setValidators([Validators.required]);
      } else {
        checkNumberControl?.clearValidators();
        checkDateControl?.clearValidators();
      }
      checkNumberControl?.updateValueAndValidity();
      checkDateControl?.updateValueAndValidity();
    });
  }

  async onSubmit() {
    if (this.form.invalid) return;
    this.isProcessing = true;
    const val = this.form.value;
    try {
      await addDoc(collection(this.firestore, 'payments'), {
        reservationId: this.reservation.id,
        clientId: this.reservation.clientId || null,
        amount: val.amount,
        type: val.type,
        date: val.date,
        checkNumber: val.checkNumber || null,
        checkDate: val.checkDate || null,
        notes: val.notes || '',
        createdAt: new Date().toISOString()
      });
      await updateDoc(doc(this.firestore, 'reservations', this.reservation.id), { advance: increment(val.amount) });
      this.ui.showToast('success', 'Paiement enregistré avec succès');
      try {
        const newTotal = (this.reservation.advance || 0) + val.amount;
        const receiptData = {
            contractNum: this.reservation.id?.substring(0, 8),
            clientName: this.reservation.clientName,
            phone: this.reservation.customerPhone,
            resDate: new Date(this.reservation.date).toLocaleDateString('fr-FR'),
            offerDescription: 'Paiement partiel/total',
            totalPrice: this.reservation.totalPrice,
            payments: [{ number: 'Nouveau', date: new Date().toLocaleDateString('fr-FR'), type: val.type, amount: val.amount, totalSoFar: newTotal }],
            remainingAmount: Math.max(0, (this.reservation.totalPrice || 0) - newTotal)
        };
        this.receiptService.generateReceipt(receiptData);
      } catch (err) { console.warn("Erreur génération PDF", err); }
      this.paymentSuccess.emit();
      this.close.emit();
    } catch (e) {
      console.error(e);
      this.ui.showToast('error', 'Erreur technique lors du paiement');
    } finally { this.isProcessing = false; }
  }

  onCancel() { this.close.emit(); }
}
END_TS

# ---------------------------------------------------------
# 8. Mise à jour du composant Principal (TS)
# ---------------------------------------------------------
echo "🚀 Refonte du ReservationFormComponent (TS)..."
cat << 'END_TS' > "$BASE_DIR/reservation-form.component.ts"
import { Component, OnInit, computed, effect, inject, signal, Input, Output, EventEmitter, Injector, runInInjectionContext } from '@angular/core';
import { CommonModule, DatePipe, Location } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { toSignal, takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { firstValueFrom, from } from 'rxjs';
import { debounceTime, filter, distinctUntilChanged, tap, switchMap, catchError } from 'rxjs/operators';
import { Firestore, collection, query, where, getDocs } from '@angular/fire/firestore';

// Services
import { ReservationService } from '../../../core/services/reservation.service';
import { ClientService } from '../../../core/services/client.service';
import { ServiceService } from '../../../core/services/service.service';
import { PartenaireService } from '../../../core/services/partenaire.service';
import { PackService } from '../../../core/services/pack.service';
import { UiService } from '../../../core/services/ui.service';
import { ConfigService } from '../../../core/services/config.service';
import { PaymentPdfService } from '../../../core/services/payment-pdf.service';
import { ContractPdfService } from '../../../core/services/contract-pdf.service';
import { AuthService } from '../../../core/services/auth.service';
import { PaymentService } from '../../../core/services/payment.service';

// Components
import { ClientFormComponent } from '../../clients/client-form/client-form.component';
import { PaymentModalComponent } from './components/payment-modal/payment-modal.component';
import { PartenaireFormComponent } from '../../partenaire/partenaire-form/partenaire-form.component';
import { AdminConfirmDialogComponent } from '../../../shared/components/admin-confirm-dialog/admin-confirm-dialog.component';
import { ReservationPartnerFinanceComponent } from './components/partner-finance/partner-finance.component';
import { ReservationClientBillingComponent } from './components/client-billing/client-billing.component';

@Component({
  selector: 'app-reservation-form',
  standalone: true,
  imports: [
    CommonModule, ReactiveFormsModule, ClientFormComponent, 
    PaymentModalComponent, PartenaireFormComponent, AdminConfirmDialogComponent,
    ReservationPartnerFinanceComponent, ReservationClientBillingComponent
  ],
  providers: [DatePipe],
  templateUrl: './reservation-form.component.html'
})
export class ReservationFormComponent implements OnInit {
  private fb = inject(FormBuilder);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private location = inject(Location);
  private reservationService = inject(ReservationService);
  private clientService = inject(ClientService);
  private serviceService = inject(ServiceService);
  private partenaireService = inject(PartenaireService);
  private packService = inject(PackService);
  private paymentService = inject(PaymentService);
  public configService = inject(ConfigService);
  private ui = inject(UiService);
  private paymentPdfService = inject(PaymentPdfService);
  private contractPdfService = inject(ContractPdfService);
  private authService = inject(AuthService);
  private firestore = inject(Firestore);
  private injector = inject(Injector);

  @Input() isModal = false; 
  @Output() close = new EventEmitter<void>();
  @Output() reservationSaved = new EventEmitter<any>();

  isAdmin = this.authService.isAdmin;
  activeTab = signal<'info' | 'partenaire' | 'teams' | 'pack' | 'services' | 'reglement' | 'partner_finance'>('info');
  isEditMode = signal(false);
  isDeleting = signal(false);
  loading = signal(false);
  autoSaveStatus = signal<'idle' | 'saving' | 'saved' | 'error'>('idle');

  reservationId: string | null = null;
  showClientModal = signal(false);
  clientToEdit = signal<any>(null);
  showPartenaireModal = signal(false);
  showPaymentModal = signal(false);
  showAdminAuth = signal(false);

  allServices = toSignal(this.serviceService.getAll(), { initialValue: [] as any[] });
  allPartenaires = toSignal(this.partenaireService.getAll(), { initialValue: [] as any[] });
  rawClients = toSignal(this.clientService.getAll(), { initialValue: [] as any[] });
  packs = toSignal(this.packService.getAll(), { initialValue: [] as any[] });
  packs$ = this.packService.getAll();

  clientSearch = signal('');
  partenaireSearch = signal(''); 
  serviceSearch = signal('');
  selectedServices = signal<any[]>([]);
  selectedDate = signal<string>('');
  selectedClientId = signal<string | null>(null);
  restrictedSlotType = signal<string | null>(null);
  pendingParams = signal<any>(null);
  
  availableCredits = signal<any[]>([]);
  globalCredits = signal<any[]>([]);
  payments = signal<any[]>([]);
  
  form: FormGroup = this.fb.group({
    date: ['', Validators.required],
    slotId: ['', Validators.required],
    startTime: [''],
    endTime: [''],
    clientId: ['', Validators.required],
    packId: [null],
    staffIds: [[] as string[]], 
    assignedServerIds: [[] as string[]], 
    services: [[] as any[]],
    totalPrice: [0, [Validators.required, Validators.min(0)]],
    advance: [0],
    status: ['CONFIRMED'],
    notes: [''],
    partnerPayments: [[]]
  });

  constructor() {
    effect(() => {
      const params = this.pendingParams();
      const slots = this.availableSlots();
      if (params && slots.length > 0) {
        this.selectedDate.set(params.date);
        const reqSlot = (params.slotId || '').toLowerCase();
        this.form.get('slotId')?.enable();
        this.restrictedSlotType.set(null);
        let targetId = reqSlot;
        if (reqSlot.includes('matin')) { this.restrictedSlotType.set('matin'); targetId = 'matin'; this.form.get('slotId')?.disable(); } 
        else if (reqSlot.includes('soir')) { this.restrictedSlotType.set('soir'); targetId = 'soir'; this.form.get('slotId')?.disable(); } 
        else if (reqSlot.includes('aprem')) { this.restrictedSlotType.set('aprem'); if(targetId === 'aprem') targetId = 'aprem1'; }
        this.form.patchValue({ date: params.date, slotId: targetId });
        this.applySlotTimes(targetId);
        this.calculateTotal();
        this.pendingParams.set(null);
      }
    });

    this.form.valueChanges.pipe(
      takeUntilDestroyed(),
      debounceTime(10000), 
      filter(() => this.form.valid && !!this.reservationId && this.isEditMode() && !this.isDeleting()),
      distinctUntilChanged((a, b) => JSON.stringify(a) === JSON.stringify(b)),
      tap(() => this.autoSaveStatus.set('saving')),
      switchMap(val => from(this.reservationService.updateReservation(this.reservationId!, val)).pipe(catchError(err => { this.autoSaveStatus.set('error'); return []; })))
    ).subscribe(() => { this.autoSaveStatus.set('saved'); setTimeout(() => this.autoSaveStatus.set('idle'), 3000); });
  }

  ngOnInit() { 
      this.loadGlobalCredits(); 
      this.route.params.subscribe(params => {
          if (params['id']) {
              this.reservationId = params['id'];
              this.isEditMode.set(true);
              this.loadReservation(params['id']);
          }
      });
      this.route.queryParams.subscribe(params => {
          if (params['date'] && !this.reservationId) {
              this.pendingParams.set({ date: params['date'], slotId: params['slotId'] || '' });
          }
      });
  }

  availableSlots = computed(() => this.configService.settings().creneaux || []);
  filteredSlots = computed(() => {
    const date = this.selectedDate();
    const slots = this.availableSlots();
    if (!date || !slots) return [];
    let valid = slots.filter((s: any) => date >= s.validFrom && date <= s.validTo);
    const restriction = this.restrictedSlotType();
    if (restriction === 'matin') return valid.filter((s: any) => s.id === 'matin');
    if (restriction === 'soir') return valid.filter((s: any) => s.id === 'soir');
    if (restriction === 'aprem') return valid.filter((s: any) => s.id.startsWith('aprem'));
    return valid;
  });
  
  filteredPartenaire = computed(() => {
    const term = this.partenaireSearch().toLowerCase();
    return (this.allPartenaires() || []).filter((p: any) => !term || (p.nom && p.nom.toLowerCase().includes(term)));
  });
  
  filteredClients = computed(() => {
    const term = this.clientSearch().toLowerCase();
    return this.rawClients().filter((c: any) => !term || (c.nom && c.nom.toLowerCase().includes(term)) || (c.telephone && c.telephone.includes(term))).slice(0, 10);
  });
  
  selectedClient = computed(() => this.rawClients().find((c: any) => c.id === this.selectedClientId()));
  
  filteredServices = computed(() => {
    const term = this.serviceSearch().toLowerCase();
    return this.allServices().filter((s: any) => !term || (s.nom && s.nom.toLowerCase().includes(term)) || (s.name && s.name.toLowerCase().includes(term)));
  });
  
  get currentReservationData() { return { id: this.reservationId, ...this.form.getRawValue(), client: this.selectedClient() }; }

  async loadReservation(id: string) {
    this.loading.set(true);
    try {
      const res: any = await firstValueFrom(this.reservationService.getById(id));
      if (res) {
        this.form.patchValue(res);
        this.form.get('date')?.disable(); this.form.get('startTime')?.disable(); this.form.get('endTime')?.disable();
        const currentSlot = (res.slotId || '').toLowerCase();
        if (currentSlot.includes('aprem')) { this.form.get('slotId')?.enable(); this.restrictedSlotType.set('aprem'); } else { this.form.get('slotId')?.disable(); }
        this.selectedDate.set(res.date);
        if (res.clientId) { this.selectedClientId.set(res.clientId); this.loadClientCredits(res.clientId); }
        if(res.services) { this.selectedServices.set(res.services); this.form.patchValue({ services: res.services }); }
        await this.loadPayments(id);
        this.calculateTotal();
      }
    } catch (e) { console.error(e); } finally { this.loading.set(false); }
  }

  calculateTotal() {
    const val = this.form.getRawValue();
    let total = 0;
    const slot = this.availableSlots().find((s: any) => s.id === val.slotId);
    if (slot) total += (Number(slot.price) || 0);
    const servicesTotal = this.selectedServices().reduce((acc: number, s: any) => acc + (Number(s.price) || Number(s.prix) || 0), 0);
    total += servicesTotal;
    if (val.packId) {
        const pack = this.packs().find(p => p.id === val.packId);
        if (pack) total += (Number(pack.price) || 0);
    }
    if (total > 0) this.form.patchValue({ totalPrice: total }, { emitEvent: false });
  }

  updateServices(services: any[]) {
      this.selectedServices.set(services);
      this.form.patchValue({ services });
      this.calculateTotal();
  }
  
  getServicesTotal(): number { return this.selectedServices().reduce((acc, s) => acc + (Number(s.price) || 0), 0); }
  applySlotTimes(slotId: string) { const slot = this.availableSlots().find((s: any) => s.id === slotId); if (slot) this.form.patchValue({ startTime: slot.start, endTime: slot.end }); }
  
  togglePartenaire(id: string) { if (this.isPartenaireSelected(id)) this.removePartenaire(id); else this.addPartenaire(id); }
  isPartenaireSelected(id: string): boolean { return (this.form.get('assignedServerIds')?.value || []).includes(id); }
  addPartenaire(id: string) {
    const currentIds = this.form.get('assignedServerIds')?.value || [];
    if (!currentIds.includes(id)) {
        const newIds = [...currentIds, id];
        this.form.patchValue({ staffIds: newIds, assignedServerIds: newIds });
        const partner = this.allPartenaires().find((p: any) => p.id === id);
        if (partner && partner.serviceIds && Array.isArray(partner.serviceIds)) {
            let currentServices = [...this.selectedServices()];
            partner.serviceIds.forEach((srvId: string) => {
                const srvDef = this.allServices().find((s: any) => s.id === srvId);
                if (srvDef && !currentServices.some(s => s.id === srvDef.id)) {
                    currentServices.push({ ...srvDef, price: Number(srvDef.price || srvDef.prix || 0) });
                }
            });
            this.updateServices(currentServices);
        }
    }
    this.partenaireSearch.set('');
  }
  removePartenaire(id: string) {
    const currentIds = this.form.get('assignedServerIds')?.value || [];
    const newIds = currentIds.filter((x: string) => x !== id);
    this.form.patchValue({ staffIds: newIds, assignedServerIds: newIds });
    const partner = this.allPartenaires().find((p: any) => p.id === id);
    if (partner && partner.serviceIds) {
        let currentServices = [...this.selectedServices()];
        currentServices = currentServices.filter(s => !partner.serviceIds.includes(s.id));
        this.updateServices(currentServices);
    }
  }
  updatePartnerPayments(newPayments: any[]) {
      this.form.patchValue({ partnerPayments: newPayments });
      if (this.isEditMode() && this.reservationId) this.onSubmit();
  }

  toggleService(service: any) {
      let current = [...this.selectedServices()];
      const idx = current.findIndex((s: any) => s.id === service.id);
      if (idx >= 0) current.splice(idx, 1);
      else { current.push({ ...service, price: Number(service.price !== undefined ? service.price : (service.prix || 0)) }); }
      this.updateServices(current);
      this.serviceSearch.set('');
  }
  isServiceSelected(service: any): boolean { return this.selectedServices().some((s: any) => s.id === service.id); }
  removeService(index: number) { const current = [...this.selectedServices()]; current.splice(index, 1); this.updateServices(current); }
  selectPack(packId: string | null, packData: any = null) {
      if (this.isPastReservation()) return;
      this.form.patchValue({ packId });
      if (packId) {
          const newPack = this.packs().find(p => p.id === packId);
          if (newPack && newPack.services) {
             let currentServices = [...this.selectedServices()];
              newPack.services.forEach((packService: any) => {
                  const fullServiceDef = this.allServices().find((s: any) => s.id === packService.id) || packService;
                  if (!currentServices.some(c => c.id === fullServiceDef.id)) {
                      currentServices.push({ ...fullServiceDef, price: Number(fullServiceDef.price || fullServiceDef.prix || 0) });
                  }
              });
              this.updateServices(currentServices);
          } else { this.calculateTotal(); }
      } else { this.calculateTotal(); }
  }
  getPackTotal(pack: any) { return Number(pack.price || 0); }

  async setActiveTab(tab: any) { 
    if (!this.form.get('clientId')?.value) { this.ui.showToast('error', 'Sélectionnez un client d\'abord'); return; }
    this.activeTab.set(tab); 
    if (this.form.valid) await this.onSubmit(); 
  }
  onClose() { if (this.isModal) this.close.emit(); else this.router.navigate(['/reservations']); }
  isPastReservation() { return this.selectedDate() && new Date(this.selectedDate()) < new Date(new Date().setHours(0,0,0,0)); }
  onSlotChange(e: any) { this.applySlotTimes(e.target.value); this.calculateTotal(); }

  openClientModal() { this.clientToEdit.set(null); this.showClientModal.set(true); }
  closeClientModal() { this.showClientModal.set(false); }
  onClientModalFinish(res: any) { this.closeClientModal(); if (res?.id) this.selectClient(res); }
  openPartenaireModal() { this.showPartenaireModal.set(true); }
  closePartenaireModal() { this.showPartenaireModal.set(false); }
  onPartenaireModalFinish(res: any) { this.closePartenaireModal(); }
  
  openPaymentModal() { if (this.reservationId) this.showPaymentModal.set(true); }
  closePaymentModal() { this.showPaymentModal.set(false); }
  async onPaymentFinished() { this.closePaymentModal(); if(this.reservationId) await this.loadPayments(this.reservationId); }

  onClientSearch(e: any) { this.clientSearch.set(e.target.value); }
  onEditClient(client: any) { if (client) { this.clientToEdit.set(client); this.showClientModal.set(true); } }
  selectClient(client: any) { 
    this.form.patchValue({ clientId: client.id }); 
    this.selectedClientId.set(client.id); 
    this.clientSearch.set(''); 
    this.loadClientCredits(client.id); 
  }

  async loadPayments(reservationId: string) {
      try {
          this.paymentService.getByReservation(reservationId).subscribe(data => {
              this.payments.set(data);
              const totalPaid = data.reduce((sum, p: any) => sum + (Number(p.amount) || 0), 0);
              this.form.patchValue({ advance: totalPaid }, { emitEvent: false });
              if (this.reservationId) this.reservationService.update(this.reservationId, { advance: totalPaid });
          });
      } catch(e) { console.error(e); }
  }
  async loadClientCredits(clientId: string) {
    try {
        runInInjectionContext(this.injector, async () => {
            const q = query(collection(this.firestore, 'provisional_receipts'), where('clientId', '==', clientId), where('status', '==', 'AVAILABLE'));
            const snap = await getDocs(q);
            const unique = new Map(); snap.docs.forEach(d => unique.set(d.id, { id: d.id, ...d.data() }));
            this.availableCredits.set(Array.from(unique.values()));
        });
    } catch(e) { console.error("Credits client error:", e); }
  }
  async loadGlobalCredits() {
    try {
        runInInjectionContext(this.injector, async () => {
            const q = query(collection(this.firestore, 'provisional_receipts'), where('status', '==', 'AVAILABLE'));
            const snap = await getDocs(q);
            const unique = new Map(); snap.docs.forEach(d => unique.set(d.id, { id: d.id, ...d.data() }));
            this.globalCredits.set(Array.from(unique.values()));
        });
    } catch(e) { console.error("Credits global error:", e); }
  }

  async onSubmit() {
    if (this.form.invalid) return;
    this.loading.set(true);
    this.calculateTotal();
    const val = this.form.getRawValue();
    try {
        if (this.isEditMode() && this.reservationId) {
            await this.reservationService.updateReservation(this.reservationId, val);
            this.ui.showToast('success', 'Mise à jour réussie');
        } else {
            const res = await this.reservationService.addReservation(val);
            this.reservationId = res.id;
            this.isEditMode.set(true);
            this.ui.showToast('success', 'Création réussie');
            this.location.replaceState('/reservations/edit/' + res.id);
        }
        this.reservationSaved.emit(true);
    } catch (e) { this.ui.showToast('error', 'Erreur'); }
    finally { this.loading.set(false); }
  }
  onDeleteReservation() { this.showAdminAuth.set(true); }
  async onAdminAuthSuccess() {
      this.showAdminAuth.set(false);
      if (!this.reservationId) return;
      this.isDeleting.set(true);
      this.form.disable({ emitEvent: false });
      this.loading.set(true);
      try {
          await this.reservationService.delete(this.reservationId);
          this.ui.showToast("success", "Réservation annulée");
          if (this.isModal) this.close.emit(); else this.router.navigate(['/reservations']);
      } catch (e) { this.isDeleting.set(false); this.form.enable(); this.ui.showToast("error", "Erreur annulation"); } 
      finally { this.loading.set(false); }
  }

  async onPrint() { if (this.reservationId) this.contractPdfService.generateContract({ id: this.reservationId, ...this.form.getRawValue() }, this.selectedClient() || {}); }
  onPrintPayments() { if (this.reservationId) this.paymentPdfService.generateReceipt({ id: this.reservationId, ...this.form.getRawValue() }, this.selectedClient() || {}, this.payments()); }
  getDateObject(ts: any): Date { return ts?.toDate ? ts.toDate() : new Date(ts || new Date()); }
}
END_TS

# ---------------------------------------------------------
# 9. Mise à jour du composant Principal (HTML)
# ---------------------------------------------------------
echo "🚀 Refonte du ReservationFormComponent (HTML)..."
cat << 'END_HTML' > "$BASE_DIR/reservation-form.component.html"
<div class="max-w-5xl mx-auto bg-white rounded-2xl shadow-xl mt-6 border border-slate-100 flex flex-col min-h-[600px] overflow-hidden">
  
  <div class="px-8 py-5 border-b border-slate-100 bg-white z-10">
    <div class="flex justify-between items-center mb-6">
      <h2 class="text-2xl font-black text-slate-800 flex items-center">
        <span class="material-icons mr-3 text-blue-600">event_available</span>
        {{ isEditMode() ? 'Modifier la Réservation' : 'Nouvelle Réservation' }}
      </h2>
      <div class="flex gap-2">
        <ng-container *ngIf="isEditMode()">
          <button type="button" (click)="onPrint()" class="flex items-center gap-2 px-3 py-1.5 bg-purple-100 text-purple-700 rounded-lg font-bold hover:bg-purple-200 transition text-sm">
            <span class="material-icons text-sm">print</span> Contrat
          </button>
          <button type="button" (click)="onPrintPayments()" class="flex items-center gap-2 px-3 py-1.5 bg-emerald-100 text-emerald-700 rounded-lg font-bold hover:bg-emerald-200 transition text-sm">
            <span class="material-icons text-sm">receipt_long</span> Règlements
          </button>
          <button type="button" (click)="onDeleteReservation()" class="flex items-center gap-2 px-3 py-1.5 bg-red-100 text-red-700 rounded-lg font-bold hover:bg-red-200 transition text-sm">
            <span class="material-icons text-sm">delete</span>
          </button>
        </ng-container>
        <button type="button" (click)="onClose()" class="text-slate-400 hover:text-slate-600 p-2 ml-2">
          <span class="material-icons">close</span>
        </button>
      </div>
    </div>

    <div class="flex items-center gap-1 overflow-x-auto no-scrollbar pb-1">
      <button (click)="setActiveTab('info')" [class]="activeTab() === 'info' ? 'bg-blue-600 text-white shadow-md shadow-blue-200' : 'bg-slate-50 text-slate-500 hover:bg-slate-100'" class="px-4 py-2 rounded-lg font-bold text-xs uppercase tracking-wide transition flex items-center gap-2 whitespace-nowrap"><span class="material-icons text-sm">person</span> Informations</button>
      <button (click)="setActiveTab('partenaire')" [class]="activeTab() === 'partenaire' ? 'bg-orange-500 text-white shadow-md shadow-orange-200' : 'bg-slate-50 text-slate-500 hover:bg-slate-100'" class="px-4 py-2 rounded-lg font-bold text-xs uppercase tracking-wide transition flex items-center gap-2 whitespace-nowrap"><span class="material-icons text-sm">badge</span> Pers. Salle</button>
      <button (click)="setActiveTab('pack')" [class]="activeTab() === 'pack' ? 'bg-slate-800 text-white' : 'bg-slate-50 text-slate-500 hover:bg-slate-100'" class="px-4 py-2 rounded-lg font-bold text-xs uppercase tracking-wide transition flex items-center gap-2 whitespace-nowrap"><span class="material-icons text-sm">inventory_2</span> Choix du Pack</button>
      <button (click)="setActiveTab('services')" [class]="activeTab() === 'services' ? 'bg-indigo-600 text-white shadow-md shadow-indigo-200' : 'bg-slate-50 text-slate-500 hover:bg-slate-100'" class="px-4 py-2 rounded-lg font-bold text-xs uppercase tracking-wide transition flex items-center gap-2 whitespace-nowrap"><span class="material-icons text-sm">room_service</span> Services</button>
      <button (click)="setActiveTab('reglement')" [class]="activeTab() === 'reglement' ? 'bg-emerald-600 text-white shadow-md shadow-emerald-200' : 'bg-slate-50 text-slate-500 hover:bg-slate-100'" class="px-4 py-2 rounded-lg font-bold text-xs uppercase tracking-wide transition flex items-center gap-2 whitespace-nowrap"><span class="material-icons text-sm">payments</span> Règlements Clients</button>
      <button (click)="setActiveTab('partner_finance')" [class]="activeTab() === 'partner_finance' ? 'bg-purple-600 text-white shadow-md shadow-purple-200' : 'bg-slate-50 text-slate-500 hover:bg-slate-100'" class="px-4 py-2 rounded-lg font-bold text-xs uppercase tracking-wide transition flex items-center gap-2 whitespace-nowrap"><span class="material-icons text-sm">handshake</span> Règlements Partenaires</button>
    </div>
  </div>

  <form [formGroup]="form" (ngSubmit)="onSubmit()" class="flex-1 flex flex-col relative overflow-hidden bg-slate-50/50">
    <div class="flex-1 p-8 overflow-y-auto custom-scrollbar">

      <div *ngIf="activeTab() === 'pack'" class="tab-content max-w-2xl mx-auto space-y-6">
          <div *ngIf="isPastReservation()" class="bg-orange-50 border-l-4 border-orange-400 p-4 rounded shadow-sm mb-6 flex items-start gap-3">
              <span class="material-icons text-orange-500 mt-0.5">lock_clock</span>
              <div><h4 class="font-bold text-orange-800 text-sm uppercase">Modification Verrouillée</h4></div>
          </div>
          <div class="text-center mb-8">
            <h3 class="text-xl font-black text-slate-700">Sélectionnez un Pack</h3>
            <p class="text-slate-400 text-sm">Choisissez une base pour pré-remplir les services</p>
          </div>
          <div class="space-y-4">
            <div (click)="selectPack(null)" class="p-5 rounded-xl border-2 transition-all flex items-center gap-4 relative"
                 [class.pointer-events-none]="isPastReservation()" [class.opacity-60]="isPastReservation()"
                 [class.border-slate-800]="form.value.packId === null" [class.bg-white]="form.value.packId === null" [class.border-slate-200]="form.value.packId !== null">
               <div class="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center"><span class="material-icons text-slate-500">edit_off</span></div>
               <div class="font-bold text-slate-800">Sur Mesure (Aucun Pack)</div>
            </div>
            <div *ngFor="let pack of (packs$ | async) || []" (click)="selectPack(pack.id || null, pack)"
                 class="p-5 rounded-xl border-2 transition-all flex items-center gap-4 bg-white relative cursor-pointer"
                 [class.border-blue-600]="form.value.packId === pack.id" [class.border-transparent]="form.value.packId !== pack.id">
                <div class="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center"><span class="material-icons text-blue-600">inventory_2</span></div>
                <div class="flex-1">
                  <div class="font-bold text-slate-800">{{ pack.nom }}</div>
                  <div class="text-xs text-slate-500">{{ getPackTotal(pack) }} DT</div>
                </div>
                <span *ngIf="form.value.packId === pack.id" class="material-icons text-blue-600">check_circle</span>
            </div>
          </div>
      </div>

      <div *ngIf="activeTab() === 'info'" class="tab-content">
          <div class="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div class="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm text-center"><div class="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Total Dossier</div><div class="text-2xl font-black text-slate-700">{{ form.value.totalPrice || 0 }} DT</div></div>
            <div class="bg-emerald-50 p-5 rounded-2xl border border-emerald-100 shadow-sm text-center"><div class="text-xs font-bold text-emerald-600 uppercase tracking-widest mb-2">Déjà Payé</div><div class="text-2xl font-black text-emerald-700">{{ form.value.advance || 0 }} DT</div></div>
            <div class="bg-slate-800 p-5 rounded-2xl shadow-lg text-center text-white"><div class="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Reste à payer</div><div class="font-black text-2xl">{{ (form.value.totalPrice || 0) - (form.value.advance || 0) }} DT</div></div>
          </div>
          <div class="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div class="space-y-6">
              <div class="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                <h4 class="text-sm font-black text-slate-500 uppercase mb-4 flex items-center gap-2"><span class="material-icons text-blue-500">calendar_today</span> Date & Horaire</h4>
                <div class="space-y-4">
                  <div><label class="block text-xs font-bold text-slate-500 mb-1">Date</label><input formControlName="date" type="date" readonly class="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-100 text-slate-500 font-bold"></div>
                  <div><label class="block text-xs font-bold text-slate-500 mb-1">Créneau</label>
                    <select formControlName="slotId" (change)="onSlotChange($event)" class="w-full px-4 py-3 rounded-xl border border-slate-200 bg-white outline-none">
                      <option value="">Sélectionner un créneau...</option>
                      <option *ngFor="let slot of filteredSlots()" [value]="slot.id">{{ slot.label }}</option>
                    </select>
                  </div>
                </div>
              </div>
              <div class="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex-1 flex flex-col">
                 <div class="flex justify-between items-center mb-4"><h4 class="text-sm font-black text-slate-500 uppercase flex items-center gap-2"><span class="material-icons text-blue-500">search</span> Sélection Client</h4><button type="button" (click)="openClientModal()" class="text-xs font-bold text-blue-600 bg-blue-50 px-3 py-1.5 rounded-lg hover:bg-blue-100 transition">+ Nouveau</button></div>
                 <input type="text" [value]="clientSearch()" (input)="onClientSearch($event)" placeholder="Rechercher nom, tél..." class="w-full px-4 py-2 rounded-lg border border-slate-200 outline-none mb-3">
                 <div class="flex-1 overflow-y-auto max-h-[250px] space-y-2 custom-scrollbar pr-1">
                   <div *ngFor="let c of filteredClients()" (click)="selectClient(c)" class="p-3 rounded-xl cursor-pointer border transition-all flex justify-between items-center" [class.bg-blue-50]="form.value.clientId === c.id" [class.border-blue-500]="form.value.clientId === c.id">
                       <div><div class="font-bold text-slate-800 text-sm">{{ c.nom }} {{ c.prenom }}</div><div class="text-xs text-slate-500">{{ c.telephone }}</div></div>
                       <span *ngIf="form.value.clientId === c.id" class="material-icons text-blue-600 text-sm">check_circle</span>
                   </div>
                 </div>
              </div>
            </div>
            <div>
              <div *ngIf="selectedClient()" class="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm h-full flex flex-col">
                  <div class="flex items-center gap-3 border-b pb-4 mb-4">
                    <div class="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold text-xl uppercase">{{ selectedClient()?.nom?.charAt(0) }}</div>
                    <div><h3 class="font-bold text-lg text-slate-800">{{ selectedClient()?.nom }} {{ selectedClient()?.prenom }}</h3><button type="button" (click)="onEditClient(selectedClient())" class="text-xs text-blue-600 hover:underline flex items-center gap-1"><span class="material-icons text-[14px]">edit</span> Modifier fiche client</button></div>
                  </div>
                  <div class="space-y-4 text-sm flex-1">
                     <div class="grid grid-cols-3 gap-2 border-b border-slate-50 pb-2"><span class="text-slate-400 font-medium">Téléphone</span><span class="col-span-2 text-slate-800 font-bold">{{ selectedClient()?.telephone }}</span></div>
                     <div class="grid grid-cols-3 gap-2 border-b border-slate-50 pb-2"><span class="text-slate-400 font-medium">Email</span><span class="col-span-2 text-slate-800 font-medium">{{ selectedClient()?.email || '-' }}</span></div>
                  </div>
                  <div *ngIf="selectedClient()?.notes" class="mt-4 p-3 bg-amber-50 border border-amber-100 rounded-lg text-xs text-amber-800"><p class="italic">{{ selectedClient()?.notes }}</p></div>
              </div>
            </div>
          </div>
          <div class="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm mt-6">
            <h3 class="font-bold text-slate-700 mb-3 flex items-center gap-2"><span class="material-icons text-slate-400">sticky_note_2</span> Notes & Commentaires</h3>
            <textarea formControlName="notes" rows="4" placeholder="Instructions..." class="w-full p-4 rounded-xl border border-slate-200 bg-slate-50"></textarea>
          </div>
      </div>

      <div *ngIf="activeTab() === 'reglement'" class="tab-content">
          <app-reservation-client-billing
             [reservationId]="reservationId"
             [totalPrice]="form.value.totalPrice"
             [advance]="form.value.advance"
             [payments]="payments()"
             [availableCredits]="availableCredits()"
             [globalCredits]="globalCredits()"
             (openPaymentModal)="openPaymentModal()"
             (reloadPayments)="loadPayments(reservationId!)"
             (creditUsed)="loadPayments(reservationId!)">
          </app-reservation-client-billing>
      </div>

      <div *ngIf="activeTab() === 'partenaire'" class="tab-content max-w-4xl mx-auto">
          <div class="flex justify-between items-center mb-6">
            <h3 class="text-lg font-black text-slate-700 flex items-center gap-2"><span class="material-icons text-orange-500">badge</span> Personnel</h3>
            <div class="flex items-center gap-3">
              <button type="button" (click)="openPartenaireModal()" class="text-xs font-bold text-orange-600 bg-orange-50 px-3 py-1.5 rounded-lg hover:bg-orange-100 transition whitespace-nowrap">+ Nouveau</button>
              <input type="text" (input)="partenaireSearch.set($any($event.target).value)" placeholder="Filtrer..." class="w-48 px-3 py-1.5 rounded-lg border border-slate-200 text-sm">
            </div>
          </div>
          <div class="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3">
            <div *ngFor="let partenaire of filteredPartenaire()" (click)="togglePartenaire(partenaire.id!)" 
                 class="p-3 rounded-xl cursor-pointer border transition-all hover:bg-orange-50 text-center relative bg-white"
                 [class.border-orange-500]="isPartenaireSelected(partenaire.id!)" [class.bg-orange-50]="isPartenaireSelected(partenaire.id!)">
                <div class="font-bold text-sm text-slate-800 truncate">{{ partenaire.nom }}</div>
                <div class="text-[10px] text-slate-500 truncate">{{ partenaire.role || 'Partenaire' }}</div>
                <span *ngIf="isPartenaireSelected(partenaire.id!)" class="material-icons text-orange-500 text-sm absolute top-1 right-1">check_circle</span>
            </div>
          </div>
      </div>

      <div *ngIf="activeTab() === 'services'" class="tab-content">
          <div *ngIf="selectedServices().length > 0" class="bg-white p-5 rounded-xl border border-slate-200 shadow-sm mb-6">
              <div class="flex justify-between items-center mb-4 pb-3 border-b border-slate-100">
                <h4 class="font-bold text-slate-700 flex items-center gap-2"><span class="material-icons text-emerald-500">check_circle</span> Inclus ({{ selectedServices().length }})</h4>
                <div class="text-sm font-bold text-slate-500">Total: <span class="text-emerald-600">{{ getServicesTotal() | number:'1.0-2' }} DT</span></div>
              </div>
              <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div *ngFor="let service of selectedServices(); let i = index" class="flex items-center gap-3 p-2 bg-slate-50 rounded-lg border border-slate-200">
                    <div class="flex-1 min-w-0"><div class="font-bold text-slate-700 text-sm truncate">{{ service.name || service.nom }}</div><div class="text-xs text-slate-400">{{ service.price | number:'1.0-2' }} DT</div></div>
                    <button type="button" (click)="removeService(i)" class="text-red-400 hover:text-red-600"><span class="material-icons">close</span></button>
                </div>
              </div>
          </div>
          <div class="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
            <div class="flex justify-between items-center mb-6"><h3 class="font-bold text-slate-700">Catalogue</h3><input type="text" (input)="serviceSearch.set($any($event.target).value)" placeholder="Rechercher..." class="w-64 px-3 py-1.5 rounded-lg border border-slate-200 text-sm"></div>
            <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
              <div *ngFor="let service of filteredServices()" (click)="toggleService(service)"
                   class="cursor-pointer border rounded-xl p-4 transition-all relative group hover:shadow-md bg-white h-auto"
                   [ngClass]="isServiceSelected(service) ? 'border-indigo-500 bg-indigo-50' : 'border-slate-200'">
                  <div class="font-bold text-sm text-slate-800">{{ service.name || service.nom }}</div>
                  <div class="text-xs font-bold text-slate-600 mt-2">{{ service.price || service.prix }} DT</div>
                  <span *ngIf="isServiceSelected(service)" class="material-icons text-indigo-600 text-lg absolute top-2 right-2">check_circle</span>
              </div>
            </div>
          </div>
      </div>

      <div *ngIf="activeTab() === 'partner_finance'" class="tab-content">
          <app-reservation-partner-finance
              [reservationId]="reservationId"
              [fullReservationData]="currentReservationData"
              [clientName]="selectedClient()?.nom + ' ' + selectedClient()?.prenom"
              [assignedServerIds]="form.get('assignedServerIds')?.value || []"
              [selectedServices]="selectedServices()"
              [allPartenaires]="allPartenaires()"
              [partnerPayments]="form.get('partnerPayments')?.value || []"
              (paymentsUpdated)="updatePartnerPayments($event)">
          </app-reservation-partner-finance>
      </div>

    </div>

    <div class="p-6 bg-white border-t border-slate-100 flex justify-end gap-3 z-10">
      <button type="button" (click)="onClose()" class="px-6 py-3 text-slate-500 font-bold hover:bg-slate-50 rounded-xl transition">Annuler</button>
      <button type="submit" [disabled]="form.invalid" class="px-8 py-3 bg-slate-900 text-white rounded-xl font-black shadow-xl hover:scale-[1.02] transition disabled:opacity-50">
        {{ isEditMode() ? 'Mettre à jour' : 'Enregistrer' }}
      </button>
    </div>
  </form>
</div>

<app-client-form *ngIf="showClientModal()" [clientId]="clientToEdit()?.id" [isModal]="true" (finish)="onClientModalFinish($event)"></app-client-form>
<app-partenaire-form *ngIf="showPartenaireModal()" [isModal]="true" (finish)="onPartenaireModalFinish($event)"></app-partenaire-form>
<app-payment-modal *ngIf="showPaymentModal()" [reservation]="currentReservationData" (close)="closePaymentModal()" (paymentSuccess)="onPaymentFinished()"></app-payment-modal>
<app-admin-confirm-dialog *ngIf="showAdminAuth()" (confirmed)="onAdminAuthSuccess()" (cancelled)="showAdminAuth.set(false)"></app-admin-confirm-dialog>
END_HTML

echo "✅ Refactoring terminé avec succès !"