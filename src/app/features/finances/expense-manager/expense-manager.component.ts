import { Component, OnInit, inject, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Observable, of, BehaviorSubject, combineLatest } from 'rxjs';
import { map, startWith } from 'rxjs/operators';

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
  
  // Services optionnels (typés as any pour éviter les erreurs si méthodes manquantes)
  private staffService = inject(StaffService) as any;
  private teamService = inject(TeamService) as any;
  private packService = inject(PackService) as any;

  // Formulaire & État
  expenseForm: FormGroup;
  loading = false;
  editingId: string | null = null; // ID si mode édition
  
  // Données observables
  rawExpenses$: Observable<Expense[]>;     // Données brutes de Firestore
  filteredExpenses$: Observable<Expense[]>; // Données filtrées pour l'affichage
  
  // Listes pour les selects
  staffList$: Observable<any[]> = of([]);
  teamList$: Observable<any[]> = of([]);
  packList$: Observable<any[]> = of([]);

  categories: ExpenseCategory[] = ['SALAIRE', 'ACHAT_PACK', 'EQUIPEMENT', 'FACTURE', 'AUTRE'];

  // --- FILTRES ---
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

    // 1. Récupérer les données brutes
    this.rawExpenses$ = this.expenseService.getExpenses();

    // 2. Combiner Données + Filtres pour créer la liste affichée
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

    // Mise à jour automatique du bénéficiaire selon la catégorie
    this.expenseForm.get('category')?.valueChanges.subscribe(cat => {
      // On ne change le type automatiquement que si on n'est pas en train d'éditer
      // ou si l'utilisateur change vraiment la catégorie
      if (!this.editingId) {
        this.updateBeneficiaryType(cat);
      }
    });
  }

  // --- GESTION DES FILTRES (Liés aux inputs HTML via [ngModel]) ---
  updateSearch(val: string) { this.filterSearch.next(val); }
  updateFilterCategory(val: string) { this.filterCategory.next(val); }
  updateStartDate(val: string) { this.filterStartDate.next(val); }
  updateEndDate(val: string) { this.filterEndDate.next(val); }

  // --- ACTIONS CRUD ---

  // 1. Préparer l'édition
  editExpense(expense: Expense) {
    this.editingId = expense.id || null;
    
    // Formater la date pour l'input type="date"
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

    // Scroll vers le formulaire (optionnel, UX)
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // 2. Annuler l'édition
  cancelEdit() {
    this.editingId = null;
    this.expenseForm.reset({
      date: new Date().toISOString().substring(0, 10),
      category: 'AUTRE',
      amount: 0,
      beneficiaryType: 'NONE'
    });
  }

  // 3. Soumettre (Ajout ou Modification)
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
        // MODE MODIFICATION
        await this.expenseService.updateExpense(this.editingId, expenseData);
        this.editingId = null; // Reset après succès
      } else {
        // MODE AJOUT
        await this.expenseService.addExpense(expenseData);
      }

      // Reset formulaire
      this.cancelEdit();

    } catch (error) {
      console.error('Erreur', error);
      alert("Une erreur est survenue lors de l'enregistrement.");
    } finally {
      this.loading = false;
    }
  }

  // 4. Suppression
  async deleteExpense(id: string | undefined) {
    if (!id || !confirm('Voulez-vous vraiment supprimer cette dépense ?')) return;
    try {
      await this.expenseService.deleteExpense(id);
      // Si on supprimait l'élément en cours d'édition
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
    // Chargement défensif des services
    if (typeof this.staffService.getStaffs === 'function') this.staffList$ = this.staffService.getStaffs();
    else if (typeof this.staffService.getAll === 'function') this.staffList$ = this.staffService.getAll();

    if (typeof this.teamService.getTeams === 'function') this.teamList$ = this.teamService.getTeams();
    else if (typeof this.teamService.getAll === 'function') this.teamList$ = this.teamService.getAll();

    if (typeof this.packService.getPacks === 'function') this.packList$ = this.packService.getPacks();
    else if (typeof this.packService.getAll === 'function') this.packList$ = this.packService.getAll();
  }
}
