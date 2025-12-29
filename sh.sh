#!/bin/bash

echo "Correction finale de StaffCalendarComponent (Erreur userState)..."

# Réécriture du fichier TypeScript avec la correction sur userInfo
cat << 'EOF' > src/app/features/staff-view/staff-calendar.component.ts
import { Component, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReservationService } from '../../core/services/reservation.service';
import { AuthService } from '../../core/services/auth.service';
import { ClientService } from '../../core/services/client.service';
import { TeamService } from '../../core/services/team.service';
import { StaffService } from '../../core/services/staff.service';
import { toSignal } from '@angular/core/rxjs-interop';

@Component({
  selector: 'app-staff-calendar',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './staff-calendar.component.html',
  styles: [`
    .animate-fade-in { animation: fadeIn 0.2s ease-out; }
    @keyframes fadeIn { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }
  `]
})
export class StaffCalendarComponent {
  private auth = inject(AuthService);
  private reservationService = inject(ReservationService);
  private clientService = inject(ClientService);
  private teamService = inject(TeamService);
  private staffService = inject(StaffService);

  viewDate = signal(new Date());
  selectedReservation = signal<any>(null);

  // CORRECTION MAJEURE : On récupère directement le Signal userState
  // Au lieu de la méthode currentUser qui perdait le contexte 'this'
  userInfo = this.auth.userState;
  
  rawReservations = toSignal(this.reservationService.getReservations(), { initialValue: [] });
  clients = toSignal(this.clientService.getAll(), { initialValue: [] });
  teams = toSignal(this.teamService.getTeams(), { initialValue: [] });
  staff = toSignal(this.staffService.getAll(), { initialValue: [] });

  // FILTRE : Réservations assignées à ce staff uniquement
  myReservations = computed(() => {
    // userInfo est un Signal, on l'appelle pour avoir la valeur courante
    const user = this.userInfo();
    const uid = user ? user.uid : null;
    
    const all = this.rawReservations() as any[];
    
    if (!uid || !all) return [];

    return all.filter(r => {
      // Exclure les annulées
      if (r.status === 'CANCELLED') return false;
      
      // Vérifier si l'ID du staff est dans la liste des serveurs assignés
      return (r.assignedServerIds || []).includes(uid);
    });
  });

  // --- Helpers pour le Popup ---
  
  getClientName(clientId: string): string {
    const list = this.clients() as any[];
    const client = list.find(c => c.id === clientId);
    return client ? `${client.nom} ${client.prenom}` : 'Client Inconnu';
  }

  getClientPhone(clientId: string): string {
    const list = this.clients() as any[];
    const client = list.find(c => c.id === clientId);
    return client ? (client.telephone || client.phone || '') : '';
  }

  getTeamNames(ids: string[]): string {
    if (!ids || ids.length === 0) return 'Aucune équipe';
    const list = this.teams() as any[];
    return ids.map(id => list.find(t => t.id === id)?.nom || 'Inconnue').join(', ');
  }

  getStaffNames(ids: string[]): string {
    if (!ids || ids.length === 0) return 'Non assigné';
    const list = this.staff() as any[];
    return ids.map(id => {
      const s = list.find(st => st.id === id);
      return s ? `${s.nom} ${s.prenom || ''}` : 'Inconnu';
    }).join(', ');
  }

  // --- Gestion Calendrier ---

  goToToday() { this.viewDate.set(new Date()); }
  prevMonth() { const d = this.viewDate(); this.viewDate.set(new Date(d.getFullYear(), d.getMonth() - 1, 1)); }
  nextMonth() { const d = this.viewDate(); this.viewDate.set(new Date(d.getFullYear(), d.getMonth() + 1, 1)); }

  // Ouverture du Popup
  onReservationClick(res: any, event: Event) {
    event.stopPropagation();
    // On enrichit l'objet pour l'affichage facile dans le HTML
    const enrichedRes = {
      ...res,
      clientName: this.getClientName(res.clientId),
      clientPhone: this.getClientPhone(res.clientId),
      teamNames: this.getTeamNames(res.assignedTeamIds),
      staffNames: this.getStaffNames(res.assignedServerIds)
    };
    this.selectedReservation.set(enrichedRes);
  }

  closeModal() { this.selectedReservation.set(null); }

  // --- Calculs Grille ---

  calendarDays = computed(() => {
    const year = this.viewDate().getFullYear();
    const month = this.viewDate().getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const days: any[] = [];

    // Jours vides début mois
    for (let i = 0; i < firstDay.getDay(); i++) {
      days.push({ id: `pad-${i}`, date: null, isPast: false });
    }

    // Jours du mois
    for (let i = 1; i <= lastDay.getDate(); i++) {
      const current = new Date(year, month, i);
      const isToday = new Date().toDateString() === current.toDateString();
      const isPast = current < new Date(new Date().setHours(0,0,0,0));

      // Filtrer les résas du jour
      const dailyRes = this.myReservations().filter(r => {
        const d = this.parseDate(r.date);
        return d && d.getDate() === i && d.getMonth() === month && d.getFullYear() === year;
      }).map(r => ({
        ...r,
        clientName: this.getClientName(r.clientId)
      }));

      days.push({ id: `day-${i}`, date: current, isToday, isPast, reservations: dailyRes });
    }
    return days;
  });

  private parseDate(val: any): Date | null {
    if (!val) return null;
    if (val.toDate) return val.toDate();
    if (val instanceof Date) return val;
    return new Date(val);
  }

  getReservationsForSlot(day: any, slot: string): any[] {
    if (!day.reservations) return [];
    return day.reservations.filter((r: any) => 
      (r.slotId || '').toLowerCase().includes(slot) || 
      (r.selectedSlotId || '').toLowerCase().includes(slot)
    );
  }

  getSlotClass(day: any, slot: string): string {
    if (day.isPast) return 'bg-slate-50 text-slate-300';
    const hasRes = this.getReservationsForSlot(day, slot).length > 0;
    return hasRes ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'bg-white border-slate-100 text-slate-300';
  }
}
EOF

echo "Correction appliquée. L'erreur 'this.userState is not a function' devrait être résolue."