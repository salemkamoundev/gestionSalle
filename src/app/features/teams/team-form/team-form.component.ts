import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators, FormGroup } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { TeamService } from '../../../core/services/team.service';
import { UiService } from '../../../core/services/ui.service';

@Component({
  selector: 'app-team-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  template: `
    <div class="min-h-screen bg-slate-50 flex items-center justify-center p-4 py-10">
      <div class="bg-white rounded-xl shadow-xl w-full max-w-4xl overflow-hidden">
        
        <div class="bg-purple-600 px-6 py-4 flex justify-between items-center sticky top-0 z-10">
          <h2 class="text-white font-bold text-lg flex items-center">
            <span class="material-icons mr-2">{{ isEditMode() ? 'edit' : 'add_business' }}</span>
            {{ isEditMode() ? 'Modifier Équipe' : "Nouvelle Équipe" }}
          </h2>
          <button (click)="cancel()" class="text-white/80 hover:text-white transition">
            <span class="material-icons">close</span>
          </button>
        </div>
        
        <form [formGroup]="form" (ngSubmit)="submit()" class="p-6 space-y-8">
          
          <div class="space-y-4">
            <h3 class="text-sm font-bold text-slate-400 uppercase tracking-wider border-b pb-2">Informations Générales</h3>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div class="md:col-span-2">
                <label class="block text-sm font-medium text-slate-700 mb-1">Nom de l'équipe / Prestataire *</label>
                <input formControlName="nom" type="text" class="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none transition" placeholder="Ex: Troupe El Farah">
              </div>
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
                <label class="block text-sm font-medium text-slate-700 mb-1">Téléphone *</label>
                <input formControlName="telephone" type="tel" class="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none">
              </div>
              <div>
                <label class="block text-sm font-medium text-slate-700 mb-1">Chef / Contact</label>
                <input formControlName="chefEquipe" type="text" class="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none">
              </div>
              <div class="flex items-center mt-6">
                <input formControlName="active" type="checkbox" id="active" class="w-4 h-4 text-purple-600 rounded border-gray-300 focus:ring-purple-500">
                <label for="active" class="ml-2 block text-sm text-slate-700">Partenaire actif</label>
              </div>
            </div>
          </div>

          <div class="flex justify-end gap-3 pt-6 border-t border-slate-100 sticky bottom-0 bg-white py-4 -mx-6 px-6 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
            <button type="button" (click)="cancel()" class="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg transition font-medium">Annuler</button>
            
            <button type="submit" [disabled]="form.invalid" class="bg-purple-600 hover:bg-purple-700 text-white px-6 py-2 rounded-lg font-medium shadow-md disabled:opacity-50 transition transform hover:-translate-y-0.5">
              {{ isEditMode() ? 'Enregistrer' : "Créer l'équipe" }}
            </button>
          </div>
        </form>
      </div>
    </div>
  `,
  styles: [`
    @keyframes fadeIn { from { opacity: 0; transform: translateY(-5px); } to { opacity: 1; transform: translateY(0); } }
    .animate-fade-in { animation: fadeIn 0.2s ease-out; }
  `]
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
    active: [true],
    createdAt: [new Date().toISOString()]
  });

  ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.isEditMode.set(true);
      this.teamId = id;
      this.service.getById(id).subscribe(t => {
        if(t) {
          this.form.patchValue({
            nom: t.nom,
            type: t.type,
            chefEquipe: t.chefEquipe,
            telephone: t.telephone,
            active: t.active
          });
        }
      });
    }
  }

  async submit() {
    if (this.form.valid) {
      try {
        const formData = this.form.value;
        if (this.isEditMode() && this.teamId) {
          await this.service.update(this.teamId, formData as any);
          this.ui.showToast('success', 'Équipe modifiée');
        } else {
          await this.service.add(formData as any);
          this.ui.showToast('success', 'Équipe ajoutée');
        }
        this.cancel();
      } catch (e) {
        this.ui.showToast('error', 'Erreur lors de la sauvegarde');
      }
    } else {
      this.ui.showToast('error', 'Formulaire invalide.');
    }
  }

  cancel() { this.router.navigate(['/admin/teams']); }
}
