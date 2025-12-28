import { Component, OnInit, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Firestore, collection, query, orderBy, limit, collectionData, doc, updateDoc } from '@angular/fire/firestore';
import { Auth, authState } from '@angular/fire/auth';
import { Observable, of } from 'rxjs';
import { switchMap, tap, catchError } from 'rxjs/operators';

@Component({
  selector: 'app-staff-notifications',
  templateUrl: './staff-notifications.component.html',
  styleUrls: ['./staff-notifications.component.scss'],
  standalone: true,
  imports: [CommonModule],
  schemas: [CUSTOM_ELEMENTS_SCHEMA]
})
export class StaffNotificationsComponent implements OnInit {

  notifications$: Observable<any[]> = of([]);
  isLoading = true;
  errorMessage: string | null = null;

  constructor(
    private firestore: Firestore,
    private auth: Auth
  ) {}

  ngOnInit() {
    this.notifications$ = authState(this.auth).pipe(
      switchMap(user => {
        if (!user) {
          this.isLoading = false;
          return of([]);
        }
        const ref = collection(this.firestore, `users/${user.uid}/notifications`);
        const q = query(ref, orderBy('createdAt', 'desc'), limit(50));
        return collectionData(q, { idField: 'id' }).pipe(
          tap(() => this.isLoading = false),
          catchError(err => {
            console.error(err);
            this.isLoading = false;
            return of([]);
          })
        );
      })
    );
  }

  async markAsRead(notif: any) {
    if (notif.read) return;
    try {
      const user = this.auth.currentUser;
      if (user && notif.id) {
        const docRef = doc(this.firestore, `users/${user.uid}/notifications/${notif.id}`);
        await updateDoc(docRef, { read: true });
      }
    } catch (e) { console.error(e); }
  }
}
