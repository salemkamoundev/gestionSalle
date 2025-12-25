import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';

import { PackService } from '../../../core/services/pack.service';
import { UiService } from '../../../core/services/ui.service';
import { StaffService } from '../../../core/services/staff.service';
import { TeamService } from '../../../core/services/team.service';

@Component({
  selector: 'app-pack-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  template: `
    <div class="max-w-5xl mx-auto space-y-8">
      <div class="flex items-center justify-between">
        <div>
          <h1 class="text-2xl font-black text-slate-800 flex items-center gap-2">
            <span class="material-icons text-purple-600">inventory_2</span>
            {{ isEditMode() ? 'Modifier le Pack' : 'Nouveau Pack' }}
          </h1>
          <p class="text-slate-500 text-sm mt-1">Gestion des ressources incluses dans le forfait.</p>
        </div>
        <button (click)="cancel()" class="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 font-bold flex items-center transition">
          <span class="material-icons text-sm mr-2">arrow_back</span> Retour
        </button>
      </div>

      <form [formGroup]="form" (ngSubmit)="submit()" class="space-y-8">
        
        <div class="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
          <h2 class="text-lg font-bold text-slate-800 mb-4 border-b border-slate-100 pb-2">Informations Générales</h2>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div class="space-y-1">
              <label class="block text-xs font-bold text-slate-500 uppercase">Nom du Pack</label>
              <input formControlName="nom" type="text" class="w-full px-4 py-2.5 rounded-lg border border-slate-200 focus:ring-2 focus:ring-purple-500 outline-none font-bold text-slate-800">
            </div>
            
            <div class="flex items-center gap-3 pt-6">
              <div class="relative inline-block w-12 h-6 transition duration-200 ease-in-out rounded-full cursor-pointer">
                <input id="active" type="checkbox" formControlName="active" class="peer sr-only" />
                <label for="active" class="block h-6 overflow-hidden rounded-full bg-slate-200 cursor-pointer peer-checked:bg-purple-600 transition-colors"></label>
                <span class="absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform peer-checked:translate-x-6"></span>
              </div>
              <label for="active" class="text-sm font-bold text-slate-700 cursor-pointer">Pack Actif</label>
            </div>

            <div class="md:col-span-2 space-y-1">
              <label class="block text-xs font-bold text-slate-500 uppercase">Description</label>
              <textarea formControlName="description" rows="2" class="w-full px-4 py-2.5 rounded-lg border border-slate-200 focus:ring-2 focus:ring-purple-500 outline-none resize-none"></textarea>
            </div>
          </div>
        </div>

        <div class="grid grid-cols-1 lg:grid-cols-2 gap-8">
          
          <div class="bg-white rounded-2xl shadow-sm border border-slate-200 flex flex-col h-full">
            <div class="p-5 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
              <h3 class="font-bold text-slate-800 flex items-center gap-2">
                <span class="material-icons text-blue-500">badge</span> Personnel Inclus
              </h3>
              <span class="bg-blue-100 text-blue-700 text-xs font-bold px-2 py-1 rounded-full">{{ selectedStaffCount() }}</span>
            </div>
            
            <div class="p-5 space-y-4 flex-1">
              <div class="relative">
                <input type="text" [value]="staffFilter()" 
                       (input)="onStaffFilterInput($event)"
                       (focus)="staffSearchFocused.set(true)"
                       (blur)="onStaffBlur()" 
                       placeholder="Rechercher un employé..." 
                       class="w-full pl-10 pr-4 py-2 rounded-lg border border-slate-200 text-sm focus:border-blue-500 outline-none">
                <span class="material-icons absolute left-3 top-2.5 text-slate-400 text-sm">search</span>
                
                @if ((staffFilter() || staffSearchFocused()) && filteredStaffList().length > 0) {
                  <div class="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-xl z-20 max-h-48 overflow-y-auto">
                    @for (s of filteredStaffList(); track s.id) {
                      <div (click)="addStaff(s.id)" class="px-4 py-2 hover:bg-blue-50 cursor-pointer flex items-center justify-between group transition">
                        <span class="text-sm font-medium text-slate-700">
                           {{ s.nom }} {{ s.prenom }}
                        </span>
                        <span class="material-icons text-blue-500 text-sm opacity-0 group-hover:opacity-100">add_circle</span>
                      </div>
                    }
                  </div>
                }
              </div>

              <div class="border rounded-xl overflow-hidden">
                <table class="w-full text-sm text-left">
                  <thead class="bg-slate-50 text-slate-500 font-bold text-xs uppercase">
                    <tr>
                      <th class="px-4 py-3">Nom</th>
                      <th class="px-4 py-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-slate-100">
                    @for (id of form.value.staffIds; track id) {
                      <tr class="hover:bg-slate-50 transition">
                        <td class="px-4 py-2 font-medium text-slate-700">
                          {{ staffMap().get(id) || 'Chargement...' }}
                        </td>
                        <td class="px-4 py-2 text-right">
                          <button type="button" (click)="removeStaff(id)" class="text-slate-400 hover:text-red-500 transition p-1">
                            <span class="material-icons text-sm">delete</span>
                          </button>
                        </td>
                      </tr>
                    }
                    @if (!form.value.staffIds?.length) {
                      <tr>
                        <td colspan="2" class="px-4 py-6 text-center text-slate-400 text-xs italic">
                          Aucun personnel sélectionné
                        </td>
                      </tr>
                    }
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <div class="bg-white rounded-2xl shadow-sm border border-slate-200 flex flex-col h-full">
            <div class="p-5 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
              <h3 class="font-bold text-slate-800 flex items-center gap-2">
                <span class="material-icons text-emerald-500">groups</span> Équipes Incluses
              </h3>
              <span class="bg-emerald-100 text-emerald-700 text-xs font-bold px-2 py-1 rounded-full">{{ selectedTeamCount() }}</span>
            </div>
            
            <div class="p-5 space-y-4 flex-1">
              <div class="relative">
                <input type="text" [value]="teamFilter()" 
                       (input)="onTeamFilterInput($event)" 
                       (focus)="teamSearchFocused.set(true)"
                       (blur)="onTeamBlur()"
                       placeholder="Rechercher une équipe..." 
                       class="w-full pl-10 pr-4 py-2 rounded-lg border border-slate-200 text-sm focus:border-emerald-500 outline-none">
                <span class="material-icons absolute left-3 top-2.5 text-slate-400 text-sm">search</span>
                
                @if ((teamFilter() || teamSearchFocused()) && filteredTeamList().length > 0) {
                  <div class="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-xl z-20 max-h-48 overflow-y-auto">
                    @for (t of filteredTeamList(); track t.id) {
                      <div (click)="addTeam(t.id)" class="px-4 py-2 hover:bg-emerald-50 cursor-pointer flex items-center justify-between group transition">
                        <span class="text-sm font-medium text-slate-700">{{ t.nom }}</span>
                        <span class="material-icons text-emerald-500 text-sm opacity-0 group-hover:opacity-100">add_circle</span>
                      </div>
                    }
                  </div>
                }
              </div>

              <div class="border rounded-xl overflow-hidden">
                <table class="w-full text-sm text-left">
                  <thead class="bg-slate-50 text-slate-500 font-bold text-xs uppercase">
                    <tr>
                      <th class="px-4 py-3">Nom Équipe</th>
                      <th class="px-4 py-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-slate-100">
                    @for (id of form.value.teamIds; track id) {
                      <tr class="hover:bg-slate-50 transition">
                        <td class="px-4 py-2 font-medium text-slate-700">
                          {{ teamMap().get(id) || 'Chargement...' }}
                        </td>
                        <td class="px-4 py-2 text-right">
                          <button type="button" (click)="removeTeam(id)" class="text-slate-400 hover:text-red-500 transition p-1">
                            <span class="material-icons text-sm">delete</span>
                          </button>
                        </td>
                      </tr>
                    }
                    @if (!form.value.teamIds?.length) {
                      <tr>
                        <td colspan="2" class="px-4 py-6 text-center text-slate-400 text-xs italic">
                          Aucune équipe sélectionnée
                        </td>
                      </tr>
                    }
                  </tbody>
                </table>
              </div>
            </div>
          </div>

        </div>

        <div class="flex justify-end gap-3 pt-6 border-t border-slate-200">
          <button type="button" (click)="cancel()" class="px-6 py-3 rounded-xl border border-slate-200 text-slate-600 font-bold hover:bg-slate-50 transition">
            Annuler
          </button>
          <button type="submit" [disabled]="form.invalid" class="px-8 py-3 rounded-xl bg-slate-900 text-white font-bold hover:bg-slate-800 shadow-lg hover:shadow-xl transition disabled:opacity-50 disabled:cursor-not-allowed">
            {{ isEditMode() ? 'Mettre à jour' : 'Enregistrer le Pack' }}
          </button>
        </div>

      </form>
    </div>
  `
})
export class PackFormComponent implements OnInit {
  private fb = inject(FormBuilder);
  private service = inject(PackService);
  private staffService = inject(StaffService);
  private teamService = inject(TeamService);
  private ui = inject(UiService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  isEditMode = signal(false);
  packId: string | null = null;

  // Data Sources (Signals)
  allStaff = toSignal(this.staffService.getAll(), { initialValue: [] as any[] });
  allTeams = toSignal(this.teamService.getAll(), { initialValue: [] as any[] });

  // Filters & States
  staffFilter = signal('');
  teamFilter = signal('');
  staffSearchFocused = signal(false);
  teamSearchFocused = signal(false);

  form = this.fb.group({
    nom: ['', Validators.required],
    description: [''],
    active: [true],
    staffIds: [[] as string[]],
    teamIds: [[] as string[]],
    createdAt: [new Date().toISOString()]
  });

  // --- COMPUTED MAPS (Correction du problème "Inconnu") ---
  // Ces Maps se mettent à jour automatiquement dès que les données arrivent de Firebase
  staffMap = computed(() => {
    const map = new Map<string, string>();
    this.allStaff().forEach(s => {
      // On combine Nom et Prénom pour être sûr d'avoir quelque chose
      const fullName = [s.nom, s.prenom].filter(Boolean).join(' ') || s.name || 'Sans Nom';
      map.set(s.id, fullName);
    });
    return map;
  });

  teamMap = computed(() => {
    const map = new Map<string, string>();
    this.allTeams().forEach(t => {
      map.set(t.id, t.nom || 'Sans Nom');
    });
    return map;
  });
  // -------------------------------------------------------

  filteredStaffList = computed(() => {
    const term = this.staffFilter().toLowerCase();
    const selected = this.form.value.staffIds || [];
    return this.allStaff().filter(s => 
      !selected.includes(s.id) && 
      (!term || String(s.nom).toLowerCase().includes(term) || String(s.prenom).toLowerCase().includes(term))
    );
  });

  filteredTeamList = computed(() => {
    const term = this.teamFilter().toLowerCase();
    const selected = this.form.value.teamIds || [];
    return this.allTeams().filter(t => 
      !selected.includes(t.id) && 
      (!term || String(t.nom).toLowerCase().includes(term))
    );
  });

  selectedStaffCount = computed(() => (this.form.value.staffIds || []).length);
  selectedTeamCount = computed(() => (this.form.value.teamIds || []).length);

  ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.isEditMode.set(true);
      this.packId = id;
      this.service.getById(id).subscribe(p => {
        if (p) {
          this.form.patchValue({
            nom: p.nom,
            description: p.description || '',
            active: !!p.active,
            staffIds: p.staffIds || [],
            teamIds: p.teamIds || []
          });
        }
      });
    }
  }

  // --- ACTIONS ---
  onStaffFilterInput(e: any) { this.staffFilter.set(e.target.value); }
  onStaffBlur() { setTimeout(() => this.staffSearchFocused.set(false), 200); }

  addStaff(id: string) {
    const current = this.form.value.staffIds || [];
    this.form.patchValue({ staffIds: [...current, id] });
    this.staffFilter.set(''); 
  }

  removeStaff(id: string) {
    const current = this.form.value.staffIds || [];
    this.form.patchValue({ staffIds: current.filter(x => x !== id) });
  }

  onTeamFilterInput(e: any) { this.teamFilter.set(e.target.value); }
  onTeamBlur() { setTimeout(() => this.teamSearchFocused.set(false), 200); }

  addTeam(id: string) {
    const current = this.form.value.teamIds || [];
    this.form.patchValue({ teamIds: [...current, id] });
    this.teamFilter.set('');
  }

  removeTeam(id: string) {
    const current = this.form.value.teamIds || [];
    this.form.patchValue({ teamIds: current.filter(x => x !== id) });
  }

  async submit() {
    if (!this.form.valid) return;
    try {
      const val = this.form.value;
      const payload: any = {
        ...val,
        staffIds: val.staffIds || [],
        teamIds: val.teamIds || []
      };

      if (this.isEditMode() && this.packId) {
        await this.service.update(this.packId, payload);
        this.ui.showToast('success', 'Pack mis à jour');
      } else {
        await this.service.add(payload);
        this.ui.showToast('success', 'Pack créé');
      }
      this.cancel();
    } catch (e) {
      this.ui.showToast('error', 'Erreur sauvegarde');
    }
  }

  cancel() {
    this.router.navigate(['/admin/packs']);
  }
}
