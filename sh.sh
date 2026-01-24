#!/bin/bash
set -e

echo "🚀 Mise à jour finale de la vue Règlements Partenaires (Épurée)..."

# ====================================================
# 1. LOGIQUE COMPOSANT (Calculs précis du reste à payer)
# ====================================================
cat << 'EOF' > src/app/features/payments/payment-list/payment-list.component.ts
import { Component, inject, computed, signal, OnInit } from '@angular/core';
import { CommonModule, DatePipe, DecimalPipe, CurrencyPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink, ActivatedRoute } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';

import { PaymentService } from '../../../core/services/payment.service';
import { ReservationService } from '../../../core/services/reservation.service';
import { UiService } from '../../../core/services/ui.service';
import { ReceiptService } from '../../../core/services/receipt.service';
import { PackService } from '../../../core/services/pack.service';
import { PartenaireService } from '../../../core/services/partenaire.service';
import { ServiceService } from '../../../core/services/service.service';

import { PaymentModalComponent } from '../payment-modal/payment-modal.component';
import { Payment } from '../../../core/models/payment.model';

interface PayableServiceItem {
  key: string;            
  reservationId: string;
  reservationDate: string;
  clientName: string;
  
  // Info Service
  serviceName: string;    
  origin: 'PACK' | 'PARTNER_SKILL'; 
  description: string; // Fusion de Source + Context
  
  // Financier
  cost: number;           
  isPaid: boolean;
  amountPaid: number;
  remainingToPay: number; // Nouveau champ explicite
  
  // Technique
  partnerId?: string;     
  paymentId?: string;
}

@Component({
  selector: 'app-payment-list',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, PaymentModalComponent, DatePipe, DecimalPipe, CurrencyPipe],
  templateUrl: './payment-list.component.html'
})
export class PaymentListComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private paymentService = inject(PaymentService);
  private reservationService = inject(ReservationService);
  private receiptService = inject(ReceiptService);
  private packService = inject(PackService);
  private partenaireService = inject(PartenaireService);
  private serviceService = inject(ServiceService);
  private ui = inject(UiService);

  // DATA
  payments = toSignal(this.paymentService.getAll(), { initialValue: [] });
  reservations = toSignal(this.reservationService.getAll(), { initialValue: [] });
  packs = toSignal(this.packService.getAll(), { initialValue: [] });
  partners = toSignal(this.partenaireService.getAll(), { initialValue: [] });
  servicesCatalog = toSignal(this.serviceService.getAll(), { initialValue: [] });

  // ETAT : On force la vue PARTNER pour que vous voyiez le résultat tout de suite
  viewMode = signal<'CLIENT' | 'PARTNER'>('PARTNER'); 
  searchQuery = signal('');
  
  page = signal(1);
  pageSize = signal(20);

  showModal = signal(false);
  paymentToEdit = signal<Payment | null>(null);

  ngOnInit() {
    console.log('✅ Vue Règlements chargée.');
  }

  // ==========================================
  // 🟢 LOGIQUE CLIENT (Conservée pour ne pas casser)
  // ==========================================
  clientPayments = computed(() => this.payments().filter(p => !p.direction || p.direction === 'INCOME'));
  
  filteredClientPayments = computed(() => {
    const q = this.searchQuery().toLowerCase();
    const sorted = [...this.clientPayments()].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    return sorted.filter(p => !q || p.receiptNumber?.toLowerCase().includes(q));
  });

  paginatedClientPayments = computed(() => {
    const start = (this.page() - 1) * this.pageSize();
    return this.filteredClientPayments().slice(start, start + this.pageSize());
  });

  totalClientPages = computed(() => Math.ceil(this.filteredClientPayments().length / this.pageSize()) || 1);
  totalAmount = computed(() => this.filteredClientPayments().reduce((sum, p) => sum + Number(p.amount), 0));

  // ==========================================
  // 🔵 LOGIQUE PARTENAIRES (Calcul précis)
  // ==========================================
  payableServices = computed(() => {
    const resList = this.reservations();
    const packList = this.packs();
    const partnerList = this.partners();
    const serviceList = this.servicesCatalog();
    const expensePayments = this.payments().filter(p => p.direction === 'EXPENSE');

    const items: PayableServiceItem[] = [];

    resList.forEach(res => {
        if (res.status === 'ANNULEE' || res.status === 'CANCELLED') return;

        // Helper pour formater la date
        const dateStr = res.date ? new Date(res.date).toLocaleDateString('fr-FR') : '';

        // 1. SERVICES DU PACK
        if (res.packId) {
            const pack = packList.find(p => p.id === res.packId);
            if (pack && pack.services) {
                pack.services.forEach(s => {
                    const sId = s.id || s.nom;
                    const uniqueKey = `${res.id}_PACK_${sId}`;
                    const existingPay = expensePayments.find(p => p.reservationId === res.id && p.serviceId === sId && p.origin === 'PACK');
                    
                    // Coût estimé (souvent 0 dans un pack, mais on prépare la structure)
                    const cost = 0; 
                    const paid = existingPay ? Number(existingPay.amount) : 0;

                    items.push({
                        key: uniqueKey,
                        reservationId: res.id!,
                        reservationDate: res.date,
                        clientName: res.clientName || 'Client',
                        serviceName: s.nom || s.name || 'Service Pack',
                        origin: 'PACK',
                        description: `Inclus dans ${pack.nom} • ${res.clientName} (${dateStr})`,
                        cost: cost, 
                        amountPaid: paid,
                        remainingToPay: existingPay ? 0 : cost, // Si payé, reste = 0
                        isPaid: !!existingPay,
                        paymentId: existingPay?.id,
                    });
                });
            }
        }

        // 2. SERVICES PARTENAIRES
        if (res.assignedServerIds && Array.isArray(res.assignedServerIds)) {
            res.assignedServerIds.forEach((pId: string) => {
                const partner = partnerList.find(p => p.id === pId);
                if (!partner) return;

                const skills = partner.serviceIds || [];
                
                if (skills.length === 0) {
                     const uniqueKey = `${res.id}_PARTNER_${pId}_GENERIC`;
                     const existingPay = expensePayments.find(p => p.reservationId === res.id && p.partnerId === pId);
                     const paid = existingPay ? Number(existingPay.amount) : 0;

                     items.push({
                        key: uniqueKey,
                        reservationId: res.id!,
                        reservationDate: res.date,
                        clientName: res.clientName || 'Client',
                        serviceName: 'Prestation Générale',
                        origin: 'PARTNER_SKILL',
                        description: `Assuré par ${partner.nom} • ${res.clientName} (${dateStr})`,
                        cost: 0,
                        amountPaid: paid,
                        remainingToPay: existingPay ? 0 : 0,
                        isPaid: !!existingPay,
                        paymentId: existingPay?.id,
                        partnerId: pId
                     });
                } else {
                    skills.forEach(skillId => {
                        const catalogS = serviceList.find(s => s.id === skillId);
                        const sName = catalogS ? catalogS.nom : 'Service';
                        const sPrice = catalogS ? (catalogS.prix || 0) : 0;
                        
                        const uniqueKey = `${res.id}_PARTNER_${pId}_${skillId}`;
                        const existingPay = expensePayments.find(p => p.reservationId === res.id && p.partnerId === pId && p.serviceId === sName);
                        
                        const paid = existingPay ? Number(existingPay.amount) : 0;

                        items.push({
                            key: uniqueKey,
                            reservationId: res.id!,
                            reservationDate: res.date,
                            clientName: res.clientName || 'Client',
                            serviceName: sName,
                            origin: 'PARTNER_SKILL',
                            description: `Assuré par ${partner.nom} • ${res.clientName} (${dateStr})`,
                            cost: sPrice,
                            amountPaid: paid,
                            remainingToPay: existingPay ? 0 : sPrice,
                            isPaid: !!existingPay,
                            paymentId: existingPay?.id,
                            partnerId: pId
                        });
                    });
                }
            });
        }
    });

    const q = this.searchQuery().toLowerCase();
    return items
        .filter(i => !q || i.serviceName.toLowerCase().includes(q) || i.description.toLowerCase().includes(q))
        .sort((a, b) => new Date(b.reservationDate).getTime() - new Date(a.reservationDate).getTime());
  });

  // --- ACTIONS ---

  async confirmAndPay(item: PayableServiceItem) {
    const defaultAmount = item.cost > 0 ? item.cost.toString() : '';
    
    // Popup plus claire
    const amountStr = await this.ui.prompt(
        'Règlement Service', 
        `Service : ${item.serviceName}\n${item.description}\n\nMontant à payer (DT) :`, 
        defaultAmount
    );

    if (amountStr && !isNaN(Number(amountStr))) {
        const pay: Payment = {
            reservationId: item.reservationId,
            amount: Number(amountStr),
            date: new Date().toISOString(),
            type: 'ESPECES',
            direction: 'EXPENSE',
            origin: item.origin,
            serviceId: item.serviceName, 
            partnerId: item.partnerId,
            notes: `Règlement : ${item.serviceName}`
        };
        await this.paymentService.add(pay);
        this.ui.showToast('success', 'Règlement effectué');
    }
  }

  async delete(pay: any) {
    if(await this.ui.confirm('Annulation', 'Annuler ce paiement ?', 'Oui', 'Non')) {
      await this.paymentService.delete(pay.id);
      this.ui.showToast('success', 'Paiement annulé');
    }
  }

  // Nav helpers
  prevPage() { this.page.set(Math.max(1, this.page() - 1)); }
  nextPage() { this.page.set(Math.min(this.totalClientPages(), this.page() + 1)); }
  getClientName(resId: string) { return this.reservations().find(r => r.id === resId)?.clientName || '-'; }
  toDate(val: any): any { if (!val) return null; try { return (val && val.toDate) ? val.toDate() : new Date(val); } catch(e) { return null; } }
  openNewPayment() { this.paymentToEdit.set(null); this.showModal.set(true); }
  openEditPayment(pay: Payment) { this.paymentToEdit.set(pay); this.showModal.set(true); }
  closeModal() { this.showModal.set(false); this.paymentToEdit.set(null); }
  printReceipt(pay: Payment) { /* ... */ }
}
EOF

# ====================================================
# 2. VUE HTML (Tableau Structuré comme demandé)
# ====================================================
cat << 'EOF' > src/app/features/payments/payment-list/payment-list.component.html
<div class="max-w-7xl mx-auto space-y-6 p-6">
  
  <div class="flex flex-col md:flex-row justify-between items-center gap-4">
    <h1 class="text-2xl font-bold text-slate-800 flex items-center">
      <span class="material-icons mr-3 text-slate-400">payments</span>
      Suivi Financier
    </h1>
    
    <div class="flex bg-slate-100 p-1 rounded-lg">
      <button (click)="viewMode.set('CLIENT')" 
              class="px-4 py-2 rounded-md text-sm font-bold transition flex items-center gap-2"
              [class.bg-white]="viewMode() === 'CLIENT'"
              [class.shadow-sm]="viewMode() === 'CLIENT'"
              [class.text-blue-600]="viewMode() === 'CLIENT'"
              [class.text-slate-500]="viewMode() !== 'CLIENT'">
        Entrées (Clients)
      </button>
      <button (click)="viewMode.set('PARTNER')" 
              class="px-4 py-2 rounded-md text-sm font-bold transition flex items-center gap-2"
              [class.bg-white]="viewMode() === 'PARTNER'"
              [class.shadow-sm]="viewMode() === 'PARTNER'"
              [class.text-purple-600]="viewMode() === 'PARTNER'"
              [class.text-slate-500]="viewMode() !== 'PARTNER'">
        Sorties (Services)
      </button>
    </div>
  </div>

  @if (viewMode() === 'CLIENT') {
    <div class="animate-fade-in space-y-6">
      <div class="flex justify-end gap-4">
        <div class="bg-white px-4 py-2 rounded-lg border border-slate-200 shadow-sm text-right">
          <p class="text-[10px] uppercase text-slate-400 font-bold">Total Encaissé</p>
          <p class="text-lg font-bold text-emerald-600">{{ totalAmount() | number:'1.0-2' }} <span class="text-xs text-slate-500">TND</span></p>
        </div>
        <button (click)="openNewPayment()" class="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium shadow flex items-center">
          <span class="material-icons text-sm mr-2">add</span> Nouveau
        </button>
      </div>
      <div class="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <table class="w-full text-left">
          <thead class="bg-slate-50 border-b border-slate-200">
            <tr>
              <th class="px-6 py-3 text-xs font-bold text-slate-500 uppercase">Date</th>
              <th class="px-6 py-3 text-xs font-bold text-slate-500 uppercase">Client</th>
              <th class="px-6 py-3 text-xs font-bold text-slate-500 uppercase">Mode</th>
              <th class="px-6 py-3 text-right text-xs font-bold text-slate-500 uppercase">Montant</th>
              <th class="px-6 py-3 text-right text-xs font-bold text-slate-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100">
            @for (pay of paginatedClientPayments(); track pay.id) {
              <tr class="hover:bg-slate-50 transition">
                <td class="px-6 py-4 text-sm font-bold text-slate-700">{{ toDate(pay.date) | date:'dd/MM/yyyy' }}</td>
                <td class="px-6 py-4">
                  <a [routerLink]="['/reservations/edit', pay.reservationId]" class="text-sm font-medium text-blue-600 hover:underline">
                    {{ getClientName(pay.reservationId) }}
                  </a>
                </td>
                <td class="px-6 py-4"><span class="px-2 py-1 rounded text-[10px] font-bold uppercase border bg-white">{{ pay.type }}</span></td>
                <td class="px-6 py-4 text-right font-bold text-slate-800">{{ pay.amount | number:'1.0-2' }} DT</td>
                <td class="px-6 py-4 text-right">
                   <button (click)="delete(pay)" class="text-slate-400 hover:text-red-600 p-1"><span class="material-icons">delete</span></button>
                </td>
              </tr>
            }
          </tbody>
        </table>
      </div>
    </div>
  }

  @if (viewMode() === 'PARTNER') {
    <div class="animate-fade-in space-y-6">
      
      <div class="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
        <div class="relative">
             <span class="material-icons absolute left-3 top-2.5 text-slate-400 text-sm">search</span>
             <input type="text" [(ngModel)]="searchQuery" placeholder="Rechercher un service..." class="w-full pl-9 pr-4 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-purple-500 text-sm">
        </div>
      </div>

      <div class="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <table class="w-full text-left border-collapse">
          <thead class="bg-purple-50 border-b border-purple-100">
            <tr>
              <th class="px-6 py-4 text-xs font-bold text-purple-900 uppercase tracking-wider w-1/3">Service & Description</th>
              <th class="px-6 py-4 text-right text-xs font-bold text-purple-900 uppercase tracking-wider">Prix / Coût</th>
              <th class="px-6 py-4 text-right text-xs font-bold text-purple-900 uppercase tracking-wider">Reste à payer</th>
              <th class="px-6 py-4 text-right text-xs font-bold text-purple-900 uppercase tracking-wider">Action</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100">
            @for (item of payableServices(); track item.key) {
              <tr class="hover:bg-purple-50/20 transition group">
                
                <td class="px-6 py-4 align-top">
                  <div class="flex flex-col">
                    <span class="font-bold text-slate-800 text-base mb-1">{{ item.serviceName }}</span>
                    <span class="text-xs text-slate-500 leading-relaxed">{{ item.description }}</span>
                    @if(item.origin === 'PACK') {
                        <span class="text-[10px] font-bold text-orange-600 bg-orange-50 w-fit px-1.5 rounded mt-1">PACK</span>
                    }
                  </div>
                </td>

                <td class="px-6 py-4 text-right align-top">
                   <span class="text-sm font-mono text-slate-600 font-medium">
                      {{ item.cost | number:'1.0-2' }} DT
                   </span>
                </td>

                <td class="px-6 py-4 text-right align-top">
                   @if (item.isPaid) {
                      <span class="text-xs font-bold text-green-600 bg-green-50 px-2 py-1 rounded-full border border-green-100">
                         0.00 DT (Payé)
                      </span>
                   } @else {
                      <span class="text-sm font-bold text-red-600 bg-red-50 px-2 py-1 rounded border border-red-100">
                         {{ item.cost | number:'1.0-2' }} DT
                      </span>
                   }
                </td>

                <td class="px-6 py-4 text-right align-middle">
                   @if (!item.isPaid) {
                      <button (click)="confirmAndPay(item)" 
                              class="bg-purple-600 hover:bg-purple-700 text-white px-5 py-2 rounded-lg text-sm font-bold shadow-md shadow-purple-200 transition transform hover:scale-105">
                        Payer
                      </button>
                   } @else {
                      <button (click)="delete({id: item.paymentId})" 
                              class="text-slate-400 hover:text-red-500 hover:bg-red-50 px-3 py-1.5 rounded-lg text-sm transition" 
                              title="Annuler le paiement">
                        Annuler
                      </button>
                   }
                </td>

              </tr>
            } @empty {
              <tr><td colspan="4" class="p-12 text-center text-slate-400 italic">Aucun service à régler.</td></tr>
            }
          </tbody>
        </table>
      </div>
    </div>
  }

  @if (showModal()) {
    <app-payment-modal 
      [reservation]="null" 
      [paymentToEdit]="paymentToEdit()"
      (onClose)="closeModal()">
    </app-payment-modal>
  }
</div>
EOF

echo "✅ Mise à jour terminée : Affichage épuré (Service, Prix, Reste, Action)."