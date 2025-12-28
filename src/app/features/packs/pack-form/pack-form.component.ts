import { Component, OnInit, computed, inject, signal, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators, FormControl } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';

import { PackService } from '../../../core/services/pack.service';
import { UiService } from '../../../core/services/ui.service';
import { StaffService } from '../../../core/services/staff.service';
import { TeamService } from '../../../core/services/team.service';
import { ServiceCatalogService } from '../../../core/services/service-catalog.service';
import { PackServiceItem } from '../../../core/models/pack.model';

@Component({
  selector: 'app-pack-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  template: `
    <div class="max-w-6xl mx-auto space-y-8 pb-20 animate-fade-in">
      
      <div class="flex items-center justify-between">
        <div>
          <h1 class="text-2xl font-black text-slate-800 flex items-center gap-2">
            <span class="material-icons text-purple-600">inventory_2</span>
            {{ isEditMode() ? 'Modifier le Pack' : 'Nouveau Pack' }}
          </h1>
          <p class="text-slate-500 text-sm mt-1">Configurez les services, le prix et les ressources du forfait.</p>
        </div>
        <button (click)="cancel()" class="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 font-bold flex items-center transition">
          <span class="material-icons text-sm mr-2">arrow_back</span> Retour
        </button>
      </div>

      <form [formGroup]="form" (ngSubmit)="submit()" class="space-y-8">
        
        <div class="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
          <h2 class="text-lg font-bold text-slate-800 mb-6 border-b border-slate-100 pb-2 flex items-center gap-2">
            <span class="material-icons text-slate-400">info</span> Informations Générales
          </h2>
          
          <div class="grid grid-cols-1 md:grid-cols-12 gap-6">
            <div class="md:col-span-6 space-y-1">
              <label class="block text-xs font-bold text-slate-500 uppercase">Nom du Pack</label>
              <input formControlName="nom" type="text" placeholder="Ex: Pack Mariage Royal" class="w-full px-4 py-3 rounded-lg border border-slate-200 focus:ring-2 focus:ring-purple-500 outline-none font-bold text-slate-800">
            </div>

            <div class="md:col-span-3 space-y-1">
              <label class="block text-xs font-bold text-slate-500 uppercase">Prix du Pack (DT)</label>
              <div class="relative">
                <input formControlName="price" type="number" class="w-full pl-4 pr-12 py-3 rounded-lg border border-slate-200 focus:ring-2 focus:ring-emerald-500 outline-none font-mono font-bold text-emerald-700 text-right">
                <span class="absolute right-4 top-3 text-slate-400 font-bold text-sm">DT</span>
              </div>
              <div *ngIf="servicesSum() > 0" class="text-xs text-right mt-1 text-slate-400">
                Somme des services : <span class="font-bold">{{ servicesSum() | number }} DT</span>
              </div>
            </div>
            
            <div class="md:col-span-3 flex items-center justify-center pt-6">
              <div class="flex items-center gap-3 bg-slate-50 px-4 py-2 rounded-lg border border-slate-100">
                <div class="relative inline-block w-12 h-6 transition duration-200 ease-in-out rounded-full cursor-pointer">
                  <input id="active" type="checkbox" formControlName="active" class="peer sr-only" />
                  <label for="active" class="block h-6 overflow-hidden rounded-full bg-slate-200 cursor-pointer peer-checked:bg-purple-600 transition-colors"></label>
                  <span class="absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform peer-checked:translate-x-6"></span>
                </div>
                <label for="active" class="text-sm font-bold text-slate-700 cursor-pointer">Pack Actif</label>
              </div>
            </div>

            <div class="md:col-span-12 space-y-1">
              <label class="block text-xs font-bold text-slate-500 uppercase">Description</label>
              <textarea formControlName="description" rows="2" class="w-full px-4 py-2.5 rounded-lg border border-slate-200 focus:ring-2 focus:ring-purple-500 outline-none resize-none" placeholder="Détails de l'offre..."></textarea>
            </div>
          </div>
        </div>

        <div class="bg-white rounded-2xl shadow-sm border border-slate-200 flex flex-col overflow-hidden">
          <div class="p-5 border-b border-slate-100 bg-indigo-50/50 flex justify-between items-center">
            <h3 class="font-bold text-slate-800 flex items-center gap-2">
              <span class="material-icons text-indigo-600">room_service</span> Services Inclus
            </h3>
            <span class="bg-indigo-100 text-indigo-700 text-xs font-bold px-3 py-1 rounded-full">
              {{ selectedServicesCount() }} services
            </span>
          </div>
          
          <div class="p-6 grid grid-cols-1 lg:grid-cols-3 gap-8">
            
            <div class="lg:col-span-1 space-y-4">
              <label class="block text-sm font-bold text-slate-700">Ajouter un service</label>
              <div class="relative z-20">
                <input type="text" [value]="serviceFilter()" 
                       (input)="onServiceFilterInput($event)"
                       (focus)="serviceSearchFocused.set(true)"
                       (blur)="onServiceBlur()" 
                       placeholder="Rechercher..." 
                       class="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none shadow-sm transition">
                <span class="material-icons absolute left-3 top-3.5 text-slate-400 text-sm">search</span>
                
                @if ((serviceFilter() || serviceSearchFocused()) && filteredServiceList().length > 0) {
                  <div class="absolute top-full left-0 right-0 mt-2 bg-white border border-slate-200 rounded-xl shadow-xl max-h-60 overflow-y-auto animate-fade-in">
                    @for (s of filteredServiceList(); track s.id) {
                      <button type="button" (click)="addService(s)" class="w-full text-left px-4 py-3 hover:bg-indigo-50 cursor-pointer flex items-center justify-between group transition border-b border-slate-50 last:border-0">
                        <div class="flex items-center gap-3">
                          <div class="w-8 h-8 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center">
                            <span class="material-icons text-sm">{{ s.icon || 'local_offer' }}</span>
                          </div>
                          <div>
                            <div class="text-sm font-bold text-slate-700">{{ s.nom }}</div>
                            <div class="text-xs text-slate-400">{{ s.prix | number }} DT</div>
                          </div>
                        </div>
                        <span class="material-icons text-indigo-500 opacity-0 group-hover:opacity-100 transition">add_circle</span>
                      </button>
                    }
                  </div>
                }
              </div>
              <p class="text-xs text-slate-400 leading-relaxed">
                Recherchez et cliquez pour ajouter les services qui composeront ce pack.
              </p>
            </div>

            <div class="lg:col-span-2 bg-slate-50 rounded-xl border border-slate-200 overflow-hidden flex flex-col">
              <div class="overflow-x-auto">
                <table class="w-full text-sm text-left">
                  <thead class="bg-slate-100 text-slate-500 font-bold text-xs uppercase border-b border-slate-200">
                    <tr>
                      <th class="px-6 py-3">Service</th>
                      <th class="px-6 py-3 text-right">Prix Unitaire</th>
                      <th class="px-6 py-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-slate-200">
                    @for (item of form.getRawValue().services; track $index) {
                      <tr class="bg-white hover:bg-slate-50 transition">
                        <td class="px-6 py-3 font-medium text-slate-700 flex items-center gap-3">
                          <span class="material-icons text-slate-400 text-sm">{{ item.icon || 'local_offer' }}</span>
                          {{ item.nom || item.name }}
                        </td>
                        <td class="px-6 py-3 text-right font-mono text-slate-600">
                          {{ (item.prix || item.price) | number }} DT
                        </td>
                        <td class="px-6 py-3 text-right">
                          <button type="button" (click)="removeService($index)" class="text-slate-400 hover:text-red-500 bg-slate-100 hover:bg-red-50 p-1.5 rounded-lg transition">
                            <span class="material-icons text-sm">close</span>
                          </button>
                        </td>
                      </tr>
                    }
                    @if (!form.getRawValue().services?.length) {
                      <tr>
                        <td colspan="3" class="px-6 py-10 text-center text-slate-400 italic flex flex-col items-center justify-center gap-2">
                          <span class="material-icons text-3xl opacity-20">playlist_add</span>
                          Aucun service sélectionné pour le moment
                        </td>
                      </tr>
                    }
                  </tbody>
                </table>
              </div>
            </div>

          </div>
        </div>

        <div class="grid grid-cols-1 lg:grid-cols-2 gap-8">
          
          <div class="bg-white rounded-2xl shadow-sm border border-slate-200 flex flex-col h-full">
            <div class="p-5 border-b border-slate-100 bg-blue-50/50 flex justify-between items-center">
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
                  <tbody class="divide-y divide-slate-100">
                    @for (id of form.getRawValue().staffIds; track id) {
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
                    @if (!form.getRawValue().staffIds?.length) {
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
            <div class="p-5 border-b border-slate-100 bg-emerald-50/50 flex justify-between items-center">
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
                  <tbody class="divide-y divide-slate-100">
                    @for (id of form.getRawValue().teamIds; track id) {
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
                    @if (!form.getRawValue().teamIds?.length) {
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
          <button type="submit" [disabled]="form.invalid" class="px-8 py-3 rounded-xl bg-slate-900 text-white font-bold hover:bg-slate-800 shadow-lg hover:shadow-xl transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2">
            <span class="material-icons text-sm">save</span>
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
  private serviceCatalog = inject(ServiceCatalogService);
  private ui = inject(UiService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  isEditMode = signal(false);
  packId: string | null = null;

  // Data Sources (Signals)
  allStaff = toSignal(this.staffService.getAll(), { initialValue: [] as any[] });
  allTeams = toSignal(this.teamService.getAll(), { initialValue: [] as any[] });
  allServices = toSignal(this.serviceCatalog.getAll(), { initialValue: [] as any[] });

  // Filters & States
  staffFilter = signal('');
  teamFilter = signal('');
  serviceFilter = signal('');
  
  staffSearchFocused = signal(false);
  teamSearchFocused = signal(false);
  serviceSearchFocused = signal(false);

  // DÉFINITION EXPLICITE DES TYPES POUR ÉVITER LES ERREURS TS
  form = this.fb.group({
    nom: new FormControl<string>('', { nonNullable: true, validators: [Validators.required] }),
    description: new FormControl<string>('', { nonNullable: true }),
    active: new FormControl<boolean>(true, { nonNullable: true }),
    price: new FormControl<number>(0, { nonNullable: true, validators: [Validators.min(0)] }),
    services: new FormControl<PackServiceItem[]>([], { nonNullable: true }), // Typage strict tableau
    staffIds: new FormControl<string[]>([], { nonNullable: true }),
    teamIds: new FormControl<string[]>([], { nonNullable: true }),
    createdAt: new FormControl<string>(new Date().toISOString(), { nonNullable: true })
  });

  // --- COMPUTED MAPS ---
  staffMap = computed(() => {
    const map = new Map<string, string>();
    this.allStaff().forEach(s => {
      const fullName = [s.nom, s.prenom].filter(Boolean).join(' ') || s.name || 'Sans Nom';
      map.set(s.id, fullName);
    });
    return map;
  });

  teamMap = computed(() => {
    const map = new Map<string, string>();
    this.allTeams().forEach(t => map.set(t.id, t.nom || 'Sans Nom'));
    return map;
  });

  // --- FILTERED LISTS ---
  filteredStaffList = computed(() => {
    const term = this.staffFilter().toLowerCase();
    const selected = this.form.getRawValue().staffIds || []; // getRawValue plus sûr
    return this.allStaff().filter(s => 
      !selected.includes(s.id) && 
      (!term || String(s.nom).toLowerCase().includes(term) || String(s.prenom).toLowerCase().includes(term))
    );
  });

  filteredTeamList = computed(() => {
    const term = this.teamFilter().toLowerCase();
    const selected = this.form.getRawValue().teamIds || [];
    return this.allTeams().filter(t => 
      !selected.includes(t.id) && 
      (!term || String(t.nom).toLowerCase().includes(term))
    );
  });

  filteredServiceList = computed(() => {
    const term = this.serviceFilter().toLowerCase();
    const currentServices = this.form.getRawValue().services || [];
    const currentIds = currentServices.map((cs: any) => cs.id);
    
    return this.allServices().filter(s => 
      !currentIds.includes(s.id) &&
      (!term || String(s.nom).toLowerCase().includes(term))
    );
  });

  // --- COUNTERS & SUMS ---
  // On utilise form.getRawValue() pour éviter les erreurs "never" si form.value est mal inféré
  selectedStaffCount = computed(() => (this.form.getRawValue().staffIds || []).length);
  selectedTeamCount = computed(() => (this.form.getRawValue().teamIds || []).length);
  selectedServicesCount = computed(() => (this.form.getRawValue().services || []).length);
  
  servicesSum = computed(() => {
    const services = this.form.getRawValue().services || [];
    return services.reduce((acc: number, curr: any) => acc + (curr.prix || curr.price || 0), 0);
  });

  ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.isEditMode.set(true);
      this.packId = id;
      this.service.getById(id).subscribe(p => {
        if (p) {
          this.form.patchValue({
            nom: p.nom || p.name,
            description: p.description || '',
            active: !!p.active,
            price: p.price || p.prix || 0,
            services: p.services || [],
            staffIds: p.staffIds || [],
            teamIds: p.teamIds || []
          });
        }
      });
    }
  }

  // --- ACTIONS SERVICES ---
  onServiceFilterInput(e: any) { this.serviceFilter.set(e.target.value); }
  onServiceBlur() { setTimeout(() => this.serviceSearchFocused.set(false), 200); }

  addService(service: any) {
    const current = this.form.getRawValue().services;
    const serviceToAdd: PackServiceItem = {
      id: service.id,
      nom: service.nom,
      name: service.name || service.nom,
      prix: service.prix || service.price || 0,
      price: service.price || service.prix || 0,
      icon: service.icon || 'local_offer'
    };
    this.form.patchValue({ services: [...current, serviceToAdd] });
    this.serviceFilter.set(''); 
  }

  removeService(index: number) {
    const current = this.form.getRawValue().services;
    const next = [...current];
    next.splice(index, 1);
    this.form.patchValue({ services: next });
  }

  // --- ACTIONS STAFF ---
  onStaffFilterInput(e: any) { this.staffFilter.set(e.target.value); }
  onStaffBlur() { setTimeout(() => this.staffSearchFocused.set(false), 200); }

  addStaff(id: string) {
    const current = this.form.getRawValue().staffIds;
    this.form.patchValue({ staffIds: [...current, id] });
    this.staffFilter.set(''); 
  }

  removeStaff(id: string) {
    const current = this.form.getRawValue().staffIds;
    this.form.patchValue({ staffIds: current.filter(x => x !== id) });
  }

  // --- ACTIONS TEAMS ---
  onTeamFilterInput(e: any) { this.teamFilter.set(e.target.value); }
  onTeamBlur() { setTimeout(() => this.teamSearchFocused.set(false), 200); }

  addTeam(id: string) {
    const current = this.form.getRawValue().teamIds;
    this.form.patchValue({ teamIds: [...current, id] });
    this.teamFilter.set('');
  }

  removeTeam(id: string) {
    const current = this.form.getRawValue().teamIds;
    this.form.patchValue({ teamIds: current.filter(x => x !== id) });
  }

  // --- SUBMIT ---
  async submit() {
    if (!this.form.valid) return;
    try {
      const val = this.form.getRawValue();
      const payload: any = {
        ...val,
        // Normalisation
        price: val.price,
        nom: val.nom, 
        staffIds: val.staffIds,
        teamIds: val.teamIds,
        services: val.services
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
