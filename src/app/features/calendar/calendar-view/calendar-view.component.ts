import { Component, inject, signal, computed } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { toSignal } from '@angular/core/rxjs-interop';
import { ReservationService } from '../../../core/services/reservation.service';
import { ClientService } from '../../../core/services/client.service';
import { UiService } from '../../../core/services/ui.service';
import { map } from 'rxjs/operators';

@Component({
  selector: 'app-calendar-view',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './calendar-view.component.html',
  styles: []
})
export class CalendarViewComponent {

  private router = inject(Router);
  private reservationService = inject(ReservationService);
  private clientService = inject(ClientService);
  private ui = inject(UiService);

  viewDate = signal(new Date());
  
  // FILTRE : On masque les réservations annulées dans le calendrier
  rawReservations = toSignal(
    this.reservationService.getReservations().pipe(
      map(list => list.filter(r => r.status !== 'CANCELLED'))
    ), 
    { initialValue: [] }
  );
  
  rawClients = toSignal(this.clientService.getAll(), { initialValue: [] });

  private parseReservationDate(value: any): Date | null {
    if (!value) return null;
    if (value?.toDate) return value.toDate();
    if (value instanceof Date) return value;
    if (typeof value === 'string') {
      if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
        return new Date(value + 'T00:00:00');
      }
      const d = new Date(value);
      return isNaN(d.getTime()) ? null : d;
    }
    return null;
  }

  private isSameDay(a: Date, b: Date): boolean {
    return a.getFullYear() === b.getFullYear()
        && a.getMonth() === b.getMonth()
        && a.getDate() === b.getDate();
  }

  private isPastDate(d: Date): boolean {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const target = new Date(d);
    target.setHours(0, 0, 0, 0);
    return target < today;
  }

  goToToday() {
    this.viewDate.set(new Date());
  }

  onSlotClick(day: any, slot: string) {
    if (!day.date) return;
    
    if (day.isPast) {
      this.ui.showToast('info', 'Impossible de réserver une date passée');
      return;
    }

    const dateStr = new Date(day.date.getTime() - (day.date.getTimezoneOffset() * 60000))
      .toISOString().split('T')[0];

    this.router.navigate(['/reservations/new'], {
      queryParams: { date: dateStr, slotId: slot }
    });
  }

  onReservationClick(res: any, event: Event) {
    event.stopPropagation();
    this.router.navigate(['/reservations/edit', res.id]);
  }

  calendarDays = computed(() => {
    const year = this.viewDate().getFullYear();
    const month = this.viewDate().getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);

    const days: any[] = [];
    const clients = this.rawClients();

    for (let i = 0; i < firstDay.getDay(); i++) {
      days.push({ id: `pad-prev-${i}`, date: null, isToday: false, isPast: false, reservations: [] });
    }

    for (let i = 1; i <= lastDay.getDate(); i++) {
      const current = new Date(year, month, i);
      const isToday = new Date().toDateString() === current.toDateString();
      const isPast = this.isPastDate(current);

      const dailyRes = this.rawReservations()
        .filter((r: any) => {
          const rDate = this.parseReservationDate(r.date);
          return !!rDate && this.isSameDay(rDate, current);
        })
        .map((r: any) => {
          const client = clients.find((c: any) => c.id === r.clientId);
          let name = 'Réservé';
          if (client) name = `${client.nom || ''} ${client.prenom || ''}`.trim() || 'Client sans nom';
          return { ...r, clientName: name };
        });

      days.push({
        id: `day-${i}`,
        date: current,
        isToday,
        isPast,
        reservations: dailyRes
      });
    }

    return days;
  });

  prevMonth() {
    const d = this.viewDate();
    this.viewDate.set(new Date(d.getFullYear(), d.getMonth() - 1, 1));
  }

  nextMonth() {
    const d = this.viewDate();
    this.viewDate.set(new Date(d.getFullYear(), d.getMonth() + 1, 1));
  }

  getReservationsForSlot(day: any, slot: string): any[] {
    if (!day.reservations) return [];
    return day.reservations.filter((r: any) => {
      if (!r.slotId) return true;
      const id = String(r.slotId || '').toLowerCase();
      const s = String(slot || '').toLowerCase();
      return id === s || id.includes(s);
    });
  }

  getSlotClass(day: any, slotType: string): string {
    if (day.isPast) {
      return 'bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed';
    }

    const res = this.getReservationsForSlot(day, slotType);
    const isOccupied = res.length > 0;
    
    return !isOccupied
      ? 'bg-green-50 border-green-200 hover:bg-green-100 text-green-700'
      : 'bg-white border-slate-100 text-slate-300';
  }

  getReservationClass(res: any): string {
    if (res.type === 'PACK' || res.packId || (res.packs && res.packs.length > 0)) {
      return 'bg-blue-600 text-white border border-blue-700';
    }
    if (res.services && res.services.length > 0) {
      return 'bg-orange-500 text-white border border-orange-600';
    }
    return 'bg-red-500 text-white border border-red-600';
  }
}
