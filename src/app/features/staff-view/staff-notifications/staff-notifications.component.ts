import { Component, inject, OnInit, signal, computed, effect, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { NotificationService } from '../../../core/services/notification.service';
import { AuthService } from '../../../core/services/auth.service';
import { AppNotification } from '../../../core/models/notification.model';
import { Observable, of, Subscription } from 'rxjs';
import { switchMap } from 'rxjs/operators';
import { toObservable } from '@angular/core/rxjs-interop';

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
        
        <button *ngIf="unreadCount() > 0" 
                (click)="markAllRead()"
                class="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-3 py-1.5 rounded-full transition text-xs font-bold shadow-sm">
          <span class="material-icons text-xs">done_all</span> <span class="hidden sm:inline">Tout lire</span>
        </button>
      </header>

      <main class="flex-1 p-4 max-w-3xl mx-auto w-full space-y-4 pb-20">
        
        <div *ngIf="loading()" class="py-10 text-center text-slate-400">
          <span class="material-icons animate-spin text-3xl">sync</span>
          <p class="text-xs mt-2">Chargement...</p>
        </div>

        <div *ngIf="!loading() && allNotifications().length === 0" class="flex flex-col items-center justify-center py-20 text-slate-400">
          <div class="w-20 h-20 bg-slate-200 rounded-full flex items-center justify-center mb-4">
            <span class="material-icons text-4xl text-slate-400">notifications_none</span>
          </div>
          <p class="font-medium">Aucune notification</p>
        </div>

        <ul class="space-y-3" *ngIf="!loading() && allNotifications().length > 0">
          <li *ngFor="let notif of paginatedList()" 
              (click)="markAsRead(notif)"
              class="bg-white p-4 rounded-xl shadow-sm border border-slate-100 relative overflow-hidden transition active:scale-[0.98] cursor-pointer"
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
                   <a [routerLink]="notif.link" (click)="$event.stopPropagation()" class="text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded hover:bg-blue-100 transition inline-flex items-center gap-1">
                     Voir <span class="material-icons text-[10px]">arrow_forward</span>
                   </a>
                </div>
              </div>
            </div>
          </li>
        </ul>

        <div *ngIf="!loading() && totalPages() > 1" class="flex items-center justify-between pt-4 border-t border-slate-200">
          <button (click)="prevPage()" 
                  [disabled]="page() <= 1"
                  class="flex items-center gap-1 px-3 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition">
            <span class="material-icons text-sm">chevron_left</span> Précédent
          </button>

          <span class="text-xs font-semibold text-slate-500">
            Page {{ page() }} / {{ totalPages() }}
          </span>

          <button (click)="nextPage()" 
                  [disabled]="page() >= totalPages()"
                  class="flex items-center gap-1 px-3 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition">
            Suivant <span class="material-icons text-sm">chevron_right</span>
          </button>
        </div>

      </main>
    </div>
  `,
  styles: [`
    @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
    .animate-fade-in { animation: fadeIn 0.3s ease-out; }
  `]
})
export class StaffNotificationsComponent implements OnInit, OnDestroy {
  private notifService = inject(NotificationService);
  private authService = inject(AuthService);

  // CORRECTION MAJEURE : Initialisation ici pour satisfaire le contexte d'injection
  private user$ = toObservable(this.authService.userState);

  // --- State avec Signals ---
  loading = signal(true);
  allNotifications = signal<AppNotification[]>([]);
  unreadCount = signal(0);
  
  // Pagination
  page = signal(1);
  pageSize = 8;
  
  currentUid: string | null = null;
  private sub: Subscription | null = null;

  // --- Computed Values ---
  totalPages = computed(() => {
    const total = this.allNotifications().length;
    return total === 0 ? 1 : Math.ceil(total / this.pageSize);
  });

  paginatedList = computed(() => {
    const start = (this.page() - 1) * this.pageSize;
    const end = start + this.pageSize;
    return this.allNotifications().slice(start, end);
  });

  constructor() {
    effect(() => {
      if (this.page() > this.totalPages()) {
        this.page.set(this.totalPages());
      }
    }, { allowSignalWrites: true });
  }

  ngOnInit() {
    this.sub = this.user$.pipe(
      switchMap(user => {
        if (!user || !user.uid) {
          this.loading.set(false);
          return of({ list: [], count: 0 });
        }
        this.currentUid = user.uid;
        
        // Souscription au compteur
        this.notifService.getUnreadCount(user.uid).subscribe(c => this.unreadCount.set(c));

        // Retourne le flux principal
        return this.notifService.getUserNotifications(user.uid);
      })
    ).subscribe({
      next: (list: AppNotification[] | any) => { 
        if (Array.isArray(list)) {
          this.allNotifications.set(list);
        } else {
          this.allNotifications.set([]);
        }
        this.loading.set(false);
      },
      error: (err) => {
        console.error(err);
        this.loading.set(false);
      }
    });
  }

  ngOnDestroy() {
    if (this.sub) {
      this.sub.unsubscribe();
    }
  }

  // --- Actions ---

  nextPage() {
    if (this.page() < this.totalPages()) {
      this.page.update(p => p + 1);
      this.scrollToTop();
    }
  }

  prevPage() {
    if (this.page() > 1) {
      this.page.update(p => p - 1);
      this.scrollToTop();
    }
  }

  markAsRead(notif: AppNotification) {
    // Correction : Passage de this.currentUid + notif.id
    if (!notif.read && notif.id && this.currentUid) {
      this.notifService.markAsRead(this.currentUid, notif.id);
    }
  }

  markAllRead() {
    const list = this.allNotifications();
    if (this.currentUid && list.length > 0) {
      this.notifService.markAllAsRead(this.currentUid, list);
    }
  }

  private scrollToTop() {
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }
}