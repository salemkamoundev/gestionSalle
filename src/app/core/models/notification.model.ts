import { Timestamp } from '@angular/fire/firestore';

export interface AppNotification {
  id?: string;
  title: string;
  body: string;
  read: boolean;
  createdAt: Timestamp;
  link?: string;     // Lien optionnel vers une page (ex: /reservations)
  icon?: string;     // Icone optionnelle (ex: event_available)
  type?: 'info' | 'success' | 'warning' | 'error';
}
