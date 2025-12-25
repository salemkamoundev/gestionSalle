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
