import { Component, EventEmitter, Input, Output, computed, inject, signal, OnChanges, SimpleChanges } from '@angular/core';
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
export class ReservationClientBillingComponent implements OnChanges {
  private reservationService = inject(ReservationService);
  private paymentService = inject(PaymentService);
  private ui = inject(UiService);

  @Input() reservationId: string | null = null;
  @Input() totalPrice = 0;
  @Input() advance = 0;
  
  // Cette liste contient TOUT (clients + partenaires), on ne l'affiche pas directement
  @Input() payments: any[] = []; 
  
  @Input() availableCredits: any[] = [];
  @Input() globalCredits: any[] = [];

  @Output() openPaymentModal = new EventEmitter<void>();
  @Output() reloadPayments = new EventEmitter<void>();
  @Output() creditUsed = new EventEmitter<void>();

  // --- NOUVELLES VARIABLES POUR L'AFFICHAGE FILTRÉ ---
  clientPayments: any[] = []; // Liste filtrée (uniquement client)
  totalPaid: number = 0;      // Total payé (Avance + Paiements client)
  remaining: number = 0;      // Reste à payer

  showClientCredits = signal(false);
  showGlobalCredits = signal(false);
  availableCreditSearch = signal('');
  globalCreditSearch = signal('');
  availableCreditPage = signal(1);
  globalCreditsPage = signal(1);
  readonly ITEMS_PER_PAGE = 5;

  // --- CYCLE DE VIE ---
  
  // Se déclenche à chaque fois qu'un @Input change (ex: nouveau paiement ajouté)
  ngOnChanges(changes: SimpleChanges): void {
    if (changes['payments'] || changes['totalPrice'] || changes['advance']) {
      this.processData();
    }
  }

  // Fonction pour filtrer et calculer
  processData() {
    alert("here")
    console.log("payments",this.payments);
    
    // 1. Filtrer : On exclut les paiements qui ont un 'partenaireId'
    // On exclut aussi ceux marqués explicitement comme 'EXPENSE'
    this.clientPayments = (this.payments || []).filter(p => {
        // 1. On vérifie la direction (selon votre JSON, c'est 'EXPENSE' pour les partenaires)
        console.log(p);
        alert("here")
        
        const isExpense = p.direction === 'EXPENSE';
        
        // 2. On vérifie la présence d'un ID partenaire (anciens ou nouveaux champs)
        const hasPartnerId = p.partnerId || p.partenaireId;

        // 3. On ne garde que si ce n'est PAS une dépense ET qu'il n'y a PAS de partenaire
        return !isExpense && !hasPartnerId;
    });

    // 2. Calculer le total des paiements (hors avance)
    const totalPaymentsOnly = this.clientPayments.reduce((acc, p) => acc + (Number(p.amount) || 0), 0);

    // 3. Calculer le total payé (Avance + Paiements)
    this.totalPaid = (Number(this.advance) || 0) + totalPaymentsOnly;

    // 4. Calculer le reste à payer
    this.remaining = (Number(this.totalPrice) || 0) - this.totalPaid;
  }

  // --- LOGIQUE UI ---

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