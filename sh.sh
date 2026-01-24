#!/bin/bash

# Définition des chemins
TS_FILE="src/app/features/calendar/calendar-view/calendar-view.component.ts"
HTML_FILE="src/app/features/calendar/calendar-view/calendar-view.component.html"

echo "🚀 Application du thème 'Rouge Foncé' pour les disponibilités..."

# 1. Mise à jour du TypeScript (Changement des classes CSS)
echo "📝 Mise à jour de $TS_FILE..."
cat << 'EOF' > "$TS_FILE"
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
EOF

# 2. Mise à jour du HTML (Légende & Texte visible)
echo "📝 Mise à jour de $HTML_FILE..."
cat << 'EOF' > "$HTML_FILE"
<div class="flex flex-col bg-white rounded-xl shadow-sm border border-slate-200">
  
  <div class="flex flex-wrap items-center gap-4 p-4 border-b border-slate-200 bg-white text-xs font-medium text-slate-600">
    <div class="flex items-center gap-2">
      <div class="w-4 h-4 bg-red-800 border border-red-900 rounded"></div>
      <span>Disponible</span>
    </div>
    <div class="flex items-center gap-2">
      <div class="w-4 h-4 bg-emerald-500 rounded shadow-sm"></div>
      <span>Occupé (Location Salle)</span>
    </div>
    <div class="flex items-center gap-2">
      <div class="w-4 h-4 bg-orange-500 rounded shadow-sm"></div>
      <span>Occupé (Pack Complet)</span>
    </div>
    <div class="flex items-center gap-2">
      <div class="w-4 h-4 bg-purple-500 rounded shadow-sm"></div>
      <span>Pack Incomplet</span>
    </div>
  </div>

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
            
            <div class="flex-1 h-full rounded flex items-center justify-center relative overflow-hidden transition-all"
                 [ngClass]="getSlotClass(day, 'matin')" (click)="onSlotClick(day, 'matin')">
              
              <span class="text-[9px] font-bold uppercase tracking-wider opacity-40 z-10" 
                    [class.text-white]="getReservationsForSlot(day, 'matin').length === 0">Matin</span>
              
              @for (res of getReservationsForSlot(day, 'matin'); track res.id) {
                <div class="absolute inset-0 z-20 flex items-center justify-center text-[10px] font-bold shadow-sm cursor-pointer hover:brightness-110 transition-all p-1 text-center leading-tight"
                     [ngClass]="getReservationClass(res)" (click)="onReservationClick(res, $event)">
                  {{ res.clientName }}
                </div>
              }
            </div>

            <div class="flex-1 h-full rounded flex items-center justify-center relative overflow-hidden transition-all"
                 [ngClass]="getSlotClass(day, 'aprem')" (click)="onSlotClick(day, 'aprem')">
              
              <span class="text-[9px] font-bold uppercase tracking-wider opacity-40 z-10"
                    [class.text-white]="getReservationsForSlot(day, 'aprem').length === 0">Aprem</span>

              @for (res of getReservationsForSlot(day, 'aprem'); track res.id) {
                <div class="absolute inset-0 z-20 flex items-center justify-center text-[10px] font-bold shadow-sm cursor-pointer hover:brightness-110 transition-all p-1 text-center leading-tight"
                     [ngClass]="getReservationClass(res)" (click)="onReservationClick(res, $event)">
                  {{ res.clientName }}
                </div>
              }
            </div>

            <div class="flex-1 h-full rounded flex items-center justify-center relative overflow-hidden transition-all"
                 [ngClass]="getSlotClass(day, 'soir')" (click)="onSlotClick(day, 'soir')">
              
              <span class="text-[9px] font-bold uppercase tracking-wider opacity-40 z-10"
                    [class.text-white]="getReservationsForSlot(day, 'soir').length === 0">Soir</span>

              @for (res of getReservationsForSlot(day, 'soir'); track res.id) {
                <div class="absolute inset-0 z-20 flex items-center justify-center text-[10px] font-bold shadow-sm cursor-pointer hover:brightness-110 transition-all p-1 text-center leading-tight"
                     [ngClass]="getReservationClass(res)" (click)="onReservationClick(res, $event)">
                  {{ res.clientName }}
                </div>
              }
            </div>

          </div>
        }
      </div>
    }
  </div>
</div>
EOF

echo "✅ Calendrier mis à jour : Cases libres en rouge foncé."