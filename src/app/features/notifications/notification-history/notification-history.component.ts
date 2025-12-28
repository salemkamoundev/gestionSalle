import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { NotificationService } from '../../../core/services/notification.service';
import { AuthService } from '../../../core/services/auth.service';
import { AppNotification } from '../../../core/models/notification.model';
import { Observable, of, from } from 'rxjs';
import { switchMap, take } from 'rxjs/operators';
import { toObservable } from '@angular/core/rxjs-interop'; // Import officiel Angular pour les signaux

@Component({
  selector: 'app-notification-history',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './notification-history.component.html'
})
export class NotificationHistoryComponent implements OnInit {
  private notifService = inject(NotificationService);
  private authService = inject(AuthService);

  // Utilisation de toObservable pour transformer le signal userState en flux réactif
  user$ = toObservable(this.authService.userState);
  
  notifications$: Observable<AppNotification[]> = of([]);
  unreadCount$: Observable<number> = of(0);
  currentUid: string | null = null;

  ngOnInit() {
    this.notifications$ = this.user$.pipe(
      switchMap(user => {
        if (!user || !user.uid) {
          this.currentUid = null;
          return of([]);
        }
        this.currentUid = user.uid;
        return this.notifService.getUserNotifications(user.uid);
      })
    );

    this.unreadCount$ = this.user$.pipe(
      switchMap(user => {
        if (!user || !user.uid) return of(0);
        return this.notifService.getUnreadCount(user.uid);
      })
    );
  }

  markAsRead(notif: AppNotification) {
    if (!notif.read && notif.id) {
      this.notifService.markAsRead(notif.id);
    }
  }

  markAllRead() {
    this.notifications$.pipe(take(1)).subscribe(list => {
      if (this.currentUid && list.length > 0) {
        this.notifService.markAllAsRead(this.currentUid, list);
      }
    });
  }
}
