import { Component, OnInit, inject, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Observable, BehaviorSubject, combineLatest } from 'rxjs';
import { map } from 'rxjs/operators';

// Services
import { ExpenseService } from '../../../core/services/expense.service';

// Model
import { Expense } from '../../../core/models/expense.model';

@Component({
  selector: 'app-expense-manager',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  templateUrl: './expense-manager.component.html',
  styles: []
})
export class ExpenseManagerComponent implements OnInit {
  @Input() reservationId: string | null = null;

  viewMode: 'LIST' | 'FORM' = 'LIST'; 

  private fb = inject(FormBuilder);
  private expenseService = inject(ExpenseService);
  
  expenseForm: FormGroup;
  loading = false;
  editingId: string | null = null;
  
  rawExpenses$: Observable<Expense[]>;
  filteredExpenses$: Observable<Expense[]>;
  
  // Filtres
  filterSearch = new BehaviorSubject<string>('');
  filterStartDate = new BehaviorSubject<string>('');
  filterEndDate = new BehaviorSubject<string>('');

  constructor() {
    this.expenseForm = this.fb.group({
      description: ['', Validators.required],
      amount: [0, [Validators.required, Validators.min(0.1)]],
      date: [new Date().toISOString().substring(0, 10), Validators.required]
    });

    this.rawExpenses$ = this.expenseService.getExpenses();

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

  ngOnInit(): void {
  }

  setView(mode: 'LIST' | 'FORM') {
    this.viewMode = mode;
    if (mode === 'LIST' && this.editingId) {
        this.cancelEdit();
    }
  }

  updateSearch(val: string) { this.filterSearch.next(val); }
  updateStartDate(val: string) { this.filterStartDate.next(val); }
  updateEndDate(val: string) { this.filterEndDate.next(val); }

  editExpense(expense: Expense) {
    this.editingId = expense.id || null;
    this.viewMode = 'FORM'; 
    
    const dateObj = this.getNativeDate(expense.date);
    const dateStr = dateObj.toISOString().substring(0, 10);

    this.expenseForm.patchValue({
      description: expense.description,
      amount: expense.amount,
      date: dateStr
    });
  }

  cancelEdit() {
    this.editingId = null;
    this.expenseForm.reset({
      date: new Date().toISOString().substring(0, 10),
      amount: 0
    });
    this.viewMode = 'LIST';
  }

  async onSubmit() {
    if (this.expenseForm.invalid) return;

    this.loading = true;
    try {
      const formVal = this.expenseForm.value;
      const expenseData: any = {
        description: formVal.description,
        amount: formVal.amount,
        date: new Date(formVal.date)
      };

      if (this.editingId) {
        await this.expenseService.updateExpense(this.editingId, expenseData);
        this.editingId = null;
      } else {
        await this.expenseService.addExpense(expenseData);
      }

      this.expenseForm.reset({
        date: new Date().toISOString().substring(0, 10),
        amount: 0
      });
      
      this.viewMode = 'LIST';

    } catch (error) {
      console.error('Erreur', error);
    } finally {
      this.loading = false;
    }
  }

  async deleteExpense(id: string | undefined) {
    if (!id || !confirm('Voulez-vous vraiment supprimer cette dépense ?')) return;
    try {
      await this.expenseService.deleteExpense(id);
      if (this.editingId === id) this.cancelEdit();
    } catch (e) {
      console.error(e);
    }
  }

  getNativeDate(date: any): Date {
    if (!date) return new Date();
    if (date && typeof date.toDate === 'function') return date.toDate();
    return new Date(date);
  }
}
