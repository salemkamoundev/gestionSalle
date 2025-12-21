import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { ServiceCatalogService } from '../../../core/services/service-catalog.service';
import { UiService } from '../../../core/services/ui.service';

@Component({
  selector: 'app-service-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  template: `
    <div class="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div class="bg-white rounded-xl shadow-xl w-full max-w-2xl overflow-hidden">
        <div class="bg-indigo-600 px-6 py-4 flex justify-between items-center">
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
              <input formControlName="nom" class="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="Ex: DJ & Animation">
              @if (form.get('nom')?.touched && form.get('nom')?.invalid) {
                <p class="text-xs text-red-600 mt-1">Nom requis</p>
              }
            </div>

            <div>
              <label class="block text-sm font-medium text-slate-700 mb-1">Prix défaut (TND)</label>
              <input type="number" formControlName="prix" class="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-right font-mono">
            </div>

            <div class="flex items-center gap-2 mt-6">
              <input id="active" type="checkbox" formControlName="active" class="h-4 w-4">
              <label for="active" class="text-sm font-medium text-slate-700">Actif</label>
            </div>

            <div class="md:col-span-2">
              <label class="block text-sm font-medium text-slate-700 mb-1">Description</label>
              <textarea formControlName="description" rows="3" class="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none resize-none" placeholder="Détails de la prestation..."></textarea>
            </div>
          </div>

          <div class="flex justify-end gap-3 pt-2">
            <button type="button" (click)="cancel()" class="px-5 py-2 rounded-lg border bg-white hover:bg-slate-50">Annuler</button>
            <button type="submit" [disabled]="form.invalid || isSubmitting()" class="px-6 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 shadow">
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
  private ui = inject(UiService);

  isEditMode = signal(false);
  isSubmitting = signal(false);
  private serviceId: string | null = null;

  form = this.fb.group({
    nom: ['', Validators.required],
    description: [''],
    prix: [0, [Validators.min(0)]],
    active: [true]
  });

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
          active: s.active !== false
        });
      });
    }
  }

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