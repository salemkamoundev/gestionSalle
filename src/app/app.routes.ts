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

// --- NOUVEAUX IMPORTS POUR LES ÉQUIPES ---
import { TeamListComponent } from './features/teams/team-list/team-list.component';
import { TeamFormComponent } from './features/teams/team-form/team-form.component';

import { authGuard } from './core/guards/auth.guard';
import { adminGuard } from './core/guards/admin.guard';

export const routes: Routes = [
  { path: 'login', component: LoginComponent },
  
  // ROUTE POUR LE STAFF (HORS MAIN LAYOUT)
  { 
    path: 'my-planning', 
    component: StaffCalendarComponent, 
    canActivate: [authGuard] 
  },

  // ROUTE POUR L'ADMIN (DANS MAIN LAYOUT)
  {
    path: '',
    component: MainLayoutComponent,
    canActivate: [authGuard], 
    children: [
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
      
      // Protection Admin sur toutes les pages Admin
      { path: 'dashboard', component: DashboardComponent, canActivate: [adminGuard] },
      
      // Réservations
      { path: 'reservations', component: CalendarViewComponent, canActivate: [adminGuard] },
      { path: 'reservations/new', component: ReservationFormComponent, canActivate: [adminGuard] },
      { path: 'reservations/edit/:id', component: ReservationFormComponent, canActivate: [adminGuard] },
      
      // Clients
      { path: 'admin/clients', component: ClientListComponent, canActivate: [adminGuard] },
      { path: 'admin/clients/new', component: ClientFormComponent, canActivate: [adminGuard] },
      { path: 'admin/clients/edit/:id', component: ClientFormComponent, canActivate: [adminGuard] },
      
      // Staff (Serveurs internes)
      { path: 'admin/serveurs', component: StaffListComponent, canActivate: [adminGuard] },
      { path: 'admin/serveurs/new', component: StaffFormComponent, canActivate: [adminGuard] },
      { path: 'admin/serveurs/edit/:id', component: StaffFormComponent, canActivate: [adminGuard] },

      // --- NOUVELLES ROUTES ÉQUIPES (Groupes/Prestataires) ---
      { path: 'admin/teams', component: TeamListComponent, canActivate: [adminGuard] },      // Liste
      { path: 'admin/teams/new', component: TeamFormComponent, canActivate: [adminGuard] },  // Création
      { path: 'admin/teams/edit/:id', component: TeamFormComponent, canActivate: [adminGuard] }, // Édition

      // Config
      { path: 'admin/config', component: ConfigurationComponent, canActivate: [adminGuard] },
    ]
  },
  { path: '**', redirectTo: '' }
];