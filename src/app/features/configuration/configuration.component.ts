import { Component, inject, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, FormArray, Validators, FormGroup } from '@angular/forms';
import { ConfigService, TimeSlot } from '../../core/services/config.service';
import { UiService } from '../../core/services/ui.service';

@Component({
  selector: 'app-configuration',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  template: `
    <div class="max-w-7xl mx-auto space-y-6 p-4">
      <div>
        <h1 class="text-2xl font-bold text-slate-800 flex items-center">
          <span class="material-icons mr-3 text-slate-400">date_range</span> 
          Tarification Saisonnière
        </h1>
        <p class="text-slate-500 mt-1">Définissez les prix des locations selon les périodes de l'année.</p>
      </div>

      <form [formGroup]="configForm" (ngSubmit)="saveConfig()">
        <div class="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          
          <div class="bg-slate-50 px-6 py-4 border-b border-slate-200 flex justify-between items-center flex-wrap gap-4">
            <h2 class="font-semibold text-slate-700 flex items-center">
              <span class="material-icons text-sm mr-2 text-slate-400">list</span>
              Liste des Périodes & Créneaux
              <span class="ml-2 text-xs bg-slate-200 text-slate-600 px-2 py-0.5 rounded-full">{{ creneauxArray.length }}</span>
            </h2>
            <button type="button" (click)="addSlot()" class="text-sm bg-blue-100 text-blue-700 px-4 py-2 rounded-lg hover:bg-blue-200 transition font-medium flex items-center">
              <span class="material-icons text-sm mr-2">add_circle</span> Ajouter une période
            </button>
          </div>

          <div class="p-6 space-y-4" formArrayName="creneaux">
            
            @if (creneauxArray.length === 0) {
               <div class="text-center py-12 text-slate-400 italic bg-slate-50 rounded-lg border-2 border-dashed border-slate-200">
                 <span class="material-icons text-4xl mb-2 text-slate-300">calendar_view_week</span>
                 <p>Aucune période configurée pour le moment.</p>
                 <p class="text-xs mt-1">Cliquez sur "Ajouter une période" pour commencer.</p>
               </div>
            }

            @for (slot of creneauxArray.controls; track $index) {
              <div [formGroupName]="$index" class="flex flex-col xl:flex-row gap-4 items-start xl:items-end bg-slate-50 p-4 rounded-lg border border-slate-200 relative group transition-all hover:shadow-md hover:border-blue-200 animate-fade-in">
                
                <div class="flex-1 w-full min-w-[200px]">
                  <label class="block text-xs font-bold text-slate-500 mb-1">Nom de la période</label>
                  <input type="text" formControlName="label" placeholder="Ex: Soirée Été, Week-end Hiver..." 
                         class="w-full px-3 py-2 border border-slate-300 rounded focus:ring-2 focus:ring-blue-500 outline-none bg-white font-medium">
                </div>

                <div class="flex gap-2 w-full xl:w-auto bg-white p-2 rounded border border-slate-100">
                  <div class="flex-1 xl:w-36">
                    <label class="block text-xs font-bold text-blue-600 mb-1">Du (Date début)</label>
                    <input type="date" formControlName="validFrom" class="w-full text-sm outline-none bg-transparent">
                  </div>
                  <div class="w-px bg-slate-200 mx-1"></div>
                  <div class="flex-1 xl:w-36">
                    <label class="block text-xs font-bold text-blue-600 mb-1">Au (Date fin)</label>
                    <input type="date" formControlName="validTo" class="w-full text-sm outline-none bg-transparent">
                  </div>
                </div>

                <div class="flex gap-2 w-full xl:w-auto bg-white p-2 rounded border border-slate-100">
                  <div class="flex-1 xl:w-24">
                    <label class="block text-xs font-bold text-slate-500 mb-1">Heure Début</label>
                    <input type="time" formControlName="start" class="w-full text-sm outline-none bg-transparent">
                  </div>
                  <div class="w-px bg-slate-200 mx-1"></div>
                  <div class="flex-1 xl:w-24">
                    <label class="block text-xs font-bold text-slate-500 mb-1">Heure Fin</label>
                    <input type="time" formControlName="end" class="w-full text-sm outline-none bg-transparent">
                  </div>
                </div>

                <div class="w-full xl:w-32">
                  <label class="block text-xs font-bold text-emerald-600 mb-1">Prix (TND)</label>
                  <div class="relative">
                    <input type="number" formControlName="price" class="w-full px-3 py-2 pl-3 pr-8 border border-slate-300 rounded focus:ring-2 focus:ring-emerald-500 outline-none bg-white font-bold text-slate-700 text-right">
                    <span class="absolute right-3 top-2 text-slate-400 text-xs font-bold mt-0.5">DT</span>
                  </div>
                </div>

                <button type="button" (click)="removeSlot($index)" class="absolute top-2 right-2 xl:static xl:mb-1 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-full transition p-2" title="Supprimer">
                  <span class="material-icons">delete</span>
                </button>
              </div>
            }
          </div>

          <div class="bg-slate-50 px-6 py-4 border-t border-slate-200 flex justify-end">
            <button type="submit" [disabled]="configForm.invalid || configForm.pristine" 
                    class="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg shadow-lg hover:shadow-xl transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center">
              <span class="material-icons text-sm mr-2">save</span> Enregistrer les tarifs
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
  private ui = inject(UiService);

  configForm = this.fb.group({ creneaux: this.fb.array([]) });
  
  get creneauxArray() { return this.configForm.get('creneaux') as FormArray; }

  constructor() {
    effect(() => {
      const settings = this.configService.settings();
      this.creneauxArray.clear();
      if (settings && settings.creneaux) {
        settings.creneaux.forEach(c => {
            this.addSlot(c);
        });
      }
    });
  }

  createSlotGroup(data?: TimeSlot): FormGroup {
    return this.fb.group({
      id: [data?.id || Date.now().toString() + Math.random().toString(36).substr(2, 9)],
      label: [data?.label || '', Validators.required],
      validFrom: [data?.validFrom || '', Validators.required],
      validTo: [data?.validTo || '', Validators.required],
      start: [data?.start || '00:00', Validators.required],
      end: [data?.end || '00:00', Validators.required],
      price: [data?.price || 0, [Validators.required, Validators.min(0)]]
    });
  }

  addSlot(data?: TimeSlot) {
    this.creneauxArray.push(this.createSlotGroup(data));
    this.configForm.markAsDirty();
  }

  removeSlot(index: number) {
    this.ui.confirm('Supprimer cette période ?', 'Cette action est immédiate au prochain enregistrement.')
      .then(confirm => {
        if (confirm) {
          this.creneauxArray.removeAt(index);
          this.configForm.markAsDirty();
        }
      });
  }

  async saveConfig() {
    if (this.configForm.valid) {
      try {
        await this.configService.updateSettings({ creneaux: this.configForm.value.creneaux as TimeSlot[] });
        this.ui.showToast('success', 'Tarifs mis à jour avec succès');
        this.configForm.markAsPristine();
      } catch (e) {
        this.ui.showToast('error', 'Erreur lors de la sauvegarde');
      }
    } else {
      // CORRECTION ICI : 'warning' -> 'error'
      this.ui.showToast('error', 'Veuillez remplir tous les champs obligatoires');
    }
  }
}
