import { Component, inject, signal, computed, OnInit, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ReservationService } from '../../../core/services/reservation.service';
import { ClientService } from '../../../core/services/client.service';
import { StaffService } from '../../../core/services/staff.service';
import { ConfigService } from '../../../core/services/config.service';
import { UiService } from '../../../core/services/ui.service';
import { Router, ActivatedRoute } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';

@Component({
  selector: 'app-reservation-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  template: `
    <div class="max-w-4xl mx-auto bg-white p-8 rounded-xl shadow-lg mt-6 border border-slate-100 relative" (click)="closeDropdown()">
      
      <div class="flex justify-between items-start mb-6">
        <h2 class="text-2xl font-bold text-slate-800 flex items-center"><span class="material-icons mr-2 text-blue-600">{{ isEditMode() ? 'edit_calendar' : 'event_available' }}</span>{{ isEditMode() ? 'Modifier la Réservation' : 'Nouvelle Réservation' }}</h2>
        @if (isEditMode()) { <span class="px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-xs font-bold border border-blue-100">MODE ÉDITION</span> }
      </div>
      
      <form [formGroup]="form" (ngSubmit)="onSubmit()" class="space-y-8">
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-8">
          
          <div class="space-y-6">
            <div class="space-y-4">
              <h3 class="text-sm font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100 pb-2">Général</h3>
              <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div><label class="block text-sm font-bold text-slate-700 mb-1">Date Événement</label><input formControlName="date" (change)="onDateChange()" type="date" class="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition"></div>
                <div><label class="block text-sm font-bold text-slate-700 mb-1">Créneau Disponible</label><select formControlName="selectedSlotId" (change)="onSlotChange($event)" class="w-full px-4 py-2 border border-slate-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 outline-none transition" [class.opacity-50]="availableSlots().length === 0" [attr.disabled]="availableSlots().length === 0 ? true : null"><option value="">-- Choisir --</option>@for (slot of availableSlots(); track slot.id) { <option [value]="slot.id">{{ slot.label }} ({{ slot.start }} - {{ slot.end }}) - {{ slot.price }} DT</option> }</select></div>
              </div>
              
              <div class="relative z-20"> 
                <label class="block text-sm font-bold text-slate-700 mb-1">Client</label>
                <div class="flex gap-2">
                  <div class="relative flex-1">
                    <span class="material-icons absolute left-3 top-2.5 text-slate-400 text-sm">search</span>
                    <input type="text" [value]="searchTerm()" (input)="onSearchInput($event)" (focus)="openDropdown($event)" (click)="openDropdown($event)" placeholder="Rechercher..." class="w-full pl-9 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none">
                    @if (isDropdownOpen()) { 
                      <div class="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-xl max-h-48 overflow-y-auto z-50">
                        @for (client of filteredClients(); track client.id) { 
                          <div (click)="selectClient(client)" class="px-4 py-2 hover:bg-blue-50 cursor-pointer border-b border-slate-50">
                            <div class="font-bold text-sm text-slate-800">{{ client.nom }} {{ client.prenom }}</div>
                            <div class="text-xs text-slate-500">{{ client.telephone }}</div>
                          </div> 
                        }
                      </div> 
                    }
                  </div>
                  <button type="button" (click)="openClientModal()" class="bg-emerald-500 hover:bg-emerald-600 text-white px-3 rounded-lg shadow transition">
                    <span class="material-icons">person_add</span>
                  </button>
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
                <div><label class="block text-sm font-bold text-slate-700 mb-1">Prix Total (TND)</label><input formControlName="totalPrice" type="number" class="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none font-mono font-bold text-right text-lg text-slate-800"></div>
                <div><label class="block text-sm font-bold text-slate-700 mb-1">Avance Reçue (TND)</label><input formControlName="advance" type="number" class="w-full px-4 py-2 border border-emerald-300 bg-emerald-50 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none font-mono font-bold text-emerald-700 text-right text-lg"></div>
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
                  <div class="relative group rounded-lg border transition-all duration-200 select-none bg-white hover:shadow-md" [class.border-emerald-500]="isServerSelected(staff.id!)" [class.bg-emerald-50]="isServerSelected(staff.id!)">
                    <div (click)="toggleServer(staff.id!)" class="p-2 flex items-center space-x-3 cursor-pointer">
                      <div class="w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs" [class.bg-emerald-500]="isServerSelected(staff.id!)" [class.text-white]="isServerSelected(staff.id!)" [class.bg-slate-200]="!isServerSelected(staff.id!)" [class.text-slate-500]="!isServerSelected(staff.id!)">{{ isServerSelected(staff.id!) ? '✓' : staff.nom.charAt(0) }}</div>
                      <div class="flex-1 min-w-0"><p class="text-sm font-bold truncate">{{ staff.nom }}</p><p class="text-[10px] text-slate-500 truncate">{{ staff.specialite }}</p></div>
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
          <button type="submit" [disabled]="form.invalid" class="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold shadow-md disabled:opacity-50">{{ isEditMode() ? 'Mettre à jour' : 'Confirmer' }}</button>
        </div>
      </form>
    </div>

    @if (showClientModal()) { 
      <div class="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fade-in">
        <div class="bg-white rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
          
          <div class="bg-blue-600 px-6 py-4 flex justify-between items-center text-white shrink-0">
            <h3 class="font-bold text-lg flex items-center"><span class="material-icons mr-2">person_add</span> Nouveau Client</h3>
            <button (click)="closeClientModal()" class="text-blue-200 hover:text-white transition"><span class="material-icons">close</span></button>
          </div>

          <form [formGroup]="quickClientForm" (ngSubmit)="saveQuickClient()" class="p-6 space-y-6 overflow-y-auto custom-scrollbar">
            
            <div class="space-y-3">
              <h4 class="text-xs font-bold text-slate-400 uppercase tracking-wider border-b pb-1">Identité Civile</h4>
              <div class="grid grid-cols-2 gap-4">
                <div>
                  <label class="block text-sm font-bold text-slate-700 mb-1">Nom *</label>
                  <input formControlName="nom" class="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none uppercase" placeholder="NOM">
                </div>
                <div>
                  <label class="block text-sm font-bold text-slate-700 mb-1">Prénom *</label>
                  <input formControlName="prenom" class="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none capitalize" placeholder="Prénom">
                </div>
                <div>
                  <label class="block text-sm font-bold text-slate-700 mb-1">N° CIN</label>
                  <input formControlName="cin" class="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none">
                </div>
                <div>
                  <label class="block text-sm font-bold text-slate-700 mb-1">Date Délivrance CIN</label>
                  <input formControlName="dateCin" type="date" class="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none">
                </div>
              </div>
            </div>

            <div class="space-y-3">
              <h4 class="text-xs font-bold text-slate-400 uppercase tracking-wider border-b pb-1">Couple / Mariés</h4>
              <div class="grid grid-cols-2 gap-4">
                <div>
                  <label class="block text-sm font-bold text-slate-700 mb-1">Prénom Conjoint 1</label>
                  <input formControlName="prenomMarie1" class="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" placeholder="Ex: Marié">
                </div>
                <div>
                  <label class="block text-sm font-bold text-slate-700 mb-1">Prénom Conjoint 2</label>
                  <input formControlName="prenomMarie2" class="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" placeholder="Ex: Mariée">
                </div>
              </div>
            </div>

            <div class="space-y-3">
              <h4 class="text-xs font-bold text-slate-400 uppercase tracking-wider border-b pb-1">Coordonnées</h4>
              <div class="grid grid-cols-2 gap-4">
                <div>
                  <label class="block text-sm font-bold text-slate-700 mb-1">Téléphone *</label>
                  <input formControlName="telephone" type="tel" class="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none">
                </div>
                <div>
                  <label class="block text-sm font-bold text-slate-700 mb-1">Email</label>
                  <input formControlName="email" type="email" class="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none">
                </div>
                <div class="col-span-2">
                  <label class="block text-sm font-bold text-slate-700 mb-1">Adresse</label>
                  <textarea formControlName="adresse" rows="2" class="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none resize-none"></textarea>
                </div>
              </div>
            </div>

          </form>

          <div class="bg-slate-50 px-6 py-4 border-t border-slate-200 flex justify-end gap-3 shrink-0">
            <button type="button" (click)="closeClientModal()" class="px-5 py-2 border border-slate-300 rounded-lg text-slate-600 hover:bg-slate-100 font-bold transition">
              Annuler
            </button>
            <button type="button" (click)="saveQuickClient()" [disabled]="quickClientForm.invalid" class="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold shadow disabled:opacity-50 transition transform hover:-translate-y-0.5">
              Enregistrer
            </button>
          </div>

        </div>
      </div> 
    }

    @if (showStaffModal()) { 
      <div class="fixed inset-0 z-[60] bg-black/50 flex items-center justify-center animate-fade-in">
        <div class="bg-white p-6 rounded-lg shadow-xl w-80">
          <h3 class="font-bold mb-4 text-slate-800">Nouveau Staff</h3>
          <form [formGroup]="quickStaffForm" (ngSubmit)="saveQuickStaff()">
            <input formControlName="nom" placeholder="Nom complet" class="block w-full border border-slate-300 p-2 mb-3 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none">
            <input formControlName="email" placeholder="Email" class="block w-full border border-slate-300 p-2 mb-3 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none">
            <input formControlName="telephone" placeholder="Téléphone" class="block w-full border border-slate-300 p-2 mb-3 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none">
            <div class="flex justify-end gap-2 mt-4">
              <button type="button" (click)="closeStaffModal()" class="text-slate-500 hover:bg-slate-100 px-3 py-1.5 rounded transition">Annuler</button>
              <button type="submit" class="bg-blue-600 text-white px-4 py-1.5 rounded font-bold hover:bg-blue-700 shadow">Sauver</button>
            </div>
          </form>
        </div>
      </div> 
    }
  `,
  styles: [` 
    .custom-scrollbar::-webkit-scrollbar { width: 4px; } 
    .custom-scrollbar::-webkit-scrollbar-track { background: transparent; } 
    .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 2px; } 
    @keyframes fadeIn { from { opacity: 0; transform: translateY(-5px); } to { opacity: 1; transform: translateY(0); } }
    .animate-fade-in { animation: fadeIn 0.2s ease-out; }
  `]
})
export class ReservationFormComponent implements OnInit {
  private fb = inject(FormBuilder);
  private reservationService = inject(ReservationService);
  private clientService = inject(ClientService);
  private staffService = inject(StaffService);
  private configService = inject(ConfigService);
  private ui = inject(UiService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  clients = toSignal(this.clientService.getAll(), { initialValue: [] });
  servers = toSignal(this.staffService.getAll(), { initialValue: [] });
  selectedDate = signal<string>('');
  availableSlots = computed(() => { const date = this.selectedDate(); if (!date) return []; return this.configService.settings().creneaux.filter(s => date >= s.validFrom && date <= s.validTo); });
  isEditMode = signal(false); reservationId: string | null = null; searchTerm = signal(''); isDropdownOpen = signal(false);
  filteredClients = computed(() => { const term = this.searchTerm().toLowerCase(); const all = this.clients(); return term ? all.filter(c => c.nom.toLowerCase().includes(term) || c.prenom.toLowerCase().includes(term) || c.telephone.includes(term)) : all; });
  showClientModal = signal(false); showStaffModal = signal(false); isPriceAutoUpdated = signal(false);

  form = this.fb.group({ date: [new Date().toISOString().split('T')[0], Validators.required], selectedSlotId: ['', Validators.required], startTime: ['', Validators.required], endTime: ['', Validators.required], clientId: ['', Validators.required], clientName: [''], assignedServerIds: [[] as string[]], status: ['CONFIRMED'], totalPrice: [0], advance: [0] });
  
  // FORMULAIRE CLIENT COMPLET
  quickClientForm = this.fb.group({ 
    nom: ['', Validators.required], 
    prenom: ['', Validators.required], 
    cin: [''], 
    dateCin: [''], 
    prenomMarie1: [''], 
    prenomMarie2: [''], 
    telephone: ['', Validators.required], 
    email: ['', Validators.email],
    adresse: [''],
    createdAt: [new Date().toISOString()] 
  });
  
  quickStaffForm = this.fb.group({ nom: ['', Validators.required], email: ['', [Validators.required, Validators.email]], telephone: ['', Validators.required], specialite: ['Salle'], role: ['SERVER'], active: [true] });
  
  ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id');
    const dateParam = this.route.snapshot.queryParamMap.get('date');
    const timeParam = this.route.snapshot.queryParamMap.get('startTime');

    if (id) {
      this.isEditMode.set(true);
      this.reservationId = id;
      this.loadReservation(id);
    } else if (dateParam) {
      this.form.patchValue({ date: dateParam });
      this.selectedDate.set(dateParam);
      if (timeParam) {
        setTimeout(() => this.trySelectSlot(timeParam), 200);
      }
    } else {
      this.selectedDate.set(this.form.value.date || '');
    }
  }

  trySelectSlot(time: string) {
    const slots = this.availableSlots();
    let match = slots.find(s => s.start === time);
    if (!match && slots.length > 0) {
       const hour = parseInt(time.split(':')[0], 10);
       if (hour < 12) match = slots.find(s => parseInt(s.start.split(':')[0]) < 12);
       else if (hour < 18) match = slots.find(s => parseInt(s.start.split(':')[0]) >= 12 && parseInt(s.start.split(':')[0]) < 18);
       else match = slots.find(s => parseInt(s.start.split(':')[0]) >= 18);
    }

    if (match) {
      this.form.patchValue({ selectedSlotId: match.id, startTime: match.start, endTime: match.end, totalPrice: match.price });
      this.isPriceAutoUpdated.set(true);
    }
  }

  onDateChange() { this.selectedDate.set(this.form.value.date || ''); this.form.patchValue({ selectedSlotId: '', startTime: '', endTime: '', totalPrice: 0 }); }
  loadReservation(id: string) { this.reservationService.getById(id).subscribe(res => { if (res) { const r = res as any; this.form.patchValue({ date: r.date, startTime: r.startTime, endTime: r.endTime, clientId: r.clientId, clientName: r.clientName, assignedServerIds: r.assignedServerIds || [], status: r.status, totalPrice: r.totalPrice || 0, advance: r.advance || 0 }); this.selectedDate.set(r.date); this.searchTerm.set(r.clientName || ''); } }); }
  onSlotChange(event: any) { const slotId = event.target.value; const selectedSlot = this.availableSlots().find(c => c.id === slotId); if (selectedSlot) { this.form.patchValue({ startTime: selectedSlot.start, endTime: selectedSlot.end, totalPrice: selectedSlot.price || 0 }); this.isPriceAutoUpdated.set(true); setTimeout(() => this.isPriceAutoUpdated.set(false), 3000); } }
  isServerSelected(id: string): boolean { const current = this.form.value.assignedServerIds as string[]; return current ? current.includes(id) : false; }
  toggleServer(id: string) { const current = (this.form.value.assignedServerIds as string[]) || []; let updated = current.includes(id) ? current.filter(sid => sid !== id) : [...current, id]; this.form.patchValue({ assignedServerIds: updated }); }
  getSelectedServerCount(): number { return (this.form.value.assignedServerIds as string[])?.length || 0; }
  onSearchInput(event: any) { this.searchTerm.set(event.target.value); this.isDropdownOpen.set(true); this.form.patchValue({ clientId: '', clientName: '' }); }
  openDropdown(ev: Event) { ev.stopPropagation(); this.isDropdownOpen.set(true); } closeDropdown() { setTimeout(() => this.isDropdownOpen.set(false), 200); }
  selectClient(client: any) { this.searchTerm.set(`${client.nom} ${client.prenom}`); this.form.patchValue({ clientId: client.id, clientName: `${client.nom} ${client.prenom}` }); this.isDropdownOpen.set(false); }
  async onSubmit() { if (this.form.valid) { try { if (this.isEditMode() && this.reservationId) await this.reservationService.update(this.reservationId, this.form.value as any); else await this.reservationService.add(this.form.value as any); this.ui.showToast('success', 'Réservation enregistrée'); this.router.navigate(['/reservations']); } catch (e) { this.ui.showToast('error', 'Erreur sauvegarde'); } } }
  cancel() { this.router.navigate(['/reservations']); }
  
  openClientModal() { this.quickClientForm.reset({ createdAt: new Date().toISOString() }); this.showClientModal.set(true); } 
  closeClientModal() { this.showClientModal.set(false); }
  
  async saveQuickClient() { 
    if (this.quickClientForm.valid) { 
      try {
        const docRef = await this.clientService.add(this.quickClientForm.value as any); 
        this.closeClientModal(); 
        const newData = this.quickClientForm.value; 
        this.selectClient({ id: docRef.id, nom: newData.nom, prenom: newData.prenom, telephone: newData.telephone }); 
        this.ui.showToast('success', 'Client ajouté'); 
      } catch(e) {
        this.ui.showToast('error', 'Erreur ajout client');
      }
    } 
  }
  
  openStaffModal() { this.quickStaffForm.reset({ role: 'SERVER', specialite: 'Salle', active: true }); this.showStaffModal.set(true); } 
  closeStaffModal() { this.showStaffModal.set(false); }
  async saveQuickStaff() { if (this.quickStaffForm.valid) { const docRef = await this.staffService.add(this.quickStaffForm.value as any); this.closeStaffModal(); this.toggleServer(docRef.id); this.ui.showToast('success', 'Staff ajouté'); } }
}
