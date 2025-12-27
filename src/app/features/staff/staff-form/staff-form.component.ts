import { Component, inject, OnInit, signal, effect, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators, FormGroup, FormControl } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { StaffService } from '../../../core/services/staff.service';
import { ConfigService } from '../../../core/services/config.service';
import { UiService } from '../../../core/services/ui.service';

@Component({
  selector: 'app-staff-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  template: `
    <div [class]="isModal ? '' : 'min-h-screen bg-slate-50 flex items-center justify-center p-4'">
      <div [class]="isModal ? '' : 'bg-white rounded-xl shadow-xl w-full max-w-2xl overflow-hidden'">
        
        @if (!isModal) {
          <div class="bg-indigo-600 px-6 py-4 flex justify-between items-center">
            <h2 class="text-white font-bold text-lg flex items-center">
              <span class="material-icons mr-2">{{ isEditMode() ? 'edit' : 'badge' }}</span>
              {{ isEditMode() ? 'Modifier Membre' : 'Nouveau Membre' }}
            </h2>
            <button (click)="cancel()" class="text-white/80 hover:text-white transition">
              <span class="material-icons">close</span>
            </button>
          </div>
        }
        
        <form [formGroup]="form" (ngSubmit)="submit()" [class]="isModal ? 'space-y-6' : 'p-6 space-y-6'">
          
          <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div class="space-y-4">
              <h3 class="text-xs font-bold text-slate-400 uppercase tracking-wider border-b pb-1">Identité & Accès</h3>
              
              <div><label class="block text-sm font-medium text-slate-700 mb-1">Nom complet *</label><input formControlName="nom" type="text" class="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none transition"></div>
              
              <div>
                <label class="block text-sm font-medium text-slate-700 mb-1">Email (Login) *</label>
                <input formControlName="email" type="email" [readonly]="isEditMode()" class="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none transition disabled:bg-slate-100 disabled:text-slate-500">
              </div>

              @if (!isEditMode()) {
                <div>
                  <label class="block text-sm font-medium text-slate-700 mb-1">Mot de passe *</label>
                  <input formControlName="password" type="password" class="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none transition" placeholder="Min 6 caractères">
                  @if (form.get('password')?.invalid && form.get('password')?.touched) {
                    <p class="text-xs text-red-500 mt-1">Requis (6 car. min)</p>
                  }
                </div>
              }

              <div><label class="block text-sm font-medium text-slate-700 mb-1">Téléphone *</label><input formControlName="telephone" type="tel" class="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none transition"></div>

              <div class="grid grid-cols-2 gap-4">
                <div><label class="block text-sm font-medium text-slate-700 mb-1">Rôle</label><select formControlName="role" class="w-full px-4 py-2 border border-slate-300 rounded-lg bg-white"><option value="SERVER">Serveur</option><option value="ADMIN">Administrateur</option></select></div>
                <div><label class="block text-sm font-medium text-slate-700 mb-1">Spécialité</label><select formControlName="specialite" class="w-full px-4 py-2 border border-slate-300 rounded-lg bg-white"><option value="Salle">Salle</option><option value="Bar">Bar</option><option value="Cuisine">Cuisine</option><option value="Accueil">Accueil</option><option value="Sécurité">Sécurité</option></select></div>
              </div>
              
              <div class="flex items-center mt-2"><input formControlName="active" type="checkbox" id="active" class="w-4 h-4 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500"><label for="active" class="ml-2 block text-sm text-slate-700">Compte Actif</label></div>
            </div>

            <div class="space-y-4">
              <h3 class="text-xs font-bold text-slate-400 uppercase tracking-wider border-b pb-1">Grille de Rémunération</h3>
              <div class="bg-slate-50 rounded-lg p-4 border border-slate-200 max-h-96 overflow-y-auto space-y-3" formGroupName="rates">
                @for (slot of configService.settings().creneaux; track slot.id) {
                  <div class="flex items-center justify-between"><div class="flex-1 pr-2"><p class="text-sm font-bold text-slate-700">{{ slot.label }}</p><p class="text-[10px] text-slate-400">{{ slot.start }} - {{ slot.end }}</p></div><div class="w-28 relative"><input [formControlName]="slot.id" type="number" class="w-full px-3 py-1.5 border border-slate-300 rounded focus:ring-2 focus:ring-emerald-500 outline-none text-right font-mono text-sm" placeholder="0"><span class="absolute right-8 top-1.5 text-xs text-slate-400 pointer-events-none">TND</span></div></div>
                } @empty { <p class="text-center text-sm text-slate-400 py-4">Aucun créneau configuré.</p> }
              </div>
            </div>
          </div>

          <div class="flex justify-end gap-3 pt-4 border-t border-slate-100">
            <button type="button" (click)="cancel()" class="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg transition font-medium">Annuler</button>
            <button type="submit" [disabled]="form.invalid || isSubmitting()" class="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2 rounded-lg font-medium shadow-md disabled:opacity-50 transition transform hover:-translate-y-0.5 flex items-center">
              @if(isSubmitting()) { <span class="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full mr-2"></span> }
              {{ isEditMode() ? 'Enregistrer' : 'Créer le compte' }}
            </button>
          </div>
        </form>
      </div>
    </div>
  `
})
export class StaffFormComponent implements OnInit {
  private fb = inject(FormBuilder);
  private service = inject(StaffService);
  public configService = inject(ConfigService);
  private ui = inject(UiService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  @Input() isModal = false;
  @Output() finish = new EventEmitter<any>();

  isEditMode = signal(false);
  isSubmitting = signal(false);
  staffId: string | null = null;

  form = this.fb.group({
    nom: ['', Validators.required],
    email: ['', [Validators.required, Validators.email]],
    password: [''],
    telephone: ['', Validators.required],
    role: ['SERVER', Validators.required],
    specialite: ['Salle'],
    active: [true],
    rates: this.fb.group({})
  });

  constructor() {
    effect(() => {
      const slots = this.configService.settings().creneaux;
      const ratesGroup = this.form.get('rates') as FormGroup;
      slots.forEach(slot => { if (!ratesGroup.contains(slot.id)) { ratesGroup.addControl(slot.id, new FormControl(0)); } });
    });
  }

  ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id');
    if (id && !this.isModal) {
      this.isEditMode.set(true);
      this.staffId = id;
      this.form.get('password')?.clearValidators();
      this.form.get('email')?.disable();
      this.loadStaff(id);
    } else {
      this.form.get('password')?.setValidators([Validators.required, Validators.minLength(6)]);
    }
    this.form.get('password')?.updateValueAndValidity();
  }

  loadStaff(id: string) {
    this.service.getById(id).subscribe(staff => {
      if (staff) {
        this.form.patchValue({
          nom: staff.nom, email: staff.email, telephone: staff.telephone, role: staff.role, specialite: staff.specialite, active: staff.active
        });
        if (staff.rates) {
          const ratesGroup = this.form.get('rates') as FormGroup;
          Object.keys(staff.rates).forEach(slotId => { if (ratesGroup.contains(slotId)) { ratesGroup.get(slotId)?.setValue(staff.rates![slotId]); } });
        }
      }
    });
  }

  async submit() {
    if (this.form.valid) {
      this.isSubmitting.set(true);
      try {
        const formData = this.form.getRawValue();
        const staffData = { ...formData, rates: formData.rates || {} };
        const password = formData.password || undefined;
        delete (staffData as any).password;

        let resultId = this.staffId;

        if (this.isEditMode() && this.staffId) {
          await this.service.update(this.staffId, staffData as any);
          this.ui.showToast('success', 'Membre modifié avec succès');
        } else {
          // On capture le résultat pour récupérer l'ID en cas de création
          const res: any = await this.service.add(staffData as any, password);
          // Si le service renvoie une ref (avec .id), on l'utilise
          if (res && res.id) resultId = res.id;
          
          this.ui.showToast('success', 'Compte utilisateur créé avec succès');
        }

        if (this.isModal) {
          // En mode modal, on émet le résultat pour sélection auto
          this.finish.emit({ id: resultId, ...staffData });
        } else {
          this.cancel();
        }
      } catch (e: any) {
        console.error(e);
        let msg = 'Erreur lors de l\'enregistrement';
        if (e.code === 'auth/email-already-in-use') msg = 'Cet email est déjà utilisé !';
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
