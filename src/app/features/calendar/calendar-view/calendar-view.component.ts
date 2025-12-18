import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ReservationService } from '../../../core/services/reservation.service';
import { StaffService } from '../../../core/services/staff.service';
import { TeamService } from '../../../core/services/team.service';
import { UiService } from '../../../core/services/ui.service';
import { Reservation } from '../../../core/models/reservation.model';
import { toSignal } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';

@Component({
  selector: 'app-calendar-view',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="p-6 max-w-7xl mx-auto">
      <div class="flex justify-between items-center mb-8">
        <div>
          <h1 class="text-3xl font-extrabold text-slate-900 tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600">Calendrier</h1>
          <p class="text-slate-500 font-medium">{{ viewDate | date:'MMMM yyyy' | titlecase }}</p>
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
                 class="min-h-[160px] flex flex-col transition-colors">
              
              <div class="p-2 flex justify-end">
                <span [class.bg-blue-600]="day.isToday" [class.text-white]="day.isToday"
                      class="text-xs font-black w-6 h-6 flex items-center justify-center rounded-full text-slate-400">
                  {{ day.date.getDate() }}
                </span>
              </div>
              
              <div class="flex-1 flex flex-col px-1 pb-1 gap-0.5 overflow-hidden">
                
                <div class="flex-1 border-t border-slate-100/50 p-0.5 relative group min-h-[40px]">
                  <span class="absolute right-0.5 top-0 text-[7px] text-slate-300 font-bold uppercase group-hover:text-blue-400 transition-colors">Matin</span>
                  @for (res of getResBySlot(day.reservations, 'MATIN'); track res.id) {
                    <div (click)="openDetails(res)" class="res-badge res-confirmed">
                      <span class="truncate">{{ res.clientName }}</span>
                    </div>
                  }
                </div>

                <div class="flex-1 border-t border-slate-100/50 p-0.5 relative group min-h-[40px]">
                  <span class="absolute right-0.5 top-0 text-[7px] text-slate-300 font-bold uppercase group-hover:text-amber-400 transition-colors">A.M</span>
                  @for (res of getResBySlot(day.reservations, 'APRES-MIDI'); track res.id) {
                    <div (click)="openDetails(res)" class="res-badge res-pending">
                      <span class="truncate">{{ res.clientName }}</span>
                    </div>
                  }
                </div>

                <div class="flex-1 border-t border-slate-100/50 p-0.5 relative group min-h-[40px]">
                  <span class="absolute right-0.5 top-0 text-[7px] text-slate-300 font-bold uppercase group-hover:text-purple-400 transition-colors">Soir</span>
                  @for (res of getResBySlot(day.reservations, 'SOIR'); track res.id) {
                    <div (click)="openDetails(res)" class="res-badge res-evening">
                      <span class="truncate">{{ res.clientName }}</span>
                    </div>
                  }
                </div>

              </div>
            </div>
          }
        </div>
      </div>

      @if (selectedReservation()) {
        <div class="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in" (click)="closeDetails()">
          <div class="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]" (click)="$event.stopPropagation()">
            
            <div class="bg-gradient-to-r from-slate-800 to-slate-900 px-6 py-4 flex justify-between items-center text-white shrink-0">
              <div>
                <h3 class="font-bold text-xl">{{ selectedReservation()?.clientName }}</h3>
                <p class="text-slate-400 text-xs mt-1">{{ selectedReservation()?.date | date:'fullDate' }}</p>
              </div>
              <button (click)="closeDetails()" class="text-slate-400 hover:text-white transition"><span class="material-icons">close</span></button>
            </div>

            <div class="p-6 space-y-6 overflow-y-auto custom-scrollbar">
              <div class="bg-purple-50 p-4 rounded-xl border border-purple-100 shadow-sm">
                <div class="flex justify-between items-center mb-3 border-b border-purple-200 pb-2">
                  <span class="text-xs font-bold text-purple-700 uppercase tracking-wider">Trésorerie</span>
                  <button (click)="goToPayments()" class="text-purple-600 hover:bg-purple-100 p-1 rounded transition flex items-center">
                    <span class="material-icons text-sm mr-1">payments</span> <span class="text-xs font-bold">Gérer</span>
                  </button>
                </div>
                <div class="grid grid-cols-3 gap-2 text-center">
                  <div><p class="text-[10px] text-slate-500 uppercase">Total</p><p class="font-bold text-slate-800">{{ selectedReservation()?.totalPrice }} DT</p></div>
                  <div><p class="text-[10px] text-slate-500 uppercase">Reçu</p><p class="font-bold text-emerald-600">{{ selectedReservation()?.advance }} DT</p></div>
                  <div><p class="text-[10px] text-slate-500 uppercase">Reste</p><p class="font-bold text-red-500">{{ (selectedReservation()?.totalPrice || 0) - (selectedReservation()?.advance || 0) }} DT</p></div>
                </div>
              </div>

              <div>
                <div class="flex items-center justify-between mb-3">
                  <h4 class="text-xs font-bold text-slate-500 uppercase tracking-wider">Affectation Équipe Personnel</h4>
                  <span class="text-xs bg-slate-100 px-2 py-1 rounded text-slate-600 font-bold">{{ (selectedReservation()?.assignedServerIds || []).length }} membres</span>
                </div>
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  @for (staff of allStaff(); track staff.id) {
                    <div (click)="toggleStaffAssignment(staff.id!)" 
                         class="flex items-center p-2 rounded-lg border cursor-pointer select-none transition-all duration-200"
                         [class.border-emerald-500]="isStaffAssigned(staff.id!)" [class.bg-emerald-50]="isStaffAssigned(staff.id!)" [class.border-slate-200]="!isStaffAssigned(staff.id!)">
                      <div class="w-6 h-6 rounded-full flex items-center justify-center text-[10px] mr-2"
                           [class.bg-emerald-500]="isStaffAssigned(staff.id!)" [class.text-white]="isStaffAssigned(staff.id!)" [class.bg-slate-200]="!isStaffAssigned(staff.id!)">
                         @if (isStaffAssigned(staff.id!)) { <span class="material-icons text-[14px]">check</span> }
                         @else { {{ staff.nom.charAt(0) }} }
                      </div>
                      <div class="flex-1 min-w-0">
                        <p class="text-sm font-bold truncate">{{ staff.nom }}</p>
                        <p class="text-[10px] text-slate-500 truncate">{{ staff.specialite }}</p>
                      </div>
                    </div>
                  }
                </div>
              </div>

              <div>
                <div class="flex items-center justify-between mb-3 border-t border-slate-100 pt-4">
                  <h4 class="text-xs font-bold text-slate-500 uppercase tracking-wider">Affectation Prestataires</h4>
                  <span class="text-xs bg-slate-100 px-2 py-1 rounded text-slate-600 font-bold">{{ (selectedReservation()?.assignedTeamIds || []).length }} équipes</span>
                </div>
                <div class="grid grid-cols-1 gap-2">
                  @for (team of allTeams(); track team.id) {
                    <div (click)="toggleTeamAssignment(team.id!)" 
                         class="flex items-center justify-between p-2.5 rounded-lg border cursor-pointer transition-all duration-200"
                         [class.border-purple-500]="isTeamAssigned(team.id!)" [class.bg-purple-50]="isTeamAssigned(team.id!)" [class.border-slate-200]="!isTeamAssigned(team.id!)">
                      <div class="flex items-center gap-3">
                        <div class="w-7 h-7 rounded-full flex items-center justify-center"
                             [class.bg-purple-500]="isTeamAssigned(team.id!)" [class.text-white]="isTeamAssigned(team.id!)"
                             [class.bg-slate-200]="!isTeamAssigned(team.id!)" [class.text-slate-500]="!isTeamAssigned(team.id!)">
                          <span class="material-icons text-sm">{{ team.type === 'ORCHESTRE' ? 'music_note' : 'groups' }}</span>
                        </div>
                        <div><p class="text-sm font-bold">{{ team.nom }}</p><p class="text-[10px] uppercase text-slate-500">{{ team.type }}</p></div>
                      </div>
                      @if(isTeamAssigned(team.id!)){ <span class="material-icons text-purple-600 text-sm">check_circle</span> }
                    </div>
                  }
                </div>
              </div>
            </div>

            <div class="bg-slate-50 px-6 py-4 border-t border-slate-200 flex justify-between shrink-0">
              <button (click)="deleteRes()" class="text-red-500 font-bold flex items-center hover:bg-red-50 px-4 py-2 rounded-lg transition"><span class="material-icons text-sm mr-2">delete</span> Supprimer</button>
              <button (click)="editRes()" class="bg-slate-800 text-white px-6 py-2 rounded-xl font-bold flex items-center hover:bg-slate-700 transition"><span class="material-icons text-sm mr-2">edit</span> Éditer tout</button>
            </div>
          </div>
        </div>
      }
    </div>
  `,
  styles: [`
    .custom-scrollbar::-webkit-scrollbar { width: 4px; }
    .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 10px; }
    .res-badge {
      padding: 2px 6px;
      border-radius: 4px;
      font-size: 10px;
      font-weight: 800;
      cursor: pointer;
      border: 1px solid transparent;
      transition: all 0.2s;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      margin-bottom: 2px;
    }
    .res-confirmed { background-color: #ecfdf5; color: #065f46; border-color: #a7f3d0; }
    .res-pending { background-color: #fffbeb; color: #92400e; border-color: #fde68a; }
    .res-evening { background-color: #f5f3ff; color: #5b21b6; border-color: #ddd6fe; }
    .res-badge:hover { transform: scale(1.02); filter: brightness(0.95); }
  `]
})
export class CalendarViewComponent implements OnInit {
  private reservationService = inject(ReservationService);
  private staffService = inject(StaffService);
  private teamService = inject(TeamService);
  private ui = inject(UiService);
  router = inject(Router);

  viewDate = new Date();
  reservations = toSignal(this.reservationService.getAll(), { initialValue: [] });
  allStaff = toSignal(this.staffService.getAll(), { initialValue: [] });
  allTeams = toSignal(this.teamService.getAll(), { initialValue: [] });

  selectedReservation = signal<Reservation | null>(null);

  calendarDays = computed(() => {
    const year = this.viewDate.getFullYear();
    const month = this.viewDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    
    let startOffset = firstDay.getDay() - 1;
    if (startOffset === -1) startOffset = 6;

    const days = [];
    const prevMonthLastDay = new Date(year, month, 0).getDate();
    
    for (let i = startOffset; i > 0; i--) {
      const d = new Date(year, month - 1, prevMonthLastDay - i + 1);
      days.push({ date: d, dateString: d.toISOString().split('T')[0], isCurrentMonth: false, isToday: false, reservations: [] });
    }

    const today = new Date();
    for (let i = 1; i <= lastDay.getDate(); i++) {
      const d = new Date(year, month, i);
      const ds = d.toISOString().split('T')[0];
      const res = this.reservations().filter(r => r.date === ds);
      days.push({
        date: d,
        dateString: ds,
        isCurrentMonth: true,
        isToday: d.toDateString() === today.toDateString(),
        reservations: res
      });
    }

    const remainingDays = 42 - days.length;
    for (let i = 1; i <= remainingDays; i++) {
      const d = new Date(year, month + 1, i);
      days.push({ date: d, dateString: d.toISOString().split('T')[0], isCurrentMonth: false, isToday: false, reservations: [] });
    }
    return days;
  });

  ngOnInit() {}

  getResBySlot(reservations: Reservation[], slotLabel: string): Reservation[] {
    return reservations.filter(r => {
      const st = r.startTime || '';
      if (slotLabel === 'MATIN') return st < '12:00';
      if (slotLabel === 'APRES-MIDI') return st >= '12:00' && st < '18:00';
      if (slotLabel === 'SOIR') return st >= '18:00';
      return false;
    });
  }

  previousMonth() { this.viewDate = new Date(this.viewDate.getFullYear(), this.viewDate.getMonth() - 1, 1); this.selectedReservation.set(null); }
  nextMonth() { this.viewDate = new Date(this.viewDate.getFullYear(), this.viewDate.getMonth() + 1, 1); this.selectedReservation.set(null); }
  today() { this.viewDate = new Date(); this.selectedReservation.set(null); }

  openDetails(res: Reservation) { this.selectedReservation.set(res); }
  closeDetails() { this.selectedReservation.set(null); }
  
  editRes() { if (this.selectedReservation()?.id) this.router.navigate(['/reservations/edit', this.selectedReservation()?.id]); }
  goToPayments() { this.router.navigate(['/payments'], { queryParams: { resId: this.selectedReservation()?.id } }); }

  async deleteRes() {
    const res = this.selectedReservation();
    if (res?.id && await this.ui.confirm('Supprimer ?', 'Confirmer la suppression ?')) {
      await this.reservationService.delete(res.id);
      this.closeDetails();
      this.ui.showToast('success', 'Supprimée');
    }
  }

  isStaffAssigned(staffId: string): boolean { return !!this.selectedReservation()?.assignedServerIds?.includes(staffId); }
  async toggleStaffAssignment(staffId: string) {
    const res = this.selectedReservation();
    if (!res?.id) return;
    const current = res.assignedServerIds || [];
    const updated = current.includes(staffId) ? current.filter((id: any) => id !== staffId) : [...current, staffId];
    await this.reservationService.update(res.id, { assignedServerIds: updated } as any);
    this.selectedReservation.update(p => p ? { ...p, assignedServerIds: updated } : null);
  }

  isTeamAssigned(teamId: string): boolean { return !!this.selectedReservation()?.assignedTeamIds?.includes(teamId); }
  async toggleTeamAssignment(teamId: string) {
    const res = this.selectedReservation();
    if (!res?.id) return;
    const current = res.assignedTeamIds || [];
    const updated = current.includes(teamId) ? current.filter((id: any) => id !== teamId) : [...current, teamId];
    await this.reservationService.update(res.id, { assignedTeamIds: updated } as any);
    this.selectedReservation.update(p => p ? { ...p, assignedTeamIds: updated } : null);
  }
}
