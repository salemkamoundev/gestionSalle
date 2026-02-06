import { Component, EventEmitter, Input, Output, inject, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { UiService } from '../../../../../core/services/ui.service';
import { ContractPdfService } from '../../../../../core/services/contract-pdf.service';
import { PaymentService } from '../../../../../core/services/payment.service'; // AJOUT

@Component({
  selector: 'app-reservation-partner-finance',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, DatePipe],
  templateUrl: './partner-finance.component.html'
})
export class ReservationPartnerFinanceComponent implements OnChanges {
  private fb = inject(FormBuilder);
  private ui = inject(UiService);
  private contractPdfService = inject(ContractPdfService);
  private paymentService = inject(PaymentService); // Injection du service

  @Input() reservationId: string | null = null;
  @Input() fullReservationData: any = {};
  @Input() clientName: string = 'Client';
  @Input() assignedServerIds: string[] = [];
  @Input() selectedServices: any[] = [];
  @Input() allPartenaires: any[] = [];
  
  // On reçoit la liste complète (mixte) des paiements
  @Input() partnerPayments: any[] = [];

  // On notifie le parent qu'il faut recharger les données
  @Output() paymentsUpdated = new EventEmitter<void>();

  partnerPaymentForm: FormGroup;
  
  // Variable pour stocker les données calculées
  groupedPartnersData: any

  constructor() {
    this.partnerPaymentForm = this.fb.group({
      partnerId: ['', Validators.required],
      amount: [0, [Validators.required, Validators.min(1)]],
      method: ['ESPECES', Validators.required],
      reference: ['']
    });
  }

  // --- CYCLE DE VIE ---
  ngOnChanges(changes: SimpleChanges): void {
    // On recalcule si l'une des entrées change
    if (changes['partnerPayments'] || changes['selectedServices'] || changes['assignedServerIds']) {
      this.calculatePartnerFinance();
    }
  }

  calculatePartnerFinance() {
    const pIds = this.assignedServerIds || [];
    const services = this.selectedServices || [];
    const payments = this.partnerPayments || [];
    const partnersList = this.allPartenaires || [];

    this.groupedPartnersData = pIds.map((pid: string) => {
        const partnerDef = partnersList.find((p: any) => p.id === pid);
        
        // Services liés à ce partenaire
        const partnerServices = services.filter(s => 
            (partnerDef?.serviceIds && partnerDef.serviceIds.includes(s.id)) || (s.partnerId === pid)
        );

        // Coût total des services
        const totalCost = partnerServices.reduce((acc, s) => acc + (Number(s.cost || s.price || 0)), 0);
        
        // Somme des paiements VERSÉS à ce partenaire
        // On filtre bien sur 'partnerId' === pid
        const totalPaid = payments
            .filter(pay => pay.partnerId === pid)
            .reduce((acc, pay) => acc + (Number(pay.amount) || 0), 0);

        return {
            partnerId: pid,
            partnerName: partnerDef ? `${partnerDef.nom} ${partnerDef.prenom || ''}` : 'Inconnu',
            services: partnerServices.map(s => s.name || s.nom),
            totalCost: totalCost,
            totalPaid: totalPaid,
            remaining: totalCost - totalPaid
        };
    });
  }

  // --- ACTIONS ---

  async addPartnerPayment() {
    if (this.partnerPaymentForm.invalid) return;
    if (!this.reservationId) {
        this.ui.showToast('error', 'Sauvegardez la réservation avant d\'ajouter un paiement');
        return;
    }

    const val = this.partnerPaymentForm.value;
    const partner = this.allPartenaires.find(p => p.id === val.partnerId);
    
    // Création de l'objet paiement (Compatible avec PaymentService)
    const newPayment = {
        reservationId: this.reservationId,
        partenaireId: val.partnerId,
        partnerId: val.partnerId,
        partnerName: partner ? `${partner.nom}` : 'Inconnu',
        amount: Number(val.amount),
        method: val.method,
        reference: val.reference,
        type: 'EXPENSE', // Type explicite
        date: new Date().toISOString() // Format ISO pour Firestore
    };

    try {
        // Enregistrement via le service (comme pour les clients)
        await this.paymentService.add(newPayment);
        
        this.ui.showToast('success', 'Règlement partenaire enregistré');
        this.partnerPaymentForm.patchValue({ amount: 0, reference: '' });
        
        // On demande au parent de recharger la liste des paiements
        this.paymentsUpdated.emit();
        
    } catch (e) {
        console.error(e);
        this.ui.showToast('error', 'Erreur lors de l\'enregistrement');
    }
  }

  // --- UTILITAIRES ---

  printPartnerReceipt(payment: any) {
    const resData = { ...this.fullReservationData, clientName: this.clientName };
    this.contractPdfService.generatePartnerReceipt(resData, payment);
  }

  printGlobalPartnerReport() {
    const resData = { ...this.fullReservationData, clientName: this.clientName };
    this.contractPdfService.generatePartnersSummary(resData, this.groupedPartnersData);
  }

  printSinglePartnerReport(partner: any) {
    const resData = { ...this.fullReservationData, clientName: this.clientName, id: this.reservationId };
    this.contractPdfService.generateSinglePartnerReport(resData, partner);
  }

  getDateObject(ts: any): Date { return ts?.toDate ? ts.toDate() : new Date(ts || new Date()); }
}