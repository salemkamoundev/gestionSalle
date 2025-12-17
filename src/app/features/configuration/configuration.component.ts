import { Component, inject, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, FormArray, Validators, FormGroup } from '@angular/forms';
import { ConfigService, TimeSlot } from '../../core/services/config.service';

@Component({
  selector: 'app-configuration',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  template: `
    <div class="max-w-7xl mx-auto space-y-6">
      
      <div>
        <h1 class="text-2xl font-bold text-slate-800 flex items-center">
          <span class="material-icons mr-3 text-slate-400">date_range</span>
          Tarification Saisonnière
        </h1>
        <p class="text-slate-500 mt-1">Définissez les prix selon les périodes de l'année (ex: Haute Saison vs Basse Saison).</p>
      </div>

      <form [formGroup]="configForm" (ngSubmit)="saveConfig()">
        <div class="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div class="bg-slate-50 px-6 py-4 border-b border-slate-200 flex justify-between items-center">
            <h2 class="font-semibold text-slate-700">Liste des Périodes & Créneaux</h2>
            <button type="button" (click)="addSlot()" class="text-sm bg-blue-100 text-blue-700 px-3 py-1 rounded hover:bg-blue-200 transition font-medium flex items-center">
              <span class="material-icons text-sm mr-1">add</span> Ajouter une période
            </button>
          </div>
          
          <div class="p-6 space-y-4" formArrayName="creneaux">
            
            @for (slot of creneauxArray.controls; track $index) {
              <div [formGroupName]="$index" class="flex flex-col xl:flex-row gap-4 items-start xl:items-end bg-slate-50 p-4 rounded-lg border border-slate-200 relative group animate-fade-in">
                
                <div class="flex-1 w-full min-w-[200px]">
                  <label class="block text-xs font-bold text-slate-500 mb-1">Libellé</label>
                  <input type="text" formControlName="label" placeholder="Ex: Soirée Été" class="w-full px-3 py-2 border border-slate-300 rounded focus:ring-2 focus:ring-blue-500 outline-none bg-white">
                </div>

                <div class="flex gap-2 w-full xl:w-auto">
                  <div class="flex-1 xl:w-36">
                    <label class="block text-xs font-bold text-slate-500 mb-1 text-blue-600">Du (Début)</label>
                    <input type="date" formControlName="validFrom" class="w-full px-3 py-2 border border-slate-300 rounded focus:ring-2 focus:ring-blue-500 outline-none bg-white">
                  </div>
                  <div class="flex-1 xl:w-36">
                    <label class="block text-xs font-bold text-slate-500 mb-1 text-blue-600">Au (Fin)</label>
                    <input type="date" formControlName="validTo" class="w-full px-3 py-2 border border-slate-300 rounded focus:ring-2 focus:ring-blue-500 outline-none bg-white">
                  </div>
                </div>

                <div class="flex gap-2 w-full xl:w-auto">
                  <div class="flex-1 xl:w-28">
                    <label class="block text-xs font-bold text-slate-500 mb-1">Heure Début</label>
                    <input type="time" formControlName="start" class="w-full px-3 py-2 border border-slate-300 rounded focus:ring-2 focus:ring-blue-500 outline-none bg-white">
                  </div>
                  <div class="flex-1 xl:w-28">
                    <label class="block text-xs font-bold text-slate-500 mb-1">Heure Fin</label>
                    <input type="time" formControlName="end" class="w-full px-3 py-2 border border-slate-300 rounded focus:ring-2 focus:ring-blue-500 outline-none bg-white">
                  </div>
                </div>

                <div class="w-full xl:w-32">
                  <label class="block text-xs font-bold text-slate-500 mb-1 text-emerald-600">Prix (TND)</label>
                  <div class="relative">
                    <input type="number" formControlName="price" class="w-full px-3 py-2 pl-3 pr-8 border border-slate-300 rounded focus:ring-2 focus:ring-emerald-500 outline-none bg-white font-bold text-slate-700">
                  </div>
                </div>

                <button type="button" (click)="removeSlot($index)" class="absolute top-2 right-2 xl:static xl:mb-1 text-slate-400 hover:text-red-500 transition p-2" title="Supprimer">
                  <span class="material-icons">delete</span>
                </button>
              </div>
            }

            @if (creneauxArray.length === 0) {
              <div class="text-center py-12 text-slate-400 italic bg-slate-50 rounded border border-dashed">
                <span class="material-icons text-3xl mb-2">calendar_view_week</span>
                <p>Aucune période configurée.</p>
              </div>
            }
          </div>

          <div class="bg-slate-50 px-6 py-4 border-t border-slate-200 flex justify-end">
             <button type="submit" [disabled]="configForm.invalid" class="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg shadow transition disabled:opacity-50">
               Enregistrer les tarifs
             </button>
          </div>
        </div>
      </form>
    </div>
  `,
  styles: [`
    @keyframes fadeIn { from { opacity: 0; transform: translateY(-5px); } to { opacity: 1; transform: translateY(0); } }
    .animate-fade-in { animation: fadeIn 0.3s ease-out; }
  `]
})
export class ConfigurationComponent {
  private fb = inject(FormBuilder);
  private configService = inject(ConfigService);

  configForm = this.fb.group({
    creneaux: this.fb.array([])
  });

  get creneauxArray() { return this.configForm.get('creneaux') as FormArray; }

  constructor() {
    effect(() => {
      const settings = this.configService.settings();
      this.creneauxArray.clear();
      settings.creneaux.forEach(c => this.addSlot(c));
    });
  }

  createSlotGroup(data?: TimeSlot): FormGroup {
    return this.fb.group({
      id: [data?.id || Date.now().toString()],
      label: [data?.label || '', Validators.required],
      validFrom: [data?.validFrom || '', Validators.required], // Date Début
      validTo: [data?.validTo || '', Validators.required],     // Date Fin
      start: [data?.start || '00:00', Validators.required],
      end: [data?.end || '00:00', Validators.required],
      price: [data?.price || 0, [Validators.required, Validators.min(0)]]
    });
  }

  addSlot(data?: TimeSlot) { this.creneauxArray.push(this.createSlotGroup(data)); }
  removeSlot(index: number) { this.creneauxArray.removeAt(index); }
  saveConfig() {
    if (this.configForm.valid) {
      this.configService.updateSettings({ creneaux: this.configForm.value.creneaux as TimeSlot[] });
      alert('Configuration sauvegardée !');
    }
  }
}
