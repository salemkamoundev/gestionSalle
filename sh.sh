#!/bin/bash

# ==========================================
# CONFIGURATION
# ==========================================
BASE_PATH="src/app"
FEATURE_DIR="$BASE_PATH/features/finances/expense-manager"

echo "👀 Rendre les boutons d'action toujours visibles..."

# ==========================================
# MISE À JOUR DU HTML
# ==========================================
# On réécrit le fichier en retirant simplement les classes d'opacité sur le div des boutons.

cat <<'EOF' > "$FEATURE_DIR/expense-manager.component.html"
<div class="container mx-auto p-4 lg:p-6 space-y-6 max-w-5xl">
  
  <header class="flex flex-col gap-4">
    <div class="flex justify-between items-center">
      <div>
        <h1 class="text-2xl font-bold text-gray-800">Gestion des Dépenses</h1>
        <p class="text-sm text-gray-500">Suivi de la trésorerie</p>
      </div>
      <div class="text-right hidden sm:block">
        <span class="text-xs text-gray-400 block">Total Dépenses</span>
      </div>
    </div>

    <div class="flex p-1 bg-gray-100 rounded-lg w-full md:w-fit">
      <button (click)="setView('LIST')" 
              class="flex-1 md:flex-none px-6 py-2 rounded-md text-sm font-medium transition-all duration-200"
              [ngClass]="viewMode === 'LIST' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'">
        <span class="flex items-center justify-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
            Historique
        </span>
      </button>
      
      <button (click)="setView('FORM')" 
              class="flex-1 md:flex-none px-6 py-2 rounded-md text-sm font-medium transition-all duration-200"
              [ngClass]="viewMode === 'FORM' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'">
        <span class="flex items-center justify-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" /></svg>
            {{ editingId ? 'Modifier' : 'Nouvelle Dépense' }}
        </span>
      </button>
    </div>
  </header>

  <div *ngIf="viewMode === 'FORM'" class="animate-fade-in">
      <div class="bg-white rounded-xl shadow-md p-6 border border-gray-100 max-w-2xl mx-auto"
           [ngClass]="{'border-blue-300 ring-2 ring-blue-50': editingId}">
        
        <div class="flex justify-between items-center mb-6 border-b pb-4">
          <h2 class="text-xl font-semibold text-gray-700">
            {{ editingId ? 'Modifier la dépense' : 'Saisir une nouvelle dépense' }}
          </h2>
          <button (click)="cancelEdit()" class="text-sm text-gray-500 hover:text-gray-700 underline">
            Annuler / Retour
          </button>
        </div>
        
        <form [formGroup]="expenseForm" (ngSubmit)="onSubmit()" class="space-y-5">
          
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
             <div>
                <label class="block text-xs font-bold text-gray-500 uppercase mb-1">Catégorie</label>
                <select formControlName="category" class="w-full rounded-lg border-gray-200 p-3 text-sm focus:ring-2 focus:ring-blue-500 bg-gray-50">
                  <option *ngFor="let cat of categories" [value]="cat">{{ cat }}</option>
                </select>
             </div>
             <div>
                <label class="block text-xs font-bold text-gray-500 uppercase mb-1">Date</label>
                <input type="date" formControlName="date" 
                       class="w-full rounded-lg border-gray-200 p-3 text-sm bg-gray-50">
             </div>
          </div>

          <div>
            <label class="block text-xs font-bold text-gray-500 uppercase mb-1">Libellé / Description</label>
            <input type="text" formControlName="description" placeholder="Ex: Achat fournitures, Salaire..." 
                   class="w-full rounded-lg border-gray-200 p-3 text-sm focus:ring-2 focus:ring-blue-500">
          </div>

          <div>
              <label class="block text-xs font-bold text-gray-500 uppercase mb-1">Montant (TND)</label>
              <div class="relative">
                <input type="number" formControlName="amount" min="0" placeholder="0.00"
                       class="w-full rounded-lg border-gray-200 p-3 pl-4 text-lg font-bold text-gray-800 focus:ring-2 focus:ring-blue-500">
                <span class="absolute right-4 top-3.5 text-gray-400 text-sm font-bold">TND</span>
              </div>
          </div>

          <div class="bg-gray-50 p-4 rounded-lg border border-dashed border-gray-300 mt-2">
            <p class="text-xs font-bold text-gray-500 uppercase mb-3">Lier cette dépense à :</p>
            
            <div class="flex flex-wrap gap-4 mb-3 text-sm">
              <label class="flex items-center gap-2 cursor-pointer bg-white px-3 py-1 rounded border hover:border-blue-400 transition">
                <input type="radio" formControlName="beneficiaryType" value="NONE" class="text-blue-600"> Aucun
              </label>
              <label class="flex items-center gap-2 cursor-pointer bg-white px-3 py-1 rounded border hover:border-blue-400 transition">
                <input type="radio" formControlName="beneficiaryType" value="STAFF" class="text-blue-600"> Staff
              </label>
              <label class="flex items-center gap-2 cursor-pointer bg-white px-3 py-1 rounded border hover:border-blue-400 transition">
                <input type="radio" formControlName="beneficiaryType" value="TEAM" class="text-blue-600"> Team
              </label>
              <label class="flex items-center gap-2 cursor-pointer bg-white px-3 py-1 rounded border hover:border-blue-400 transition">
                <input type="radio" formControlName="beneficiaryType" value="PACK" class="text-blue-600"> Pack
              </label>
            </div>

            <div *ngIf="expenseForm.get('beneficiaryType')?.value === 'STAFF'" class="animate-fade-in-down">
              <select formControlName="beneficiaryId" class="w-full rounded border-gray-300 p-2 text-sm">
                <option value="">-- Sélectionner l'employé --</option>
                <option *ngFor="let s of staffList$ | async" [value]="s.id">
                  {{ s.firstName }} {{ s.lastName }} {{ s.nom }} {{ s.name }}
                </option>
              </select>
            </div>
            <div *ngIf="expenseForm.get('beneficiaryType')?.value === 'TEAM'" class="animate-fade-in-down">
              <select formControlName="beneficiaryId" class="w-full rounded border-gray-300 p-2 text-sm">
                <option value="">-- Sélectionner l'équipe --</option>
                <option *ngFor="let t of teamList$ | async" [value]="t.id">
                  {{ t.name || t.nom || 'Équipe' }}
                </option>
              </select>
            </div>
            <div *ngIf="expenseForm.get('beneficiaryType')?.value === 'PACK'" class="animate-fade-in-down">
              <select formControlName="beneficiaryId" class="w-full rounded border-gray-300 p-2 text-sm">
                <option value="">-- Sélectionner le pack --</option>
                <option *ngFor="let p of packList$ | async" [value]="p.id">
                  {{ p.name || p.nom }} ({{ p.price || p.prix }} TND)
                </option>
              </select>
            </div>
          </div>

          <button type="submit" [disabled]="expenseForm.invalid || loading"
                  [ngClass]="editingId ? 'bg-orange-500 hover:bg-orange-600' : 'bg-blue-600 hover:bg-blue-700'"
                  class="w-full text-white font-bold py-3 px-4 rounded-lg shadow-lg mt-2 text-sm disabled:opacity-50 transition-all transform active:scale-95">
            {{ loading ? 'Enregistrement en cours...' : (editingId ? 'Mettre à jour la dépense' : 'Enregistrer la dépense') }}
          </button>
        </form>
      </div>
  </div>

  <div *ngIf="viewMode === 'LIST'" class="space-y-4 animate-fade-in">
      
      <div class="bg-white rounded-xl shadow-sm p-4 border border-gray-100 grid grid-cols-2 md:grid-cols-4 gap-3">
        <div class="col-span-2 md:col-span-1">
          <label class="block text-xs font-bold text-gray-400 mb-1">Recherche</label>
          <div class="relative">
            <span class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
               <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
            </span>
            <input type="text" placeholder="Description..." (input)="updateSearch($any($event.target).value)"
                   class="w-full rounded-lg border-gray-200 text-sm pl-10 p-2 bg-gray-50 focus:bg-white transition">
          </div>
        </div>
        <div>
          <label class="block text-xs font-bold text-gray-400 mb-1">Catégorie</label>
          <select (change)="updateFilterCategory($any($event.target).value)" 
                  class="w-full rounded-lg border-gray-200 text-sm p-2 bg-gray-50 focus:bg-white cursor-pointer">
            <option value="ALL">Toutes les catégories</option>
            <option *ngFor="let cat of categories" [value]="cat">{{ cat }}</option>
          </select>
        </div>
        <div>
          <label class="block text-xs font-bold text-gray-400 mb-1">Du</label>
          <input type="date" (change)="updateStartDate($any($event.target).value)"
                 class="w-full rounded-lg border-gray-200 text-sm p-2 bg-gray-50 focus:bg-white cursor-pointer">
        </div>
        <div>
          <label class="block text-xs font-bold text-gray-400 mb-1">Au</label>
          <input type="date" (change)="updateEndDate($any($event.target).value)"
                 class="w-full rounded-lg border-gray-200 text-sm p-2 bg-gray-50 focus:bg-white cursor-pointer">
        </div>
      </div>

      <div class="bg-white rounded-xl shadow-md border border-gray-100 overflow-hidden">
        <div class="overflow-x-auto">
          <table class="w-full text-left border-collapse">
            <thead>
              <tr class="bg-gray-50 text-gray-500 text-xs uppercase border-b border-gray-100 tracking-wider">
                <th class="p-4 font-semibold">Date</th>
                <th class="p-4 font-semibold">Description</th>
                <th class="p-4 font-semibold text-right">Montant</th>
                <th class="p-4 font-semibold text-center w-24">Actions</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-100 text-sm">
              <tr *ngFor="let expense of filteredExpenses$ | async" 
                  class="hover:bg-blue-50 transition duration-150 group">
                
                <td class="p-4 text-gray-600 whitespace-nowrap">
                  {{ getNativeDate(expense.date) | date:'dd MMM yyyy' }}
                </td>
                
                <td class="p-4">
                  <div class="font-medium text-gray-800">{{ expense.description }}</div>
                  <div class="flex items-center gap-2 mt-1">
                    <span class="text-[10px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 font-semibold border border-gray-200">
                      {{ expense.category }}
                    </span>
                    <span *ngIf="expense.beneficiaryType !== 'NONE'" class="text-[10px] text-blue-600 flex items-center gap-1">
                      <svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg>
                      {{ expense.beneficiaryType }}
                    </span>
                  </div>
                </td>
                
                <td class="p-4 text-right font-bold text-red-600 text-base">
                  - {{ expense.amount | number:'1.2-2' }} 
                </td>
                
                <td class="p-4 text-center">
                  <div class="flex justify-center gap-2">
                    <button (click)="editExpense(expense)" class="p-2 text-blue-500 hover:bg-blue-50 rounded-full transition" title="Modifier">
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-5 h-5">
                        <path stroke-linecap="round" stroke-linejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" />
                      </svg>
                    </button>
                    <button (click)="deleteExpense(expense.id)" class="p-2 text-red-400 hover:bg-red-50 rounded-full transition" title="Supprimer">
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-5 h-5">
                        <path stroke-linecap="round" stroke-linejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                      </svg>
                    </button>
                  </div>
                </td>
              </tr>

              <tr *ngIf="(filteredExpenses$ | async)?.length === 0">
                <td colspan="4" class="p-12 text-center text-gray-400">
                  <div class="flex flex-col items-center">
                    <svg class="w-12 h-12 mb-3 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                    <p>Aucune dépense trouvée.</p>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
  </div>
</div>
EOF

echo "✅ Boutons visibles en permanence."