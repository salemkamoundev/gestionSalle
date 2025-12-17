import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { ClientService } from '../../../core/services/client.service';

@Component({
  selector: 'app-client-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  template: `
    <div class="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div class="bg-white rounded-xl shadow-xl w-full max-w-lg overflow-hidden">
        
        <div class="px-6 py-4 flex justify-between items-center transition-colors"
             [class.bg-blue-600]="!isEditMode()"
             [class.bg-purple-600]="isEditMode()">
          <h2 class="text-white font-bold text-lg flex items-center">
            <span class="material-icons mr-2">{{ isEditMode() ? 'edit' : 'person_add' }}</span>
            {{ isEditMode() ? 'Modifier le Client' : 'Nouveau Client' }}
          </h2>
          <button (click)="cancel()" class="text-white/80 hover:text-white transition">
            <span class="material-icons">close</span>
          </button>
        </div>
        
        <form [formGroup]="form" (ngSubmit)="submit()" class="p-6 space-y-5">
          
          <div>
            <label class="block text-sm font-medium text-slate-700 mb-1">Nom complet *</label>
            <input formControlName="nom" type="text" class="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition">
          </div>

          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-sm font-medium text-slate-700 mb-1">Téléphone *</label>
              <input formControlName="telephone" type="tel" class="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition">
            </div>
            <div>
              <label class="block text-sm font-medium text-slate-700 mb-1">Email</label>
              <input formControlName="email" type="email" class="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition">
            </div>
          </div>

          <div>
            <label class="block text-sm font-medium text-slate-700 mb-1">Adresse</label>
            <textarea formControlName="adresse" rows="3" class="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition resize-none"></textarea>
          </div>

          <div class="flex justify-end gap-3 pt-4 border-t border-slate-100">
            <button type="button" (click)="cancel()" class="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg transition font-medium">Annuler</button>
            <button type="submit" [disabled]="form.invalid" 
              class="text-white px-6 py-2 rounded-lg font-medium shadow-md disabled:opacity-50 transition transform hover:-translate-y-0.5"
              [class.bg-blue-600]="!isEditMode()"
              [class.hover:bg-blue-700]="!isEditMode()"
              [class.bg-purple-600]="isEditMode()"
              [class.hover:bg-purple-700]="isEditMode()">
              {{ isEditMode() ? 'Mettre à jour' : 'Enregistrer' }}
            </button>
          </div>
        </form>
      </div>
    </div>
  `
})
export class ClientFormComponent implements OnInit {
  private fb = inject(FormBuilder);
  private service = inject(ClientService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  isEditMode = signal(false);
  clientId: string | null = null;

  form = this.fb.group({
    nom: ['', Validators.required],
    telephone: ['', Validators.required],
    email: ['', Validators.email],
    adresse: [''],
    createdAt: [new Date().toISOString()]
  });

  ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.isEditMode.set(true);
      this.clientId = id;
      this.loadClient(id);
    }
  }

  loadClient(id: string) {
    this.service.getById(id).subscribe(client => {
      if (client) {
        this.form.patchValue({
          nom: client.nom,
          telephone: client.telephone,
          email: client.email,
          adresse: client.adresse
          // On ne touche pas à createdAt en edit
        });
      }
    });
  }

  async submit() {
    if (this.form.valid) {
      try {
        if (this.isEditMode() && this.clientId) {
          // UPDATE
          await this.service.update(this.clientId, this.form.value as any);
        } else {
          // CREATE
          await this.service.add(this.form.value as any);
        }
        this.cancel();
      } catch (e) {
        console.error(e);
        alert('Une erreur est survenue.');
      }
    }
  }

  cancel() {
    this.router.navigate(['/admin/clients']);
  }
}
