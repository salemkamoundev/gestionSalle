import { Routes } from '@angular/router';
import { LoginComponent } from './features/auth/login/login.component';
import { MainLayoutComponent } from './layout/main-layout/main-layout.component';
import { DashboardComponent } from './features/dashboard/dashboard.component';
import { CalendarViewComponent } from './features/calendar/calendar-view/calendar-view.component';
import { ReservationFormComponent } from './features/calendar/reservation-form/reservation-form.component';
import { ClientListComponent } from './features/clients/client-list/client-list.component';
import { ClientFormComponent } from './features/clients/client-form/client-form.component';
import { ClientHistoryComponent } from './features/clients/client-history/client-history.component';
import { StaffListComponent } from './features/staff/staff-list/staff-list.component';
import { StaffFormComponent } from './features/staff/staff-form/staff-form.component';
import { StaffCalendarComponent } from './features/staff-view/staff-calendar.component';
import { StaffNotificationsComponent } from './features/staff-view/staff-notifications/staff-notifications.component';
import { TeamListComponent } from './features/teams/team-list/team-list.component';
import { TeamFormComponent } from './features/teams/team-form/team-form.component';
import { HistoryComponent } from './features/history/history.component';
import { PaymentListComponent } from './features/payments/payment-list/payment-list.component';
import { PaymentReservationDetailComponent } from './features/payments/payment-reservation-detail/payment-reservation-detail.component';
import { NotificationHistoryComponent } from './features/notifications/notification-history/notification-history.component';
import { ConfigurationComponent } from './features/configuration/configuration.component';
import { PackListComponent } from './features/packs/pack-list/pack-list.component';
import { PackFormComponent } from './features/packs/pack-form/pack-form.component';
import { ServiceListComponent } from './features/services/service-list/service-list.component';
import { ServiceFormComponent } from './features/services/service-form/service-form.component';
import { ExpenseManagerComponent } from './features/finances/expense-manager/expense-manager.component';
import { ChatComponent } from './features/admin/chat/chat.component';

import { authGuard } from './core/guards/auth.guard';
import { adminGuard } from './core/guards/admin.guard';

export const routes: Routes = [
  { path: 'login', component: LoginComponent },
  
  // ROUTES STAFF
  { path: 'my-planning', component: StaffCalendarComponent, canActivate: [authGuard] },
  { path: 'my-notifications', component: StaffNotificationsComponent, canActivate: [authGuard] },
  { path: 'my-chat', component: ChatComponent, canActivate: [authGuard] }, // <--- Route Chat pour le Staff

  { path: 'finances/expenses', loadComponent: () => import('./features/finances/expense-manager/expense-manager.component').then(m => m.ExpenseManagerComponent) },
  { path: 'admin/payments/reservation/:reservationId', component: PaymentReservationDetailComponent },
  
  {
    path: '',
    component: MainLayoutComponent,
    canActivate: [authGuard], 
    children: [
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
      
      { path: 'admin/notifications', component: NotificationHistoryComponent, title: 'Vos Notifications' },

      { path: 'dashboard', component: DashboardComponent, canActivate: [adminGuard] },
      
      { path: 'reservations', component: CalendarViewComponent, canActivate: [adminGuard] },
      { path: 'reservations/new', component: ReservationFormComponent, canActivate: [adminGuard] },
      { path: 'reservations/edit/:id', component: ReservationFormComponent, canActivate: [adminGuard] },
      
      { path: 'history', component: HistoryComponent, canActivate: [adminGuard] },
      
      { path: 'admin/clients', component: ClientListComponent, canActivate: [adminGuard] },
      { path: 'admin/clients/new', component: ClientFormComponent, canActivate: [adminGuard] },
      { path: 'admin/clients/history/:id', component: ClientHistoryComponent, title: 'Dossier Client' },
      { path: 'admin/clients/edit/:id', component: ClientFormComponent, canActivate: [adminGuard] },
      
      { path: 'admin/serveurs', component: StaffListComponent, canActivate: [adminGuard] },
      { path: 'admin/serveurs/new', component: StaffFormComponent, canActivate: [adminGuard] },
      { path: 'admin/serveurs/edit/:id', component: StaffFormComponent, canActivate: [adminGuard] },

      { path: 'admin/teams', component: TeamListComponent, canActivate: [adminGuard] },
      { path: 'admin/teams/new', component: TeamFormComponent, canActivate: [adminGuard] },
      { path: 'admin/teams/edit/:id', component: TeamFormComponent, canActivate: [adminGuard] },
      { path: 'admin/services', component: ServiceListComponent, canActivate: [adminGuard] },
      { path: 'admin/services/new', component: ServiceFormComponent, canActivate: [adminGuard] },
      { path: 'admin/services/edit/:id', component: ServiceFormComponent, canActivate: [adminGuard] },

      { path: 'admin/packs', component: PackListComponent, canActivate: [adminGuard] },
      { path: 'admin/packs/new', component: PackFormComponent, canActivate: [adminGuard] },
      { path: 'admin/packs/edit/:id', component: PackFormComponent, canActivate: [adminGuard] },
      {
        path: 'depenses',
        component: ExpenseManagerComponent,
        title: 'Gestion des Dépenses'
      },
      { path: 'admin/chat', component: ChatComponent, canActivate: [adminGuard] },
      { path: 'admin/payments', component: PaymentListComponent, canActivate: [adminGuard] },

      { path: 'admin/config', component: ConfigurationComponent, canActivate: [adminGuard] },
    ]
  },
  { path: '**', redirectTo: '' }
];
