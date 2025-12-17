#!/bin/bash

# ==============================================================================
# TITRE : Staff Remuneration Configuration
# DESCRIPTION : Ajout de la grille tarifaire par créneau dans la fiche Staff
# ==============================================================================

set -euo pipefail

# Couleurs
COLOR_RESET='\033[0m'
COLOR_SUCCESS='\033[0;32m'
COLOR_INFO='\033[0;36m'

log_info() { echo -e "${COLOR_INFO}[INFO] $1${COLOR_RESET}"; }
log_success() { echo -e "${COLOR_SUCCESS}[OK] $1${COLOR_RESET}"; }

# Vérification racine
if [ ! -f "angular.json" ]; then
    echo "Erreur : Exécute ce script à la racine du projet."
    exit 1
fi

# ==============================================================================
# ÉTAPE 1 : MISE À JOUR DU MODÈLE STAFF
# ==============================================================================
log_info "Mise à jour du modèle Staff (Ajout rates)..."

cat <<'EOF' > src/app/core/models/staff.model.ts
export interface ServerStaff {
  id?: string;
  nom: string;
  email: string;
  telephone?: string;
  specialite?: string; // Ex: Serveur, Barman, Sécurité
  role?: 'ADMIN' | 'SERVER';
  active?: boolean;
  createdAt?: string;
  
  // NOUVEAU : Grille tarifaire
  // Clé = ID du créneau (ex: 'slot_123'), Valeur = Prix en TND (ex: 80)
  rates?: Record<string, number>;
}
EOF

# ==============================================================================
# ÉTAPE 2 : MISE À JOUR DU FORMULAIRE STAFF
# ==============================================================================
log_info "Mise à jour de StaffFormComponent (Grille Tarifs)..."

cat <<'EOF' > src/app/features/staff/staff-form/staff-form.component.ts
import { Component, inject, OnInit, signal, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators, FormGroup, FormControl } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { StaffService } from '../../../core/services/staff.service';
import { ConfigService } from '../../../core/services/config.service';

@Component({
  selector: 'app-staff-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  template: `
    <div class="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div class="bg-white rounded-xl shadow-xl w-full max-w-2xl overflow-hidden">
        
        <div class="bg-indigo-600 px-6 py-4 flex justify-between items-center">
          <h2 class="text-white font-bold text-lg flex items-center">
            <span class="material-icons mr-2">{{ isEditMode() ? 'edit' : 'badge' }}</span>
            {{ isEditMode() ? 'Modifier Membre' : 'Nouveau Membre' }}
          </h2>
          <button (click)="cancel()" class="text-white/80 hover:text-white transition">
            <span class="material-icons">close</span>
          </button>
        </div>
        
        <form [formGroup]="form" (ngSubmit)="submit()" class="p-6 space-y-6">
          
          <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div class="space-y-4">
              <h3 class="text-xs font-bold text-slate-400 uppercase tracking-wider border-b pb-1">Identité</h3>
              
              <div>
                <label class="block text-sm font-medium text-slate-700 mb-1">Nom complet *</label>
                <input formControlName="nom" type="text" class="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none transition">
              </div>

              <div>
                <label class="block text-sm font-medium text-slate-700 mb-1">Email (Identifiant) *</label>
                <input formControlName="email" type="email" class="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none transition">
              </div>

              <div>
                <label class="block text-sm font-medium text-slate-700 mb-1">Téléphone *</label>
                <input formControlName="telephone" type="tel" class="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none transition">
              </div>

              <div class="grid grid-cols-2 gap-4">
                <div>
                  <label class="block text-sm font-medium text-slate-700 mb-1">Rôle</label>
                  <select formControlName="role" class="w-full px-4 py-2 border border-slate-300 rounded-lg bg-white">
                    <option value="SERVER">Serveur</option>
                    <option value="ADMIN">Administrateur</option>
                  </select>
                </div>
                <div>
                  <label class="block text-sm font-medium text-slate-700 mb-1">Spécialité</label>
                  <select formControlName="specialite" class="w-full px-4 py-2 border border-slate-300 rounded-lg bg-white">
                    <option value="Salle">Salle</option>
                    <option value="Bar">Bar</option>
                    <option value="Cuisine">Cuisine</option>
                    <option value="Accueil">Accueil</option>
                    <option value="Sécurité">Sécurité</option>
                  </select>
                </div>
              </div>
              
              <div class="flex items-center mt-2">
                <input formControlName="active" type="checkbox" id="active" class="w-4 h-4 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500">
                <label for="active" class="ml-2 block text-sm text-slate-700">Compte Actif</label>
              </div>
            </div>

            <div class="space-y-4">
              <h3 class="text-xs font-bold text-slate-400 uppercase tracking-wider border-b pb-1">Grille de Rémunération</h3>
              <p class="text-[11px] text-slate-500 italic">Saisissez le montant perçu par ce membre pour chaque type de créneau.</p>
              
              <div class="bg-slate-50 rounded-lg p-4 border border-slate-200 max-h-80 overflow-y-auto space-y-3" formGroupName="rates">
                
                @for (slot of configService.settings().creneaux; track slot.id) {
                  <div class="flex items-center justify-between">
                    <div class="flex-1 pr-2">
                      <p class="text-sm font-bold text-slate-700">{{ slot.label }}</p>
                      <p class="text-[10px] text-slate-400">{{ slot.start }} - {{ slot.end }}</p>
                    </div>
                    <div class="w-28 relative">
                      <input [formControlName]="slot.id" type="number" class="w-full px-3 py-1.5 border border-slate-300 rounded focus:ring-2 focus:ring-emerald-500 outline-none text-right font-mono text-sm" placeholder="0">
                      <span class="absolute right-8 top-1.5 text-xs text-slate-400 pointer-events-none">TND</span>
                    </div>
                  </div>
                } @empty {
                  <p class="text-center text-sm text-slate-400 py-4">Aucun créneau configuré.</p>
                }

              </div>
            </div>
          </div>

          <div class="flex justify-end gap-3 pt-4 border-t border-slate-100">
            <button type="button" (click)="cancel()" class="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg transition font-medium">Annuler</button>
            <button type="submit" [disabled]="form.invalid" class="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2 rounded-lg font-medium shadow-md disabled:opacity-50 transition transform hover:-translate-y-0.5">
              {{ isEditMode() ? 'Enregistrer les modifications' : 'Créer le membre' }}
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
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  isEditMode = signal(false);
  staffId: string | null = null;

  form = this.fb.group({
    nom: ['', Validators.required],
    email: ['', [Validators.required, Validators.email]],
    telephone: ['', Validators.required],
    role: ['SERVER', Validators.required],
    specialite: ['Salle'],
    active: [true],
    rates: this.fb.group({}) // Conteneur dynamique pour les prix
  });

  constructor() {
    // Initialiser les contrôles de taux dynamiquement en fonction de la config
    effect(() => {
      const slots = this.configService.settings().creneaux;
      const ratesGroup = this.form.get('rates') as FormGroup;
      
      slots.forEach(slot => {
        if (!ratesGroup.contains(slot.id)) {
          ratesGroup.addControl(slot.id, new FormControl(0));
        }
      });
    });
  }

  ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.isEditMode.set(true);
      this.staffId = id;
      this.loadStaff(id);
    }
  }

  loadStaff(id: string) {
    this.service.getById(id).subscribe(staff => {
      if (staff) {
        this.form.patchValue({
          nom: staff.nom,
          email: staff.email,
          telephone: staff.telephone,
          role: staff.role,
          specialite: staff.specialite,
          active: staff.active
        });

        // Charger les tarifs existants
        if (staff.rates) {
          const ratesGroup = this.form.get('rates') as FormGroup;
          Object.keys(staff.rates).forEach(slotId => {
            if (ratesGroup.contains(slotId)) {
              ratesGroup.get(slotId)?.setValue(staff.rates![slotId]);
            }
          });
        }
      }
    });
  }

  async submit() {
    if (this.form.valid) {
      try {
        const formData = this.form.value;
        // On s'assure que rates est bien un objet
        const staffData = {
          ...formData,
          rates: formData.rates || {}
        };

        if (this.isEditMode() && this.staffId) {
          await this.service.update(this.staffId, staffData as any);
        } else {
          await this.service.add(staffData as any);
        }
        this.cancel();
      } catch (e) {
        console.error(e);
        alert('Erreur lors de l\'enregistrement');
      }
    }
  }

  cancel() {
    this.router.navigate(['/admin/serveurs']);
  }
}
EOF

log_success "Gestion des Rémunérations Staff activée !"
echo -e "${COLOR_INFO}👉 Va dans 'Admin > Équipe' et modifie un membre.${COLOR_RESET}"
echo -e "${COLOR_INFO}👉 Tu verras à droite la liste de tes créneaux (Matin, Soir, etc.) et tu pourras saisir le salaire pour chacun.${COLOR_RESET}"