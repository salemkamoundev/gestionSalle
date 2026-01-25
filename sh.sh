#!/bin/bash

# Fichier cible
FILE="src/app/features/dashboard/dashboard.component.ts"

echo "Correction complète du DashboardComponent..."

cat > "$FILE" << 'EOF'
import { Component, computed, inject } from '@angular/core';
import { CommonModule, DatePipe, DecimalPipe } from '@angular/common';
import { RouterLink, Router } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { ReservationService } from '../../core/services/reservation.service';
import { ExpenseService } from '../../core/services/expense.service';
import { PaymentService } from '../../core/services/payment.service';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink, DatePipe, DecimalPipe],
  templateUrl: './dashboard.component.html'
})
export class DashboardComponent {
  private reservationService = inject(ReservationService);
  private expenseService = inject(ExpenseService);
  private paymentService = inject(PaymentService);
  private router = inject(Router);

  // --- DATA SOURCES ---
  allReservations = toSignal(this.reservationService.getAll(), { initialValue: [] as any[] });
  // Correction: Utilisation de getExpenses() au lieu de getAll()
  allExpenses = toSignal(this.expenseService.getExpenses(), { initialValue: [] as any[] });
  allPayments = toSignal(this.paymentService.getAll(), { initialValue: [] as any[] });

  // --- KPIS GLOBAUX ---
  
  totalReservations = computed(() => {
    return this.allReservations().filter(r => r.status !== 'CANCELLED' && r.status !== 'ANNULEE').length;
  });

  totalRevenue = computed(() => {
    return this.allReservations()
      .filter(r => r.status !== 'CANCELLED' && r.status !== 'ANNULEE')
      .reduce((acc, curr) => acc + (Number(curr.totalPrice) || 0), 0);
  });

  todayReservations = computed(() => {
    const today = new Date().toISOString().split('T')[0];
    return this.allReservations().filter(r => r.date === today && r.status !== 'CANCELLED' && r.status !== 'ANNULEE');
  });

  // --- LISTES FILTRÉES (Logique 7 Jours) ---

  // 1. Prochaines Réservations (Futur - 7 prochains jours)
  upcomingReservations = computed(() => {
    const now = new Date();
    const today = now.toISOString().split('T')[0];
    
    const sevenDaysLaterDate = new Date(now);
    sevenDaysLaterDate.setDate(sevenDaysLaterDate.getDate() + 7);
    const sevenDaysLater = sevenDaysLaterDate.toISOString().split('T')[0];

    return this.allReservations()
      .filter(r => {
        if (r.status === 'CANCELLED' || r.status === 'ANNULEE') return false;
        // Strictement futur ou aujourd'hui, jusqu'à J+7
        return r.date >= today && r.date <= sevenDaysLater;
      })
      .sort((a, b) => a.date.localeCompare(b.date));
  });

  // 2. Retards de Paiement (Passé - 7 derniers jours seulement)
  // Nommé 'pastUnpaidReservations' pour correspondre au template HTML existant
  pastUnpaidReservations = computed(() => {
    const now = new Date();
    const today = now.toISOString().split('T')[0];
    
    const sevenDaysAgoDate = new Date(now);
    sevenDaysAgoDate.setDate(sevenDaysAgoDate.getDate() - 7);
    const sevenDaysAgo = sevenDaysAgoDate.toISOString().split('T')[0];

    return this.allReservations()
      .filter(r => {
        if (r.status === 'CANCELLED' || r.status === 'ANNULEE') return false;

        // Condition temporelle : Passé mais récent (>= J-7 et < Aujourd'hui)
        const isRecentPast = r.date < today && r.date >= sevenDaysAgo;
        
        // Condition financière : Reste à payer > 0
        const total = Number(r.totalPrice) || 0;
        const paid = Number(r.advance) || 0;
        
        return isRecentPast && (paid < total);
      })
      .sort((a, b) => b.date.localeCompare(a.date)); // Plus récent en premier
  });

  // --- HELPERS UI ---

  navigateToReservation(id: string) {
    this.router.navigate(['/reservations/edit', id]);
  }

  getStatusLabel(status: string): string {
    switch(status) {
        case 'CONFIRMED': case 'CONFIRMEE': return 'Confirmée';
        case 'PENDING': case 'EN_ATTENTE': return 'En attente';
        case 'COMPLETED': case 'TERMINEE': return 'Terminée';
        case 'CANCELLED': case 'ANNULEE': return 'Annulée';
        default: return status;
    }
  }

  getStatusClass(status: string): string {
    switch(status) {
        case 'CONFIRMED': case 'CONFIRMEE': return 'bg-emerald-50 text-emerald-700 border-emerald-100';
        case 'PENDING': case 'EN_ATTENTE': return 'bg-amber-50 text-amber-700 border-amber-100';
        case 'COMPLETED': case 'TERMINEE': return 'bg-blue-50 text-blue-700 border-blue-100';
        case 'CANCELLED': case 'ANNULEE': return 'bg-red-50 text-red-700 border-red-100';
        default: return 'bg-slate-50 text-slate-700 border-slate-100';
    }
  }
}
EOF

echo "✅ Dashboard corrigé et compilation réparée."