import { Component, inject, OnInit, signal, computed, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';

import { ServiceCatalogService } from '../../../core/services/service-catalog.service';
import { PartenaireService } from '../../../core/services/partenaire.service';
import { UiService } from '../../../core/services/ui.service';

@Component({
  selector: 'app-service-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  template: `
    <div class="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div class="bg-white rounded-xl shadow-xl w-full max-w-2xl overflow-visible"> <div class="bg-indigo-600 px-6 py-4 flex justify-between items-center rounded-t-xl">
          <h2 class="text-white font-bold text-lg flex items-center">
            <span class="material-icons mr-2">{{ isEditMode() ? 'edit' : 'design_services' }}</span>
            {{ isEditMode() ? 'Modifier Service' : 'Nouveau Service' }}
          </h2>
          <button (click)="cancel()" class="text-white/80 hover:text-white transition">
            <span class="material-icons">close</span>
          </button>
        </div>

        <form [formGroup]="form" (ngSubmit)="submit()" class="p-6 space-y-6">
          <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            <div class="md:col-span-2">
              <label class="block text-sm font-medium text-slate-700 mb-1">Nom du service *</label>
              <input formControlName="nom" class="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none font-bold text-slate-800" placeholder="Ex: DJ & Animation">
              @if (form.get('nom')?.touched && form.get('nom')?.invalid) {
                <p class="text-xs text-red-600 mt-1">Nom requis</p>
              }
            </div>

            <div class="md:col-span-2 relative z-30">
              <label class="block text-sm font-medium text-slate-700 mb-1">Partenaire Associé (Recherche)</label>
              
              <div class="relative">
                <span class="material-icons absolute left-3 top-2.5 text-slate-400 text-sm">search</span>
                
                <input 
                  type="text" 
                  [value]="partnerSearch()" 
                  (input)="onSearch($event)"
                  (focus)="showDropdown.set(true)"
                  (blur)="onBlur()"
                  placeholder="Rechercher un partenaire..."
                  class="w-full pl-9 pr-10 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none transition"
                  [class.border-indigo-500]="showDropdown()"
                >

                @if (partnerSearch()) {
                  <button type="button" (click)="clearPartner()" class="absolute right-3 top-2.5 text-slate-400 hover:text-red-500 transition">
                    <span class="material-icons text-sm">close</span>
                  </button>
                }
              </div>

              @if (showDropdown() && filteredPartners().length > 0) {
                <div class="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-xl max-h-60 overflow-y-auto z-50 animate-in fade-in slide-in-from-top-2 duration-150">
                  @for (p of filteredPartners(); track p.id) {
                    <div (mousedown)="selectPartner(p)" class="px-4 py-3 hover:bg-indigo-50 cursor-pointer flex items-center gap-3 transition border-b border-slate-50 last:border-0 group">
                      <div class="w-8 h-8 rounded-full bg-slate-100 text-slate-500 group-hover:bg-indigo-100 group-hover:text-indigo-600 flex items-center justify-center font-bold text-xs transition">
                        {{ p.nom.charAt(0) }}{{ p.prenom?.charAt(0) }}
                      </div>
                      <div>
                        <div class="font-bold text-slate-700 text-sm group-hover:text-indigo-700">{{ p.nom }} {{ p.prenom }}</div>
                        <div class="text-[10px] text-slate-400 uppercase tracking-wide group-hover:text-indigo-400">{{ p.specialite || 'Autre' }}</div>
                      </div>
                    </div>
                  }
                </div>
              }
              
              <p class="text-[11px] text-slate-400 mt-1 pl-1">
                Assigner ce partenaire par défaut pour ce service. (Un partenaire peut réaliser plusieurs services).
              </p>
            </div>

            <div>
              <label class="block text-sm font-medium text-slate-700 mb-1">Prix défaut (TND)</label>
              <input type="number" formControlName="prix" class="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-right font-mono font-bold text-slate-700">
            </div>

            <div class="flex items-center gap-2 mt-7">
              <input id="active" type="checkbox" formControlName="active" class="h-5 w-5 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500 cursor-pointer">
              <label for="active" class="text-sm font-medium text-slate-700 cursor-pointer select-none">Service Actif</label>
            </div>

            <div class="md:col-span-2">
              <label class="block text-sm font-medium text-slate-700 mb-1">Description</label>
              <textarea formControlName="description" rows="3" class="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none resize-none" placeholder="Détails de la prestation..."></textarea>
            </div>
          </div>

          <div class="flex justify-end gap-3 pt-4 border-t border-slate-100">
            <button type="button" (click)="cancel()" class="px-5 py-2 rounded-lg border bg-white hover:bg-slate-50 text-slate-700 font-medium transition">Annuler</button>
            <button type="submit" [disabled]="form.invalid || isSubmitting()" class="px-6 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 shadow font-bold transition flex items-center gap-2">
              @if(isSubmitting()) { <span class="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full"></span> }
              {{ isEditMode() ? 'Enregistrer' : 'Créer' }}
            </button>
          </div>
        </form>
      </div>
    </div>
  `
})
export class ServiceFormComponent implements OnInit {
  private fb = inject(FormBuilder);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private service = inject(ServiceCatalogService);
  private partenaireService = inject(PartenaireService);
  private ui = inject(UiService);

  isEditMode = signal(false);
  isSubmitting = signal(false);
  private serviceId: string | null = null;

  // Gestion Autocomplete
  allPartners = toSignal(this.partenaireService.getAll(), { initialValue: [] as any[] });
  partnerSearch = signal('');
  showDropdown = signal(false);

  form = this.fb.group({
    nom: ['', Validators.required],
    description: [''],
    prix: [0, [Validators.min(0)]],
    active: [true],
    partnerId: [null as string | null]
  });

  // Filtrage dynamique
  filteredPartners = computed(() => {
    const term = this.partnerSearch().toLowerCase();
    const partners = this.allPartners();
    if (!term) return partners; 
    return partners.filter(p => 
      (p.nom && p.nom.toLowerCase().includes(term)) || 
      (p.prenom && p.prenom.toLowerCase().includes(term)) ||
      (p.specialite && p.specialite.toLowerCase().includes(term))
    );
  });

  constructor() {
    // Effet pour initialiser le champ recherche quand les données arrivent (mode Edit)
    effect(() => {
      const currentId = this.form.value.partnerId;
      const partners = this.allPartners();
      // Si on a un ID mais pas de texte de recherche affiché, on le cherche
      if (currentId && !this.partnerSearch() && partners.length > 0) {
        const p = partners.find(p => p.id === currentId);
        if (p) {
          this.partnerSearch.set(`${p.nom} ${p.prenom}`);
        }
      }
    });
  }

  ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.isEditMode.set(true);
      this.serviceId = id;
      this.service.getById(id).subscribe(s => {
        if (!s) return;
        this.form.patchValue({
          nom: s.nom,
          description: s.description || '',
          prix: s.prix ?? 0,
          active: s.active !== false,
          partnerId: s.partnerId || null
        });
      });
    }
  }

  // --- Logique Autocomplete ---

  onSearch(event: any) {
    this.partnerSearch.set(event.target.value);
    this.showDropdown.set(true);
    this.form.patchValue({ partnerId: null }); // Reset ID si on tape
  }

  selectPartner(p: any) {
    this.form.patchValue({ partnerId: p.id });
    this.partnerSearch.set(`${p.nom} ${p.prenom}`);
    this.showDropdown.set(false);
  }

  clearPartner() {
    this.form.patchValue({ partnerId: null });
    this.partnerSearch.set('');
    this.showDropdown.set(false);
  }

  onBlur() {
    setTimeout(() => {
      this.showDropdown.set(false);
    }, 200);
  }

  // --- Submit ---

  async submit() {
    if (this.form.invalid) {
      this.ui.showToast('error', 'Formulaire invalide.');
      return;
    }
    this.isSubmitting.set(true);
    try {
      const data = this.form.value as any;
      if (this.isEditMode() && this.serviceId) {
        await this.service.update(this.serviceId, data);
        this.ui.showToast('success', 'Service modifié');
      } else {
        await this.service.add(data);
        this.ui.showToast('success', 'Service ajouté');
      }
      this.cancel();
    } catch {
      this.ui.showToast('error', 'Erreur lors de la sauvegarde');
    } finally {
      this.isSubmitting.set(false);
    }
  }

  cancel() {
    this.router.navigate(['/admin/services']);
  }
}
