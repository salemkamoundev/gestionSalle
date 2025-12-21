import { Component, inject, OnInit, signal, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { ClientService } from '../../../core/services/client.service';
import { UiService } from '../../../core/services/ui.service';

@Component({
  selector: 'app-client-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  template: `
    <div [class]="isModal ? 'w-full max-w-2xl' : 'min-h-screen bg-slate-50 flex items-center justify-center p-4'">
      <div class="bg-white rounded-xl shadow-xl w-full overflow-hidden" [class.max-w-2xl]="!isModal">
        
        <div class="px-6 py-4 flex justify-between items-center transition-colors"
             [class.bg-blue-600]="!isEditMode()"
             [class.bg-purple-600]="isEditMode()">
          <h2 class="text-white font-bold text-lg flex items-center">
            <span class="material-icons mr-2">{{ isEditMode() ? 'edit' : 'person_add' }}</span>
            {{ isEditMode() ? 'Modifier le Client' : 'Nouveau Client' }}
          </h2>
          <button type="button" (click)="cancel()" class="text-white/80 hover:text-white transition">
            <span class="material-icons">close</span>
          </button>
        </div>
        
        <form [formGroup]="form" (ngSubmit)="submit()" class="p-6 space-y-6">
          
          <div class="space-y-4">
            <h3 class="text-xs font-bold text-slate-400 uppercase tracking-wider border-b pb-1">Identité Civile</h3>
            
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label class="block text-sm font-medium text-slate-700 mb-1">Nom *</label>
                <input formControlName="nom" type="text" class="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition uppercase">
              </div>
              <div>
                <label class="block text-sm font-medium text-slate-700 mb-1">Prénom *</label>
                <input formControlName="prenom" type="text" class="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition capitalize">
              </div>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label class="block text-sm font-medium text-slate-700 mb-1">N° CIN</label>
                <input formControlName="cin" type="text" class="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition">
              </div>
              <div>
                <label class="block text-sm font-medium text-slate-700 mb-1">Date Délivrance CIN</label>
                <input formControlName="dateCin" type="date" class="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition">
              </div>
            </div>
          </div>

          <div class="space-y-4">
            <h3 class="text-xs font-bold text-slate-400 uppercase tracking-wider border-b pb-1">Couple / Mariés</h3>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label class="block text-sm font-medium text-slate-700 mb-1">Prénom Conjoint 1</label>
                <input formControlName="prenomMarie1" type="text" class="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition" placeholder="Ex: Marié">
              </div>
              <div>
                <label class="block text-sm font-medium text-slate-700 mb-1">Prénom Conjoint 2</label>
                <input formControlName="prenomMarie2" type="text" class="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition" placeholder="Ex: Mariée">
              </div>
            </div>
          </div>

          <div class="space-y-4">
            <h3 class="text-xs font-bold text-slate-400 uppercase tracking-wider border-b pb-1">Coordonnées</h3>
            
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
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
              <textarea formControlName="adresse" rows="2" class="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition resize-none"></textarea>
            </div>
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
  @Input() isModal = false; // Permet de savoir si on est dans une modale
  @Output() finish = new EventEmitter<any>(); // Émet le client créé ou null si annulé

  private fb = inject(FormBuilder);
  private service = inject(ClientService);
  private ui = inject(UiService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  isEditMode = signal(false);
  clientId: string | null = null;

  form = this.fb.group({
    nom: ['', Validators.required],
    prenom: ['', Validators.required],
    cin: [''],
    dateCin: [''],
    prenomMarie1: [''],
    prenomMarie2: [''],
    telephone: ['', Validators.required],
    email: ['', Validators.email],
    adresse: [''],
    createdAt: [new Date().toISOString()]
  });

  ngOnInit() {
    // Si on est en mode modale, on ne regarde pas l'URL
    if (this.isModal) return;

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
          prenom: client.prenom,
          cin: client.cin,
          dateCin: client.dateCin,
          prenomMarie1: client.prenomMarie1,
          prenomMarie2: client.prenomMarie2,
          telephone: client.telephone,
          email: client.email,
          adresse: client.adresse
        });
      }
    });
  }

  async submit() {
    if (this.form.valid) {
      try {
        let result = null;
        if (this.isEditMode() && this.clientId) {
          await this.service.update(this.clientId, this.form.value as any);
          this.ui.showToast('success', 'Client mis à jour');
          result = { id: this.clientId, ...this.form.value };
        } else {
          const docRef = await this.service.add(this.form.value as any);
          this.ui.showToast('success', 'Client créé avec succès');
          // On construit l'objet client complet pour le renvoyer
          result = { id: docRef.id, ...this.form.value };
        }

        if (this.isModal) {
          this.finish.emit(result); // On renvoie le client au parent
          this.form.reset(); // Reset pour la prochaine fois
        } else {
          this.cancel();
        }
      } catch (e) {
        console.error(e);
        this.ui.showToast('error', 'Une erreur est survenue');
      }
    }
  }

  cancel() {
    if (this.isModal) {
      this.finish.emit(null); // Annulation
    } else {
      this.router.navigate(['/admin/clients']);
    }
  }
}
