#!/bin/bash

# Dossier cible
BASE_DIR="src/app/features/staff-notifications"
mkdir -p "$BASE_DIR"

echo "📂 Création du composant StaffNotifications dans $BASE_DIR..."

# 1. Création du fichier TypeScript (.ts)
# Utilise la syntaxe MODULAIRE (comme votre FcmService)
cat << 'EOF' > "$BASE_DIR/staff-notifications.component.ts"
import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { 
  Firestore, 
  collection, 
  query, 
  orderBy, 
  limit, 
  collectionData, 
  doc, 
  updateDoc, 
  where 
} from '@angular/fire/firestore';
import { Auth, authState } from '@angular/fire/auth';
import { Observable, of } from 'rxjs';
import { switchMap, map } from 'rxjs/operators';

@Component({
  selector: 'app-staff-notifications',
  templateUrl: './staff-notifications.component.html',
  styleUrls: ['./staff-notifications.component.scss'],
  standalone: true,
  imports: [CommonModule, IonicModule] // Standalone component
})
export class StaffNotificationsComponent implements OnInit {

  notifications$: Observable<any[]> = of([]);
  unreadCount$: Observable<number> = of(0);

  constructor(
    private firestore: Firestore,
    private auth: Auth
  ) {}

  ngOnInit() {
    // Écoute de l'utilisateur connecté
    const user$ = authState(this.auth);

    // 1. Liste des notifications (Triées par date)
    this.notifications$ = user$.pipe(
      switchMap(user => {
        if (!user) return of([]);
        const ref = collection(this.firestore, `users/${user.uid}/notifications`);
        const q = query(ref, orderBy('createdAt', 'desc'), limit(50));
        return collectionData(q, { idField: 'id' }); // idField ajoute l'ID du doc
      })
    );

    // 2. Compteur de non-lues (Optionnel)
    this.unreadCount$ = this.notifications$.pipe(
      map(notifs => notifs.filter(n => !n.read).length)
    );
  }

  /**
   * Marquer une notification comme lue
   */
  async markAsRead(notification: any) {
    if (notification.read) return;

    try {
      const user = this.auth.currentUser;
      if (user && notification.id) {
        const docRef = doc(this.firestore, `users/${user.uid}/notifications/${notification.id}`);
        await updateDoc(docRef, { read: true });
      }
    } catch (e) {
      console.error('Erreur update notif:', e);
    }
  }

  /**
   * Action au clic (ex: redirection selon le type)
   */
  handleNotificationClick(notification: any) {
    this.markAsRead(notification);
    
    // Logique de redirection ici si besoin
    if (notification.type === 'reservation_assigned') {
      // router.navigate(['/reservations', notification.data.reservationId]);
    }
  }
}
EOF

# 2. Création du fichier HTML (.html)
cat << 'EOF' > "$BASE_DIR/staff-notifications.component.html"
<ion-header>
  <ion-toolbar>
    <ion-title>
      Notifications
      <span *ngIf="(unreadCount$ | async) as count" style="font-size: 0.8em; opacity: 0.7;">
        ({{ count }} nvelles)
      </span>
    </ion-title>
  </ion-toolbar>
</ion-header>

<ion-content class="ion-padding">
  
  <ion-list>
    <ion-item-sliding *ngFor="let notif of notifications$ | async">
      
      <ion-item button (click)="handleNotificationClick(notif)" [class.unread]="!notif.read">
        <ion-icon 
          [name]="notif.read ? 'mail-open-outline' : 'mail-unread-outline'" 
          slot="start"
          [color]="notif.read ? 'medium' : 'primary'">
        </ion-icon>
        
        <ion-label>
          <h2>{{ notif.title }}</h2>
          <p>{{ notif.body }}</p>
          <p class="date" *ngIf="notif.createdAt?.seconds">
            {{ notif.createdAt.seconds * 1000 | date:'dd/MM HH:mm' }}
          </p>
        </ion-label>

        <ion-badge slot="end" *ngIf="!notif.read" color="primary">!</ion-badge>
      </ion-item>

      <ion-item-options side="end">
        <ion-item-option (click)="markAsRead(notif)" color="secondary">
          Lu
        </ion-item-option>
      </ion-item-options>

    </ion-item-sliding>
    
    <div *ngIf="(notifications$ | async)?.length === 0" class="empty-state">
      <ion-icon name="notifications-off-outline" size="large"></ion-icon>
      <p>Aucune notification pour le moment.</p>
    </div>

  </ion-list>
</ion-content>
EOF

# 3. Création du fichier SCSS (.scss)
cat << 'EOF' > "$BASE_DIR/staff-notifications.component.scss"
.unread {
  --background: rgba(var(--ion-color-primary-rgb), 0.08);
  font-weight: 500;
}

.date {
  font-size: 0.8em;
  color: var(--ion-color-medium);
  margin-top: 4px;
}

.empty-state {
  text-align: center;
  margin-top: 50px;
  color: var(--ion-color-medium);
  
  ion-icon {
    font-size: 48px;
    margin-bottom: 10px;
  }
}
EOF

echo "✅ Composant StaffNotificationsComponent généré avec succès !"
echo "👉 N'oubliez pas de l'ajouter dans vos routes (app-routing.module.ts) :"
echo "   { path: 'notifications', loadComponent: () => import('./features/staff-notifications/staff-notifications.component').then(m => m.StaffNotificationsComponent) }"