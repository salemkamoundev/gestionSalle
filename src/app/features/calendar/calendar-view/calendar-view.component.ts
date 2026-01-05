import { Component, inject, signal, computed, ChangeDetectorRef } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { Router } from '@angular/router';
import { ReservationService } from '../../../core/services/reservation.service';
import { ConfigService } from '../../../core/services/config.service';
import { PackService } from '../../../core/services/pack.service'; // AJOUT IMPORT
import { toSignal } from '@angular/core/rxjs-interop';
import { map, tap } from 'rxjs/operators';

@Component({
  selector: 'app-calendar-view',
  standalone: true,
  imports: [CommonModule, DatePipe],
  templateUrl: './calendar-view.component.html'
})
export class CalendarViewComponent {
  private router = inject(Router);
  private reservationService = inject(ReservationService);
  private packService = inject(PackService); // AJOUT INJECTION
  private cdr = inject(ChangeDetectorRef);
  public configService = inject(ConfigService);

  viewDate = signal(new Date());

  // Chargement des packs pour la comparaison
  packs = toSignal(this.packService.getAll(), { initialValue: [] });

  rawReservations = toSignal(
    this.reservationService.getAll().pipe(
      map(list => list.filter(r => String(r.status).toUpperCase() !== 'CANCELLED')),
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
      
      const res = this.getReservationsForSlot(day, slotId);
      
      if (res.length > 0) return 'bg-white border border-slate-100 cursor-pointer';
      
      return 'bg-red-50 hover:bg-red-100 cursor-pointer border border-red-100 transition';
  }

  // LOGIQUE COULEURS CORRIGÉE
  getReservationClass(res: any) {
      // 1. Si c'est un PACK
      if (res.packId) {
          // On cherche le pack original
          const pack = this.packs().find((p: any) => p.id === res.packId);
          
          if (pack && pack.services && Array.isArray(pack.services)) {
              const resServices = res.services || [];
              
              // COMPARAISON : Si la résa a moins de services que le pack original
              // C'est qu'il manque des services => VIOLET
              if (resServices.length < pack.services.length) {
                  return 'bg-purple-500 text-white border-purple-600 shadow-sm';
              }
          }
          
          // Sinon Pack Complet => ORANGE
          return 'bg-orange-500 text-white border-orange-600 shadow-sm';
      }

      // 2. Sinon Location Salle simple => VERT
      return 'bg-emerald-500 text-white border-emerald-600 shadow-sm';
  }

  onSlotClick(day: any, slotId: string) {
      if (!day.date) return;
      this.router.navigate(['/reservations/new'], { queryParams: { date: day.dateStr, slotId: slotId } });
  }

  onReservationClick(res: any, event: Event) {
      event.stopPropagation();
      this.router.navigate(['/reservations/edit', res.id]);
  }
}
