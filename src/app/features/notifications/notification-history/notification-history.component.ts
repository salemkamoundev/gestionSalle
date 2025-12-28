import { Component, inject, OnInit, signal, computed, effect, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { NotificationService } from '../../../core/services/notification.service';
import { AuthService } from '../../../core/services/auth.service';
import { AppNotification } from '../../../core/models/notification.model';
import { of, Subscription } from 'rxjs';
import { switchMap } from 'rxjs/operators';
import { toObservable } from '@angular/core/rxjs-interop';

@Component({
  selector: 'app-notification-history',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './notification-history.component.html'
})
export class NotificationHistoryComponent implements OnInit, OnDestroy {
  private notifService = inject(NotificationService);
  private authService = inject(AuthService);

  // Initialisation du contexte d'injection pour toObservable
  private user$ = toObservable(this.authService.userState);

  // --- State avec Signals ---
  loading = signal(true);
  allNotifications = signal<AppNotification[]>([]);
  unreadCount = signal(0);
  
  // Pagination configuration
  page = signal(1);
  pageSize = 10;
  
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
    // Si on change de filtre ou de liste, on revient à une page valide
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
          this.currentUid = null;
          return of([]);
        }
        this.currentUid = user.uid;
        
        // Mise à jour du compteur
        this.notifService.getUnreadCount(user.uid).subscribe(c => this.unreadCount.set(c));

        // Récupération de la liste
        return this.notifService.getUserNotifications(user.uid);
      })
    ).subscribe({
      next: (list) => {
        this.allNotifications.set(list || []);
        this.loading.set(false);
      },
      error: (err) => {
        console.error(err);
        this.loading.set(false);
      }
    });
  }

  ngOnDestroy() {
    if (this.sub) this.sub.unsubscribe();
  }

  // --- Actions de Pagination ---
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

  private scrollToTop() {
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  // --- Actions Métier ---
  markAsRead(notif: AppNotification) {
    if (!notif.read && notif.id && this.currentUid) {
      // Correction : Ajout de l'uid requis par le service
      this.notifService.markAsRead(this.currentUid, notif.id);
    }
  }

  markAllRead() {
    const list = this.allNotifications();
    if (this.currentUid && list.length > 0) {
      this.notifService.markAllAsRead(this.currentUid, list);
    }
  }
}