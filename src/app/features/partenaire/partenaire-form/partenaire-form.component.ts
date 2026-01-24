import { Component, inject, OnInit, signal, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';

import { PartenaireService } from '../../../core/services/partenaire.service';
import { UiService } from '../../../core/services/ui.service';

@Component({
  selector: 'app-partenaire-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  template: `
    <div [class]="isModal ? '' : 'min-h-screen bg-slate-50 flex items-center justify-center p-4'">
      <div [class]="isModal ? '' : 'bg-white rounded-xl shadow-xl w-full max-w-2xl overflow-hidden'">
        
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
        
        <form [formGroup]="form" (ngSubmit)="submit()" [class]="isModal ? 'space-y-6' : 'p-8 space-y-6'">
          
          <div class="space-y-6">
            <h3 class="text-xs font-bold text-slate-400 uppercase tracking-wider border-b pb-2 flex items-center gap-2">
                <span class="material-icons text-sm">person</span> Identité & Accès
            </h3>
            
            <div>
                <label class="block text-xs font-bold text-slate-500 mb-1 uppercase">Nom complet *</label>
                <input formControlName="nom" type="text" class="w-full px-4 py-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none transition font-semibold text-slate-700">
            </div>
            
            <div>
                <label class="block text-xs font-bold text-slate-500 mb-1 uppercase">Email (Login) *</label>
                <input formControlName="email" type="email" [readonly]="isEditMode()" class="w-full px-4 py-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none transition disabled:bg-slate-50 disabled:text-slate-400">
            </div>

            <div>
                <label class="block text-xs font-bold text-slate-500 mb-1 uppercase">
                    {{ isEditMode() ? 'Nouveau Mot de passe (Optionnel)' : 'Mot de passe *' }}
                </label>
                <div class="relative">
                    <input 
                      [type]="showPassword() ? 'text' : 'password'" 
                      formControlName="password" 
                      class="w-full px-4 py-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none transition pr-10" 
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
                <input formControlName="telephone" type="tel" class="w-full px-4 py-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none transition">
            </div>

            <div class="grid grid-cols-2 gap-4">
                <div>
                    <label class="block text-xs font-bold text-slate-500 mb-1 uppercase">Rôle</label>
                    <select formControlName="role" class="w-full px-4 py-3 border border-slate-200 rounded-lg bg-white outline-none focus:ring-2 focus:ring-indigo-500">
                        <option value="SERVER">Partenaire</option>
                        <option value="ADMIN">Administrateur</option>
                    </select>
                </div>
                <div>
                    <label class="block text-xs font-bold text-slate-500 mb-1 uppercase">Spécialité</label>
                    <select formControlName="specialite" class="w-full px-4 py-3 border border-slate-200 rounded-lg bg-white outline-none focus:ring-2 focus:ring-indigo-500">
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

          <div class="flex justify-end gap-3 pt-6 border-t border-slate-100">
            <button type="button" (click)="cancel()" class="px-6 py-2.5 text-slate-600 hover:bg-slate-100 rounded-xl transition font-bold text-sm">Annuler</button>
            <button type="submit" [disabled]="form.invalid || isSubmitting()" class="bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-2.5 rounded-xl font-bold shadow-lg shadow-indigo-200 disabled:opacity-50 transition transform hover:-translate-y-0.5 flex items-center text-sm">
              @if(isSubmitting()) { <span class="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full mr-2"></span> }
              {{ isEditMode() ? 'Enregistrer' : 'Créer le Compte' }}
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
  private ui = inject(UiService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  @Input() isModal = false;
  @Output() finish = new EventEmitter<any>();

  isEditMode = signal(false);
  isSubmitting = signal(false);
  showPassword = signal(false);
  partenaireId: string | null = null;

  form = this.fb.group({
    nom: ['', Validators.required],
    email: ['', [Validators.required, Validators.email]],
    password: [''],
    telephone: ['', Validators.required],
    role: ['SERVER', Validators.required],
    specialite: ['Salle'],
    active: [true]
  });

  ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id');
    if (id && !this.isModal) {
      this.isEditMode.set(true);
      this.partenaireId = id;
      this.form.get('password')?.setValidators([Validators.minLength(6)]); 
      this.form.get('password')?.enable();
      this.form.get('email')?.disable();
      this.loadPartenaire(id);
    } else {
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
          active: p.active
        });
      }
    });
  }

  async submit() {
    if (this.form.valid) {
      this.isSubmitting.set(true);
      try {
        const formData = this.form.getRawValue();
        const data = { ...formData };
        const password = formData.password || undefined;
        delete (data as any).password;

        let resultId = this.partenaireId;

        if (this.isEditMode() && this.partenaireId) {
          await this.service.update(this.partenaireId, data as any, password);
          this.ui.showToast('success', 'Partenaire modifié avec succès');
        } else {
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
