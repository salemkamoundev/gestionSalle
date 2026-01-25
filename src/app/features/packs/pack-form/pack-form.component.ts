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
  
  // --- FILTERS & STATES ---
  serviceFilter = signal('');
  serviceSearchFocused = signal(false);

  // --- FORMULAIRE ---
  form = this.fb.group({
    nom: new FormControl<string>('', { nonNullable: true, validators: [Validators.required] }),
    description: new FormControl<string>('', { nonNullable: true }),
    active: new FormControl<boolean>(true, { nonNullable: true }),
    price: new FormControl<number>(0, { nonNullable: true, validators: [Validators.min(0)] }),
    services: new FormControl<PackServiceItem[]>([], { nonNullable: true }),
    // Note: partenaireIds est maintenant déduit ou optionnel, mais on le garde pour compatibilité
    partenaireIds: new FormControl<string[]>([], { nonNullable: true }),
    createdAt: new FormControl<string>(new Date().toISOString(), { nonNullable: true })
  });

  // --- COMPUTED ---
  filteredServiceList = computed(() => {
    const term = this.serviceFilter().toLowerCase();
    const currentServices = this.form.getRawValue().services || [];
    const currentIds = currentServices.map((cs: any) => cs.id);
    
    return this.allServices().filter(s => 
      !currentIds.includes(s.id) &&
      (!term || String(s.nom).toLowerCase().includes(term))
    );
  });

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
            partenaireIds: p.partenaireIds || []
          });
        }
      });
    }
  }

  // --- ACTIONS SERVICES ---
  onServiceFilterInput(e: any) { this.serviceFilter.set(e.target.value); }
  onServiceBlur() { setTimeout(() => this.serviceSearchFocused.set(false), 200); }

  addService(serviceCatalogItem: any) {
    const current = this.form.getRawValue().services;
    const servicePrice = serviceCatalogItem.prix || serviceCatalogItem.price || 0;
    
    // RECHERCHE DU PARTENAIRE ASSOCIÉ
    // On suppose que serviceCatalogItem contient 'partenaireId'
    let partName = 'Non assigné';
    let partId = serviceCatalogItem.partenaireId;

    if (partId) {
        const foundPartner = this.allPartenaire().find(p => p.id === partId);
        if (foundPartner) {
            partName = `${foundPartner.nom} ${foundPartner.prenom}`;
        }
    }

    const serviceToAdd: PackServiceItem = {
      id: serviceCatalogItem.id,
      nom: serviceCatalogItem.nom,
      name: serviceCatalogItem.name || serviceCatalogItem.nom,
      prix: servicePrice,
      price: servicePrice,
      icon: serviceCatalogItem.icon || 'local_offer',
      partenaireId: partId,
      partenaireName: partName
    };
    
    // Ajout service + Mise à jour Prix Pack
    const currentPackPrice = this.form.getRawValue().price || 0;
    this.form.patchValue({ 
      services: [...current, serviceToAdd],
      price: currentPackPrice + servicePrice 
    });
    
    // Mise à jour automatique de la liste des IDs partenaires du pack (optionnel mais utile)
    this.updatePartenaireIdsFromServices([...current, serviceToAdd]);

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

    this.updatePartenaireIdsFromServices(next);
  }

  // Helper pour synchroniser le tableau partenaireIds avec les services présents
  private updatePartenaireIdsFromServices(services: PackServiceItem[]) {
      const pIds = services
        .map(s => s.partenaireId)
        .filter(id => !!id) as string[];
      
      // Garder unique
      const uniqueIds = Array.from(new Set(pIds));
      this.form.patchValue({ partenaireIds: uniqueIds });
  }

  // --- SUBMIT ---
  async submit() {
    if (!this.form.valid) return;
    try {
      const val = this.form.getRawValue();
      const payload: any = {
        ...val,
        price: val.price,
        nom: val.nom, 
        services: val.services,
        // On s'assure que partenaireIds est bien rempli basé sur les services
        partenaireIds: val.partenaireIds 
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
