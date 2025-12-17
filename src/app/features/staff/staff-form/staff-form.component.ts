import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { StaffService } from '../../../core/services/staff.service';

@Component({
  selector: 'app-staff-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  template: `
    <div class="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div class="bg-white rounded-xl shadow-xl w-full max-w-lg overflow-hidden">
        <div class="bg-emerald-600 px-6 py-4 flex justify-between items-center">
          <h2 class="text-white font-bold text-lg">Nouveau Membre</h2>
          <button (click)="cancel()" class="text-emerald-200 hover:text-white transition">
            <span class="material-icons">close</span>
          </button>
        </div>
        
        <form [formGroup]="form" (ngSubmit)="submit()" class="p-6 space-y-5">
          <div class="bg-amber-50 text-amber-800 text-sm p-3 rounded border border-amber-200">
            Note : Cela crée le profil. L'utilisateur devra s'inscrire ou être invité via Firebase Auth.
          </div>

          <div>
            <label class="block text-sm font-medium text-slate-700 mb-1">Nom complet *</label>
            <input formControlName="nom" type="text" class="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none">
          </div>

          <div>
            <label class="block text-sm font-medium text-slate-700 mb-1">Email (Identifiant) *</label>
            <input formControlName="email" type="email" class="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none">
          </div>

          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-sm font-medium text-slate-700 mb-1">Rôle</label>
              <select formControlName="role" class="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 bg-white">
                <option value="SERVER">Serveur</option>
                <option value="ADMIN">Admin</option>
              </select>
            </div>
            <div>
              <label class="block text-sm font-medium text-slate-700 mb-1">Spécialité</label>
              <select formControlName="specialite" class="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 bg-white">
                <option value="Salle">Salle</option>
                <option value="Bar">Bar</option>
                <option value="Cuisine">Cuisine</option>
              </select>
            </div>
          </div>

          <div class="flex justify-end gap-3 pt-2">
            <button type="button" (click)="cancel()" class="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg transition">Annuler</button>
            <button type="submit" [disabled]="form.invalid" class="bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-2 rounded-lg font-medium shadow-md disabled:opacity-50 transition">
              Créer le profil
            </button>
          </div>
        </form>
      </div>
    </div>
  `
})
export class StaffFormComponent {
  private fb = inject(FormBuilder);
  private service = inject(StaffService);
  private router = inject(Router);

  form = this.fb.group({
    nom: ['', Validators.required],
    email: ['', [Validators.required, Validators.email]],
    role: ['SERVER'],
    specialite: ['Salle'],
    active: [true]
  });

  async submit() {
    if (this.form.valid) {
      await this.service.add(this.form.value as any);
      this.cancel();
    }
  }

  cancel() {
    this.router.navigate(['/admin/serveurs']);
  }
}
