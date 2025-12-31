import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { Router } from '@angular/router'; // Ajout de Router
import { ReservationService } from '../../core/services/reservation.service';
import { ClientService } from '../../core/services/client.service';
import { toSignal } from '@angular/core/rxjs-interop';
import { firstValueFrom } from 'rxjs';

@Component({
  selector: 'app-history',
  standalone: true,
  imports: [CommonModule],
  providers: [DatePipe],
  templateUrl: './history.component.html'
})
export class HistoryComponent implements OnInit {
  private router = inject(Router); // Injection du Router
  private reservationService = inject(ReservationService);
  private clientService = inject(ClientService);

  clients = toSignal(this.clientService.getAll(), { initialValue: [] as any[] });
  
  reservations = signal<any[]>([]);
  loading = signal(true);
  
  totalRevenue = computed(() => this.reservations().reduce((acc, r) => acc + (Number(r.totalPrice) || 0), 0));
  count = computed(() => this.reservations().length);

  ngOnInit() {
    this.loadHistory();
  }

  async loadHistory() {
    this.loading.set(true);
    try {
      const res = await firstValueFrom(this.reservationService.getAll());
      const sorted = res.sort((a: any, b: any) => {
        const dateA = this.getDate(a.date).getTime();
        const dateB = this.getDate(b.date).getTime();
        return dateB - dateA;
      });
      this.reservations.set(sorted);
    } catch (e) {
      console.error('Erreur chargement historique', e);
    } finally {
      this.loading.set(false);
    }
  }

  getDate(val: any): Date {
    if (!val) return new Date();
    return val?.toDate ? val.toDate() : new Date(val);
  }

  getClientName(clientId: string): string {
    if (!clientId) return 'Client Inconnu';
    const client = this.clients().find((c: any) => c.id === clientId);
    return client ? (client.nom + ' ' + (client.prenom || '')) : 'Client Inconnu';
  }

  getStatusLabel(status: string): string {
    const map: any = {
      'CONFIRMED': 'Confirmé',
      'PENDING': 'En attente',
      'CANCELLED': 'Annulé',
      'COMPLETED': 'Terminé'
    };
    return map[status] || status;
  }

  getStatusClass(status: string): string {
    const map: any = {
      'CONFIRMED': 'bg-green-100 text-green-800',
      'PENDING': 'bg-yellow-100 text-yellow-800',
      'CANCELLED': 'bg-red-100 text-red-800',
      'COMPLETED': 'bg-blue-100 text-blue-800'
    };
    return map[status] || 'bg-gray-100 text-gray-800';
  }

  // Nouvelle méthode de navigation
  viewReservation(id: string) {
    this.router.navigate(['/reservations/edit', id]);
  }
}
