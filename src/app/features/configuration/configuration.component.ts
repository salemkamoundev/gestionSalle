import { Component, inject, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, FormArray, Validators, FormGroup } from '@angular/forms';
import { Firestore, collection, query, where, getDocs } from '@angular/fire/firestore';
import { ConfigService, TimeSlot } from '../../core/services/config.service';
import { UiService } from '../../core/services/ui.service';

@Component({
  selector: 'app-configuration',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  template: `
    <div class="max-w-7xl mx-auto space-y-6 p-4">
      
      <div class="flex flex-wrap justify-between items-end gap-4">
        <div>
          <h1 class="text-2xl font-bold text-slate-800 flex items-center">
            <span class="material-icons mr-3 text-slate-400">date_range</span> 
            Tarification Saisonnière
          </h1>
          <p class="text-slate-500 mt-1">Gérez les créneaux (Matin, Après-midi 1 & 2, Soir) et leurs tarifs.</p>
        </div>
        
        <button (click)="saveConfig()" [disabled]="configForm.invalid || configForm.pristine" class="px-6 py-2.5 bg-slate-900 text-white rounded-xl font-bold shadow-lg hover:scale-105 transition disabled:opacity-50 disabled:hover:scale-100 flex items-center gap-2">
          <span class="material-icons text-sm">save</span> Enregistrer les tarifs
        </button>
      </div>

      <form [formGroup]="configForm" (ngSubmit)="saveConfig()">
        <div class="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          
          <div class="bg-slate-50 px-6 py-4 border-b border-slate-200 flex justify-between items-center flex-wrap gap-4">
            <h2 class="font-semibold text-slate-700 flex items-center">
              <span class="material-icons text-sm mr-2 text-slate-400">list</span>
              Liste des Périodes
            </h2>
            <div class="flex gap-2">
              
              <button type="button" (click)="addSlot(undefined, true)" class="px-4 py-2 bg-white border border-slate-300 text-slate-700 rounded-lg text-sm font-bold hover:bg-slate-50 transition flex items-center gap-2">
                <span class="material-icons text-sm text-green-600">add</span> Ajouter une période
              </button>
            </div>
          </div>

          <div class="p-6 space-y-4" formArrayName="creneaux">
            <div *ngFor="let slot of creneauxArray.controls; let i = index" [formGroupName]="i" 
                 class="grid grid-cols-1 md:grid-cols-12 gap-4 items-end p-4 rounded-xl border border-slate-100 hover:border-blue-200 hover:bg-blue-50/30 transition group relative">
              
              <div class="md:col-span-2">
                <label class="block text-xs font-bold text-slate-400 uppercase mb-1">Type (ID)</label>
                <div class="relative">
                    <select formControlName="id" class="w-full pl-8 pr-3 py-2 rounded-lg border border-slate-200 text-sm font-bold text-slate-700 focus:border-blue-500 outline-none appearance-none bg-white cursor-pointer">
                        <option value="matin">Matin</option>
                        <option value="aprem1">Après-midi 1</option>
                        <option value="aprem2">Après-midi 2</option>
                        <option value="soir">Soir</option>
                    </select>
                    <span class="material-icons absolute left-2 top-2 text-slate-400 text-sm">category</span>
                </div>
              </div>

              <div class="md:col-span-3">
                <label class="block text-xs font-bold text-slate-400 uppercase mb-1">Libellé</label>
                <input formControlName="label" type="text" placeholder="Ex: Hiver" class="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:border-blue-500 outline-none">
              </div>

              <div class="md:col-span-2">
                <label class="block text-xs font-bold text-slate-400 uppercase mb-1">Dates (Du/Au)</label>
                <div class="flex flex-col gap-1">
                    <input formControlName="validFrom" type="date" class="w-full px-2 py-1 rounded-lg border border-slate-200 text-xs focus:border-blue-500 outline-none">
                    <input formControlName="validTo" type="date" class="w-full px-2 py-1 rounded-lg border border-slate-200 text-xs focus:border-blue-500 outline-none">
                </div>
              </div>

              <div class="md:col-span-2">
                <label class="block text-xs font-bold text-slate-400 uppercase mb-1">Horaire</label>
                <div class="flex items-center gap-1">
                   <input formControlName="start" type="time" class="w-full px-1 py-2 rounded-lg border border-slate-200 text-sm focus:border-blue-500 outline-none text-center">
                   <span class="text-slate-400">-</span>
                   <input formControlName="end" type="time" class="w-full px-1 py-2 rounded-lg border border-slate-200 text-sm focus:border-blue-500 outline-none text-center">
                </div>
              </div>

              <div class="md:col-span-2">
                <label class="block text-xs font-bold text-slate-400 uppercase mb-1">Prix (DT)</label>
                <div class="relative">
                  <input formControlName="price" type="number" class="w-full pl-3 pr-8 py-2 rounded-lg border border-slate-200 text-sm font-bold text-slate-700 focus:border-blue-500 outline-none">
                  <span class="absolute right-3 top-2 text-xs text-slate-400 font-bold">DT</span>
                </div>
              </div>

              <div class="md:col-span-1 flex justify-end pb-2">
                 <button type="button" (click)="removeSlot(i)" class="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition" title="Supprimer">
                   <span class="material-icons">delete</span>
                 </button>
              </div>
            </div>
            
            <div *ngIf="creneauxArray.length === 0" class="text-center py-8 text-slate-400 italic bg-slate-50 rounded-xl border border-dashed border-slate-200">
              Aucun créneau configuré. Cliquez sur "Générer Saisons 2026" pour commencer.
            </div>
          </div>
          
          <div class="bg-slate-50 px-6 py-4 border-t border-slate-200 flex justify-end">
             <button type="submit" [disabled]="configForm.invalid || configForm.pristine" class="px-8 py-3 bg-slate-900 text-white rounded-xl font-bold shadow-lg hover:scale-[1.02] transition disabled:opacity-50 flex items-center gap-2">
               <span class="material-icons">save</span> Enregistrer
             </button>
          </div>
        </div>
      </form>
    </div>
  `
})
export class ConfigurationComponent {
  private fb = inject(FormBuilder);
  private configService = inject(ConfigService);
  private ui = inject(UiService);
  private firestore = inject(Firestore);

  configForm: FormGroup;

  constructor() {
    this.configForm = this.fb.group({
      creneaux: this.fb.array([])
    });

    effect(() => {
      const settings = this.configService.settings();
      if (settings && settings.creneaux) {
        this.loadCreneaux(settings.creneaux);
      }
    });
  }

  get creneauxArray() {
    return this.configForm.get('creneaux') as FormArray;
  }

  loadCreneaux(creneaux: TimeSlot[]) {
    this.creneauxArray.clear();
    creneaux.forEach(slot => {
      this.addSlot(slot, false);
    });
    this.configForm.markAsPristine();
  }

  createSlotGroup(data?: TimeSlot): FormGroup {
    return this.fb.group({
      // ID STRICT : Par défaut 'matin'
      id: [data?.id || 'matin', Validators.required],
      label: [data?.label || '', Validators.required],
      validFrom: [data?.validFrom || '', Validators.required],
      validTo: [data?.validTo || '', Validators.required],
      start: [data?.start || '08:00', Validators.required],
      end: [data?.end || '12:00', Validators.required],
      price: [data?.price || 0, [Validators.required, Validators.min(0)]]
    });
  }

  addSlot(data?: TimeSlot, prepend: boolean = false) {
    const group = this.createSlotGroup(data);
    if (prepend) {
      this.creneauxArray.insert(0, group);
    } else {
      this.creneauxArray.push(group);
    }
    this.configForm.markAsDirty();
  }

  generate2026Seasons() {
    this.ui.confirm('Générer les tarifs 2026 ?', 'Attention : Ceci remplacera la configuration actuelle.')
      .then(confirm => {
        if (confirm) {
          this.creneauxArray.clear();
          const seasons = this.get2026SeasonsData();
          seasons.forEach(s => this.addSlot(s));
          this.ui.showToast('success', 'Grille 2026 générée ! Pensez à enregistrer.');
          this.configForm.markAsDirty();
        }
      });
  }

  private get2026SeasonsData(): TimeSlot[] {
    // Configuration : 4 créneaux (Matin, Aprem1, Aprem2, Soir)
    const baseSeasons = [
      { name: 'Hiver', start: '2026-01-01', end: '2026-03-20', pM: 200, pA1: 400, pA2: 500, pS: 600 },
      { name: 'Printemps', start: '2026-03-21', end: '2026-06-20', pM: 300, pA1: 600, pA2: 700, pS: 900 },
      { name: 'Été', start: '2026-06-21', end: '2026-09-21', pM: 500, pA1: 900, pA2: 1200, pS: 1500 },
      { name: 'Automne', start: '2026-09-22', end: '2026-12-20', pM: 250, pA1: 500, pA2: 600, pS: 700 },
      { name: 'Fêtes', start: '2026-12-21', end: '2026-12-31', pM: 400, pA1: 800, pA2: 1000, pS: 1200 },
    ];

    let slots: any[] = [];

    baseSeasons.forEach(s => {
      // 1. Matin
      slots.push({
        id: 'matin',
        label: `Matin (${s.name})`,
        validFrom: s.start, validTo: s.end,
        start: '08:00', end: '12:00',
        price: s.pM
      });

      // 2. Aprem 1
      slots.push({
        id: 'aprem1',
        label: `Après-midi Option 1 (${s.name})`,
        validFrom: s.start, validTo: s.end,
        start: '12:00', end: '16:00',
        price: s.pA1
      });

      // 3. Aprem 2
      slots.push({
        id: 'aprem2',
        label: `Après-midi Option 2 (${s.name})`,
        validFrom: s.start, validTo: s.end,
        start: '12:00', end: '19:00',
        price: s.pA2
      });

      // 4. Soir
      slots.push({
        id: 'soir',
        label: `Soir (${s.name})`,
        validFrom: s.start, validTo: s.end,
        start: '18:00', end: '02:00',
        price: s.pS
      });
    });

    return slots;
  }

  async removeSlot(index: number) {
    const slotGroup = this.creneauxArray.at(index);
    const slotId = slotGroup.value.id;

    if (slotId) {
      try {
        const q = query(collection(this.firestore, 'reservations'), where('slotId', '==', slotId));
        const snapshot = await getDocs(q);
        const activeUsage = snapshot.docs.filter(d => d.data()['status'] !== 'CANCELLED');

        if (activeUsage.length > 0) {
          console.warn(`Le type de créneau ${slotId} est utilisé dans ${activeUsage.length} réservations.`);
        }
      } catch (e) {
        console.error("Erreur vérification usage", e);
      }
    }

    this.ui.confirm('Supprimer cette période ?', 'Cette action est irréversible après enregistrement.')
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
        this.ui.showToast('success', 'Tarifs mis à jour avec succès !');
        this.configForm.markAsPristine();
      } catch (error) {
        this.ui.showToast('error', 'Erreur lors de la mise à jour');
        console.error(error);
      }
    } else {
      this.ui.showToast('error', 'Veuillez corriger les erreurs du formulaire');
      this.configForm.markAllAsTouched();
    }
  }
}