#!/bin/bash

# ==============================================================================
# TITRE : Calendar Click Interactions
# DESCRIPTION : Gestion du clic sur les jours (Vide -> Ajout, Plein -> Menu Choix)
# ==============================================================================

set -euo pipefail

# Couleurs
COLOR_RESET='\033[0m'
COLOR_SUCCESS='\033[0;32m'
COLOR_INFO='\033[0;36m'

log_info() { echo -e "${COLOR_INFO}[INFO] $1${COLOR_RESET}"; }
log_success() { echo -e "${COLOR_SUCCESS}[OK] $1${COLOR_RESET}"; }

# Vérification racine
if [ ! -f "angular.json" ]; then
    echo "Erreur : Exécute ce script à la racine du projet."
    exit 1
fi

# ==============================================================================
# ÉTAPE 1 : PRE-REMPLISSAGE DATE DANS LE FORMULAIRE
# ==============================================================================
log_info "Mise à jour du ReservationFormComponent pour lire l'URL..."

cat <<'EOF' > src/app/features/calendar/reservation-form/reservation-form.component.ts
import { Component, inject, signal, computed, OnInit, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ReservationService } from '../../../core/services/reservation.service';
import { ClientService } from '../../../core/services/client.service';
import { StaffService } from '../../../core/services/staff.service';
import { ConfigService, TimeSlot } from '../../../core/services/config.service';
import { Router, ActivatedRoute } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';

@Component({
  selector: 'app-reservation-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  template: `
    <div class="max-w-4xl mx-auto bg-white p-8 rounded-xl shadow-lg mt-6 border border-slate-100 relative" (click)="closeDropdown()">
      
      <div class="flex justify-between items-start mb-6">
        <h2 class="text-2xl font-bold text-slate-800 flex items-center">
          <span class="material-icons mr-2 text-blue-600">
            {{ isEditMode() ? 'edit_calendar' : 'event_available' }}
          </span>
          {{ isEditMode() ? 'Modifier la Réservation' : 'Nouvelle Réservation' }}
        </h2>
        @if (isEditMode()) { <span class="px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-xs font-bold border border-blue-100">MODE ÉDITION</span> }
      </div>
      
      <form [formGroup]="form" (ngSubmit)="onSubmit()" class="space-y-8">
        
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-8">
          
          <div class="space-y-6">
            <div class="space-y-4">
              <h3 class="text-sm font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100 pb-2">Général</h3>
              <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label class="block text-sm font-bold text-slate-700 mb-1">Date Événement</label>
                  <input formControlName="date" (change)="onDateChange()" type="date" class="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition">
                  @if (!form.value.date) { <p class="text-[10px] text-orange-500 mt-1">Sélectionnez une date</p> }
                </div>
                
                <div>
                  <label class="block text-sm font-bold text-slate-700 mb-1">Créneau Disponible</label>
                  <select formControlName="selectedSlotId" (change)="onSlotChange($event)" class="w-full px-4 py-2 border border-slate-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 outline-none transition"
                          [class.opacity-50]="availableSlots().length === 0"
                          [attr.disabled]="availableSlots().length === 0 ? true : null">
                    <option value="">-- Choisir --</option>
                    @for (slot of availableSlots(); track slot.id) { 
                       <option [value]="slot.id">
                         {{ slot.label }} ({{ slot.start }} - {{ slot.end }}) - {{ slot.price }} DT
                       </option> 
                    }
                  </select>
                  @if (availableSlots().length === 0 && form.value.date) {
                    <p class="text-[10px] text-red-500 mt-1">Aucun tarif pour cette date.</p>
                  }
                </div>
              </div>
              
              <div class="relative z-20"> 
                <label class="block text-sm font-bold text-slate-700 mb-1">Client</label>
                <div class="flex gap-2">
                  <div class="relative flex-1">
                    <span class="material-icons absolute left-3 top-2.5 text-slate-400 text-sm">search</span>
                    <input type="text" [value]="searchTerm()" (input)="onSearchInput($event)" (focus)="openDropdown($event)" (click)="openDropdown($event)"
                      placeholder="Rechercher..." class="w-full pl-9 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none">
                    @if (isDropdownOpen()) {
                      <div class="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-xl max-h-48 overflow-y-auto z-50">
                        @for (client of filteredClients(); track client.id) {
                          <div (click)="selectClient(client)" class="px-4 py-2 hover:bg-blue-50 cursor-pointer border-b border-slate-50">
                            <div class="font-bold text-sm text-slate-800">{{ client.nom }}</div>
                            <div class="text-xs text-slate-500">{{ client.telephone }}</div>
                          </div>
                        }
                      </div>
                    }
                  </div>
                  <button type="button" (click)="openClientModal()" class="bg-emerald-500 text-white px-3 rounded-lg shadow"><span class="material-icons">person_add</span></button>
                </div>
                <input type="hidden" formControlName="clientId">
              </div>
            </div>

            <div class="space-y-4">
              <div class="flex justify-between items-center border-b border-slate-100 pb-2">
                 <h3 class="text-sm font-bold text-slate-400 uppercase tracking-wider">Finances</h3>
                 @if (isPriceAutoUpdated()) { <span class="text-[10px] text-green-600 bg-green-50 px-2 py-0.5 rounded border border-green-100 animate-pulse">Tarif période appliqué</span> }
              </div>
              <div class="grid grid-cols-2 gap-4">
                <div>
                  <label class="block text-sm font-bold text-slate-700 mb-1">Prix Total (TND)</label>
                  <input formControlName="totalPrice" type="number" class="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none font-mono font-bold text-right text-lg text-slate-800">
                </div>
                <div>
                  <label class="block text-sm font-bold text-slate-700 mb-1">Avance Reçue (TND)</label>
                  <input formControlName="advance" type="number" class="w-full px-4 py-2 border border-emerald-300 bg-emerald-50 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none font-mono font-bold text-emerald-700 text-right text-lg">
                </div>
              </div>
            </div>
          </div>

          <div class="space-y-6">
            <div class="space-y-4">
              <div class="flex justify-between items-end border-b border-slate-100 pb-2">
                 <div class="flex items-center gap-2">
                   <h3 class="text-sm font-bold text-slate-400 uppercase tracking-wider">Équipe</h3>
                   <button type="button" (click)="openStaffModal()" class="text-blue-600 hover:bg-blue-50 rounded-full p-1"><span class="material-icons text-sm">add</span></button>
                 </div>
                 <span class="text-xs font-bold px-2 py-1 rounded bg-slate-100 text-slate-600">{{ getSelectedServerCount() }} sel.</span>
              </div>
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-80 overflow-y-auto pr-1">
                @for (staff of servers(); track staff.id) {
                  <div (click)="toggleServer(staff.id!)" class="cursor-pointer rounded-lg border p-2 flex items-center space-x-3 select-none transition"
                       [class.border-emerald-500]="isServerSelected(staff.id!)" [class.bg-emerald-50]="isServerSelected(staff.id!)">
                    <div class="w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs"
                         [class.bg-emerald-500]="isServerSelected(staff.id!)" [class.text-white]="isServerSelected(staff.id!)"
                         [class.bg-slate-200]="!isServerSelected(staff.id!)" [class.text-slate-500]="!isServerSelected(staff.id!)">
                      {{ isServerSelected(staff.id!) ? '✓' : staff.nom.charAt(0) }}
                    </div>
                    <div class="flex-1 min-w-0">
                       <p class="text-sm font-bold truncate">{{ staff.nom }}</p>
                       <p class="text-[10px] text-slate-500 truncate">{{ staff.specialite }}</p>
                    </div>
                  </div>
                }
              </div>
            </div>
            @if (isEditMode()) {
              <div>
                <label class="block text-sm font-bold text-slate-700 mb-1">Statut</label>
                <select formControlName="status" class="w-full px-4 py-2 border border-slate-300 rounded-lg">
                   <option value="CONFIRMED">✅ Confirmé</option>
                   <option value="PENDING">⏳ En attente</option>
                   <option value="CANCELLED">🚫 Annulé</option>
                </select>
              </div>
            }
          </div>
        </div>

        <div class="flex justify-end space-x-3 pt-6 border-t border-slate-100">
          <button type="button" (click)="cancel()" class="px-5 py-2.5 border border-slate-300 rounded-lg text-slate-600 hover:bg-slate-50 font-medium">Annuler</button>
          <button type="submit" [disabled]="form.invalid" class="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold shadow-md disabled:opacity-50">
            {{ isEditMode() ? 'Mettre à jour' : 'Confirmer' }}
          </button>
        </div>
      </form>
    </div>

    @if (showClientModal()) { <div class="fixed inset-0 z-[60] bg-black/50 flex items-center justify-center"><div class="bg-white p-6 rounded-lg shadow-xl"><h3 class="font-bold mb-4">Nouveau Client</h3><form [formGroup]="quickClientForm" (ngSubmit)="saveQuickClient()"><input formControlName="nom" placeholder="Nom" class="block w-full border p-2 mb-2 rounded"><input formControlName="telephone" placeholder="Tél" class="block w-full border p-2 mb-2 rounded"><button type="submit" class="bg-blue-600 text-white px-4 py-2 rounded">Sauver</button><button type="button" (click)="closeClientModal()" class="ml-2 text-red-500">Fermer</button></form></div></div> }
    @if (showStaffModal()) { <div class="fixed inset-0 z-[60] bg-black/50 flex items-center justify-center"><div class="bg-white p-6 rounded-lg shadow-xl"><h3 class="font-bold mb-4">Nouveau Staff</h3><form [formGroup]="quickStaffForm" (ngSubmit)="saveQuickStaff()"><input formControlName="nom" placeholder="Nom" class="block w-full border p-2 mb-2 rounded"><input formControlName="email" placeholder="Email" class="block w-full border p-2 mb-2 rounded"><input formControlName="telephone" placeholder="Tél" class="block w-full border p-2 mb-2 rounded"><button type="submit" class="bg-blue-600 text-white px-4 py-2 rounded">Sauver</button><button type="button" (click)="closeStaffModal()" class="ml-2 text-red-500">Fermer</button></form></div></div> }
  `
})
export class ReservationFormComponent implements OnInit {
  private fb = inject(FormBuilder);
  private reservationService = inject(ReservationService);
  private clientService = inject(ClientService);
  private staffService = inject(StaffService);
  private configService = inject(ConfigService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  clients = toSignal(this.clientService.getAll(), { initialValue: [] });
  servers = toSignal(this.staffService.getAll(), { initialValue: [] });
  
  selectedDate = signal<string>('');
  availableSlots = computed(() => {
    const date = this.selectedDate();
    if (!date) return [];
    return this.configService.settings().creneaux.filter(s => date >= s.validFrom && date <= s.validTo);
  });

  isEditMode = signal(false);
  reservationId: string | null = null;
  searchTerm = signal('');
  isDropdownOpen = signal(false);
  filteredClients = computed(() => { const term = this.searchTerm().toLowerCase(); const all = this.clients(); return term ? all.filter(c => c.nom.toLowerCase().includes(term) || c.telephone.includes(term)) : all; });
  showClientModal = signal(false); showStaffModal = signal(false);
  isPriceAutoUpdated = signal(false);

  form = this.fb.group({
    date: [new Date().toISOString().split('T')[0], Validators.required],
    selectedSlotId: ['', Validators.required],
    startTime: ['', Validators.required],
    endTime: ['', Validators.required],
    clientId: ['', Validators.required],
    clientName: [''],
    assignedServerIds: [[] as string[]],
    status: ['CONFIRMED'],
    totalPrice: [0],
    advance: [0]
  });

  quickClientForm = this.fb.group({ nom: ['', Validators.required], telephone: ['', Validators.required], email: [''], adresse: [''], createdAt: [new Date().toISOString()] });
  quickStaffForm = this.fb.group({ nom: ['', Validators.required], email: ['', [Validators.required, Validators.email]], telephone: ['', Validators.required], specialite: ['Salle'], role: ['SERVER'], active: [true] });

  ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id');
    const dateParam = this.route.snapshot.queryParamMap.get('date'); // <--- ICI : Lire le paramètre 'date'

    if (id) {
      this.isEditMode.set(true);
      this.reservationId = id;
      this.loadReservation(id);
    } else if (dateParam) {
      // Pré-remplissage si date fournie
      this.form.patchValue({ date: dateParam });
      this.selectedDate.set(dateParam);
    } else {
      this.selectedDate.set(this.form.value.date || '');
    }
  }

  onDateChange() {
    this.selectedDate.set(this.form.value.date || '');
    this.form.patchValue({ selectedSlotId: '', startTime: '', endTime: '', totalPrice: 0 });
  }

  loadReservation(id: string) {
    this.reservationService.getById(id).subscribe(res => {
      if (res) {
        const r = res as any;
        this.form.patchValue({
          date: r.date,
          startTime: r.startTime, endTime: r.endTime, 
          clientId: r.clientId, clientName: r.clientName, assignedServerIds: r.assignedServerIds || [], status: r.status, totalPrice: r.totalPrice || 0, advance: r.advance || 0
        });
        this.selectedDate.set(r.date);
        this.searchTerm.set(r.clientName || '');
      }
    });
  }

  onSlotChange(event: any) {
    const slotId = event.target.value;
    const selectedSlot = this.availableSlots().find(c => c.id === slotId);
    if (selectedSlot) {
      this.form.patchValue({ startTime: selectedSlot.start, endTime: selectedSlot.end, totalPrice: selectedSlot.price || 0 });
      this.isPriceAutoUpdated.set(true);
      setTimeout(() => this.isPriceAutoUpdated.set(false), 3000);
    }
  }

  isServerSelected(id: string): boolean { const current = this.form.value.assignedServerIds as string[]; return current ? current.includes(id) : false; }
  toggleServer(id: string) { const current = (this.form.value.assignedServerIds as string[]) || []; let updated = current.includes(id) ? current.filter(sid => sid !== id) : [...current, id]; this.form.patchValue({ assignedServerIds: updated }); }
  getSelectedServerCount(): number { return (this.form.value.assignedServerIds as string[])?.length || 0; }
  onSearchInput(event: any) { this.searchTerm.set(event.target.value); this.isDropdownOpen.set(true); this.form.patchValue({ clientId: '', clientName: '' }); }
  openDropdown(ev: Event) { ev.stopPropagation(); this.isDropdownOpen.set(true); }
  closeDropdown() { setTimeout(() => this.isDropdownOpen.set(false), 200); }
  selectClient(client: any) { this.searchTerm.set(client.nom); this.form.patchValue({ clientId: client.id, clientName: client.nom }); this.isDropdownOpen.set(false); }
  async onSubmit() { if (this.form.valid) { if (this.isEditMode() && this.reservationId) await this.reservationService.update(this.reservationId, this.form.value as any); else await this.reservationService.add(this.form.value as any); this.router.navigate(['/reservations']); } }
  cancel() { this.router.navigate(['/reservations']); }
  openClientModal() { this.quickClientForm.reset({ createdAt: new Date().toISOString() }); this.showClientModal.set(true); }
  closeClientModal() { this.showClientModal.set(false); }
  async saveQuickClient() { if (this.quickClientForm.valid) { const docRef = await this.clientService.add(this.quickClientForm.value as any); this.closeClientModal(); this.selectClient({ id: docRef.id, nom: this.quickClientForm.value.nom, telephone: this.quickClientForm.value.telephone }); } }
  openStaffModal() { this.quickStaffForm.reset({ role: 'SERVER', specialite: 'Salle', active: true }); this.showStaffModal.set(true); }
  closeStaffModal() { this.showStaffModal.set(false); }
  async saveQuickStaff() { if (this.quickStaffForm.valid) { const docRef = await this.staffService.add(this.quickStaffForm.value as any); this.closeStaffModal(); this.toggleServer(docRef.id); } }
}
EOF

# ==============================================================================
# ÉTAPE 2 : GESTION CLIC DANS CALENDAR VIEW
# ==============================================================================
log_info "Mise à jour de CalendarView (Logique Clic Vide vs Plein)..."

cat <<'EOF' > src/app/features/calendar/calendar-view/calendar-view.component.ts
import { Component, inject, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReservationService } from '../../../core/services/reservation.service';
import { AuthService } from '../../../core/services/auth.service';
import { StaffService } from '../../../core/services/staff.service';
import { ActivityService } from '../../../core/services/activity.service';
import { RouterLink, Router } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { startOfMonth, endOfMonth, startOfWeek, endOfWeek, format, addMonths, subMonths, eachDayOfInterval, isSameMonth, isSameDay, isToday } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Reservation } from '../../../core/models/reservation.model';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-calendar-view',
  standalone: true,
  imports: [CommonModule, RouterLink, FormsModule],
  template: `
    <div class="p-6 bg-white min-h-screen flex flex-col">
      <div class="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
        <div class="flex items-center gap-4">
          <button (click)="previousMonth()" class="p-2 rounded-full hover:bg-gray-100 border transition"><span class="material-icons text-gray-600">chevron_left</span></button>
          <h2 class="text-2xl font-bold text-slate-800 capitalize min-w-[200px] text-center">{{ currentMonthLabel() }}</h2>
          <button (click)="nextMonth()" class="p-2 rounded-full hover:bg-gray-100 border transition"><span class="material-icons text-gray-600">chevron_right</span></button>
        </div>
        <div class="flex items-center gap-3">
          <button (click)="goToToday()" class="px-3 py-1 text-sm border rounded hover:bg-gray-50 text-gray-600">Aujourd'hui</button>
          <a routerLink="/reservations/new" class="bg-blue-600 text-white px-4 py-2 rounded shadow hover:bg-blue-700 transition flex items-center"><span class="material-icons text-sm mr-2">add</span> Réservation</a>
        </div>
      </div>

      <div class="flex-1 border rounded-lg overflow-hidden bg-slate-50 flex flex-col">
        <div class="grid grid-cols-7 bg-white border-b">
          @for (day of weekDays; track day) { <div class="py-2 text-center text-sm font-semibold text-slate-500 uppercase">{{ day }}</div> }
        </div>
        <div class="grid grid-cols-7 flex-1 auto-rows-fr">
          @for (day of calendarDays(); track day) {
            <div (click)="onDayClick(day)" 
                 class="min-h-[120px] bg-white border-b border-r p-1 relative flex flex-col cursor-pointer transition hover:bg-blue-50/50"
                 [class.bg-blue-50]="isToday(day)" [class.bg-slate-50]="!isCurrentMonth(day)">
              
              <div class="text-right text-xs mb-1 font-medium" [class.text-blue-600]="isToday(day)" [class.text-slate-400]="!isCurrentMonth(day)">{{ day | date:'d' }}</div>
              
              <div class="flex-1 overflow-y-auto space-y-1 custom-scrollbar">
                @for (res of getReservationsForDay(day); track res.id) {
                  <div (click)="openDetails(res); $event.stopPropagation()" 
                       class="text-[10px] p-1.5 rounded border-l-4 shadow-sm cursor-pointer truncate bg-white hover:brightness-95 transition"
                       [class.border-green-500]="res.status === 'CONFIRMED'" [class.border-yellow-500]="res.status === 'PENDING'" [class.border-red-500]="res.status === 'CANCELLED'">
                    <span class="font-bold">{{ res.startTime }}</span> {{ res.clientName }}
                  </div>
                }
              </div>
            </div>
          }
        </div>
      </div>
    </div>

    @if (selectedReservation()) {
      <div class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-fade-in" (click)="closeDetails()">
        <div class="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]" (click)="$event.stopPropagation()">
          <div class="bg-gradient-to-r from-slate-800 to-slate-900 px-6 py-4 flex justify-between items-center text-white shrink-0">
            <div><h3 class="font-bold text-xl">{{ selectedReservation()?.clientName }}</h3><p class="text-slate-400 text-xs mt-1">{{ selectedReservation()?.date | date:'fullDate' }}</p></div>
            <button (click)="closeDetails()" class="text-slate-400 hover:text-white"><span class="material-icons">close</span></button>
          </div>
          <div class="p-6 space-y-6 overflow-y-auto custom-scrollbar">
             <div class="bg-purple-50 p-4 rounded-xl border border-purple-100 shadow-sm">
               <div class="flex justify-between items-center mb-3 border-b border-purple-200 pb-2"><span class="text-xs font-bold text-purple-700 uppercase tracking-wider">Trésorerie</span><button (click)="openPayment()" class="text-purple-600 hover:bg-purple-100 p-1 rounded transition"><span class="material-icons text-sm">add</span></button></div>
               <div class="grid grid-cols-3 gap-2 text-center"><div><p class="text-[10px] text-slate-500 uppercase">Total</p><p class="font-bold text-slate-800">{{ getResPrice(selectedReservation()) }} DT</p></div><div><p class="text-[10px] text-slate-500 uppercase">Reçu</p><p class="font-bold text-emerald-600">{{ getResAdvance(selectedReservation()) }} DT</p></div><div><p class="text-[10px] text-slate-500 uppercase">Reste</p><p class="font-bold text-red-500">{{ (getResPrice(selectedReservation()) - getResAdvance(selectedReservation())) }} DT</p></div></div>
             </div>
             <div>
               <div class="flex items-center justify-between mb-3"><h4 class="text-xs font-bold text-slate-500 uppercase tracking-wider">Affectation Équipe</h4><span class="text-xs bg-slate-100 px-2 py-1 rounded text-slate-600 font-bold">{{ (selectedReservation()?.assignedServerIds || []).length }} membres</span></div>
               <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
                 @for (staff of allStaff(); track staff.id) {
                   <div (click)="toggleStaffAssignment(staff.id!)" class="flex items-center p-2 rounded-lg border cursor-pointer select-none transition-all duration-200 hover:shadow-sm" [class.border-emerald-500]="isStaffAssigned(staff.id!)" [class.bg-emerald-50]="isStaffAssigned(staff.id!)" [class.border-slate-200]="!isStaffAssigned(staff.id!)">
                     <div class="w-6 h-6 rounded-full flex items-center justify-center text-[10px] mr-2 transition-colors" [class.bg-emerald-500]="isStaffAssigned(staff.id!)" [class.text-white]="isStaffAssigned(staff.id!)" [class.bg-slate-200]="!isStaffAssigned(staff.id!)" [class.text-slate-400]="!isStaffAssigned(staff.id!)">@if(isStaffAssigned(staff.id!)){ <span class="material-icons text-[14px]">check</span> }</div>
                     <div class="flex-1 min-w-0"><p class="text-sm font-bold truncate" [class.text-emerald-900]="isStaffAssigned(staff.id!)">{{ staff.nom }}</p><p class="text-[10px] truncate" [class.text-emerald-700]="isStaffAssigned(staff.id!)" [class.text-slate-500]="!isStaffAssigned(staff.id!)">{{ staff.specialite }}</p></div>
                   </div>
                 }
               </div>
             </div>
          </div>
          <div class="bg-slate-50 px-6 py-4 border-t border-slate-200 flex justify-between shrink-0"><button (click)="initiateDelete()" class="text-red-500 hover:bg-red-50 px-3 py-2 rounded text-sm font-bold transition flex items-center"><span class="material-icons text-sm mr-2">delete</span> Supprimer</button><button (click)="editCurrent()" class="bg-slate-800 hover:bg-slate-700 text-white px-5 py-2 rounded text-sm font-bold transition flex items-center"><span class="material-icons text-sm mr-2">edit</span> Éditer tout</button></div>
        </div>
      </div>
    }

    @if (selectedDayForMenu()) {
      <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm animate-fade-in" (click)="closeDayMenu()">
        <div class="bg-white rounded-xl shadow-2xl w-80 overflow-hidden transform scale-100" (click)="$event.stopPropagation()">
          
          <div class="bg-blue-600 px-6 py-4 flex justify-between items-center text-white">
            <h3 class="font-bold text-lg">{{ selectedDayForMenu() | date:'fullDate' }}</h3>
            <button (click)="closeDayMenu()" class="text-blue-200 hover:text-white"><span class="material-icons">close</span></button>
          </div>

          <div class="p-4 bg-slate-50 border-b border-slate-200">
            <button (click)="addNewOnDay()" class="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-lg shadow font-bold flex justify-center items-center transition">
              <span class="material-icons mr-2">add_circle</span> Nouvelle Réservation
            </button>
          </div>

          <div class="p-4 space-y-2 max-h-60 overflow-y-auto">
            <p class="text-xs font-bold text-slate-500 uppercase mb-2">Réservations existantes</p>
            @for (res of getReservationsForDay(selectedDayForMenu()!); track res.id) {
              <div (click)="openDetails(res); closeDayMenu()" class="p-3 bg-white border border-slate-200 rounded-lg shadow-sm hover:border-blue-300 hover:shadow-md cursor-pointer transition">
                <div class="flex justify-between items-center">
                  <span class="font-bold text-slate-800">{{ res.clientName }}</span>
                  <span class="text-xs font-bold px-2 py-0.5 rounded" [class.bg-green-100]="res.status === 'CONFIRMED'" [class.text-green-800]="res.status === 'CONFIRMED'">{{ res.status }}</span>
                </div>
                <div class="text-xs text-slate-500 mt-1 flex items-center">
                  <span class="material-icons text-[12px] mr-1">schedule</span> {{ res.startTime }} - {{ res.endTime }}
                </div>
              </div>
            }
          </div>
        </div>
      </div>
    }

    @if (showPaymentModal()) { <div class="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm animate-fade-in"><div class="bg-white rounded-xl shadow-2xl p-6 w-72"><h3 class="font-bold text-lg mb-4 text-center">Ajouter Paiement</h3><div class="mb-4"><input type="number" [(ngModel)]="amountToAdd" class="w-full text-center text-3xl font-bold border-b-2 border-emerald-500 outline-none pb-2 text-slate-800" placeholder="0"><p class="text-center text-xs text-slate-400 mt-1">Montant en TND</p></div><div class="flex gap-2"><button (click)="closePayment()" class="flex-1 py-2 border rounded text-slate-600 hover:bg-slate-50">Annuler</button><button (click)="submitPayment()" class="flex-1 py-2 bg-emerald-600 text-white rounded font-bold hover:bg-emerald-700">Valider</button></div></div></div> }

    @if (showDeleteModal()) { <div class="fixed inset-0 z-[70] flex items-center justify-center bg-red-900/80 backdrop-blur-sm animate-fade-in"><div class="bg-white rounded-xl shadow-2xl p-8 w-96 transform scale-100"><div class="flex flex-col items-center mb-6"><div class="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4"><span class="material-icons text-red-600 text-3xl">gpp_maybe</span></div><h3 class="font-bold text-xl text-slate-800 text-center">Zone de Danger</h3><p class="text-sm text-slate-500 text-center mt-2">Vous êtes sur le point de supprimer définitivement cette réservation.</p></div><div class="space-y-4"><div><label class="block text-xs font-bold text-slate-700 uppercase mb-1">Mot de passe Admin</label><input type="password" [(ngModel)]="deletePassword" class="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-red-500 outline-none transition" placeholder="••••••••" (keyup.enter)="confirmDelete()">@if (deleteError()) { <p class="text-xs text-red-600 mt-1 flex items-center animate-pulse"><span class="material-icons text-xs mr-1">error</span> Mot de passe incorrect</p> }</div><button (click)="confirmDelete()" [disabled]="isDeleting()" class="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-3 rounded-lg shadow-lg transition flex justify-center items-center disabled:opacity-70 disabled:cursor-not-allowed">@if (isDeleting()) { <span class="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full mr-2"></span> } Confirmer la suppression</button><button (click)="closeDeleteModal()" class="w-full text-slate-500 hover:text-slate-800 font-medium py-2">Annuler</button></div></div></div> }
  `,
  styles: [`
    .custom-scrollbar::-webkit-scrollbar { width: 4px; }
    .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
    .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 2px; }
    @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
    .animate-fade-in { animation: fadeIn 0.2s ease-out; }
  `]
})
export class CalendarViewComponent {
  private reservationService = inject(ReservationService);
  private staffService = inject(StaffService);
  private activityService = inject(ActivityService);
  private router = inject(Router);
  authService = inject(AuthService);

  viewDate = signal(new Date());
  weekDays = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
  reservations = toSignal(this.reservationService.getAll(), { initialValue: [] });
  allStaff = toSignal(this.staffService.getAll(), { initialValue: [] });
  selectedReservation = signal<Reservation | null>(null);

  // --- NOUVEAU : GESTION CLIC JOUR ---
  selectedDayForMenu = signal<Date | null>(null);

  onDayClick(day: Date) {
    const events = this.getReservationsForDay(day);
    if (events.length === 0) {
      // Cas VIDE : Navigation directe vers ajout avec date
      const dateStr = format(day, 'yyyy-MM-dd');
      this.router.navigate(['/reservations/new'], { queryParams: { date: dateStr } });
    } else {
      // Cas REMPLI : Ouverture du menu
      this.selectedDayForMenu.set(day);
    }
  }

  closeDayMenu() {
    this.selectedDayForMenu.set(null);
  }

  addNewOnDay() {
    const day = this.selectedDayForMenu();
    if (day) {
      const dateStr = format(day, 'yyyy-MM-dd');
      this.router.navigate(['/reservations/new'], { queryParams: { date: dateStr } });
    }
  }

  // --- RESTE DU CODE (Similaire au précédent) ---
  showPaymentModal = signal(false); amountToAdd = 0; showDeleteModal = signal(false); deletePassword = signal(''); deleteError = signal(false); isDeleting = signal(false);

  openDetails(res: Reservation) { this.selectedReservation.set(res); }
  closeDetails() { this.selectedReservation.set(null); }
  editCurrent() { const res = this.selectedReservation(); if (res?.id) this.router.navigate(['/reservations/edit', res.id]); }
  
  initiateDelete() { this.deletePassword.set(''); this.deleteError.set(false); this.showDeleteModal.set(true); }
  closeDeleteModal() { this.showDeleteModal.set(false); }
  async confirmDelete() {
    if (!this.deletePassword()) return;
    this.isDeleting.set(true); this.deleteError.set(false);
    const isValid = await this.authService.verifyPassword(this.deletePassword());
    if (isValid) { const res = this.selectedReservation(); if (res?.id) { await this.reservationService.delete(res.id); this.closeDeleteModal(); this.closeDetails(); } } else { this.deleteError.set(true); }
    this.isDeleting.set(false);
  }

  isStaffAssigned(staffId: string): boolean { const res = this.selectedReservation(); if (!res || !res.assignedServerIds) return false; return res.assignedServerIds.includes(staffId); }
  async toggleStaffAssignment(staffId: string) { const res = this.selectedReservation(); if (!res || !res.id) return; const currentIds = res.assignedServerIds || []; let newIds = currentIds.includes(staffId) ? currentIds.filter(id => id !== staffId) : [...currentIds, staffId]; await this.reservationService.update(res.id, { assignedServerIds: newIds } as any); this.selectedReservation.update(prev => { if (!prev) return null; return { ...prev, assignedServerIds: newIds }; }); }
  
  getResPrice(res: any) { return Number(res?.totalPrice) || 0; }
  getResAdvance(res: any) { return Number(res?.advance) || 0; }
  openPayment() { this.amountToAdd = 0; this.showPaymentModal.set(true); }
  closePayment() { this.showPaymentModal.set(false); }
  async submitPayment() { const res = this.selectedReservation(); if (res && this.amountToAdd > 0) { const newAdvance = this.getResAdvance(res) + this.amountToAdd; await this.reservationService.update(res.id!, { advance: newAdvance, advanceOnly: true } as any); this.activityService.log('PAYMENT', 'RESERVATION', `Paiement reçu : ${this.amountToAdd} TND (Client: ${res.clientName})`); this.closePayment(); this.selectedReservation.update(prev => { if (!prev) return null; return { ...prev, advance: newAdvance } as any; }); } }

  nextMonth() { this.viewDate.update(d => addMonths(d, 1)); }
  previousMonth() { this.viewDate.update(d => subMonths(d, 1)); }
  goToToday() { this.viewDate.set(new Date()); }
  currentMonthLabel = computed(() => format(this.viewDate(), 'MMMM yyyy', { locale: fr }));
  calendarDays = computed(() => eachDayOfInterval({ start: startOfWeek(startOfMonth(this.viewDate()), { weekStartsOn: 1 }), end: endOfWeek(endOfMonth(this.viewDate()), { weekStartsOn: 1 }) }));
  isToday(d: Date) { return isToday(d); }
  isCurrentMonth(d: Date) { return isSameMonth(d, this.viewDate()); }
  getReservationsForDay(date: Date): Reservation[] { return this.reservations().filter(r => r.date === format(date, 'yyyy-MM-dd')); }
}
EOF

log_success "Interactions Calendrier activées !"
echo -e "${COLOR_INFO}👉 Clique sur une case VIDE : tu vas directement créer une résa pour ce jour.${COLOR_RESET}"
echo -e "${COLOR_INFO}👉 Clique sur une case OCCUPÉE : un menu apparaît pour Ajouter ou Voir les détails.${COLOR_RESET}"