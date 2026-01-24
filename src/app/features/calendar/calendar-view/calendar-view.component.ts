import { Component, inject, signal, computed, ChangeDetectorRef } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { Router } from '@angular/router';
import { ReservationService } from '../../../core/services/reservation.service';
import { ClientService } from '../../../core/services/client.service';
import { ConfigService } from '../../../core/services/config.service';
import { PackService } from '../../../core/services/pack.service';
import { toSignal } from '@angular/core/rxjs-interop';
import { map, tap } from 'rxjs/operators';
import { combineLatest } from 'rxjs';

@Component({
  selector: 'app-calendar-view',
  standalone: true,
  imports: [CommonModule, DatePipe],
  templateUrl: './calendar-view.component.html'
})
export class CalendarViewComponent {
  private router = inject(Router);
  private reservationService = inject(ReservationService);
  private clientService = inject(ClientService);
  private packService = inject(PackService);
  private cdr = inject(ChangeDetectorRef);
  public configService = inject(ConfigService);

  viewDate = signal(new Date());

  packs = toSignal(this.packService.getAll(), { initialValue: [] });

  rawReservations = toSignal(
    combineLatest([
      this.reservationService.getAll(),
      this.clientService.getAll()
    ]).pipe(
      map(([reservations, clients]) => {
        return reservations
          .filter(r => String(r.status).toUpperCase() !== 'CANCELLED')
          .map((res: any) => {
            const client = clients.find((c: any) => c.id === res.clientId);
            let displayName = 'Réservé';
            if (client) {
                displayName = `${client.nom} ${client.prenom}`;
            } else if (res.clientName) {
                displayName = res.clientName;
            } else if (res.customerName) {
                displayName = res.customerName;
            }
            return { ...res, clientName: displayName };
          });
      }),
      tap(() => setTimeout(() => this.cdr.detectChanges(), 0))
    ),
    { initialValue: [] }
  );

  calendarDays = computed(() => {
    const date = this.viewDate();
    const year = date.getFullYear();
    const month = date.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const firstDayIndex = new Date(year, month, 1).getDay();
    let startOffset = firstDayIndex === 0 ? 6 : firstDayIndex - 1;

    const days = [];
    const today = new Date();
    today.setHours(0,0,0,0);

    for (let i = 0; i < startOffset; i++) {
        days.push({ id: `pad-${i}`, date: null, isPast: true });
    }

    for (let i = 1; i <= daysInMonth; i++) {
        const d = new Date(year, month, i);
        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
        const dCheck = new Date(d);
        dCheck.setHours(0,0,0,0);
        
        days.push({
            id: dateStr,
            date: d,
            dateStr: dateStr,
            isCurrentMonth: true,
            isToday: dCheck.getTime() === today.getTime(),
            isPast: dCheck < today
        });
    }
    return days;
  });

  goToToday() { this.viewDate.set(new Date()); }
  prevMonth() { const d = this.viewDate(); this.viewDate.set(new Date(d.getFullYear(), d.getMonth() - 1, 1)); }
  nextMonth() { const d = this.viewDate(); this.viewDate.set(new Date(d.getFullYear(), d.getMonth() + 1, 1)); }

  getReservationsForSlot(day: any, slotId: string) {
    if (!day.dateStr) return [];
    return this.rawReservations().filter((r: any) => {
        if (r.date !== day.dateStr) return false;
        if (slotId === 'aprem') return r.slotId && r.slotId.startsWith('aprem');
        return r.slotId === slotId;
    });
  }

  getSlotClass(day: any, slotId: string) {
      if (!day.date) return 'bg-slate-50 opacity-20 cursor-default';
      
      if (day.isPast) {
          return 'bg-slate-100 opacity-60 cursor-not-allowed';
      }

      const res = this.getReservationsForSlot(day, slotId);
      
      if (res.length > 0) return 'bg-white border border-slate-100 cursor-pointer';
      
      // MODIFICATION ICI : Rouge Foncé pour case libre
      return 'bg-red-800 hover:bg-red-700 cursor-pointer border border-red-900 transition shadow-inner';
  }

  getReservationClass(res: any) {
      if (res.packId) {
          const pack = this.packs().find((p: any) => p.id === res.packId);
          if (pack && pack.services && Array.isArray(pack.services)) {
              const resServices = res.services || [];
              if (resServices.length < pack.services.length) {
                  return 'bg-purple-500 text-white border-purple-600 shadow-sm';
              }
          }
          return 'bg-orange-500 text-white border-orange-600 shadow-sm';
      }
      return 'bg-emerald-500 text-white border-emerald-600 shadow-sm';
  }

  onSlotClick(day: any, slotId: string) {
      if (!day.date || day.isPast) return;
      this.router.navigate(['/reservations/new'], { queryParams: { date: day.dateStr, slotId: slotId } });
  }

  onReservationClick(res: any, event: Event) {
      event.stopPropagation();
      this.router.navigate(['/reservations/edit', res.id]);
  }
}
