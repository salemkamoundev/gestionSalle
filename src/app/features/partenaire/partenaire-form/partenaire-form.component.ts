import { Component, inject, OnInit, signal, computed, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';

import { PartenaireService } from '../../../core/services/partenaire.service';
import { ServiceService } from '../../../core/services/service.service';
import { UiService } from '../../../core/services/ui.service';

@Component({
  selector: 'app-partenaire-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  template: `
    <div [class]="isModal ? '' : 'min-h-screen bg-slate-50 flex items-center justify-center p-4'">
      <div [class]="isModal ? '' : 'bg-white rounded-xl shadow-xl w-full max-w-4xl overflow-hidden'">
        
        @if (!isModal) {
          <div class="bg-indigo-600 px-6 py-4 flex justify-between items-center">
            <h2 class="text-white font-bold text-lg flex items-center">
              <span class="material-icons mr-2">{{ isEditMode() ? 'edit' : 'person_add' }}</span>
              {{ isEditMode() ? 'Modifier Partenaire' : 'Nouveau Partenaire' }}
            </h2>
            <button (click)="cancel()" class="text-white/80 hover:text-white transition">
              <span class="material-icons">close</span>
            </button>
          </div>
        }
        
        <form [formGroup]="form" (ngSubmit)="submit()" [class]="isModal ? 'space-y-6' : 'p-6 space-y-6'">
          
          <div class="grid grid-cols-1 md:grid-cols-2 gap-8">
            
            <div class="space-y-5">
              <h3 class="text-xs font-bold text-slate-400 uppercase tracking-wider border-b pb-2 flex items-center gap-2">
                <span class="material-icons text-sm">person</span> Identité & Accès
              </h3>
              
              <div>
                <label class="block text-xs font-bold text-slate-500 mb-1 uppercase">Nom complet *</label>
                <input formControlName="nom" type="text" class="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none transition font-semibold text-slate-700">
              </div>
              
              <div>
                <label class="block text-xs font-bold text-slate-500 mb-1 uppercase">Email (Login) *</label>
                <input formControlName="email" type="email" [readonly]="isEditMode()" class="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none transition disabled:bg-slate-50 disabled:text-slate-400">
              </div>

              <div>
                <label class="block text-xs font-bold text-slate-500 mb-1 uppercase">
                    {{ isEditMode() ? 'Nouveau Mot de passe (Optionnel)' : 'Mot de passe *' }}
                </label>
                <div class="relative">
                    <input 
                      [type]="showPassword() ? 'text' : 'password'" 
                      formControlName="password" 
                      class="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none transition pr-10" 
                      [placeholder]="isEditMode() ? 'Laisser vide pour ne pas changer' : 'Minimum 6 caractères'"
                    >
                    <button type="button" (click)="showPassword.set(!showPassword())" class="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-indigo-600">
                        <span class="material-icons text-lg">{{ showPassword() ? 'visibility_off' : 'visibility' }}</span>
                    </button>
                </div>
                @if (form.get('password')?.invalid && (form.get('password')?.touched || form.get('password')?.dirty)) {
                    @if (form.get('password')?.errors?.['required']) {
                        <p class="text-xs text-red-500 mt-1">Le mot de passe est requis.</p>
                    }
                    @if (form.get('password')?.errors?.['minlength']) {
                        <p class="text-xs text-red-500 mt-1">Minimum 6 caractères.</p>
                    }
                }
              </div>

              <div>
                <label class="block text-xs font-bold text-slate-500 mb-1 uppercase">Téléphone *</label>
                <input formControlName="telephone" type="tel" class="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none transition">
              </div>

              <div class="grid grid-cols-2 gap-4">
                <div>
                    <label class="block text-xs font-bold text-slate-500 mb-1 uppercase">Rôle</label>
                    <select formControlName="role" class="w-full px-4 py-2 border border-slate-200 rounded-lg bg-white outline-none focus:ring-2 focus:ring-indigo-500">
                        <option value="SERVER">Partenaire</option>
                        <option value="ADMIN">Administrateur</option>
                    </select>
                </div>
                <div>
                    <label class="block text-xs font-bold text-slate-500 mb-1 uppercase">Spécialité</label>
                    <select formControlName="specialite" class="w-full px-4 py-2 border border-slate-200 rounded-lg bg-white outline-none focus:ring-2 focus:ring-indigo-500">
                        <option value="Salle">Salle</option>
                        <option value="Bar">Bar</option>
                        <option value="Cuisine">Cuisine</option>
                        <option value="Accueil">Accueil</option>
                        <option value="Sécurité">Sécurité</option>
                    </select>
                </div>
              </div>
              
              <div class="flex items-center pt-2">
                <input formControlName="active" type="checkbox" id="active" class="w-5 h-5 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500 cursor-pointer">
                <label for="active" class="ml-2 block text-sm font-medium text-slate-700 cursor-pointer">Compte Actif</label>
              </div>
            </div>

            <div class="space-y-4">
              <h3 class="text-xs font-bold text-slate-400 uppercase tracking-wider border-b pb-2 flex items-center gap-2">
                <span class="material-icons text-sm">room_service</span> Services Réalisables
              </h3>
              
              <div class="relative">
                <input 
                    type="text" 
                    placeholder="Rechercher un service..." 
                    (input)="serviceSearch.set($any($event.target).value)"
                    class="w-full pl-9 pr-4 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                >
                <span class="material-icons absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-lg">search</span>
              </div>

              <div class="bg-slate-50 rounded-xl p-4 border border-slate-200 max-h-[400px] overflow-y-auto custom-scrollbar">
                @if (filteredServices().length > 0) {
                    <p class="text-xs text-slate-500 mb-3">Cochez les compétences :</p>
                    <div class="space-y-2">
                        @for (service of filteredServices(); track service.id) {
                            <div (click)="toggleService(service.id)" 
                                 class="flex items-center p-3 rounded-lg border cursor-pointer transition-all hover:shadow-sm"
                                 [class.bg-white]="!isServiceSelected(service.id)"
                                 [class.border-slate-200]="!isServiceSelected(service.id)"
                                 [class.bg-indigo-50]="isServiceSelected(service.id)"
                                 [class.border-indigo-300]="isServiceSelected(service.id)"
                                 [class.ring-1]="isServiceSelected(service.id)"
                                 [class.ring-indigo-300]="isServiceSelected(service.id)">
                                
                                <div class="flex-shrink-0 mr-3">
                                    <div class="w-5 h-5 rounded border flex items-center justify-center transition-colors"
                                         [class.border-slate-300]="!isServiceSelected(service.id)"
                                         [class.bg-white]="!isServiceSelected(service.id)"
                                         [class.border-indigo-600]="isServiceSelected(service.id)"
                                         [class.bg-indigo-600]="isServiceSelected(service.id)">
                                        @if (isServiceSelected(service.id)) {
                                            <span class="material-icons text-white text-[14px] font-bold">check</span>
                                        }
                                    </div>
                                </div>
                                
                                <div class="flex-1">
                                    <div class="text-sm font-bold text-slate-700">{{ service.nom || service.name }}</div>
                                    <div class="text-xs text-slate-500">{{ service.price || service.prix }} DT</div>
                                </div>
                            </div>
                        }
                    </div>
                } @else {
                    <div class="text-center py-8">
                         <span class="material-icons text-slate-300 text-4xl mb-2">search_off</span>
                         <p class="text-sm text-slate-400">Aucun service trouvé.</p>
                    </div>
                }
              </div>
            </div>
          </div>

          <div class="flex justify-end gap-3 pt-6 border-t border-slate-100">
            <button type="button" (click)="cancel()" class="px-5 py-2.5 text-slate-600 hover:bg-slate-100 rounded-xl transition font-bold text-sm">Annuler</button>
            <button type="submit" [disabled]="form.invalid || isSubmitting()" class="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2.5 rounded-xl font-bold shadow-lg shadow-indigo-200 disabled:opacity-50 transition transform hover:-translate-y-0.5 flex items-center text-sm">
              @if(isSubmitting()) { <span class="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full mr-2"></span> }
              {{ isEditMode() ? 'Enregistrer les modifications' : 'Créer le Compte' }}
            </button>
          </div>
        </form>
      </div>
    </div>
  `
})
export class PartenaireFormComponent implements OnInit {
  private fb = inject(FormBuilder);
  private service = inject(PartenaireService);
  private serviceService = inject(ServiceService);
  private ui = inject(UiService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  @Input() isModal = false;
  @Output() finish = new EventEmitter<any>();

  isEditMode = signal(false);
  isSubmitting = signal(false);
  showPassword = signal(false);
  partenaireId: string | null = null;
  serviceSearch = signal('');

  availableServices = toSignal(this.serviceService.getAll(), { initialValue: [] as any[] });

  filteredServices = computed(() => {
    const term = this.serviceSearch().toLowerCase().trim();
    const services = this.availableServices();
    if (!term) return services;
    return services.filter(s => (s.nom || s.name || '').toLowerCase().includes(term));
  });

  form = this.fb.group({
    nom: ['', Validators.required],
    email: ['', [Validators.required, Validators.email]],
    password: [''], // Pas de validateur required au départ
    telephone: ['', Validators.required],
    role: ['SERVER', Validators.required],
    specialite: ['Salle'],
    active: [true],
    serviceIds: [[] as string[]]
  });

  ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id');
    if (id && !this.isModal) {
      // MODE ÉDITION
      this.isEditMode.set(true);
      this.partenaireId = id;
      
      // MDP optionnel en édition : on ne met PAS de Validators.required
      this.form.get('password')?.setValidators([Validators.minLength(6)]); 
      this.form.get('password')?.enable(); // On laisse activé pour pouvoir saisir
      this.form.get('email')?.disable(); // Email reste fixe
      
      this.loadPartenaire(id);
    } else {
      // MODE CRÉATION
      // MDP Obligatoire
      this.form.get('password')?.setValidators([Validators.required, Validators.minLength(6)]);
      this.form.get('password')?.enable();
      this.form.get('email')?.enable();
    }
    this.form.get('password')?.updateValueAndValidity();
  }

  loadPartenaire(id: string) {
    this.service.getById(id).subscribe(p => {
      if (p) {
        this.form.patchValue({
          nom: p.nom, 
          email: p.email, 
          telephone: p.telephone, 
          role: p.role, 
          specialite: p.specialite, 
          active: p.active,
          serviceIds: p.serviceIds || [] 
        });
      }
    });
  }

  toggleService(serviceId: string) {
    const currentIds = this.form.get('serviceIds')?.value || [];
    let newIds = [];
    if (currentIds.includes(serviceId)) {
        newIds = currentIds.filter((id: string) => id !== serviceId);
    } else {
        newIds = [...currentIds, serviceId];
    }
    this.form.patchValue({ serviceIds: newIds });
    this.form.markAsDirty();
  }

  isServiceSelected(serviceId: string): boolean {
    const currentIds = this.form.get('serviceIds')?.value || [];
    return currentIds.includes(serviceId);
  }

  async submit() {
    if (this.form.valid) {
      this.isSubmitting.set(true);
      try {
        const formData = this.form.getRawValue();
        const data = { ...formData };
        
        // Gestion du mot de passe
        const password = formData.password || undefined;
        // On supprime du payload Firestore (seul Firebase Auth gère le mdp)
        delete (data as any).password;

        let resultId = this.partenaireId;

        if (this.isEditMode() && this.partenaireId) {
          // Mise à jour : on passe aussi le password (si fourni)
          // Le service devra gérer la mise à jour Auth si implémenté, 
          // ou l'ignorer silencieusement si ce n'est pas supporté par le backend actuel.
          await this.service.update(this.partenaireId, data as any, password);
          this.ui.showToast('success', 'Partenaire modifié avec succès');
        } else {
          // Création
          const res: any = await this.service.add(data as any, password);
          if (res && res.id) resultId = res.id;
          this.ui.showToast('success', 'Compte créé avec succès');
        }

        if (this.isModal) {
          this.finish.emit({ id: resultId, ...data });
        } else {
          this.cancel();
        }
      } catch (e: any) {
        console.error(e);
        let msg = 'Erreur lors de l\'enregistrement';
        if (e.code === 'auth/email-already-in-use') msg = 'Cet email est déjà associé à un compte !';
        if (e.code === 'auth/weak-password') msg = 'Le mot de passe est trop faible.';
        this.ui.showToast('error', msg);
      } finally {
        this.isSubmitting.set(false);
      }
    }
  }

  cancel() { 
    if (this.isModal) {
      this.finish.emit(null);
    } else {
      this.router.navigate(['/admin/serveurs']);
    }
  }
}
