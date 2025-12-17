import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { ClientService } from '../../../core/services/client.service';

@Component({
  selector: 'app-client-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  template: `
    <div class="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div class="bg-white rounded-xl shadow-xl w-full max-w-lg overflow-hidden">
        <div class="bg-blue-600 px-6 py-4 flex justify-between items-center">
          <h2 class="text-white font-bold text-lg">Nouveau Client</h2>
          <button (click)="cancel()" class="text-blue-200 hover:text-white transition">
            <span class="material-icons">close</span>
          </button>
        </div>
        
        <form [formGroup]="form" (ngSubmit)="submit()" class="p-6 space-y-5">
          <div>
            <label class="block text-sm font-medium text-slate-700 mb-1">Nom complet *</label>
            <input formControlName="nom" type="text" class="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none">
          </div>

          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-sm font-medium text-slate-700 mb-1">Téléphone *</label>
              <input formControlName="telephone" type="tel" class="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none">
            </div>
            <div>
              <label class="block text-sm font-medium text-slate-700 mb-1">Email</label>
              <input formControlName="email" type="email" class="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none">
            </div>
          </div>

          <div>
            <label class="block text-sm font-medium text-slate-700 mb-1">Adresse</label>
            <textarea formControlName="adresse" rows="3" class="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"></textarea>
          </div>

          <div class="flex justify-end gap-3 pt-2">
            <button type="button" (click)="cancel()" class="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg transition">Annuler</button>
            <button type="submit" [disabled]="form.invalid" class="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-medium shadow-md disabled:opacity-50 transition">
              Enregistrer
            </button>
          </div>
        </form>
      </div>
    </div>
  `
})
export class ClientFormComponent {
  private fb = inject(FormBuilder);
  private service = inject(ClientService);
  private router = inject(Router);

  form = this.fb.group({
    nom: ['', Validators.required],
    telephone: ['', Validators.required],
    email: ['', Validators.email],
    adresse: [''],
    createdAt: [new Date().toISOString()]
  });

  async submit() {
    if (this.form.valid) {
      await this.service.add(this.form.value as any);
      this.cancel();
    }
  }

  cancel() {
    this.router.navigate(['/admin/clients']);
  }
}
