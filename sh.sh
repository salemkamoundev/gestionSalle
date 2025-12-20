#!/bin/bash

# ==========================================
# CONFIGURATION
# ==========================================
BASE_PATH="src/app"
FEATURE_DIR="$BASE_PATH/features/finances/expense-manager"

echo "🎨 Correction des icônes (Remplacement FontAwesome par SVG natifs)..."

# ==========================================
# MISE À JOUR DU COMPONENT HTML
# ==========================================
# Nous réécrivons le fichier HTML complet avec des SVG à la place des balises <i>
# Cela garantit que les icônes s'affichent même si FontAwesome est absent.

cat <<'EOF' > "$FEATURE_DIR/expense-manager.component.html"
<div class="container mx-auto p-4 lg:p-6 space-y-6">
  
  <header class="flex flex-col md:flex-row justify-between items-start md:items-center mb-4">
    <div>
      <h1 class="text-2xl font-bold text-gray-800">Gestion des Dépenses</h1>
      <p class="text-sm text-gray-500">Suivi de la trésorerie et des paiements.</p>
    </div>
  </header>

  <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
    
    <div class="lg:col-span-1">
      <div class="bg-white rounded-xl shadow-md p-5 border border-gray-100 sticky top-4 transition-all"
           [ngClass]="{'border-blue-300 ring-2 ring-blue-100': editingId}">
        
        <div class="flex justify-between items-center mb-4">
          <h2 class="text-lg font-semibold text-gray-700">
            {{ editingId ? 'Modifier la dépense' : 'Nouvelle dépense' }}
          </h2>
          <button *ngIf="editingId" (click)="cancelEdit()" class="text-xs text-gray-500 hover:text-gray-700 underline">
            Annuler
          </button>
        </div>
        
        <form [formGroup]="expenseForm" (ngSubmit)="onSubmit()" class="space-y-3">
          
          <div>
            <label class="block text-xs font-medium text-gray-700 mb-1">Catégorie</label>
            <select formControlName="category" class="w-full rounded border-gray-300 p-2 text-sm focus:ring-2 focus:ring-blue-500">
              <option *ngFor="let cat of categories" [value]="cat">{{ cat }}</option>
            </select>
          </div>

          <div>
            <label class="block text-xs font-medium text-gray-700 mb-1">Libellé</label>
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
                <input type="radio" formControlName="beneficiaryType" value="TEAM"> Team
              </label>
              <label class="flex items-center gap-1 cursor-pointer">
                <input type="radio" formControlName="beneficiaryType" value="PACK"> Pack
              </label>
            </div>

            <div *ngIf="expenseForm.get('beneficiaryType')?.value === 'STAFF'">
              <select formControlName="beneficiaryId" class="w-full rounded border-gray-300 p-2 text-xs">
                <option value="">-- Employé --</option>
                <option *ngFor="let s of staffList$ | async" [value]="s.id">
                  {{ s.firstName }} {{ s.lastName }} {{ s.nom }} {{ s.name }}
                </option>
              </select>
            </div>
            <div *ngIf="expenseForm.get('beneficiaryType')?.value === 'TEAM'">
              <select formControlName="beneficiaryId" class="w-full rounded border-gray-300 p-2 text-xs">
                <option value="">-- Équipe --</option>
                <option *ngFor="let t of teamList$ | async" [value]="t.id">
                  {{ t.name || t.nom || 'Équipe' }}
                </option>
              </select>
            </div>
            <div *ngIf="expenseForm.get('beneficiaryType')?.value === 'PACK'">
              <select formControlName="beneficiaryId" class="w-full rounded border-gray-300 p-2 text-xs">
                <option value="">-- Pack --</option>
                <option *ngFor="let p of packList$ | async" [value]="p.id">
                  {{ p.name || p.nom }} ({{ p.price || p.prix }} TND)
                </option>
              </select>
            </div>
          </div>

          <button type="submit" [disabled]="expenseForm.invalid || loading"
                  [ngClass]="editingId ? 'bg-orange-500 hover:bg-orange-600' : 'bg-blue-600 hover:bg-blue-700'"
                  class="w-full text-white font-bold py-2 px-4 rounded shadow mt-2 text-sm disabled:opacity-50 transition-colors">
            {{ loading ? 'En cours...' : (editingId ? 'Modifier la dépense' : 'Ajouter la dépense') }}
          </button>
          
          <button *ngIf="editingId" type="button" (click)="cancelEdit()" 
                  class="w-full bg-gray-200 hover:bg-gray-300 text-gray-700 font-semibold py-2 px-4 rounded text-sm">
             Annuler
          </button>
        </form>
      </div>
    </div>

    <div class="lg:col-span-2 space-y-4">
      
      <div class="bg-white rounded-xl shadow-sm p-4 border border-gray-100 grid grid-cols-2 md:grid-cols-4 gap-3">
        <div class="col-span-2 md:col-span-1">
          <label class="block text-xs font-bold text-gray-400 mb-1">Recherche</label>
          <input type="text" placeholder="Description..." (input)="updateSearch($any($event.target).value)"
                 class="w-full rounded border-gray-200 text-sm p-2 focus:ring-1 focus:ring-blue-500 bg-gray-50">
        </div>
        <div>
          <label class="block text-xs font-bold text-gray-400 mb-1">Catégorie</label>
          <select (change)="updateFilterCategory($any($event.target).value)" 
                  class="w-full rounded border-gray-200 text-sm p-2 bg-gray-50">
            <option value="ALL">Toutes</option>
            <option *ngFor="let cat of categories" [value]="cat">{{ cat }}</option>
          </select>
        </div>
        <div>
          <label class="block text-xs font-bold text-gray-400 mb-1">Du</label>
          <input type="date" (change)="updateStartDate($any($event.target).value)"
                 class="w-full rounded border-gray-200 text-sm p-2 bg-gray-50">
        </div>
        <div>
          <label class="block text-xs font-bold text-gray-400 mb-1">Au</label>
          <input type="date" (change)="updateEndDate($any($event.target).value)"
                 class="w-full rounded border-gray-200 text-sm p-2 bg-gray-50">
        </div>
      </div>

      <div class="bg-white rounded-xl shadow-md border border-gray-100 overflow-hidden">
        <div class="overflow-x-auto">
          <table class="w-full text-left border-collapse">
            <thead>
              <tr class="bg-gray-50 text-gray-600 text-xs uppercase border-b border-gray-100">
                <th class="p-3">Date</th>
                <th class="p-3">Info</th>
                <th class="p-3 text-right">Montant</th>
                <th class="p-3 text-center">Actions</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-100 text-sm">
              <tr *ngFor="let expense of filteredExpenses$ | async" 
                  class="hover:bg-blue-50 transition duration-150"
                  [ngClass]="{'bg-blue-50 border-l-4 border-blue-500': expense.id === editingId}">
                
                <td class="p-3 text-gray-500 whitespace-nowrap">
                  {{ getNativeDate(expense.date) | date:'dd/MM/yyyy' }}
                </td>
                
                <td class="p-3">
                  <div class="font-medium text-gray-800">{{ expense.description }}</div>
                  <div class="flex items-center gap-2 mt-1">
                    <span class="text-[10px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 font-semibold">
                      {{ expense.category }}
                    </span>
                    <span *ngIf="expense.beneficiaryType !== 'NONE'" class="text-[10px] text-blue-500">
                      via {{ expense.beneficiaryType }}
                    </span>
                  </div>
                </td>
                
                <td class="p-3 text-right font-bold text-red-600">
                  - {{ expense.amount | number:'1.2-2' }} 
                </td>
                
                <td class="p-3 text-center">
                  <div class="flex justify-center gap-2">
                    
                    <button (click)="editExpense(expense)" class="p-2 text-blue-400 hover:text-blue-600 hover:bg-blue-100 rounded transition" title="Modifier">
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-4 h-4">
                        <path stroke-linecap="round" stroke-linejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" />
                      </svg>
                    </button>
                    
                    <button (click)="deleteExpense(expense.id)" class="p-2 text-red-300 hover:text-red-600 hover:bg-red-100 rounded transition" title="Supprimer">
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-4 h-4">
                        <path stroke-linecap="round" stroke-linejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                      </svg>
                    </button>

                  </div>
                </td>
              </tr>

              <tr *ngIf="(filteredExpenses$ | async)?.length === 0">
                <td colspan="4" class="p-8 text-center text-gray-400">
                  <div class="flex flex-col items-center">
                    <p>Aucune dépense ne correspond aux filtres.</p>
                  </div>
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

echo "✅ Icônes corrigées ! Les boutons devraient apparaître maintenant."