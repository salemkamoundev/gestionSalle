import { Component, OnInit, inject, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Observable, of, BehaviorSubject, combineLatest } from 'rxjs';
import { map } from 'rxjs/operators';

// Services
import { ExpenseService } from '../../../core/services/expense.service';
import { StaffService } from '../../../core/services/staff.service';
import { TeamService } from '../../../core/services/team.service';
import { PackService } from '../../../core/services/pack.service';

// Model
import { Expense, ExpenseCategory, BeneficiaryType } from '../../../core/models/expense.model';

@Component({
  selector: 'app-expense-manager',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  templateUrl: './expense-manager.component.html',
  styles: []
})
export class ExpenseManagerComponent implements OnInit {
  @Input() reservationId: string | null = null;

  // --- GESTION DES ONGLETS ---
  viewMode: 'LIST' | 'FORM' = 'LIST'; // Par défaut : Historique

  private fb = inject(FormBuilder);
  private expenseService = inject(ExpenseService);
  
  private staffService = inject(StaffService) as any;
  private teamService = inject(TeamService) as any;
  private packService = inject(PackService) as any;

  expenseForm: FormGroup;
  loading = false;
  editingId: string | null = null;
  
  rawExpenses$: Observable<Expense[]>;
  filteredExpenses$: Observable<Expense[]>;
  
  staffList$: Observable<any[]> = of([]);
  teamList$: Observable<any[]> = of([]);
  packList$: Observable<any[]> = of([]);

  categories: ExpenseCategory[] = ['SALAIRE', 'ACHAT_PACK', 'EQUIPEMENT', 'FACTURE', 'AUTRE'];

  // Filtres
  filterSearch = new BehaviorSubject<string>('');
  filterCategory = new BehaviorSubject<string>('ALL');
  filterStartDate = new BehaviorSubject<string>('');
  filterEndDate = new BehaviorSubject<string>('');

  constructor() {
    this.expenseForm = this.fb.group({
      description: ['', Validators.required],
      amount: [0, [Validators.required, Validators.min(0.1)]],
      date: [new Date().toISOString().substring(0, 10), Validators.required],
      category: ['AUTRE', Validators.required],
      beneficiaryType: ['NONE'],
      beneficiaryId: [''] 
    });

    this.rawExpenses$ = this.expenseService.getExpenses();

    this.filteredExpenses$ = combineLatest([
      this.rawExpenses$,
      this.filterSearch,
      this.filterCategory,
      this.filterStartDate,
      this.filterEndDate
    ]).pipe(
      map(([expenses, search, category, start, end]) => {
        return expenses.filter(exp => {
          const expDate = this.getNativeDate(exp.date);
          const matchesSearch = !search || exp.description.toLowerCase().includes(search.toLowerCase());
          const matchesCategory = category === 'ALL' || exp.category === category;
          
          let matchesDate = true;
          if (start) matchesDate = matchesDate && expDate >= new Date(start);
          if (end) matchesDate = matchesDate && expDate <= new Date(end);

          return matchesSearch && matchesCategory && matchesDate;
        });
      })
    );
  }

  ngOnInit(): void {
    this.loadExternalDataSafe();

    this.expenseForm.get('category')?.valueChanges.subscribe(cat => {
      if (!this.editingId) {
        this.updateBeneficiaryType(cat);
      }
    });
  }

  // --- ACTIONS ONGLETS ---
  setView(mode: 'LIST' | 'FORM') {
    this.viewMode = mode;
    if (mode === 'LIST' && this.editingId) {
        this.cancelEdit(); // Si on quitte le formulaire, on annule l'édition
    }
  }

  // --- FILTRES ---
  updateSearch(val: string) { this.filterSearch.next(val); }
  updateFilterCategory(val: string) { this.filterCategory.next(val); }
  updateStartDate(val: string) { this.filterStartDate.next(val); }
  updateEndDate(val: string) { this.filterEndDate.next(val); }

  // --- CRUD ---

  editExpense(expense: Expense) {
    this.editingId = expense.id || null;
    
    // Basculer vers l'onglet formulaire
    this.viewMode = 'FORM'; 
    
    const dateObj = this.getNativeDate(expense.date);
    const dateStr = dateObj.toISOString().substring(0, 10);

    this.expenseForm.patchValue({
      description: expense.description,
      amount: expense.amount,
      date: dateStr,
      category: expense.category,
      beneficiaryType: expense.beneficiaryType || 'NONE',
      beneficiaryId: expense.beneficiaryId || ''
    });
  }

  cancelEdit() {
    this.editingId = null;
    this.expenseForm.reset({
      date: new Date().toISOString().substring(0, 10),
      category: 'AUTRE',
      amount: 0,
      beneficiaryType: 'NONE'
    });
    // Retourner à la liste
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
        date: new Date(formVal.date),
        category: formVal.category,
        beneficiaryType: formVal.beneficiaryType,
        beneficiaryId: formVal.beneficiaryId
      };

      if (this.editingId) {
        await this.expenseService.updateExpense(this.editingId, expenseData);
        this.editingId = null;
      } else {
        await this.expenseService.addExpense(expenseData);
      }

      this.expenseForm.reset({
        date: new Date().toISOString().substring(0, 10),
        category: 'AUTRE',
        amount: 0,
        beneficiaryType: 'NONE'
      });
      
      // Retour automatique à la liste après ajout réussi
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

  // --- HELPERS ---

  getNativeDate(date: any): Date {
    if (!date) return new Date();
    if (date && typeof date.toDate === 'function') return date.toDate();
    return new Date(date);
  }

  updateBeneficiaryType(category: string) {
    let type: BeneficiaryType = 'NONE';
    if (category === 'SALAIRE') type = 'STAFF';
    else if (category === 'ACHAT_PACK') type = 'PACK';
    this.expenseForm.patchValue({ beneficiaryType: type });
  }

  loadExternalDataSafe() {
    if (typeof this.staffService.getStaffs === 'function') this.staffList$ = this.staffService.getStaffs();
    else if (typeof this.staffService.getAll === 'function') this.staffList$ = this.staffService.getAll();

    if (typeof this.teamService.getTeams === 'function') this.teamList$ = this.teamService.getTeams();
    else if (typeof this.teamService.getAll === 'function') this.teamList$ = this.teamService.getAll();

    if (typeof this.packService.getPacks === 'function') this.packList$ = this.packService.getPacks();
    else if (typeof this.packService.getAll === 'function') this.packList$ = this.packService.getAll();
  }
}
