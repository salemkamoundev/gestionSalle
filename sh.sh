#!/bin/bash

# 1. Création du dossier et du composant History
mkdir -p src/app/features/history

cat > src/app/features/history/history.component.ts <<EOF
import { Component, inject, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ReservationService } from '../../core/services/reservation.service';
import { toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-history',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  template: \`
    <div class="p-6 max-w-7xl mx-auto space-y-6">
      
      <div class="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 class="text-2xl font-bold text-slate-800 flex items-center">
            <span class="material-icons mr-3 text-slate-400">history_edu</span>
            Historique & Rapports
          </h1>
          <p class="text-slate-500 mt-1">Consultez l'historique des réservations et le chiffre d'affaires.</p>
        </div>
        
        <div class="flex gap-4">
          <div class="bg-white px-4 py-2 rounded-lg border border-slate-200 shadow-sm">
            <p class="text-[10px] uppercase text-slate-400 font-bold">Total Filtré</p>
            <p class="text-lg font-bold text-slate-800">{{ totalRevenue() | number:'1.0-2' }} <span class="text-xs font-normal">TND</span></p>
          </div>
          <div class="bg-emerald-50 px-4 py-2 rounded-lg border border-emerald-100 shadow-sm">
            <p class="text-[10px] uppercase text-emerald-600 font-bold">Avances Reçues</p>
            <p class="text-lg font-bold text-emerald-700">{{ totalAdvance() | number:'1.0-2' }} <span class="text-xs font-normal">TND</span></p>
          </div>
        </div>
      </div>

      <div class="bg-white p-4 rounded-xl shadow-sm border border-slate-200 grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
        
        <div class="md:col-span-1">
          <label class="block text-xs font-bold text-slate-500 mb-1">Recherche Client</label>
          <div class="relative">
            <span class="material-icons absolute left-3 top-2 text-slate-400 text-sm">search</span>
            <input type="text" [(ngModel)]="searchQuery" placeholder="Nom, Prénom..." class="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm">
          </div>
        </div>

        <div>
          <label class="block text-xs font-bold text-slate-500 mb-1">Du</label>
          <input type="date" [(ngModel)]="startDate" class="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm">
        </div>

        <div>
          <label class="block text-xs font-bold text-slate-500 mb-1">Au</label>
          <input type="date" [(ngModel)]="endDate" class="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm">
        </div>

        <div>
          <label class="block text-xs font-bold text-slate-500 mb-1">Statut</label>
          <select [(ngModel)]="statusFilter" class="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm bg-white">
            <option value="ALL">Tous les statuts</option>
            <option value="CONFIRMED">✅ Confirmés</option>
            <option value="PENDING">⏳ En attente</option>
            <option value="CANCELLED">🚫 Annulés</option>
          </select>
        </div>
      </div>

      <div class="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div class="overflow-x-auto">
          <table class="w-full text-left">
            <thead class="bg-slate-50 border-b border-slate-200">
              <tr>
                <th class="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Date / Heure</th>
                <th class="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Client</th>
                <th class="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Statut</th>
                <th class="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider text-right">Prix Total</th>
                <th class="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider text-right">Avance</th>
                <th class="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider text-right">Reste</th>
                <th class="px-6 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">Action</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100">
              @for (res of filteredReservations(); track res.id) {
                <tr class="hover:bg-slate-50 transition group">
                  <td class="px-6 py-4">
                    <div class="font-bold text-slate-800">{{ res.date | date:'dd MMM yyyy' }}</div>
                    <div class="text-xs text-slate-500">{{ res.startTime }} - {{ res.endTime }}</div>
                  </td>
                  <td class="px-6 py-4">
                    <div class="font-medium text-slate-900">{{ res.clientName }}</div>
                  </td>
                  <td class="px-6 py-4">
                    <span class="px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide border"
                      [class.bg-emerald-50]="res.status === 'CONFIRMED'" [class.text-emerald-700]="res.status === 'CONFIRMED'" [class.border-emerald-100]="res.status === 'CONFIRMED'"
                      [class.bg-amber-50]="res.status === 'PENDING'" [class.text-amber-700]="res.status === 'PENDING'" [class.border-amber-100]="res.status === 'PENDING'"
                      [class.bg-red-50]="res.status === 'CANCELLED'" [class.text-red-700]="res.status === 'CANCELLED'" [class.border-red-100]="res.status === 'CANCELLED'">
                      {{ res.status === 'CONFIRMED' ? 'Confirmé' : (res.status === 'PENDING' ? 'En Attente' : 'Annulé') }}
                    </span>
                  </td>
                  <td class="px-6 py-4 text-right font-mono text-sm text-slate-600">
                    {{ res.totalPrice | number }} DT
                  </td>
                  <td class="px-6 py-4 text-right font-mono text-sm text-emerald-600 font-bold">
                    {{ res.advance | number }} DT
                  </td>
                  <td class="px-6 py-4 text-right font-mono text-sm text-red-500">
                    {{ (res.totalPrice || 0) - (res.advance || 0) | number }} DT
                  </td>
                  <td class="px-6 py-4 text-right">
                    <a [routerLink]="['/reservations/edit', res.id]" class="text-blue-600 hover:bg-blue-50 p-2 rounded-full transition inline-block">
                      <span class="material-icons text-lg">visibility</span>
                    </a>
                  </td>
                </tr>
              } @empty {
                <tr>
                  <td colspan="7" class="px-6 py-12 text-center text-slate-400">
                    <span class="material-icons text-4xl mb-2">filter_list_off</span>
                    <p>Aucune réservation trouvée pour ces critères.</p>
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      </div>
    </div>
  \`
})
export class HistoryComponent {
  private service = inject(ReservationService);
  
  // Données brutes
  rawReservations = toSignal(this.service.getAll(), { initialValue: [] });
  
  // Filtres (Signals)
  searchQuery = signal('');
  startDate = signal('');
  endDate = signal('');
  statusFilter = signal('ALL');

  // Logique de filtrage
  filteredReservations = computed(() => {
    let data = this.rawReservations();
    const query = this.searchQuery().toLowerCase();
    const start = this.startDate();
    const end = this.endDate();
    const status = this.statusFilter();

    // Tri par date décroissante (le plus récent en haut)
    data = [...data].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    return data.filter(r => {
      // Filtre Recherche Texte
      const matchesSearch = r.clientName?.toLowerCase().includes(query);
      
      // Filtre Statut
      const matchesStatus = status === 'ALL' ? true : r.status === status;
      
      // Filtre Date
      let matchesDate = true;
      if (start) matchesDate = matchesDate && r.date >= start;
      if (end) matchesDate = matchesDate && r.date <= end;

      return matchesSearch && matchesStatus && matchesDate;
    });
  });

  // Calcul des totaux sur les données FILTRÉES
  totalRevenue = computed(() => this.filteredReservations().reduce((sum, r) => sum + (Number(r.totalPrice) || 0), 0));
  totalAdvance = computed(() => this.filteredReservations().reduce((sum, r) => sum + (Number(r.advance) || 0), 0));
}
EOF

# 2. Mise à jour des Routes (Incluant History + Teams + Mock)
cat > src/app/app.routes.ts <<EOF
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
import { StaffCalendarComponent } from './features/staff-view/staff-calendar.component';
import { TeamListComponent } from './features/teams/team-list/team-list.component';
import { TeamFormComponent } from './features/teams/team-form/team-form.component';
import { HistoryComponent } from './features/history/history.component'; // <--- NEW IMPORT

import { authGuard } from './core/guards/auth.guard';
import { adminGuard } from './core/guards/admin.guard';

export const routes: Routes = [
  { path: 'login', component: LoginComponent },
  
  { path: 'my-planning', component: StaffCalendarComponent, canActivate: [authGuard] },

  {
    path: '',
    component: MainLayoutComponent,
    canActivate: [authGuard], 
    children: [
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
      
      { path: 'dashboard', component: DashboardComponent, canActivate: [adminGuard] },
      
      { path: 'reservations', component: CalendarViewComponent, canActivate: [adminGuard] },
      { path: 'reservations/new', component: ReservationFormComponent, canActivate: [adminGuard] },
      { path: 'reservations/edit/:id', component: ReservationFormComponent, canActivate: [adminGuard] },
      
      { path: 'history', component: HistoryComponent, canActivate: [adminGuard] }, // <--- NEW ROUTE
      
      { path: 'admin/clients', component: ClientListComponent, canActivate: [adminGuard] },
      { path: 'admin/clients/new', component: ClientFormComponent, canActivate: [adminGuard] },
      { path: 'admin/clients/edit/:id', component: ClientFormComponent, canActivate: [adminGuard] },
      
      { path: 'admin/serveurs', component: StaffListComponent, canActivate: [adminGuard] },
      { path: 'admin/serveurs/new', component: StaffFormComponent, canActivate: [adminGuard] },
      { path: 'admin/serveurs/edit/:id', component: StaffFormComponent, canActivate: [adminGuard] },

      { path: 'admin/teams', component: TeamListComponent, canActivate: [adminGuard] },
      { path: 'admin/teams/new', component: TeamFormComponent, canActivate: [adminGuard] },
      { path: 'admin/teams/edit/:id', component: TeamFormComponent, canActivate: [adminGuard] },

      { path: 'admin/config', component: ConfigurationComponent, canActivate: [adminGuard] },
    ]
  },
  { path: '**', redirectTo: '' }
];
EOF

# 3. Mise à jour du Menu Latéral
TARGET_LAYOUT="src/app/layout/main-layout/main-layout.component.ts"
cat > $TARGET_LAYOUT <<EOF
import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet, RouterLink, RouterLinkActive, Router, NavigationEnd } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { MockDataService } from '../../core/services/mock-data.service';
import { filter } from 'rxjs';
import { UiContainerComponent } from '../../shared/components/ui-container.component';

@Component({
  selector: 'app-main-layout',
  standalone: true,
  imports: [CommonModule, RouterOutlet, RouterLink, RouterLinkActive, UiContainerComponent],
  template: \`
    <div class="flex h-screen bg-slate-50 overflow-hidden relative">
      
      <app-ui-container></app-ui-container>

      <div *ngIf="isMobileMenuOpen()" class="fixed inset-0 bg-slate-900/50 z-40 md:hidden backdrop-blur-sm transition-opacity" (click)="closeMobileMenu()"></div>

      <aside class="fixed inset-y-0 left-0 z-50 w-72 bg-slate-900 text-white flex flex-col shadow-2xl transition-transform duration-300 ease-in-out md:relative md:translate-x-0"
             [class.-translate-x-full]="!isMobileMenuOpen()" [class.translate-x-0]="isMobileMenuOpen()">
        
        <div class="p-6 border-b border-slate-800 flex flex-col items-center text-center relative">
          <button (click)="closeMobileMenu()" class="absolute top-4 right-4 text-slate-400 hover:text-white md:hidden"><span class="material-icons">close</span></button>
          <div class="w-12 h-12 rounded-full bg-gradient-to-tr from-pink-500 to-purple-600 flex items-center justify-center shadow-lg mb-3 mt-2 md:mt-0">
            <span class="material-icons text-white">apartment</span>
          </div>
          <h1 class="text-xl font-bold tracking-wider text-white">LA PRINCESSE</h1>
        </div>

        <div class="px-6 py-4 bg-slate-800/50 border-b border-slate-800 flex items-center gap-3">
          <div class="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center font-bold shrink-0">
            {{ (authService.userState()?.email?.charAt(0) || 'A') | uppercase }}
          </div>
          <div class="overflow-hidden">
            <p class="text-sm font-medium truncate w-40">{{ authService.userState()?.email }}</p>
            <span class="text-[10px] bg-green-600 px-1.5 py-0.5 rounded text-white font-bold tracking-wide">
              {{ authService.userState()?.role || 'INVITÉ' }}
            </span>
          </div>
        </div>

        <nav class="flex-1 px-4 py-6 space-y-2 overflow-y-auto custom-scrollbar">
          
          <p class="px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Général</p>
          
          <a routerLink="/dashboard" routerLinkActive="bg-purple-600 text-white shadow-lg" [routerLinkActiveOptions]="{exact: true}" class="flex items-center px-4 py-3 rounded-lg text-slate-300 hover:bg-slate-800 hover:text-white transition cursor-pointer">
            <span class="material-icons mr-3">dashboard</span> Tableau de bord
          </a>
          
          <a routerLink="/reservations" routerLinkActive="bg-purple-600 text-white shadow-lg" class="flex items-center px-4 py-3 rounded-lg text-slate-300 hover:bg-slate-800 hover:text-white transition cursor-pointer">
            <span class="material-icons mr-3">calendar_month</span> Planning
          </a>

          <a routerLink="/history" routerLinkActive="bg-purple-600 text-white shadow-lg" class="flex items-center px-4 py-3 rounded-lg text-slate-300 hover:bg-slate-800 hover:text-white transition cursor-pointer">
            <span class="material-icons mr-3">history_edu</span> Historique
          </a>

          <p class="mt-8 mb-2 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Administration</p>
          
          <a routerLink="/admin/clients" routerLinkActive="bg-purple-600 text-white shadow-lg" class="flex items-center px-4 py-3 rounded-lg text-slate-300 hover:bg-slate-800 hover:text-white transition cursor-pointer">
            <span class="material-icons mr-3">groups</span> Clients
          </a>
          
          <a routerLink="/admin/serveurs" routerLinkActive="bg-purple-600 text-white shadow-lg" class="flex items-center px-4 py-3 rounded-lg text-slate-300 hover:bg-slate-800 hover:text-white transition cursor-pointer">
            <span class="material-icons mr-3">badge</span> Staff
          </a>

          <a routerLink="/admin/teams" routerLinkActive="bg-purple-600 text-white shadow-lg" class="flex items-center px-4 py-3 rounded-lg text-slate-300 hover:bg-slate-800 hover:text-white transition cursor-pointer">
            <span class="material-icons mr-3">handshake</span> Équipes
          </a>
          
          <a routerLink="/admin/config" routerLinkActive="bg-purple-600 text-white shadow-lg" class="flex items-center px-4 py-3 rounded-lg text-slate-300 hover:bg-slate-800 hover:text-white transition cursor-pointer">
            <span class="material-icons mr-3">settings</span> Configuration
          </a>

        </nav>

        <div class="p-4 border-t border-slate-800 space-y-3">
          <button (click)="mockService.resetAndSeed()" class="w-full flex items-center justify-center px-4 py-2 bg-orange-500/10 hover:bg-orange-600 border border-orange-500/50 text-orange-400 hover:text-white rounded-lg transition cursor-pointer text-xs font-bold uppercase tracking-wide">
            <span class="material-icons text-sm mr-2">science</span> Générer Données
          </button>
          <button (click)="authService.logout()" class="w-full flex items-center justify-center px-4 py-3 bg-slate-800 hover:bg-red-600 text-slate-300 hover:text-white rounded-lg transition cursor-pointer">
            <span class="material-icons text-sm mr-2">logout</span> Déconnexion
          </button>
        </div>
      </aside>

      <div class="flex-1 flex flex-col h-full overflow-hidden w-full">
        <header class="bg-white border-b border-slate-200 p-4 flex items-center justify-between md:hidden shadow-sm z-30 shrink-0">
          <div class="flex items-center">
            <button (click)="openMobileMenu()" class="p-2 -ml-2 mr-2 text-slate-600 hover:bg-slate-100 rounded-lg">
              <span class="material-icons text-2xl">menu</span>
            </button>
            <span class="font-bold text-slate-800 text-lg">La Princesse</span>
          </div>
          <div class="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center text-white font-bold text-xs">
            {{ (authService.userState()?.email?.charAt(0) || 'A') | uppercase }}
          </div>
        </header>
        <main class="flex-1 overflow-auto bg-slate-50 p-4 md:p-8 w-full">
          <router-outlet></router-outlet>
        </main>
      </div>
    </div>
  \`
})
export class MainLayoutComponent {
  authService = inject(AuthService);
  mockService = inject(MockDataService);
  private router = inject(Router);
  isMobileMenuOpen = signal(false);

  constructor() {
    this.router.events.pipe(filter(event => event instanceof NavigationEnd)).subscribe(() => {
      this.closeMobileMenu();
    });
  }

  openMobileMenu() { this.isMobileMenuOpen.set(true); }
  closeMobileMenu() { this.isMobileMenuOpen.set(false); }
}
EOF

echo "Page Historique ajoutée et configurée avec succès !"