import { Component, OnInit, computed, inject, signal, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators, FormControl } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';

import { PackService } from '../../../core/services/pack.service';
import { UiService } from '../../../core/services/ui.service';
import { StaffService } from '../../../core/services/staff.service';
// SUPPRIMÉ : TeamService
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
         </form>
    </div>
  `
})
export class PackFormComponent implements OnInit {
  private fb = inject(FormBuilder);
  private service = inject(PackService);
  private staffService = inject(StaffService);
  // SUPPRIMÉ : private teamService = inject(TeamService);
  private serviceCatalog = inject(ServiceCatalogService);
  private ui = inject(UiService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  isEditMode = signal(false);
  packId: string | null = null;

  // Data Sources (Signals)
  allStaff = toSignal(this.staffService.getAll(), { initialValue: [] as any[] });
  // SUPPRIMÉ : allTeams
  allServices = toSignal(this.serviceCatalog.getAll(), { initialValue: [] as any[] });

  // Filters & States
  staffFilter = signal('');
  // SUPPRIMÉ : teamFilter
  serviceFilter = signal('');
  
  staffSearchFocused = signal(false);
  // SUPPRIMÉ : teamSearchFocused
  serviceSearchFocused = signal(false);

  form = this.fb.group({
    nom: new FormControl<string>('', { nonNullable: true, validators: [Validators.required] }),
    description: new FormControl<string>('', { nonNullable: true }),
    active: new FormControl<boolean>(true, { nonNullable: true }),
    price: new FormControl<number>(0, { nonNullable: true, validators: [Validators.min(0)] }),
    services: new FormControl<PackServiceItem[]>([], { nonNullable: true }),
    staffIds: new FormControl<string[]>([], { nonNullable: true }),
    teamIds: new FormControl<string[]>([], { nonNullable: true }), // On garde le contrôle pour compatibilité mais vide
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

  // SUPPRIMÉ : teamMap

  // --- FILTERED LISTS ---
  filteredStaffList = computed(() => {
    const term = this.staffFilter().toLowerCase();
    const selected = this.form.getRawValue().staffIds || [];
    return this.allStaff().filter(s => 
      !selected.includes(s.id) && 
      (!term || String(s.nom).toLowerCase().includes(term) || String(s.prenom).toLowerCase().includes(term))
    );
  });

  // SUPPRIMÉ : filteredTeamList (retourne tableau vide pour éviter erreur template)
  filteredTeamList = computed(() => []);
  teamFilter = signal(''); // Signal vide pour le template
  teamSearchFocused = signal(false);
  teamMap = computed(() => new Map<string, string>()); // Map vide

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
  selectedStaffCount = computed(() => (this.form.getRawValue().staffIds || []).length);
  selectedTeamCount = computed(() => 0); // Toujours 0
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
            teamIds: [] // On ignore les équipes existantes
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
    const servicePrice = service.prix || service.price || 0;
    
    const serviceToAdd: PackServiceItem = {
      id: service.id,
      nom: service.nom,
      name: service.name || service.nom,
      prix: servicePrice,
      price: servicePrice,
      icon: service.icon || 'local_offer'
    };
    
    // Ajout service + Mise à jour Prix
    const currentPrice = this.form.getRawValue().price || 0;
    this.form.patchValue({ 
      services: [...current, serviceToAdd],
      price: currentPrice + servicePrice
    });
    
    this.serviceFilter.set(''); 
  }

  updateServicePrice(index: number, event: any) {
    const newVal = parseFloat(event.target.value);
    if (isNaN(newVal) || newVal < 0) return;

    const currentServices = this.form.getRawValue().services;
    const oldItem = currentServices[index];
    const oldPrice = oldItem.prix || oldItem.price || 0;
    
    const updatedItem = { ...oldItem, prix: newVal, price: newVal };
    const nextServices = [...currentServices];
    nextServices[index] = updatedItem;

    const currentPackPrice = this.form.getRawValue().price || 0;
    const diff = newVal - oldPrice;
    const newPackPrice = Math.max(0, currentPackPrice + diff);

    this.form.patchValue({
      services: nextServices,
      price: newPackPrice
    });
  }

  removeService(index: number) {
    const current = this.form.getRawValue().services;
    const itemToRemove = current[index];
    const itemPrice = itemToRemove.prix || itemToRemove.price || 0;
    
    const next = [...current];
    next.splice(index, 1);
    
    const currentPrice = this.form.getRawValue().price || 0;
    const newPrice = Math.max(0, currentPrice - itemPrice);
    
    this.form.patchValue({ 
      services: next,
      price: newPrice
    });
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

  // --- ACTIONS TEAMS (Méthodes vides pour ne pas casser le template) ---
  onTeamFilterInput(e: any) { }
  onTeamBlur() { }
  addTeam(id: string) { }
  removeTeam(id: string) { }

  // --- SUBMIT ---
  async submit() {
    if (!this.form.valid) return;
    try {
      const val = this.form.getRawValue();
      const payload: any = {
        ...val,
        price: val.price,
        nom: val.nom, 
        staffIds: val.staffIds,
        teamIds: [], // Force empty teams
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