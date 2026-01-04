import { Component, inject, signal, computed, effect } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { Router } from '@angular/router';
import { ReservationService } from '../../../core/services/reservation.service';
import { ConfigService } from '../../../core/services/config.service';
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
  public configService = inject(ConfigService);

  viewDate = signal(new Date());

  // SIGNAL PRINCIPAL : Contient la liste brute venant de Firebase
  // Le filtrage se fait ici pour garantir que le reste du composant ne voit JAMAIS les annulés
  rawReservations = toSignal(
    this.reservationService.getReservations().pipe(
      tap(list => console.log('📅 Calendrier: Réception de', list.length, 'réservations brutes')),
      map(list => list.filter(r => {
          // LOGIQUE DE FILTRAGE STRICTE
          const isCancelled = r.status === 'CANCELLED';
          if(isCancelled) console.log('🚫 Masquage réservation annulée:', r.id);
          return !isCancelled;
      }))
    ),
    { initialValue: [] }
  );

  // Génération de la grille (Jours)
  calendarDays = computed(() => {
    const date = this.viewDate();
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();

    const days = [];
    let startDayOfWeek = firstDay.getDay(); 
    if (startDayOfWeek === 0) startDayOfWeek = 7;
    const emptySlotsBefore = startDayOfWeek - 1;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (let i = 0; i < emptySlotsBefore; i++) {
        days.push({ id: `prev-${i}`, date: null, isCurrentMonth: false, isPast: true });
    }

    const todayStr = new Date().toISOString().split('T')[0];
    for (let i = 1; i <= daysInMonth; i++) {
        const d = new Date(year, month, i);
        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
        
        const dCheck = new Date(d);
        dCheck.setHours(0,0,0,0);
        const isPast = dCheck < today;

        days.push({
            id: dateStr,
            date: d,
            dateStr: dateStr,
            isCurrentMonth: true,
            isToday: dateStr === todayStr,
            isPast: isPast // Propriété requise pour le HTML
        });
    }
    return days;
  });

  // NAVIGATION
  goToToday() { this.viewDate.set(new Date()); }
  prevMonth() { const d = this.viewDate(); this.viewDate.set(new Date(d.getFullYear(), d.getMonth() - 1, 1)); }
  nextMonth() { const d = this.viewDate(); this.viewDate.set(new Date(d.getFullYear(), d.getMonth() + 1, 1)); }

  // AFFICHAGE
  getReservationsForSlot(day: any, slotId: string) {
    if (!day.dateStr) return [];
    
    // On utilise la liste DÉJÀ FILTRÉE
    return this.rawReservations().filter((r: any) => {
        if (r.date !== day.dateStr) return false;
        if (slotId === 'aprem') return r.slotId && r.slotId.startsWith('aprem');
        return r.slotId === slotId;
    });
  }

  getSlotClass(day: any, slotId: string) {
      if (!day.date) return 'bg-slate-50 opacity-20 cursor-default';
      const res = this.getReservationsForSlot(day, slotId);
      if (res.length > 0) return 'bg-white hover:bg-slate-50 transition min-h-[80px] border border-slate-100';
      return 'bg-white hover:bg-blue-50 cursor-pointer transition min-h-[80px] border border-slate-100';
  }

  getReservationClass(res: any) {
      const isPaid = (res.advance || 0) >= (res.totalPrice || 0);
      if (res.status === 'COMPLETED') return 'bg-slate-600 text-white border-slate-700';
      if (isPaid) return 'bg-emerald-500 text-white border-emerald-600 shadow-sm';
      if ((res.advance || 0) > 0) return 'bg-orange-400 text-white border-orange-500 shadow-sm';
      return 'bg-red-500 text-white border-red-600 shadow-sm';
  }

  // INTERACTIONS
  onSlotClick(day: any, slotId: string) {
      if (!day.date) return;
      this.router.navigate(['/reservations/new'], { queryParams: { date: day.dateStr, slotId: slotId } });
  }

  onReservationClick(res: any, event: Event) {
      event.stopPropagation();
      this.router.navigate(['/reservations/edit', res.id]);
  }
}
