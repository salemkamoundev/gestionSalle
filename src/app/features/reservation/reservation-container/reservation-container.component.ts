import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

// Import des composants enfants pour utilisation dans le template
import { ClientInfoComponent } from '../client-info/client-info.component';
import { EventDetailsComponent } from '../event-details/event-details.component';
import { ServicesPacksComponent } from '../services-packs/services-packs.component';
import { StaffTeamsComponent } from '../staff-teams/staff-teams.component';
import { PaymentsComponent } from '../payments/payments.component';

@Component({
  selector: 'app-reservation-container',
  standalone: true,
  imports: [
    CommonModule,
    ClientInfoComponent,
    EventDetailsComponent,
    ServicesPacksComponent,
    StaffTeamsComponent,
    PaymentsComponent
  ],
  templateUrl: './reservation-container.component.html',
  styleUrls: ['./reservation-container.component.scss']
})
export class ReservationContainerComponent {
  
  // Configuration des onglets
  tabs = [
    { id: 'client', label: 'Client', icon: 'person' },
    { id: 'event', label: 'Événement', icon: 'event' },
    { id: 'packs', label: 'Services & Packs', icon: 'inventory_2' },
    { id: 'staff', label: 'Staff & Équipe', icon: 'groups' },
    { id: 'payment', label: 'Paiements', icon: 'payments' }
  ];

  // Onglet actif par défaut
  activeTab: string = 'client';

  // Méthode de changement d'onglet
  selectTab(tabId: string) {
    this.activeTab = tabId;
  }
}
