import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { TeamService } from '../../../core/services/team.service';
import { UiService } from '../../../core/services/ui.service';

@Component({
  selector: 'app-team-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  template: `
    <div class="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div class="bg-white rounded-xl shadow-xl w-full max-w-lg overflow-hidden">
        
        <div class="bg-purple-600 px-6 py-4 flex justify-between items-center">
          <h2 class="text-white font-bold text-lg flex items-center">
            <span class="material-icons mr-2">{{ isEditMode() ? 'edit' : 'add_business' }}</span>
            {{ isEditMode() ? 'Modifier Équipe' : 'Nouvelle Équipe' }}
          </h2>
          <button (click)="cancel()" class="text-white/80 hover:text-white transition">
            <span class="material-icons">close</span>
          </button>
        </div>
        
        <form [formGroup]="form" (ngSubmit)="submit()" class="p-6 space-y-6">
          
          <div>
            <label class="block text-sm font-medium text-slate-700 mb-1">Nom de l'équipe / Prestataire *</label>
            <input formControlName="nom" type="text" class="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none transition" placeholder="Ex: Troupe El Farah">
          </div>

          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-sm font-medium text-slate-700 mb-1">Type *</label>
              <select formControlName="type" class="w-full px-4 py-2 border border-slate-300 rounded-lg bg-white focus:ring-2 focus:ring-purple-500 outline-none">
                <option value="ORCHESTRE">Orchestre</option>
                <option value="PHOTOGRAPHE">Photographe</option>
                <option value="TRAITEUR">Traiteur</option>
                <option value="TROUPE">Troupe</option>
                <option value="AUTRE">Autre</option>
              </select>
            </div>
            <div>
               <label class="block text-sm font-medium text-slate-700 mb-1">Prix de référence (TND)</label>
               <input formControlName="prixReference" type="number" class="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none text-right">
            </div>
          </div>

          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-sm font-medium text-slate-700 mb-1">Chef / Contact</label>
              <input formControlName="chefEquipe" type="text" class="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none">
            </div>
            <div>
              <label class="block text-sm font-medium text-slate-700 mb-1">Téléphone *</label>
              <input formControlName="telephone" type="tel" class="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none">
            </div>
          </div>
          
          <div class="flex items-center">
            <input formControlName="active" type="checkbox" id="active" class="w-4 h-4 text-purple-600 rounded border-gray-300 focus:ring-purple-500">
            <label for="active" class="ml-2 block text-sm text-slate-700">Partenaire actif</label>
          </div>

          <div class="flex justify-end gap-3 pt-4 border-t border-slate-100">
            <button type="button" (click)="cancel()" class="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg transition font-medium">Annuler</button>
            <button type="submit" [disabled]="form.invalid" class="bg-purple-600 hover:bg-purple-700 text-white px-6 py-2 rounded-lg font-medium shadow-md disabled:opacity-50 transition">
              {{ isEditMode() ? 'Enregistrer' : 'Ajouter' }}
            </button>
          </div>
        </form>
      </div>
    </div>
  `
})
export class TeamFormComponent implements OnInit {
  private fb = inject(FormBuilder);
  private service = inject(TeamService);
  private ui = inject(UiService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  isEditMode = signal(false);
  teamId: string | null = null;

  form = this.fb.group({
    nom: ['', Validators.required],
    type: ['ORCHESTRE', Validators.required],
    chefEquipe: [''],
    telephone: ['', Validators.required],
    prixReference: [0],
    active: [true],
    createdAt: [new Date().toISOString()]
  });

  ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.isEditMode.set(true);
      this.teamId = id;
      this.service.getById(id).subscribe(t => {
        if(t) this.form.patchValue(t as any);
      });
    }
  }

  async submit() {
    if (this.form.valid) {
      try {
        if (this.isEditMode() && this.teamId) {
          await this.service.update(this.teamId, this.form.value as any);
          this.ui.showToast('success', 'Équipe modifiée');
        } else {
          await this.service.add(this.form.value as any);
          this.ui.showToast('success', 'Équipe ajoutée');
        }
        this.cancel();
      } catch (e) {
        this.ui.showToast('error', 'Erreur lors de la sauvegarde');
      }
    }
  }

  cancel() { this.router.navigate(['/admin/teams']); }
}
