#!/bin/bash

# ==============================================================================
# CONFIGURATION DES CHEMINS
# ==============================================================================
BASE_PATH="src/app"
MODELS_DIR="$BASE_PATH/core/models"
SERVICES_DIR="$BASE_PATH/core/services"
FEATURE_DIR="$BASE_PATH/features/finances/expense-manager"

# Couleurs pour le terminal
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}🚀 Démarrage de l'installation du module Dépenses...${NC}"

# ==============================================================================
# 1. SAUVEGARDES DE SÉCURITÉ
# ==============================================================================
echo -e "${BLUE}💾 Création des sauvegardes...${NC}"
mkdir -p "$FEATURE_DIR/backup"

[ -f "$FEATURE_DIR/expense-manager.component.ts" ] && cp "$FEATURE_DIR/expense-manager.component.ts" "$FEATURE_DIR/backup/expense-manager.component.ts.bak_$(date +%s)"
[ -f "$FEATURE_DIR/expense-manager.component.html" ] && cp "$FEATURE_DIR/expense-manager.component.html" "$FEATURE_DIR/backup/expense-manager.component.html.bak_$(date +%s)"

# ==============================================================================
# 2. CRÉATION DU MODÈLE (Expense)
# ==============================================================================
echo -e "${GREEN}📝 Création du modèle Expense...${NC}"

cat <<'EOF' > "$MODELS_DIR/expense.model.ts"
import { Timestamp } from '@angular/fire/firestore';

export type ExpenseCategory = 'SALAIRE' | 'ACHAT_PACK' | 'EQUIPEMENT' | 'FACTURE' | 'AUTRE';
export type BeneficiaryType = 'STAFF' | 'TEAM' | 'PACK' | 'NONE';

export interface Expense {
  id?: string;
  description: string;
  amount: number;
  date: Date | Timestamp;
  category: ExpenseCategory;
  
  // Relations dynamiques
  beneficiaryType: BeneficiaryType;
  beneficiaryId?: string;   // ID du Staff, de l'Équipe ou du Pack
  beneficiaryName?: string; // Nom stocké pour affichage facile
  
  createdAt?: Date;
}
EOF

# ==============================================================================
# 3. CRÉATION DU SERVICE (ExpenseService)
# ==============================================================================
echo -e "${GREEN}⚙️  Création du service ExpenseService...${NC}"

cat <<'EOF' > "$SERVICES_DIR/expense.service.ts"
import { Injectable, inject } from '@angular/core';
import { Firestore, collection, addDoc, deleteDoc, doc, collectionData, query, orderBy, Timestamp } from '@angular/fire/firestore';
import { Observable } from 'rxjs';
import { Expense } from '../models/expense.model';

@Injectable({
  providedIn: 'root'
})
export class ExpenseService {
  private firestore = inject(Firestore);
  private collectionName = 'expenses';

  constructor() {}

  // Ajouter une dépense
  async addExpense(expense: Expense): Promise<void> {
    const colRef = collection(this.firestore, this.collectionName);
    await addDoc(colRef, {
      ...expense,
      date: Timestamp.fromDate(new Date(expense.date as Date)),
      createdAt: Timestamp.now()
    });
  }

  // Récupérer toutes les dépenses (triées par date)
  getExpenses(): Observable<Expense[]> {
    const colRef = collection(this.firestore, this.collectionName);
    const q = query(colRef, orderBy('date', 'desc'));
    return collectionData(q, { idField: 'id' }) as Observable<Expense[]>;
  }

  // Supprimer une dépense
  async deleteExpense(id: string): Promise<void> {
    const docRef = doc(this.firestore, this.collectionName, id);
    await deleteDoc(docRef);
  }
}
EOF

# ==============================================================================
# 4. CRÉATION DU COMPONENT TYPESCRIPT
# ==============================================================================
echo -e "${GREEN}🧠 Génération de la logique (Component TS)...${NC}"

cat <<'EOF' > "$FEATURE_DIR/expense-manager.component.ts"
import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';

// Services
import { ExpenseService } from '../../../core/services/expense.service';
import { StaffService } from '../../../core/services/staff.service';
import { TeamService } from '../../../core/services/team.service';
import { PackService } from '../../../core/services/pack.service';

// Models
import { Expense, ExpenseCategory, BeneficiaryType } from '../../../core/models/expense.model';
import { Staff } from '../../../core/models/staff.model';
import { Team } from '../../../core/models/team.model';
import { Pack } from '../../../core/models/pack.model';
import { Observable } from 'rxjs';

@Component({
  selector: 'app-expense-manager',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  templateUrl: './expense-manager.component.html',
  styles: []
})
export class ExpenseManagerComponent implements OnInit {
  private fb = inject(FormBuilder);
  private expenseService = inject(ExpenseService);
  
  // Services pour les listes déroulantes
  private staffService = inject(StaffService);
  private teamService = inject(TeamService);
  private packService = inject(PackService);

  expenseForm: FormGroup;
  loading = false;
  
  // Listes de données
  expenses$: Observable<Expense[]>;
  staffList$: Observable<Staff[]>;
  teamList$: Observable<Team[]>;
  packList$: Observable<Pack[]>;

  // Options pour le select
  categories: ExpenseCategory[] = ['SALAIRE', 'ACHAT_PACK', 'EQUIPEMENT', 'FACTURE', 'AUTRE'];

  constructor() {
    this.expenseForm = this.fb.group({
      description: ['', Validators.required],
      amount: [0, [Validators.required, Validators.min(1)]],
      date: [new Date().toISOString().substring(0, 10), Validators.required],
      category: ['AUTRE', Validators.required],
      beneficiaryType: ['NONE'], // STAFF, TEAM, PACK, NONE
      beneficiaryId: [''] 
    });

    this.expenses$ = this.expenseService.getExpenses();
    
    // Initialisation des listes (supposant que ces méthodes existent dans tes services)
    this.staffList$ = this.staffService.getStaffs(); 
    this.teamList$ = this.teamService.getTeams();
    this.packList$ = this.packService.getPacks();
  }

  ngOnInit(): void {
    // Observer les changements de catégorie pour adapter le formulaire
    this.expenseForm.get('category')?.valueChanges.subscribe(cat => {
      this.updateBeneficiaryType(cat);
    });
  }

  // Logique automatique pour déterminer le type de bénéficiaire
  updateBeneficiaryType(category: string) {
    let type: BeneficiaryType = 'NONE';
    if (category === 'SALAIRE') type = 'STAFF';
    else if (category === 'ACHAT_PACK') type = 'PACK';
    // Tu peux ajouter d'autres logiques ici (ex: primes d'équipes)
    
    this.expenseForm.patchValue({ beneficiaryType: type });
  }

  // Changer manuellement le type (via radio buttons ou autre si besoin)
  setBeneficiaryType(type: BeneficiaryType) {
    this.expenseForm.patchValue({ beneficiaryType: type });
  }

  async onSubmit() {
    if (this.expenseForm.invalid) return;

    this.loading = true;
    try {
      const formVal = this.expenseForm.value;

      // Récupérer le nom du bénéficiaire pour l'affichage (optionnel mais pratique)
      // Note: C'est une simplification, idéalement on gère ça mieux
      let beneficiaryName = ''; 
      
      const newExpense: Expense = {
        description: formVal.description,
        amount: formVal.amount,
        date: new Date(formVal.date),
        category: formVal.category,
        beneficiaryType: formVal.beneficiaryType,
        beneficiaryId: formVal.beneficiaryId,
        beneficiaryName: beneficiaryName // À améliorer si besoin
      };

      await this.expenseService.addExpense(newExpense);
      this.expenseForm.reset({
        date: new Date().toISOString().substring(0, 10),
        category: 'AUTRE',
        amount: 0,
        beneficiaryType: 'NONE'
      });
    } catch (error) {
      console.error('Erreur lors de l\'ajout de la dépense', error);
      alert('Erreur lors de l\'enregistrement');
    } finally {
      this.loading = false;
    }
  }

  async deleteExpense(id: string | undefined) {
    if (!id || !confirm('Supprimer cette dépense ?')) return;
    try {
      await this.expenseService.deleteExpense(id);
    } catch (error) {
      console.error(error);
    }
  }
}
EOF

# ==============================================================================
# 5. CRÉATION DU TEMPLATE HTML (Tailwind)
# ==============================================================================
echo -e "${GREEN}🎨 Génération de la vue (HTML + Tailwind)...${NC}"

cat <<'EOF' > "$FEATURE_DIR/expense-manager.component.html"
<div class="container mx-auto p-6 space-y-8">
  
  <header class="flex justify-between items-center mb-6">
    <div>
      <h1 class="text-3xl font-bold text-gray-800">Gestion des Dépenses</h1>
      <p class="text-gray-500">Enregistrez les salaires, achats de packs et factures.</p>
    </div>
  </header>

  <div class="grid grid-cols-1 lg:grid-cols-3 gap-8">
    
    <div class="lg:col-span-1">
      <div class="bg-white rounded-xl shadow-lg p-6 border border-gray-100 sticky top-6">
        <h2 class="text-xl font-semibold mb-4 text-gray-700 border-b pb-2">Nouvelle Dépense</h2>
        
        <form [formGroup]="expenseForm" (ngSubmit)="onSubmit()" class="space-y-4">
          
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Catégorie</label>
            <select formControlName="category" class="w-full rounded-lg border-gray-300 border p-2.5 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition">
              <option *ngFor="let cat of categories" [value]="cat">{{ cat }}</option>
            </select>
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Libellé / Description</label>
            <input type="text" formControlName="description" placeholder="Ex: Salaire Janvier, Facture STEG..." 
                   class="w-full rounded-lg border-gray-300 border p-2.5 focus:ring-2 focus:ring-blue-500">
          </div>

          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Montant (TND)</label>
              <input type="number" formControlName="amount" min="0" 
                     class="w-full rounded-lg border-gray-300 border p-2.5 focus:ring-2 focus:ring-blue-500 font-bold text-right">
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Date</label>
              <input type="date" formControlName="date" 
                     class="w-full rounded-lg border-gray-300 border p-2.5 focus:ring-2 focus:ring-blue-500">
            </div>
          </div>

          <div class="bg-gray-50 p-4 rounded-lg border border-gray-200 mt-4">
            <p class="text-xs font-bold text-gray-500 uppercase mb-2">Lier cette dépense à :</p>

            <div class="flex gap-4 mb-3 text-sm">
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

            <div *ngIf="expenseForm.get('beneficiaryType')?.value === 'STAFF'" class="animate-fade-in">
              <label class="block text-xs text-gray-500 mb-1">Sélectionner l'employé</label>
              <select formControlName="beneficiaryId" class="w-full rounded border-gray-300 p-2 text-sm">
                <option value="">-- Choisir un membre --</option>
                <option *ngFor="let staff of staffList$ | async" [value]="staff.id">
                  {{ staff.firstName }} {{ staff.lastName }} ({{ staff.role }})
                </option>
              </select>
            </div>

            <div *ngIf="expenseForm.get('beneficiaryType')?.value === 'TEAM'" class="animate-fade-in">
              <label class="block text-xs text-gray-500 mb-1">Sélectionner l'équipe</label>
              <select formControlName="beneficiaryId" class="w-full rounded border-gray-300 p-2 text-sm">
                <option value="">-- Choisir une équipe --</option>
                <option *ngFor="let team of teamList$ | async" [value]="team.id">
                  {{ team.name }}
                </option>
              </select>
            </div>

            <div *ngIf="expenseForm.get('beneficiaryType')?.value === 'PACK'" class="animate-fade-in">
              <label class="block text-xs text-gray-500 mb-1">Sélectionner le pack concerné</label>
              <select formControlName="beneficiaryId" class="w-full rounded border-gray-300 p-2 text-sm">
                <option value="">-- Choisir un pack --</option>
                <option *ngFor="let pack of packList$ | async" [value]="pack.id">
                  {{ pack.name }} ({{ pack.price }} TND)
                </option>
              </select>
            </div>
          </div>

          <button type="submit" [disabled]="expenseForm.invalid || loading"
                  class="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded-lg shadow transition transform hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed mt-4">
            <span *ngIf="!loading">Enregistrer la dépense</span>
            <span *ngIf="loading">Enregistrement...</span>
          </button>
        </form>
      </div>
    </div>

    <div class="lg:col-span-2">
      <div class="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden">
        <div class="p-4 bg-gray-50 border-b flex justify-between items-center">
          <h2 class="font-semibold text-gray-700">Historique</h2>
          </div>
        
        <div class="overflow-x-auto">
          <table class="w-full text-left border-collapse">
            <thead>
              <tr class="bg-gray-100 text-gray-600 text-sm uppercase tracking-wider">
                <th class="p-4 font-medium">Date</th>
                <th class="p-4 font-medium">Description</th>
                <th class="p-4 font-medium">Type</th>
                <th class="p-4 font-medium text-right">Montant</th>
                <th class="p-4 font-medium text-center">Action</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-100 text-sm">
              <tr *ngFor="let expense of expenses$ | async" class="hover:bg-gray-50 transition">
                <td class="p-4 text-gray-500 whitespace-nowrap">
                  {{ expense.date | date:'dd/MM/yyyy' }}
                </td>
                <td class="p-4">
                  <div class="font-medium text-gray-800">{{ expense.description }}</div>
                  <div class="text-xs text-gray-500" *ngIf="expense.beneficiaryType !== 'NONE'">
                     Lié à : <span class="bg-gray-200 px-1 rounded">{{ expense.beneficiaryType }}</span>
                  </div>
                </td>
                <td class="p-4">
                  <span [ngClass]="{
                    'bg-green-100 text-green-700': expense.category === 'SALAIRE',
                    'bg-yellow-100 text-yellow-700': expense.category === 'ACHAT_PACK',
                    'bg-gray-100 text-gray-700': expense.category === 'AUTRE'
                  }" class="px-2 py-1 rounded-full text-xs font-semibold">
                    {{ expense.category }}
                  </span>
                </td>
                <td class="p-4 text-right font-bold text-red-600">
                  - {{ expense.amount | number:'1.2-2' }} TND
                </td>
                <td class="p-4 text-center">
                  <button (click)="deleteExpense(expense.id)" class="text-red-400 hover:text-red-600 p-2 rounded hover:bg-red-50 transition" title="Supprimer">
                    <i class="fa-solid fa-trash"></i>
                  </button>
                </td>
              </tr>
              
              <tr *ngIf="(expenses$ | async)?.length === 0">
                <td colspan="5" class="p-8 text-center text-gray-400">
                  Aucune dépense enregistrée pour le moment.
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

echo -e "${BLUE}✅ Installation terminée avec succès !${NC}"
echo -e "${BLUE}👉 Va sur http://localhost:4200/depenses pour tester.${NC}"