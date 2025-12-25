#!/bin/bash

echo "🚀 Configuration de la page Notifications pour le Staff..."

# 1. Création du composant StaffNotifications (Page Historique Staff)
# -----------------------------------------------------------------
mkdir -p src/app/features/staff-view/staff-notifications

echo "📝 Création de src/app/features/staff-view/staff-notifications/staff-notifications.component.ts..."
cat << 'EOF' > src/app/features/staff-view/staff-notifications/staff-notifications.component.ts
import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { NotificationService } from '../../../core/services/notification.service';
import { AuthService } from '../../../core/services/auth.service';
import { AppNotification } from '../../../core/models/notification.model';
import { Observable, of, switchMap, take } from 'rxjs';

@Component({
  selector: 'app-staff-notifications',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <div class="min-h-screen bg-slate-50 flex flex-col animate-fade-in">
      
      <header class="bg-slate-900 text-white p-4 shadow-md flex justify-between items-center sticky top-0 z-30">
        <div class="flex items-center gap-3">
          <button routerLink="/my-planning" class="p-2 -ml-2 hover:bg-slate-800 rounded-full transition text-slate-300 hover:text-white">
            <span class="material-icons">arrow_back</span>
          </button>
          <div>
            <h1 class="font-bold text-lg leading-tight">Notifications</h1>
            <p class="text-xs text-slate-400">Historique de vos alertes</p>
          </div>
        </div>
        
        <button *ngIf="(unreadCount$ | async)! > 0" 
                (click)="markAllRead()"
                class="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-3 py-1.5 rounded-full transition text-xs font-bold shadow-sm">
          <span class="material-icons text-xs">done_all</span> <span class="hidden sm:inline">Tout lire</span>
        </button>
      </header>

      <main class="flex-1 p-4 max-w-3xl mx-auto w-full space-y-4 pb-20">
        
        <ng-container *ngIf="notifications$ | async as list">
          
          <div *ngIf="list.length === 0" class="flex flex-col items-center justify-center py-20 text-slate-400">
            <div class="w-20 h-20 bg-slate-200 rounded-full flex items-center justify-center mb-4">
              <span class="material-icons text-4xl text-slate-400">notifications_none</span>
            </div>
            <p class="font-medium">Aucune notification</p>
          </div>

          <ul class="space-y-3">
            <li *ngFor="let notif of list" 
                (click)="markAsRead(notif)"
                class="bg-white p-4 rounded-xl shadow-sm border border-slate-100 relative overflow-hidden transition active:scale-[0.98]"
                [class.border-l-4]="!notif.read"
                [class.border-l-blue-500]="!notif.read">
              
              <div *ngIf="!notif.read" class="absolute inset-0 bg-blue-50/30 pointer-events-none"></div>

              <div class="flex gap-4 relative z-10">
                <div [ngClass]="{
                  'bg-blue-100 text-blue-600': notif.type === 'info' || !notif.type,
                  'bg-green-100 text-green-600': notif.type === 'success',
                  'bg-amber-100 text-amber-600': notif.type === 'warning',
                  'bg-red-100 text-red-600': notif.type === 'error'
                }" class="w-10 h-10 rounded-full flex items-center justify-center shrink-0">
                  <span class="material-icons text-xl">{{ notif.icon || 'notifications' }}</span>
                </div>

                <div class="flex-1 min-w-0">
                  <div class="flex justify-between items-start gap-2">
                    <h3 class="font-bold text-slate-800 text-sm leading-tight" [class.text-blue-700]="!notif.read">{{ notif.title }}</h3>
                    <span class="text-[10px] text-slate-400 shrink-0">{{ notif.createdAt.toDate() | date:'dd/MM HH:mm' }}</span>
                  </div>
                  
                  <p class="text-slate-600 text-xs mt-1 leading-relaxed line-clamp-2">{{ notif.body }}</p>
                  
                  <div *ngIf="notif.link" class="mt-2 flex justify-end">
                     <a [routerLink]="notif.link" class="text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded hover:bg-blue-100 transition inline-flex items-center gap-1">
                       Voir <span class="material-icons text-[10px]">arrow_forward</span>
                     </a>
                  </div>
                </div>
              </div>
            </li>
          </ul>

        </ng-container>
      </main>
    </div>
  `,
  styles: [`
    @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
    .animate-fade-in { animation: fadeIn 0.3s ease-out; }
  `]
})
export class StaffNotificationsComponent implements OnInit {
  private notifService = inject(NotificationService);
  private authService = inject(AuthService);

  notifications$: Observable<AppNotification[]> = of([]);
  unreadCount$: Observable<number> = of(0);
  currentUid: string | null = null;

  ngOnInit() {
    this.notifications$ = this.toObservable(this.authService.userState).pipe(
      switchMap(user => {
        if (!user || !user.uid) return of([]);
        this.currentUid = user.uid;
        return this.notifService.getUserNotifications(user.uid);
      })
    );

    this.unreadCount$ = this.toObservable(this.authService.userState).pipe(
      switchMap(user => {
        if (!user || !user.uid) return of(0);
        return this.notifService.getUnreadCount(user.uid);
      })
    );
  }

  markAsRead(notif: AppNotification) {
    if (!notif.read && notif.id && this.currentUid) {
      this.notifService.markAsRead(this.currentUid, notif.id);
    }
  }

  markAllRead() {
    this.notifications$.pipe(take(1)).subscribe(list => {
      if (this.currentUid) {
        this.notifService.markAllAsRead(this.currentUid, list);
      }
    });
  }

  private toObservable(signal: any): Observable<any> {
    return new Observable(subscriber => { subscriber.next(signal()); });
  }
}
EOF


# 2. Mise à jour des Routes
# -------------------------
echo "🔗 Ajout de la route '/my-notifications' dans app.routes.ts..."
cat << 'EOF' > src/app/app.routes.ts
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
import { StaffNotificationsComponent } from './features/staff-view/staff-notifications/staff-notifications.component'; // <--- IMPORT
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
  
  // ROUTES STAFF (ACCESSIBLES SANS ADMIN)
  { path: 'my-planning', component: StaffCalendarComponent, canActivate: [authGuard] },
  { path: 'my-notifications', component: StaffNotificationsComponent, canActivate: [authGuard] }, // <--- NOUVELLE ROUTE

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
EOF


# 3. Mise à jour du Planning (Lien Bouton)
# ----------------------------------------
echo "🔄 Mise à jour du lien notification dans StaffCalendarComponent..."
# On met à jour le fichier pour que le routerLink pointe vers /my-notifications
cat << 'EOF' > src/app/features/staff-view/staff-calendar.component.ts
import { Component, inject, computed, signal, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { ReservationService } from '../../core/services/reservation.service';
import { AuthService } from '../../core/services/auth.service';
import { NotificationService } from '../../core/services/notification.service';
import { toSignal } from '@angular/core/rxjs-interop';
import { startOfMonth, endOfMonth, startOfWeek, endOfWeek, format, addMonths, subMonths, eachDayOfInterval, isSameMonth, isToday } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Reservation } from '../../core/models/reservation.model';

@Component({
  selector: 'app-staff-calendar',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <div class="min-h-screen bg-slate-50 flex flex-col">
      
      <header class="bg-slate-900 text-white p-4 shadow-md flex justify-between items-center z-20">
        
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center font-bold text-lg">
            {{ (authService.userState()?.email?.charAt(0) || 'S') | uppercase }}
          </div>
          <div>
            <h1 class="font-bold text-lg leading-tight">Mon Planning</h1>
            <p class="text-xs text-slate-400">{{ authService.userState()?.email }}</p>
          </div>
        </div>
        
        <div class="flex items-center gap-3">
          
          <button routerLink="/my-notifications" class="relative p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-full transition group">
            <span class="material-icons">notifications</span>
            
            <span *ngIf="unreadCount() > 0" class="absolute top-1 right-2 w-3 h-3 bg-red-500 border-2 border-slate-900 rounded-full animate-pulse"></span>
            
            <span class="absolute -bottom-8 left-1/2 -translate-x-1/2 bg-slate-800 text-white text-[10px] px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition whitespace-nowrap z-50 pointer-events-none">
              {{ unreadCount() > 0 ? unreadCount() + ' nouvelle(s)' : 'Notifications' }}
            </span>
          </button>

          <button (click)="logout()" class="flex items-center gap-2 bg-slate-800 hover:bg-red-600 text-white px-4 py-2 rounded-lg transition text-sm font-bold">
            <span class="material-icons text-sm">logout</span> <span class="hidden sm:inline">Déconnexion</span>
          </button>
        </div>
      </header>

      <main class="flex-1 flex flex-col p-4 md:p-6 max-w-7xl mx-auto w-full">
        
        <div class="flex justify-between items-center mb-6 bg-white p-3 rounded-xl shadow-sm border border-slate-200">
          <button (click)="previousMonth()" class="p-2 hover:bg-slate-100 rounded-full transition"><span class="material-icons">chevron_left</span></button>
          <h2 class="text-xl font-bold text-slate-800 capitalize">{{ currentMonthLabel() }}</h2>
          <button (click)="nextMonth()" class="p-2 hover:bg-slate-100 rounded-full transition"><span class="material-icons">chevron_right</span></button>
        </div>

        <div class="flex-1 bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col min-h-[600px]">
          
          <div class="grid grid-cols-7 border-b bg-slate-50">
            @for (day of weekDays; track day) {
              <div class="py-3 text-center text-xs font-bold text-slate-500 uppercase tracking-wider">{{ day }}</div>
            }
          </div>

          <div class="grid grid-cols-7 flex-1 auto-rows-fr divide-x divide-y divide-slate-100">
            @for (day of calendarDays(); track day) {
              <div class="min-h-[100px] p-2 relative transition hover:bg-slate-50"
                   [class.bg-blue-50]="isToday(day)"
                   [class.bg-slate-50]="!isCurrentMonth(day)">
                
                <div class="text-right text-xs font-bold mb-1" 
                     [class.text-blue-600]="isToday(day)" 
                     [class.text-slate-400]="!isCurrentMonth(day)">
                  {{ day | date:'d' }}
                </div>

                <div class="space-y-1">
                  @for (res of getMyShifts(day); track res.id) {
                    <div (click)="openDetails(res)" class="px-2 py-1.5 rounded bg-blue-100 border-l-4 border-blue-500 text-blue-900 text-[11px] font-medium shadow-sm cursor-pointer hover:brightness-95 transition truncate">
                      {{ res.startTime }} - {{ res.endTime }}
                    </div>
                  }
                </div>
              </div>
            }
          </div>
        </div>
      </main>
    </div>

    @if (selectedReservation()) {
      <div class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/80 backdrop-blur-sm p-4 animate-fade-in" (click)="closeDetails()">
        <div class="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden" (click)="$event.stopPropagation()">
          
          <div class="bg-blue-600 px-6 py-4 flex justify-between items-center text-white">
            <h3 class="font-bold text-lg">Détails Shift</h3>
            <button (click)="closeDetails()" class="text-blue-200 hover:text-white"><span class="material-icons">close</span></button>
          </div>

          <div class="p-6 space-y-4">
            
            <div class="text-center mb-4">
              <p class="text-sm text-slate-500 uppercase font-bold tracking-wider mb-1">Date</p>
              <p class="text-xl font-bold text-slate-800 capitalize">{{ selectedReservation()?.date | date:'fullDate':'':'fr' }}</p>
            </div>

            <div class="bg-slate-50 p-4 rounded-xl border border-slate-100 flex items-center justify-between">
              <div>
                <p class="text-xs text-slate-400 uppercase font-bold">Début</p>
                <p class="text-lg font-bold text-slate-700">{{ selectedReservation()?.startTime }}</p>
              </div>
              <span class="material-icons text-slate-300">arrow_forward</span>
              <div class="text-right">
                <p class="text-xs text-slate-400 uppercase font-bold">Fin</p>
                <p class="text-lg font-bold text-slate-700">{{ selectedReservation()?.endTime }}</p>
              </div>
            </div>

            <div>
              <p class="text-xs text-slate-500 uppercase font-bold mb-1">Client / Événement</p>
              <p class="font-medium text-slate-800">{{ selectedReservation()?.clientName }}</p>
            </div>

            <div class="pt-4 border-t border-slate-100">
              <button (click)="closeDetails()" class="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-3 rounded-lg transition">
                Fermer
              </button>
            </div>

          </div>
        </div>
      </div>
    }
  `,
  styles: [`
    @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
    .animate-fade-in { animation: fadeIn 0.2s ease-out; }
  `]
})
export class StaffCalendarComponent {
  authService = inject(AuthService);
  notificationService = inject(NotificationService);
  private reservationService = inject(ReservationService);
  private router = inject(Router);

  viewDate = signal(new Date());
  weekDays = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
  unreadCount = signal(0);
  
  reservations = toSignal(this.reservationService.getAll(), { initialValue: [] });
  selectedReservation = signal<Reservation | null>(null);

  constructor() {
    effect((onCleanup) => {
      const u = this.authService.userState();
      const uid = u?.uid;
      
      if (uid) {
        const key = 'MY_PLANNING_FCM_INIT_V1';
        if (sessionStorage.getItem(key) !== '1') {
          sessionStorage.setItem(key, '1');
          void this.notificationService.ensurefcmTokensForUser(uid).catch(console.warn);
        }
        const sub = this.notificationService.getUnreadCount(uid).subscribe(count => {
          this.unreadCount.set(count);
        });
        onCleanup(() => sub.unsubscribe());
      } else {
        this.unreadCount.set(0);
      }
    });
  }

  getMyShifts(date: Date): Reservation[] {
    const dateStr = format(date, 'yyyy-MM-dd');
    const myUid = this.authService.userState()?.uid;
    if (!myUid) return [];
    return this.reservations().filter(r => {
      if (r.date !== dateStr) return false;
      return r.assignedServerIds && r.assignedServerIds.includes(myUid);
    });
  }

  nextMonth() { this.viewDate.update(d => addMonths(d, 1)); }
  previousMonth() { this.viewDate.update(d => subMonths(d, 1)); }
  
  currentMonthLabel = computed(() => format(this.viewDate(), 'MMMM yyyy', { locale: fr }));
  calendarDays = computed(() => eachDayOfInterval({ 
    start: startOfWeek(startOfMonth(this.viewDate()), { weekStartsOn: 1 }), 
    end: endOfWeek(endOfMonth(this.viewDate()), { weekStartsOn: 1 }) 
  }));

  isToday(d: Date) { return isToday(d); }
  isCurrentMonth(d: Date) { return isSameMonth(d, this.viewDate()); }

  openDetails(res: Reservation) { this.selectedReservation.set(res); }
  closeDetails() { this.selectedReservation.set(null); }
  
  goToAdminChat() { this.router.navigate(['/admin/chat']); }

  async logout() {
    await this.authService.logout();
    this.router.navigate(['/login']);
  }
}
EOF

echo "✅ Terminé : Page notifications staff créée et liée !"