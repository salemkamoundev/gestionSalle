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
