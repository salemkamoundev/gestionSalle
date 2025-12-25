import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { NotificationService } from '../../../core/services/notification.service';
import { AuthService } from '../../../core/services/auth.service';
import { AppNotification } from '../../../core/models/notification.model';
import { Observable, of, switchMap, take } from 'rxjs';

@Component({
  selector: 'app-notification-history',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './notification-history.component.html'
})
export class NotificationHistoryComponent implements OnInit {
  private notifService = inject(NotificationService);
  private authService = inject(AuthService);

  notifications$: Observable<AppNotification[]> = of([]);
  unreadCount$: Observable<number> = of(0);
  currentUid: string | null = null;

  ngOnInit() {
    // On réagit aux changements d'utilisateur
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

  // Helper simple pour s'adapter à votre version d'Angular
  private toObservable(signal: any): Observable<any> {
    return new Observable(subscriber => {
        subscriber.next(signal());
    });
  }

  constructor() {
      // Init au cas où
      const user = this.authService.userState();
      if(user && user.uid) {
         this.currentUid = user.uid;
      }
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
}
