import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ReservationService } from '../../../core/services/reservation.service';
import { Reservation } from '../../../core/models/reservation.model';
import { toSignal, toObservable } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';

import { switchMap, map } from 'rxjs';
@Component({
  selector: 'app-calendar-view',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="p-6 max-w-7xl mx-auto">
      <div class="flex justify-between items-center mb-8">
        <div>
          <h1 class="text-3xl font-black text-slate-900 tracking-tight">Calendrier</h1>
          <p class="text-slate-500 font-medium">{{ viewDate() | date:'MMMM yyyy' | titlecase }}</p>
        </div>
        <div class="flex items-center gap-3">
          <div class="flex bg-white rounded-lg shadow-sm border border-slate-200 p-1 mr-4">
            <button (click)="previousMonth()" class="p-2 hover:bg-slate-50 rounded-md transition"><span class="material-icons">chevron_left</span></button>
            <button (click)="today()" class="px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-50 rounded-md transition border-x border-slate-100">Aujourd'hui</button>
            <button (click)="nextMonth()" class="p-2 hover:bg-slate-50 rounded-md transition"><span class="material-icons">chevron_right</span></button>
          </div>
          <button (click)="router.navigate(['/reservations/new'])" class="bg-blue-600 text-white px-6 py-2.5 rounded-xl font-bold shadow-lg hover:bg-blue-700 transition flex items-center">
            <span class="material-icons mr-2">add</span> Nouvelle Réservation
          </button>
        </div>
      </div>

      <div class="bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
        <div class="grid grid-cols-7 bg-slate-50 border-b border-slate-200">
          @for (day of ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']; track day) {
            <div class="py-4 text-center text-xs font-black text-slate-400 uppercase tracking-widest">{{ day }}</div>
          }
        </div>

        <div class="grid grid-cols-7 gap-px bg-slate-200">
          @for (day of calendarDays(); track day.dateString) {
            <div [class.bg-slate-50]="!day.isCurrentMonth" [class.bg-white]="day.isCurrentMonth" 
                 class="min-h-[180px] flex flex-col transition-colors">
              
              <div class="p-2 flex justify-end">
                <span [class.bg-blue-600]="day.isToday" [class.text-white]="day.isToday"
                      class="text-xs font-black w-6 h-6 flex items-center justify-center rounded-full text-slate-400">
                  {{ day.date.getDate() }}
                </span>
              </div>
              
              <div class="flex-1 flex flex-col px-1 pb-1 gap-1">
                @for (slot of ['MATIN', 'APRES-MIDI', 'SOIR']; track slot) {
                  <div (click)="onSlotClick(day, slot)" 
                       class="flex-1 rounded border border-dashed border-slate-100 hover:border-blue-300 hover:bg-blue-50/50 transition-all cursor-pointer p-1 relative group">
                    <span class="absolute right-1 top-0 text-[7px] text-slate-300 font-bold uppercase group-hover:text-blue-500">{{ slot }}</span>
                    
                    @for (res of getResBySlot(day.reservations, slot); track res.id) {
                      <div (click)="onEditReservation(res, $event)" 
                           class="p-1 rounded text-[10px] font-black border truncate mb-1 shadow-sm transition-transform hover:scale-[1.02]"
                           [class.bg-emerald-50]="res.status === 'CONFIRMED'" [class.border-emerald-200]="res.status === 'CONFIRMED'" [class.text-emerald-700]="res.status === 'CONFIRMED'"
                           [class.bg-amber-50]="res.status === 'PENDING'" [class.border-amber-200]="res.status === 'PENDING'" [class.text-amber-700]="res.status === 'PENDING'">
                        {{ res.clientName }}
                      </div>
                    }
                  </div>
                }
              </div>
            </div>
          }
        </div>
      </div>
    </div>
  `,
  styles: []
})
export class CalendarViewComponent implements OnInit {
  private reservationService = inject(ReservationService);
  router = inject(Router);

  viewDate = signal(new Date());

  /* MONTH_RANGE_LOADING */
    private monthReservations$ = toObservable(this.viewDate).pipe(
    map(d => {
      const start = new Date(d.getFullYear(), d.getMonth(), 1);
      const end = new Date(d.getFullYear(), d.getMonth() + 1, 0);
      const startStr = start.toISOString().slice(0, 10);
      const endStr = end.toISOString().slice(0, 10);
      return { startStr, endStr };
    }),
    switchMap(r => this.reservationService.getRange(r.startStr, r.endStr))
  );
  reservations = toSignal(this.monthReservations$, { initialValue: [] });

  calendarDays = computed(() => {
    const year = this.viewDate().getFullYear();
    const month = this.viewDate().getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    
    let startOffset = firstDay.getDay() - 1;
    if (startOffset === -1) startOffset = 6;

    const days: any[] = [];
    const todayStr = new Date().toDateString();

    // Jours du mois précédent
    for (let i = startOffset; i > 0; i--) {
      const d: Date = new Date(year, month, -i + 1);
      days.push({ 
        date: d, 
        dateString: d.toISOString().split('T')[0], 
        isCurrentMonth: false, 
        isToday: false, 
        reservations: [] 
      });
    }

    // Jours du mois actuel
    for (let i = 1; i <= lastDay.getDate(); i++) {
      const d: Date = new Date(year, month, i);
      const ds = d.toISOString().split('T')[0];
      days.push({
        date: d,
        dateString: ds,
        isCurrentMonth: true,
        isToday: d.toDateString() === todayStr,
        reservations: this.reservations().filter(r => r.date === ds)
      });
    }

    // Jours du mois suivant pour compléter la grille de 42 cases
    const totalDaysNeeded = 42;
    const currentLength = days.length;
    for (let i = 1; i <= (totalDaysNeeded - currentLength); i++) {
      const d: Date = new Date(year, month + 1, i);
      days.push({ 
        date: d, 
        dateString: d.toISOString().split('T')[0], 
        isCurrentMonth: false, 
        isToday: false, 
        reservations: [] 
      });
    }
    return days;
  });

  ngOnInit() {}

  getResBySlot(reservations: Reservation[], slot: string): Reservation[] {
    return reservations.filter(r => {
      const st = r.startTime || '';
      if (slot === 'MATIN') return st < '12:00';
      if (slot === 'APRES-MIDI') return st >= '12:00' && st < '18:00';
      return st >= '18:00';
    });
  }

  onSlotClick(day: any, slot: string) {
    if (!day.dateString) return;
    const slotId = slot === 'MATIN' ? 'matin' : slot === 'APRES-MIDI' ? 'aprem' : 'soir';
    this.router.navigate(['/reservations/new'], { 
      queryParams: { date: day.dateString, slotId: slotId } 
    });
  }

  onEditReservation(res: Reservation, event: Event) {
    event.stopPropagation();
    if (res.id) {
      this.router.navigate(['/reservations/edit', res.id]);
    }
  }

  previousMonth() {
    const d = this.viewDate();
    this.viewDate.set(new Date(d.getFullYear(), d.getMonth() - 1, 1));
  }
  nextMonth() {
    const d = this.viewDate();
    this.viewDate.set(new Date(d.getFullYear(), d.getMonth() + 1, 1));
  }
  today() { 
    this.viewDate = signal(new Date());

  /* MONTH_RANGE_LOADING */ 
  }

  // --- COLOR LOGIC AUTOMATED ---

  /**
   * Couleur de fond de la case "Jour"
   * - Vide : Vert clair
   * - Occupé : Blanc (par défaut) ou autre
   */
  getDayClass(day: any): string {
    const hasReservations = day.reservations && day.reservations.length > 0;
    // Si aucune réservation -> Vert (libre), sinon Blanc
    return !hasReservations ? 'bg-green-50 hover:bg-green-100' : 'bg-white';
  }

  /**
   * Couleur de la pastille "Réservation"
   * - Pack : Bleu
   * - Salle + Service : Orange
   * - Salle seule : Rouge
   */
  getReservationClass(res: any): string {
    if (!res) return '';

    // 1. PACK (Bleu)
    // On vérifie si c'est explicitement un type PACK ou s'il contient des packs
    if (res.type === 'PACK' || res.packId || (res.packs && res.packs.length > 0)) {
      return 'bg-blue-600 text-white border-l-4 border-blue-800 shadow-sm opacity-90 hover:opacity-100';
    }

    // 2. SALLE + SERVICES (Orange)
    // On vérifie s'il y a des services associés
    if (res.services && res.services.length > 0) {
      return 'bg-orange-500 text-white border-l-4 border-orange-700 shadow-sm opacity-90 hover:opacity-100';
    }

    // 3. SALLE SEULE / DÉFAUT (Rouge)
    return 'bg-red-500 text-white border-l-4 border-red-700 shadow-sm opacity-90 hover:opacity-100';
  }

  /**
   * Couleur d'un SLOT (Matin ou Soir)
   * - Vert : Vide
   * - Blanc/Rouge : Occupé (selon la logique de réservation)
   */
  getSlotClass(day: any, slotType: string): string {
    // Vérifier s'il y a une réservation pour ce slot précis
    const isOccupied = day.reservations && day.reservations.some((r: any) => 
        (r.slotId && r.slotId.toLowerCase() === slotType) || 
        (!r.slotId) // Si pas de slotId, on considère que ça prend toute la journée ? À ajuster.
    );

    // Si LIBRE -> Vert clair + Bordure verte
    if (!isOccupied) {
      return 'bg-green-50 border-green-200 hover:bg-green-100 cursor-pointer';
    }
    
    // Si OCCUPÉ -> Blanc (les pastilles de réservation feront la couleur)
    return 'bg-white border-slate-200';
  }
}
