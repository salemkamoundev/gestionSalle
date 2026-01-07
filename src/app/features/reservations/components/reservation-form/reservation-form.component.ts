import { Component, OnInit, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule, FormsModule } from '@angular/forms';
import { Reservation, PartnerPayment } from '../../../../core/models/reservation.model';
import { PdfService } from '../../../../core/services/pdf.service';

interface PartnerSummary {
  partnerId: string;
  partnerName: string;
  services: string[];
  totalCost: number;
  totalPaid: number;
  remaining: number;
}

@Component({
  selector: 'app-reservation-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule],
  templateUrl: './reservation-form.component.html',
  styleUrls: ['./reservation-form.component.scss']
})
export class ReservationFormComponent implements OnInit {
  @Input() reservation: Reservation | null = null;
  @Output() save = new EventEmitter<Reservation>();
  @Output() cancel = new EventEmitter<void>();

  // Variable d'état pour l'onglet actif
  activeTab: 'client' | 'partner' = 'client';

  clientPaymentForm: FormGroup;
  partnerPaymentForm: FormGroup;
  groupedPartners: PartnerSummary[] = [];

  constructor(
    private fb: FormBuilder,
    private pdfService: PdfService
  ) {
    this.clientPaymentForm = this.fb.group({
      amount: [0, [Validators.required, Validators.min(1)]],
      method: ['ESPECES', Validators.required]
    });

    this.partnerPaymentForm = this.fb.group({
      partnerId: ['', Validators.required],
      amount: [0, [Validators.required, Validators.min(1)]],
      method: ['ESPECES', Validators.required],
      reference: ['']
    });
  }

  ngOnInit(): void {
    if (this.reservation) {
      this.calculatePartnerSummaries();
    }
  }

  // --- GESTION DES ONGLETS ---
  switchTab(tab: 'client' | 'partner') {
    this.activeTab = tab;
  }

  // --- LOGIQUE PARTENAIRES ---
  calculatePartnerSummaries() {
    if (!this.reservation) return;

    const summaryMap = new Map<string, PartnerSummary>();

    this.reservation.services.forEach(service => {
      if (service.partnerId && service.partnerName) {
        if (!summaryMap.has(service.partnerId)) {
          summaryMap.set(service.partnerId, {
            partnerId: service.partnerId,
            partnerName: service.partnerName,
            services: [],
            totalCost: 0,
            totalPaid: 0,
            remaining: 0
          });
        }
        const current = summaryMap.get(service.partnerId)!;
        current.services.push(service.name);
        current.totalCost += (service.cost || 0);
      }
    });

    if (this.reservation.partnerPayments) {
      this.reservation.partnerPayments.forEach(pay => {
        if (summaryMap.has(pay.partnerId)) {
          summaryMap.get(pay.partnerId)!.totalPaid += pay.amount;
        }
      });
    }

    this.groupedPartners = Array.from(summaryMap.values()).map(p => {
      p.remaining = p.totalCost - p.totalPaid;
      return p;
    });
  }

  addPartnerPayment() {
    if (this.partnerPaymentForm.invalid || !this.reservation) return;

    const formVal = this.partnerPaymentForm.value;
    const partner = this.groupedPartners.find(p => p.partnerId === formVal.partnerId);
    
    const newPayment: PartnerPayment = {
      partnerId: formVal.partnerId,
      partnerName: partner ? partner.partnerName : 'Inconnu',
      amount: formVal.amount,
      date: new Date(),
      method: formVal.method,
      reference: formVal.reference
    };

    if (!this.reservation.partnerPayments) {
      this.reservation.partnerPayments = [];
    }
    
    this.reservation.partnerPayments.push(newPayment);
    this.partnerPaymentForm.patchValue({ amount: 0, reference: '' });
    this.calculatePartnerSummaries();
  }

  printPartnerReceipt(payment: PartnerPayment) {
    if (this.reservation) {
      this.pdfService.generatePartnerReceipt(this.reservation, payment);
    }
  }

  printGlobalPartnerReport() {
    if (this.reservation) {
      this.pdfService.generatePartnersSummary(this.reservation, this.groupedPartners);
    }
  }

  // --- LOGIQUE CLIENTS ---
  addClientPayment() {
    if (this.clientPaymentForm.invalid || !this.reservation) return;
    
    const val = this.clientPaymentForm.value;
    const newPay = {
        amount: val.amount,
        date: new Date(),
        method: val.method
    };
    
    if (!this.reservation.clientPayments) {
        this.reservation.clientPayments = [];
    }

    this.reservation.clientPayments.push(newPay);
    this.reservation.advance = (this.reservation.advance || 0) + val.amount;
    
    this.clientPaymentForm.reset({ method: 'ESPECES', amount: 0 });
  }

  getClientRemaining(): number {
      if(!this.reservation) return 0;
      return (this.reservation.totalPrice || 0) - (this.reservation.advance || 0);
  }
}
