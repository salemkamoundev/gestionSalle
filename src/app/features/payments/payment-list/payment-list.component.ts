import { Component, inject, computed, signal, OnInit } from '@angular/core';
import { CommonModule, DatePipe, DecimalPipe } from '@angular/common';
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
  description: string;
  
  // Financier
  cost: number;           
  isPaid: boolean;
  amountPaid: number;
  remainingToPay: number;
  
  // Technique
  partnerId?: string;     
  paymentId?: string;
}

@Component({
  selector: 'app-payment-list',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, PaymentModalComponent, DatePipe, DecimalPipe],
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

  // ETAT
  viewMode = signal<'CLIENT' | 'PARTNER'>('PARTNER'); 
  searchQuery = signal('');
  
  page = signal(1);
  pageSize = signal(20);

  showModal = signal(false);
  paymentToEdit = signal<Payment | null>(null);

  ngOnInit() {
    console.log('✅ Vue Règlements chargée (Type Fixed).');
  }

  // ==========================================
  // 🟢 LOGIQUE CLIENT
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
  // 🔵 LOGIQUE PARTENAIRES (Calcul via Services)
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

        const dateStr = res.date ? new Date(res.date).toLocaleDateString('fr-FR') : '';

        // 1. SERVICES DU PACK
        if (res.packId) {
            const pack = packList.find(p => p.id === res.packId);
            if (pack && pack.services) {
                pack.services.forEach(s => {
                    const sId = s.id || s.nom;
                    const uniqueKey = `${res.id}_PACK_${sId}`;
                    const existingPay = expensePayments.find(p => p.reservationId === res.id && p.serviceId === sId && p.origin === 'PACK');
                    
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
                        remainingToPay: existingPay ? 0 : cost, 
                        isPaid: !!existingPay,
                        paymentId: existingPay?.id,
                    });
                });
            }
        }

        // 2. SERVICES PARTENAIRES (Nouvelle Logique)
        const processedPartners = new Set<string>();

        // A. Vérification des services spécifiques liés à un partenaire
        if (res.services && Array.isArray(res.services)) {
            // CORRECTION ICI : Ajout du type explicite (s: any)
            res.services.forEach((s: any) => {
                // On cherche l'ID du partenaire soit dans la résa, soit dans le catalogue
                let pId = s.partnerId;
                if (!pId && s.id) {
                    const catalogS = serviceList.find(cs => cs.id === s.id);
                    pId = catalogS?.partnerId;
                }

                if (pId) {
                    processedPartners.add(pId);
                    const partner = partnerList.find(p => p.id === pId);
                    const sName = s.nom || s.name || 'Service';
                    const sPrice = Number(s.price || s.prix || 0);

                    const uniqueKey = `${res.id}_PARTNER_${pId}_${s.id || sName}`;
                    const existingPay = expensePayments.find(p => p.reservationId === res.id && p.partnerId === pId && p.serviceId === sName);
                    const paid = existingPay ? Number(existingPay.amount) : 0;

                    items.push({
                        key: uniqueKey,
                        reservationId: res.id!,
                        reservationDate: res.date,
                        clientName: res.clientName || 'Client',
                        serviceName: sName,
                        origin: 'PARTNER_SKILL',
                        description: `Assuré par ${partner?.nom || 'Inconnu'} • ${res.clientName} (${dateStr})`,
                        cost: sPrice,
                        amountPaid: paid,
                        remainingToPay: existingPay ? 0 : sPrice,
                        isPaid: !!existingPay,
                        paymentId: existingPay?.id,
                        partnerId: pId
                    });
                }
            });
        }

        // B. Fallback : Partenaires assignés manuellement sans service lié
        if (res.assignedServerIds && Array.isArray(res.assignedServerIds)) {
            res.assignedServerIds.forEach((pId: string) => {
                if (!processedPartners.has(pId)) {
                    const partner = partnerList.find(p => p.id === pId);
                    if (!partner) return;

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

  prevPage() { this.page.set(Math.max(1, this.page() - 1)); }
  nextPage() { this.page.set(Math.min(this.totalClientPages(), this.page() + 1)); }
  getClientName(resId: string) { return this.reservations().find(r => r.id === resId)?.clientName || '-'; }
  toDate(val: any): any { if (!val) return null; try { return (val && val.toDate) ? val.toDate() : new Date(val); } catch(e) { return null; } }
  openNewPayment() { this.paymentToEdit.set(null); this.showModal.set(true); }
  openEditPayment(pay: Payment) { this.paymentToEdit.set(pay); this.showModal.set(true); }
  closeModal() { this.showModal.set(false); this.paymentToEdit.set(null); }
  printReceipt(pay: Payment) { /* ... */ }
}
