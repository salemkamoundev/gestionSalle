#!/bin/bash

# ==============================================================================
# TITRE : Full CRUD Clients
# DESCRIPTION : Ajout de la fonctionnalité "Modifier" et amélioration "Supprimer"
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
# ÉTAPE 1 : MISE À JOUR DES ROUTES
# ==============================================================================
log_info "Ajout de la route d'édition client..."

cat <<'EOF' > src/app/app.routes.ts
import { Routes } from '@angular/router';
import { LoginComponent } from './features/auth/login/login.component';
import { MainLayoutComponent } from './layout/main-layout/main-layout.component';
import { DashboardComponent } from './features/dashboard/dashboard.component';
import { CalendarViewComponent } from './features/calendar/calendar-view/calendar-view.component';
import { ReservationFormComponent } from './features/calendar/reservation-form/reservation-form.component';
import { ClientListComponent } from './features/clients/client-list/client-list.component';
import { ClientFormComponent } from './features/clients/client-form/client-form.component';
import { StaffListComponent } from './features/staff/staff-list/staff-list.component';
import { StaffFormComponent } from './features/staff/staff-form/staff-form.component';
import { ConfigurationComponent } from './features/configuration/configuration.component';
import { authGuard } from './core/guards/auth.guard';
import { adminGuard } from './core/guards/admin.guard';

export const routes: Routes = [
  { path: 'login', component: LoginComponent },
  {
    path: '',
    component: MainLayoutComponent,
    canActivate: [authGuard],
    children: [
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
      { path: 'dashboard', component: DashboardComponent },
      
      // Calendrier
      { path: 'reservations', component: CalendarViewComponent },
      { path: 'reservations/new', component: ReservationFormComponent },
      { path: 'reservations/edit/:id', component: ReservationFormComponent },

      // Clients
      { path: 'admin/clients', component: ClientListComponent, canActivate: [adminGuard] },
      { path: 'admin/clients/new', component: ClientFormComponent, canActivate: [adminGuard] },
      { path: 'admin/clients/edit/:id', component: ClientFormComponent, canActivate: [adminGuard] }, // <--- Nouvelle route

      // Staff
      { path: 'admin/serveurs', component: StaffListComponent, canActivate: [adminGuard] },
      { path: 'admin/serveurs/new', component: StaffFormComponent, canActivate: [adminGuard] },

      { path: 'admin/config', component: ConfigurationComponent, canActivate: [adminGuard] },
    ]
  },
  { path: '**', redirectTo: '' }
];
EOF

# ==============================================================================
# ÉTAPE 2 : MISE À JOUR DE LA LISTE (Bouton Modifier)
# ==============================================================================
log_info "Ajout du bouton Modifier dans la liste des clients..."

cat <<'EOF' > src/app/features/clients/client-list/client-list.component.ts
import { Component, inject, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, Router } from '@angular/router';
import { ClientService } from '../../../core/services/client.service';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { Client } from '../../../core/models/client.model';

@Component({
  selector: 'app-client-list',
  standalone: true,
  imports: [CommonModule, RouterLink, FormsModule],
  template: `
    <div class="max-w-7xl mx-auto space-y-6">
      
      <div class="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 class="text-2xl font-bold text-slate-800 flex items-center">
            <span class="material-icons mr-3 text-slate-400">groups</span>
            Clients
          </h1>
          <p class="text-slate-500 mt-1">Base de données contacts ({{ filteredClients().length }})</p>
        </div>
        
        <div class="flex gap-3 w-full md:w-auto">
          <div class="relative flex-1 md:w-64">
            <span class="material-icons absolute left-3 top-2.5 text-slate-400 text-sm">search</span>
            <input 
              type="text" 
              [(ngModel)]="searchQuery" 
              placeholder="Rechercher..." 
              class="w-full pl-9 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm"
            >
          </div>
          <a routerLink="/admin/clients/new" class="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium shadow transition flex items-center whitespace-nowrap">
            <span class="material-icons text-sm mr-2">add</span> Nouveau
          </a>
        </div>
      </div>

      <div class="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div class="overflow-x-auto">
          <table class="w-full text-left">
            <thead class="bg-slate-50 border-b border-slate-200">
              <tr>
                <th class="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Identité</th>
                <th class="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Contact</th>
                <th class="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Adresse</th>
                <th class="px-6 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100">
              @for (client of filteredClients(); track client.id) {
                <tr class="hover:bg-slate-50 transition group">
                  <td class="px-6 py-4">
                    <div class="font-medium text-slate-900">{{ client.nom }}</div>
                    <div class="text-xs text-slate-400">Ajouté le {{ client.createdAt | date:'shortDate' }}</div>
                  </td>
                  <td class="px-6 py-4">
                    <div class="flex flex-col text-sm text-slate-600">
                      <span class="flex items-center"><span class="material-icons text-[14px] mr-1 text-slate-400">phone</span> {{ client.telephone }}</span>
                      @if(client.email) {
                        <span class="flex items-center mt-1"><span class="material-icons text-[14px] mr-1 text-slate-400">email</span> {{ client.email }}</span>
                      }
                    </div>
                  </td>
                  <td class="px-6 py-4 text-slate-600 text-sm max-w-xs truncate">
                    {{ client.adresse || '-' }}
                  </td>
                  <td class="px-6 py-4 text-right">
                    <div class="flex justify-end gap-2">
                      <button (click)="edit(client)" class="text-slate-400 hover:text-blue-600 p-2 rounded-full hover:bg-blue-50 transition" title="Modifier">
                        <span class="material-icons text-lg">edit</span>
                      </button>
                      
                      <button (click)="delete(client.id!)" class="text-slate-400 hover:text-red-600 p-2 rounded-full hover:bg-red-50 transition" title="Supprimer">
                        <span class="material-icons text-lg">delete</span>
                      </button>
                    </div>
                  </td>
                </tr>
              } @empty {
                <tr>
                  <td colspan="4" class="px-6 py-12 text-center">
                    <div class="flex flex-col items-center justify-center text-slate-400">
                      <span class="material-icons text-4xl mb-2">search_off</span>
                      <p>Aucun client trouvé.</p>
                    </div>
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `
})
export class ClientListComponent {
  private service = inject(ClientService);
  private router = inject(Router);
  
  rawClients = toSignal(this.service.getAll(), { initialValue: [] });
  searchQuery = signal('');

  filteredClients = computed(() => {
    const q = this.searchQuery().toLowerCase();
    return this.rawClients().filter(c => 
      c.nom.toLowerCase().includes(q) || 
      c.telephone.includes(q) ||
      (c.email && c.email.toLowerCase().includes(q))
    );
  });

  edit(client: Client) {
    this.router.navigate(['/admin/clients/edit', client.id]);
  }

  async delete(id: string) {
    if(confirm('Êtes-vous sûr de vouloir supprimer ce client ? Cette action est irréversible.')) {
      await this.service.delete(id);
    }
  }
}
EOF

# ==============================================================================
# ÉTAPE 3 : MISE À JOUR DU FORMULAIRE (Mode Édition)
# ==============================================================================
log_info "Adaptation du Formulaire Client (Mode Édition)..."

cat <<'EOF' > src/app/features/clients/client-form/client-form.component.ts
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
EOF

log_success "Gestion Clients mise à jour (Edit & Delete) !"
echo -e "${COLOR_INFO}👉 Actualise la page /admin/clients. Tu as maintenant les boutons d'édition.${COLOR_RESET}"