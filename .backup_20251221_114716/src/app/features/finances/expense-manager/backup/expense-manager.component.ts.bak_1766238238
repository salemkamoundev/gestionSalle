import { Component, Input, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ExpenseService } from '../../../core/services/expense.service';
import { Expense } from '../../../core/models/expense.model';

@Component({
  selector: 'app-expense-manager',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './expense-manager.component.html'
})
export class ExpenseManagerComponent implements OnInit {
  @Input() reservationId: string = '';

  private expenseService: ExpenseService = inject(ExpenseService);
  
  // Signals pour la réactivité
  expenses = signal<Expense[]>([]);

  // Computed Values (Calculs automatiques dès que expenses change)
  totalPack = computed(() => 
    this.expenses()
      .filter(e => e.type === 'PACK_ITEM')
      .reduce((sum, e) => sum + e.amount, 0)
  );

  totalPaid = computed(() => 
    this.expenses()
      .filter(e => e.status === 'PAYE')
      .reduce((sum, e) => sum + e.amount, 0)
  );

  totalRemaining = computed(() => 
    this.expenses()
      .filter(e => e.status === 'A_PAYER')
      .reduce((sum, e) => sum + e.amount, 0)
  );

  ngOnInit() {
    this.loadExpenses();
  }

  loadExpenses() {
    if (this.reservationId) {
      this.expenseService.getByReservationId(this.reservationId).subscribe((data: any) => {
        this.expenses.set(data);
      });
    }
  }

  togglePayment(expense: Expense) {
    this.expenseService.toggleStatus(expense.id);
    this.loadExpenses(); // Recharger pour voir les changements
  }
}
