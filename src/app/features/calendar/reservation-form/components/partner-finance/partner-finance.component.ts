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
