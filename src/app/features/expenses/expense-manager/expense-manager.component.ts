import { Component, OnInit, inject, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Observable, BehaviorSubject, combineLatest } from 'rxjs';
import { map } from 'rxjs/operators';

// Services & Models (Chemins relatifs standards)
import { ExpenseService } from '../../../core/services/expense.service';
import { Expense } from '../../../core/models/expense.model';
import { AdminConfirmDialogComponent } from '../../../shared/components/admin-confirm-dialog/admin-confirm-dialog.component';

@Component({
  selector: 'app-expense-manager',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, AdminConfirmDialogComponent],
  templateUrl: './expense-manager.component.html'
})
export class ExpenseManagerComponent {
  @Input() reservationId: string | null = null;

  private fb = inject(FormBuilder);
  private expenseService = inject(ExpenseService);
  
  // ÉTAT VISUEL
  showFormModal = false; // Remplace viewMode pour éviter que la liste disparaisse
  showAdminAuth = false; // Pour la popup de sécurité
  loading = false;
  
  // DONNÉES
  editingId: string | null = null;
  expenseForm: FormGroup;
  rawExpenses$: Observable<Expense[]>;
  filteredExpenses$: Observable<Expense[]>;
  
  // FILTRES
  filterSearch = new BehaviorSubject<string>('');
  filterStartDate = new BehaviorSubject<string>('');
  filterEndDate = new BehaviorSubject<string>('');

  // SÉCURITÉ (Action en attente)
  pendingAction: 'EDIT' | 'DELETE' | null = null;
  pendingData: any = null;

  constructor() {
    this.expenseForm = this.fb.group({
      description: ['', Validators.required],
      amount: [0, [Validators.required, Validators.min(0.1)]],
      date: [new Date().toISOString().substring(0, 10), Validators.required]
    });

    this.rawExpenses$ = this.expenseService.getExpenses();

    // Logique de filtrage
    this.filteredExpenses$ = combineLatest([
      this.rawExpenses$,
      this.filterSearch,
      this.filterStartDate,
      this.filterEndDate
    ]).pipe(
      map(([expenses, search, start, end]) => {
        return expenses.filter(exp => {
          const expDate = this.getNativeDate(exp.date);
          const matchesSearch = !search || exp.description.toLowerCase().includes(search.toLowerCase());
          let matchesDate = true;
          if (start) matchesDate = matchesDate && expDate >= new Date(start);
          if (end) matchesDate = matchesDate && expDate <= new Date(end);
          return matchesSearch && matchesDate;
        });
      })
    );
  }

  // --- GESTION MODALE ---
  openNewExpense() {
    this.editingId = null;
    this.expenseForm.reset({
      date: new Date().toISOString().substring(0, 10),
      amount: 0
    });
    this.showFormModal = true;
  }

  closeFormModal() {
    this.showFormModal = false;
    this.editingId = null;
  }

  // --- FILTRES ---
  updateSearch(e: any) { this.filterSearch.next(e.target.value); }
  updateStartDate(e: any) { this.filterStartDate.next(e.target.value); }
  updateEndDate(e: any) { this.filterEndDate.next(e.target.value); }

  // --- SÉCURITÉ ADMIN (INTERCEPTION) ---

  requestEdit(expense: Expense) {
    this.pendingAction = 'EDIT';
    this.pendingData = expense;
    this.showAdminAuth = true; // Ouvre la sécurité d'abord
  }

  requestDelete(id: string | undefined) {
    if (!id) return;
    this.pendingAction = 'DELETE';
    this.pendingData = id;
    this.showAdminAuth = true; // Ouvre la sécurité d'abord
  }

  onAdminAuthSuccess() {
    this.showAdminAuth = false;
    
    // Exécution différée après mot de passe OK
    if (this.pendingAction === 'EDIT') {
      this.openEditForm(this.pendingData);
    } else if (this.pendingAction === 'DELETE') {
      this.performDelete(this.pendingData);
    }
    
    this.pendingAction = null;
    this.pendingData = null;
  }

  // --- ACTIONS RÉELLES ---

  private openEditForm(expense: Expense) {
    this.editingId = expense.id || null;
    const dateObj = this.getNativeDate(expense.date);
    this.expenseForm.patchValue({
      description: expense.description,
      amount: expense.amount,
      date: dateObj.toISOString().substring(0, 10)
    });
    this.showFormModal = true; // Ouvre la modale formulaire
  }

  private async performDelete(id: string) {
    if(!confirm('Êtes-vous sûr de vouloir supprimer définitivement ?')) return;
    try {
      await this.expenseService.deleteExpense(id);
    } catch (e) { console.error(e); }
  }

  async onSubmit() {
    if (this.expenseForm.invalid) return;
    this.loading = true;
    try {
      const data = {
        ...this.expenseForm.value,
        date: new Date(this.expenseForm.value.date)
      };

      if (this.editingId) {
        await this.expenseService.updateExpense(this.editingId, data);
      } else {
        await this.expenseService.addExpense(data);
      }
      this.closeFormModal();
    } catch (e) { console.error(e); }
    finally { this.loading = false; }
  }

  getNativeDate(date: any): Date {
    return date?.toDate ? date.toDate() : new Date(date || new Date());
  }
}
