#!/bin/bash

# apply_opacity_past_days.sh
# 1. Ajoute la propriété 'isPast' aux objets jours.
# 2. Applique [class.opacity-60] et [class.bg-slate-50] sur les jours passés dans le template.

cat > src/app/features/calendar/calendar-view/calendar-view.component.ts << 'EOF'
import { Component, inject, signal, computed } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { toSignal } from '@angular/core/rxjs-interop';
import { ReservationService } from '../../../core/services/reservation.service';
import { ClientService } from '../../../core/services/client.service';
import { UiService } from '../../../core/services/ui.service';

@Component({
  selector: 'app-calendar-view',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="flex flex-col bg-white rounded-xl shadow-sm border border-slate-200">
      
      <div class="flex justify-between items-center p-4 border-b border-slate-100 bg-slate-50">
        
        <button (click)="goToToday()" 
                class="px-3 py-1.5 text-xs font-bold text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 shadow-sm transition">
          Aujourd'hui
        </button>

        <div class="flex items-center gap-4">
          <button (click)="prevMonth()" class="p-2 hover:bg-white hover:shadow-sm rounded-full transition text-slate-600">
            <span class="material-icons">chevron_left</span>
          </button>
          
          <h2 class="text-lg font-bold text-slate-800 capitalize flex items-center gap-2">
            <span class="material-icons text-indigo-500">calendar_month</span>
            {{ viewDate() | date:'MMMM yyyy' }}
          </h2>

          <button (click)="nextMonth()" class="p-2 hover:bg-white hover:shadow-sm rounded-full transition text-slate-600">
            <span class="material-icons">chevron_right</span>
          </button>
        </div>

        <div class="w-[85px]"></div>
      </div>

      <div class="grid grid-cols-7 border-b border-slate-100 bg-slate-50/50">
        <div *ngFor="let d of ['Dim','Lun','Mar','Mer','Jeu','Ven','Sam']"
             class="py-2 text-center text-xs font-bold text-slate-400 uppercase tracking-wider">
          {{ d }}
        </div>
      </div>

      <div class="grid grid-cols-7 bg-slate-100 gap-px border-b border-slate-200">
        @for (day of calendarDays(); track day.id) {
          
          <div class="bg-white min-h-[170px] h-full p-2 flex flex-col gap-2 transition relative group"
               [class.bg-slate-50]="!day.date || day.isPast"
               [class.opacity-60]="day.isPast">
            
            @if (day.date) {
              <div class="flex justify-between items-start">
                <span class="text-xs font-semibold px-2 py-0.5 rounded-full"
                      [class.bg-indigo-600]="day.isToday"
                      [class.text-white]="day.isToday"
                      [class.text-slate-700]="!day.isToday">
                  {{ day.date | date:'d' }}
                </span>
              </div>

              <div class="flex flex-col gap-1 flex-1 h-full mt-1">
                
                <div class="flex-1 h-full rounded border border-dashed flex items-center justify-center relative overflow-hidden transition-colors"
                     [ngClass]="getSlotClass(day, 'matin')" (click)="onSlotClick(day, 'matin')">
                  
                  <span class="text-[9px] font-bold uppercase tracking-wider opacity-60 z-10">Matin</span>
                  
                  @for (res of getReservationsForSlot(day, 'matin'); track res.id) {
                    <div class="absolute inset-0 z-20 flex items-center justify-center text-[10px] font-bold shadow-sm cursor-pointer hover:scale-[1.02] transition-transform p-1 text-center leading-tight"
                         [ngClass]="getReservationClass(res)" (click)="onReservationClick(res, $event)">
                      {{ res.clientName || 'Réservé' }}
                    </div>
                  }
                </div>

                <div class="flex-1 h-full rounded border border-dashed flex items-center justify-center relative overflow-hidden transition-colors"
                     [ngClass]="getSlotClass(day, 'aprem')" (click)="onSlotClick(day, 'aprem')">
                  
                  <span class="text-[9px] font-bold uppercase tracking-wider opacity-60 z-10">Aprem</span>

                  @for (res of getReservationsForSlot(day, 'aprem'); track res.id) {
                    <div class="absolute inset-0 z-20 flex items-center justify-center text-[10px] font-bold shadow-sm cursor-pointer hover:scale-[1.02] transition-transform p-1 text-center leading-tight"
                         [ngClass]="getReservationClass(res)" (click)="onReservationClick(res, $event)">
                      {{ res.clientName || 'Réservé' }}
                    </div>
                  }
                </div>

                <div class="flex-1 h-full rounded border border-dashed flex items-center justify-center relative overflow-hidden transition-colors"
                     [ngClass]="getSlotClass(day, 'soir')" (click)="onSlotClick(day, 'soir')">
                  
                  <span class="text-[9px] font-bold uppercase tracking-wider opacity-60 z-10">Soir</span>

                  @for (res of getReservationsForSlot(day, 'soir'); track res.id) {
                    <div class="absolute inset-0 z-20 flex items-center justify-center text-[10px] font-bold shadow-sm cursor-pointer hover:scale-[1.02] transition-transform p-1 text-center leading-tight"
                         [ngClass]="getReservationClass(res)" (click)="onReservationClick(res, $event)">
                      {{ res.clientName || 'Réservé' }}
                    </div>
                  }
                </div>

              </div>
            }
          </div>
        }
      </div>
    </div>
  `,
  styles: []
})
export class CalendarViewComponent {

  private router = inject(Router);
  private reservationService = inject(ReservationService);
  private clientService = inject(ClientService);
  private ui = inject(UiService);

  viewDate = signal(new Date());
  rawReservations = toSignal(this.reservationService.getReservations(), { initialValue: [] });
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
    
    // Bloque le clic sur le passé
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
      const isPast = this.isPastDate(current); // Calcul ici

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
        isPast, // Ajouté à l'objet jour
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
    const res = this.getReservationsForSlot(day, slotType);
    const isOccupied = res.length > 0;
    
    // Le style "grisé" est géré par l'opacité sur le parent (la div du jour)
    // On garde ici les couleurs standard pour les créneaux, qui seront affectées par l'opacité parent
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
EOF