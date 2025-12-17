import { Component, inject, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, FormArray, Validators, FormGroup } from '@angular/forms';
import { ConfigService, TimeSlot } from '../../core/services/config.service';

@Component({
  selector: 'app-configuration',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  template: `
    <div class="max-w-4xl mx-auto space-y-6">
      
      <div>
        <h1 class="text-2xl font-bold text-slate-800 flex items-center">
          <span class="material-icons mr-3 text-slate-400">tune</span>
          Configuration des Créneaux
        </h1>
        <p class="text-slate-500 mt-1">Définissez les plages horaires disponibles à la location.</p>
      </div>

      <form [formGroup]="configForm" (ngSubmit)="saveConfig()">
        <div class="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div class="bg-slate-50 px-6 py-4 border-b border-slate-200 flex justify-between items-center">
            <h2 class="font-semibold text-slate-700">Liste des Créneaux</h2>
            <button type="button" (click)="addSlot()" class="text-sm bg-blue-100 text-blue-700 px-3 py-1 rounded hover:bg-blue-200 transition font-medium flex items-center">
              <span class="material-icons text-sm mr-1">add</span> Ajouter
            </button>
          </div>
          
          <div class="p-6 space-y-4" formArrayName="creneaux">
            
            @for (slot of creneauxArray.controls; track $index) {
              <div [formGroupName]="$index" class="flex flex-col md:flex-row gap-4 items-end bg-slate-50 p-4 rounded-lg border border-slate-200 relative group animate-fade-in">
                
                <div class="flex-1 w-full">
                  <label class="block text-xs font-semibold text-slate-500 mb-1">Nom (ex: Soirée)</label>
                  <input type="text" formControlName="label" class="w-full px-3 py-2 border border-slate-300 rounded focus:ring-2 focus:ring-blue-500 outline-none bg-white">
                </div>

                <div class="w-full md:w-32">
                  <label class="block text-xs font-semibold text-slate-500 mb-1">Début</label>
                  <input type="time" formControlName="start" class="w-full px-3 py-2 border border-slate-300 rounded focus:ring-2 focus:ring-blue-500 outline-none bg-white">
                </div>

                <div class="w-full md:w-32">
                  <label class="block text-xs font-semibold text-slate-500 mb-1">Fin</label>
                  <input type="time" formControlName="end" class="w-full px-3 py-2 border border-slate-300 rounded focus:ring-2 focus:ring-blue-500 outline-none bg-white">
                </div>

                <button type="button" (click)="removeSlot($index)" class="absolute top-2 right-2 md:static md:mb-1 text-slate-400 hover:text-red-500 transition p-1" title="Supprimer">
                  <span class="material-icons">delete</span>
                </button>
              </div>
            }

            @if (creneauxArray.length === 0) {
              <div class="text-center py-8 text-slate-400 italic bg-slate-50 rounded border border-dashed">
                Aucun créneau défini. Cliquez sur "Ajouter".
              </div>
            }

          </div>

          <div class="bg-slate-50 px-6 py-4 border-t border-slate-200 flex justify-end">
             <button type="submit" [disabled]="configForm.invalid" class="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg shadow transition disabled:opacity-50">
               Enregistrer la configuration
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

  get creneauxArray() {
    return this.configForm.get('creneaux') as FormArray;
  }

  constructor() {
    // Charger la config existante
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
      start: [data?.start || '00:00', Validators.required],
      end: [data?.end || '00:00', Validators.required]
    });
  }

  addSlot(data?: TimeSlot) {
    this.creneauxArray.push(this.createSlotGroup(data));
  }

  removeSlot(index: number) {
    this.creneauxArray.removeAt(index);
  }

  saveConfig() {
    if (this.configForm.valid) {
      this.configService.updateSettings({
        creneaux: this.configForm.value.creneaux as TimeSlot[]
      });
      alert('Configuration sauvegardée !');
    }
  }
}
