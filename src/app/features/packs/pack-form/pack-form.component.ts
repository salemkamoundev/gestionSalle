import { Component, OnInit, computed, inject, signal, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators, FormControl } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';

import { PackService } from '../../../core/services/pack.service';
import { UiService } from '../../../core/services/ui.service';
import { PartenaireService } from '../../../core/services/partenaire.service';
import { ServiceCatalogService } from '../../../core/services/service-catalog.service';
import { PackServiceItem } from '../../../core/models/pack.model';

@Component({
  selector: 'app-pack-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './pack-form.component.html'
})
export class PackFormComponent implements OnInit {
  private fb = inject(FormBuilder);
  private service = inject(PackService);
  private partenaireService = inject(PartenaireService);
  private serviceCatalog = inject(ServiceCatalogService);
  private ui = inject(UiService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  isEditMode = signal(false);
  packId: string | null = null;

  // --- DATA SOURCES ---
  allPartenaire = toSignal(this.partenaireService.getAll(), { initialValue: [] as any[] });
  allServices = toSignal(this.serviceCatalog.getAll(), { initialValue: [] as any[] });
  
  // MOCK: On simule la liste des équipes vide pour ne pas casser le HTML
  allTeams = signal<any[]>([]); 

  // --- FILTERS & STATES ---
  partenaireFilter = signal('');
  teamFilter = signal(''); // Pour le champ de recherche équipe
  serviceFilter = signal('');
  
  partenaireSearchFocused = signal(false);
  teamSearchFocused = signal(false); // Pour le focus équipe
  serviceSearchFocused = signal(false);

  // --- FORMULAIRE COMPLET ---
  form = this.fb.group({
    nom: new FormControl<string>('', { nonNullable: true, validators: [Validators.required] }),
    description: new FormControl<string>('', { nonNullable: true }),
    active: new FormControl<boolean>(true, { nonNullable: true }),
    price: new FormControl<number>(0, { nonNullable: true, validators: [Validators.min(0)] }),
    services: new FormControl<PackServiceItem[]>([], { nonNullable: true }),
    partenaireIds: new FormControl<string[]>([], { nonNullable: true }),
    teamIds: new FormControl<string[]>([], { nonNullable: true }), // Présent pour le HTML
    createdAt: new FormControl<string>(new Date().toISOString(), { nonNullable: true })
  });

  // --- COMPUTED LISTS (FILTRAGE) ---

  // 1. Partenaire
  filteredPartenaireList = computed(() => {
    const term = this.partenaireFilter().toLowerCase();
    const selected = this.form.getRawValue().partenaireIds || [];
    return this.allPartenaire().filter(s => 
      !selected.includes(s.id) && 
      (!term || String(s.nom).toLowerCase().includes(term) || String(s.prenom).toLowerCase().includes(term))
    );
  });

  // 2. Équipes (Vide mais existant pour éviter erreur template)
  filteredTeamList = computed(() => []);
  
  // 3. Services
  filteredServiceList = computed(() => {
    const term = this.serviceFilter().toLowerCase();
    const currentServices = this.form.getRawValue().services || [];
    const currentIds = currentServices.map((cs: any) => cs.id);
    
    return this.allServices().filter(s => 
      !currentIds.includes(s.id) &&
      (!term || String(s.nom).toLowerCase().includes(term))
    );
  });

  // --- COUNTERS & MAPS ---
  selectedPartenaireCount = computed(() => (this.form.getRawValue().partenaireIds || []).length);
  selectedTeamCount = computed(() => 0); // Toujours 0
  selectedServicesCount = computed(() => (this.form.getRawValue().services || []).length);
  
  // Calcul automatique du prix théorique des services
  servicesSum = computed(() => {
    const services = this.form.getRawValue().services || [];
    return services.reduce((acc: number, curr: any) => acc + (curr.prix || curr.price || 0), 0);
  });

  partenaireMap = computed(() => {
    const map = new Map<string, string>();
    this.allPartenaire().forEach(s => {
      const fullName = [s.nom, s.prenom].filter(Boolean).join(' ') || s.name || 'Sans Nom';
      map.set(s.id, fullName);
    });
    return map;
  });

  teamMap = computed(() => new Map<string, string>()); // Map vide

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
            partenaireIds: p.partenaireIds || [],
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
    
    // Ajout service + Mise à jour Prix Pack (Suggestion)
    const currentPackPrice = this.form.getRawValue().price || 0;
    this.form.patchValue({ 
      services: [...current, serviceToAdd],
      price: currentPackPrice + servicePrice 
    });
    
    this.serviceFilter.set(''); 
  }

  updateServicePrice(index: number, event: any) {
    const newVal = parseFloat(event.target.value);
    if (isNaN(newVal) || newVal < 0) return;

    const currentServices = this.form.getRawValue().services;
    const oldItem = currentServices[index];
    const oldItemPrice = oldItem.prix || oldItem.price || 0;
    
    const updatedItem = { ...oldItem, prix: newVal, price: newVal };
    const nextServices = [...currentServices];
    nextServices[index] = updatedItem;

    // Ajustement intelligent du prix total
    const currentPackPrice = this.form.getRawValue().price || 0;
    const diff = newVal - oldItemPrice;
    
    this.form.patchValue({
      services: nextServices,
      price: Math.max(0, currentPackPrice + diff)
    });
  }

  removeService(index: number) {
    const current = this.form.getRawValue().services;
    const itemToRemove = current[index];
    const itemPrice = itemToRemove.prix || itemToRemove.price || 0;
    
    const next = [...current];
    next.splice(index, 1);
    
    const currentPackPrice = this.form.getRawValue().price || 0;
    
    this.form.patchValue({ 
      services: next,
      price: Math.max(0, currentPackPrice - itemPrice)
    });
  }

  // --- ACTIONS PARTENAIRE ---
  onPartenaireFilterInput(e: any) { this.partenaireFilter.set(e.target.value); }
  onPartenaireBlur() { setTimeout(() => this.partenaireSearchFocused.set(false), 200); }

  addPartenaire(id: string) {
    const current = this.form.getRawValue().partenaireIds;
    if (!current.includes(id)) {
        this.form.patchValue({ partenaireIds: [...current, id] });
    }
    this.partenaireFilter.set(''); 
  }

  removePartenaire(id: string) {
    const current = this.form.getRawValue().partenaireIds;
    this.form.patchValue({ partenaireIds: current.filter(x => x !== id) });
  }

  // --- ACTIONS TEAMS (STUBS POUR HTML) ---
  // Ces méthodes ne font rien mais empêchent les erreurs dans le template
  onTeamFilterInput(e: any) { this.teamFilter.set(e.target.value); }
  onTeamBlur() { setTimeout(() => this.teamSearchFocused.set(false), 200); }
  addTeam(id: string) { /* No-op */ }
  removeTeam(id: string) { /* No-op */ }

  // --- SUBMIT ---
  async submit() {
    if (!this.form.valid) return;
    try {
      const val = this.form.getRawValue();
      const payload: any = {
        ...val,
        price: val.price,
        nom: val.nom, 
        partenaireIds: val.partenaireIds,
        teamIds: [], // Force vide
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
