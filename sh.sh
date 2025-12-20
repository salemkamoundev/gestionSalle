#!/bin/bash

# ==========================================
# CONFIGURATION
# ==========================================
BASE_PATH="src/app"
FEATURE_DIR="$BASE_PATH/features/finances/expense-manager"

echo "🚑 Correction finale des erreurs de Date et Timestamp..."

# ==========================================
# 1. MISE À JOUR DU COMPONENT TS
#    (Ajout de la méthode helper 'getNativeDate')
# ==========================================
echo "🔧 Mise à jour du Component TS..."

cat <<'EOF' > "$FEATURE_DIR/expense-manager.component.ts"
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
EOF

# ==========================================
# 2. MISE À JOUR DU COMPONENT HTML
#    (Utilisation de getNativeDate() pour nettoyer le template)
# ==========================================
echo "🔧 Mise à jour du Component HTML..."

cat <<'EOF' > "$FEATURE_DIR/expense-manager.component.html"
<div class="container mx-auto p-4 lg:p-6 space-y-6">
  
  <header class="flex flex-col md:flex-row justify-between items-start md:items-center mb-4">
    <div>
      <h1 class="text-2xl font-bold text-gray-800">Gestion des Dépenses</h1>
      <p class="text-sm text-gray-500">Gérez les sorties d'argent (Salaires, Achats...)</p>
    </div>
  </header>

  <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
    
    <div class="lg:col-span-1">
      <div class="bg-white rounded-xl shadow-md p-5 border border-gray-100">
        <h2 class="text-lg font-semibold mb-4 text-gray-700">Ajouter une dépense</h2>
        
        <form [formGroup]="expenseForm" (ngSubmit)="onSubmit()" class="space-y-3">
          
          <div>
            <label class="block text-xs font-medium text-gray-700 mb-1">Type de dépense</label>
            <select formControlName="category" class="w-full rounded border-gray-300 p-2 text-sm focus:ring-2 focus:ring-blue-500">
              <option *ngFor="let cat of categories" [value]="cat">{{ cat }}</option>
            </select>
          </div>

          <div>
            <label class="block text-xs font-medium text-gray-700 mb-1">Description</label>
            <input type="text" formControlName="description" placeholder="Ex: Salaire..." 
                   class="w-full rounded border-gray-300 p-2 text-sm focus:ring-2 focus:ring-blue-500">
          </div>

          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="block text-xs font-medium text-gray-700 mb-1">Montant (TND)</label>
              <input type="number" formControlName="amount" min="0" 
                     class="w-full rounded border-gray-300 p-2 text-sm font-bold text-right">
            </div>
            <div>
              <label class="block text-xs font-medium text-gray-700 mb-1">Date</label>
              <input type="date" formControlName="date" 
                     class="w-full rounded border-gray-300 p-2 text-sm">
            </div>
          </div>

          <div class="bg-gray-50 p-3 rounded border border-gray-200 mt-2">
            <p class="text-xs font-bold text-gray-500 uppercase mb-2">Lier à :</p>

            <div class="flex flex-wrap gap-3 mb-2 text-xs">
              <label class="flex items-center gap-1 cursor-pointer">
                <input type="radio" formControlName="beneficiaryType" value="NONE"> Aucun
              </label>
              <label class="flex items-center gap-1 cursor-pointer">
                <input type="radio" formControlName="beneficiaryType" value="STAFF"> Staff
              </label>
              <label class="flex items-center gap-1 cursor-pointer">
                <input type="radio" formControlName="beneficiaryType" value="TEAM"> Équipe
              </label>
              <label class="flex items-center gap-1 cursor-pointer">
                <input type="radio" formControlName="beneficiaryType" value="PACK"> Pack
              </label>
            </div>

            <div *ngIf="expenseForm.get('beneficiaryType')?.value === 'STAFF'">
              <select formControlName="beneficiaryId" class="w-full rounded border-gray-300 p-2 text-xs">
                <option value="">-- Choisir Employé --</option>
                <option *ngFor="let s of staffList$ | async" [value]="s.id">
                  {{ s.firstName }} {{ s.lastName }} {{ s.nom }} {{ s.name }}
                </option>
              </select>
            </div>

            <div *ngIf="expenseForm.get('beneficiaryType')?.value === 'TEAM'">
              <select formControlName="beneficiaryId" class="w-full rounded border-gray-300 p-2 text-xs">
                <option value="">-- Choisir Équipe --</option>
                <option *ngFor="let t of teamList$ | async" [value]="t.id">
                  {{ t.name || t.nom || t.label || 'Équipe sans nom' }}
                </option>
              </select>
            </div>

            <div *ngIf="expenseForm.get('beneficiaryType')?.value === 'PACK'">
              <select formControlName="beneficiaryId" class="w-full rounded border-gray-300 p-2 text-xs">
                <option value="">-- Choisir Pack --</option>
                <option *ngFor="let p of packList$ | async" [value]="p.id">
                  {{ p.name || p.nom || p.title || 'Pack' }} ({{ p.price || p.prix }} TND)
                </option>
              </select>
            </div>
          </div>

          <button type="submit" [disabled]="expenseForm.invalid || loading"
                  class="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded shadow mt-2 text-sm disabled:opacity-50">
            {{ loading ? 'Enregistrement...' : 'Valider' }}
          </button>
        </form>
      </div>
    </div>

    <div class="lg:col-span-2">
      <div class="bg-white rounded-xl shadow-md border border-gray-100 overflow-hidden">
        <div class="overflow-x-auto">
          <table class="w-full text-left border-collapse">
            <thead>
              <tr class="bg-gray-100 text-gray-600 text-xs uppercase">
                <th class="p-3">Date</th>
                <th class="p-3">Info</th>
                <th class="p-3 text-right">Montant</th>
                <th class="p-3 text-center">Action</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-100 text-sm">
              <tr *ngFor="let expense of expenses$ | async" class="hover:bg-gray-50">
                <td class="p-3 text-gray-500 whitespace-nowrap">
                  {{ getNativeDate(expense.date) | date:'dd/MM/yyyy' }}
                </td>
                <td class="p-3">
                  <div class="font-medium text-gray-800">{{ expense.description }}</div>
                  <div class="text-xs text-gray-400">{{ expense.category }}</div>
                </td>
                <td class="p-3 text-right font-bold text-red-600">
                  - {{ expense.amount | number:'1.2-2' }} 
                </td>
                <td class="p-3 text-center">
                  <button (click)="deleteExpense(expense.id)" class="text-red-400 hover:text-red-600">
                    <i class="fa-solid fa-trash"></i>
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </div>
</div>
EOF

echo "✅ Correction terminée. Relance ng serve."