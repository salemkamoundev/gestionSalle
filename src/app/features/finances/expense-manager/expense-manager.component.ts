import { Component, OnInit, inject, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Observable, of } from 'rxjs';
import { Timestamp } from '@angular/fire/firestore'; 

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

  private fb = inject(FormBuilder);
  private expenseService = inject(ExpenseService);
  
  // Injections souples
  private staffService = inject(StaffService) as any;
  private teamService = inject(TeamService) as any;
  private packService = inject(PackService) as any;

  expenseForm: FormGroup;
  loading = false;
  
  expenses$: Observable<Expense[]>;
  
  staffList$: Observable<any[]> = of([]);
  teamList$: Observable<any[]> = of([]);
  packList$: Observable<any[]> = of([]);

  categories: ExpenseCategory[] = ['SALAIRE', 'ACHAT_PACK', 'EQUIPEMENT', 'FACTURE', 'AUTRE'];

  constructor() {
    this.expenseForm = this.fb.group({
      description: ['', Validators.required],
      amount: [0, [Validators.required, Validators.min(1)]],
      date: [new Date().toISOString().substring(0, 10), Validators.required],
      category: ['AUTRE', Validators.required],
      beneficiaryType: ['NONE'],
      beneficiaryId: [''] 
    });

    this.expenses$ = this.expenseService.getExpenses();
  }

  ngOnInit(): void {
    this.loadExternalDataSafe();

    this.expenseForm.get('category')?.valueChanges.subscribe(cat => {
      this.updateBeneficiaryType(cat);
    });
  }

  /**
   * Méthode Helper pour convertir n'importe quelle date (Timestamp ou Date string)
   * en objet Date JS standard utilisable par le pipe | date
   */
  getNativeDate(date: any): Date {
    if (!date) return new Date();
    // Si c'est un Timestamp Firebase (objet avec méthode toDate)
    if (date && typeof date.toDate === 'function') {
      return date.toDate();
    }
    // Sinon c'est déjà une Date ou une string
    return new Date(date);
  }

  loadExternalDataSafe() {
    // STAFF
    if (typeof this.staffService.getStaffs === 'function') this.staffList$ = this.staffService.getStaffs();
    else if (typeof this.staffService.getAll === 'function') this.staffList$ = this.staffService.getAll();
    else if (typeof this.staffService.getStaffList === 'function') this.staffList$ = this.staffService.getStaffList();

    // TEAMS
    if (typeof this.teamService.getTeams === 'function') this.teamList$ = this.teamService.getTeams();
    else if (typeof this.teamService.getAll === 'function') this.teamList$ = this.teamService.getAll();

    // PACKS
    if (typeof this.packService.getPacks === 'function') this.packList$ = this.packService.getPacks();
    else if (typeof this.packService.getAll === 'function') this.packList$ = this.packService.getAll();
  }

  updateBeneficiaryType(category: string) {
    let type: BeneficiaryType = 'NONE';
    if (category === 'SALAIRE') type = 'STAFF';
    else if (category === 'ACHAT_PACK') type = 'PACK';
    this.expenseForm.patchValue({ beneficiaryType: type });
  }

  async onSubmit() {
    if (this.expenseForm.invalid) return;

    this.loading = true;
    try {
      const formVal = this.expenseForm.value;
      
      const newExpense: Expense = {
        description: formVal.description,
        amount: formVal.amount,
        date: new Date(formVal.date),
        category: formVal.category,
        beneficiaryType: formVal.beneficiaryType,
        beneficiaryId: formVal.beneficiaryId
      };

      await this.expenseService.addExpense(newExpense);
      this.expenseForm.reset({
        date: new Date().toISOString().substring(0, 10),
        category: 'AUTRE',
        amount: 0,
        beneficiaryType: 'NONE'
      });
    } catch (error) {
      console.error('Erreur', error);
    } finally {
      this.loading = false;
    }
  }

  async deleteExpense(id: string | undefined) {
    if (!id || !confirm('Supprimer ?')) return;
    await this.expenseService.deleteExpense(id);
  }
}
