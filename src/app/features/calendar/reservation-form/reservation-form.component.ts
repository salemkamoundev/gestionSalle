import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ReservationService } from '../../../core/services/reservation.service';
import { ClientService } from '../../../core/services/client.service';
import { StaffService } from '../../../core/services/staff.service';
import { ConfigService } from '../../../core/services/config.service';
import { Router, ActivatedRoute } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';

@Component({
  selector: 'app-reservation-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  template: `
    <div class="max-w-3xl mx-auto bg-white p-8 rounded-xl shadow-lg mt-6 border border-slate-100 relative" (click)="closeDropdown()">
      
      <div class="flex justify-between items-start mb-6">
        <h2 class="text-2xl font-bold text-slate-800 flex items-center">
          <span class="material-icons mr-2 text-blue-600">
            {{ isEditMode() ? 'edit_calendar' : 'event_available' }}
          </span>
          {{ isEditMode() ? 'Modifier la Réservation' : 'Nouvelle Réservation' }}
        </h2>
        @if (isEditMode()) {
          <span class="px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-xs font-bold border border-blue-100">MODE ÉDITION</span>
        }
      </div>
      
      <form [formGroup]="form" (ngSubmit)="onSubmit()" class="space-y-8">
        
        <div class="space-y-4">
          <h3 class="text-sm font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100 pb-2">Informations Générales</h3>
          
          <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label class="block text-sm font-bold text-slate-700 mb-1">Date</label>
              <input formControlName="date" type="date" class="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition shadow-sm">
            </div>

            <div>
              <label class="block text-sm font-bold text-slate-700 mb-1">Créneau</label>
              <div class="relative">
                <select formControlName="startTime" (change)="onSlotChange($event)" class="w-full px-4 py-3 border border-slate-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 outline-none appearance-none shadow-sm cursor-pointer">
                  <option value="">-- Choisir --</option>
                  @for (opt of slotOptions(); track opt.value) {
                    <option [value]="opt.value">{{ opt.label }}</option>
                  }
                </select>
                <span class="material-icons absolute right-3 top-3 text-slate-400 pointer-events-none">expand_more</span>
              </div>
            </div>
          </div>

          <div class="relative z-20"> 
            <label class="block text-sm font-bold text-slate-700 mb-1">Client</label>
            <div class="flex gap-2">
              <div class="relative flex-1">
                <div class="relative">
                  <span class="material-icons absolute left-3 top-3 text-slate-400">search</span>
                  <input type="text" [value]="searchTerm()" (input)="onSearchInput($event)" (focus)="openDropdown($event)" (click)="openDropdown($event)"
                    placeholder="Rechercher un client..." class="w-full pl-10 pr-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none shadow-sm"
                    [class.border-red-500]="form.get('clientId')?.invalid && form.get('clientId')?.touched">
                  @if (searchTerm()) {
                    <button type="button" (click)="clearSelection()" class="absolute right-3 top-3 text-slate-400 hover:text-red-500"><span class="material-icons text-lg">close</span></button>
                  }
                </div>
                @if (isDropdownOpen()) {
                  <div class="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-xl max-h-60 overflow-y-auto z-50">
                    @for (client of filteredClients(); track client.id) {
                      <div (click)="selectClient(client)" class="px-4 py-3 hover:bg-blue-50 cursor-pointer border-b border-slate-50 last:border-0">
                        <div class="font-bold text-slate-800">{{ client.nom }}</div>
                        <div class="text-xs text-slate-500">{{ client.telephone }}</div>
                      </div>
                    } @empty { <div class="px-4 py-3 text-slate-500 text-sm italic text-center">Aucun résultat.</div> }
                  </div>
                }
              </div>
              <button type="button" (click)="openClientModal()" class="bg-emerald-500 hover:bg-emerald-600 text-white px-3 rounded-lg shadow flex items-center justify-center shrink-0" title="Ajouter Client"><span class="material-icons">person_add</span></button>
            </div>
            <input type="hidden" formControlName="clientId">
          </div>
        </div>

        <div class="space-y-4">
          <div class="flex justify-between items-end border-b border-slate-100 pb-2">
             <div class="flex items-center gap-2">
               <h3 class="text-sm font-bold text-slate-400 uppercase tracking-wider">Affectation Équipe</h3>
               <button type="button" (click)="openStaffModal()" class="text-blue-600 hover:bg-blue-50 rounded-full p-1 transition" title="Créer nouveau membre">
                 <span class="material-icons text-sm">add</span>
               </button>
             </div>
             <span class="text-xs font-bold px-2 py-1 rounded bg-slate-100 text-slate-600">
               {{ getSelectedServerCount() }} sélectionné(s)
             </span>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            @for (staff of servers(); track staff.id) {
              <div class="relative group rounded-lg border transition-all duration-200 select-none bg-white hover:shadow-md"
                   [class.border-emerald-500]="isServerSelected(staff.id!)"
                   [class.bg-emerald-50]="isServerSelected(staff.id!)"
                   [class.ring-1]="isServerSelected(staff.id!)"
                   [class.ring-emerald-500]="isServerSelected(staff.id!)"
                   [class.border-slate-200]="!isServerSelected(staff.id!)">
                
                <div (click)="toggleServer(staff.id!)" class="p-3 flex items-center space-x-3 cursor-pointer">
                  <div class="w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm transition-colors"
                       [class.bg-emerald-500]="isServerSelected(staff.id!)"
                       [class.text-white]="isServerSelected(staff.id!)"
                       [class.bg-slate-200]="!isServerSelected(staff.id!)"
                       [class.text-slate-500]="!isServerSelected(staff.id!)">
                    @if (isServerSelected(staff.id!)) {
                      <span class="material-icons text-sm">check</span>
                    } @else {
                      {{ staff.nom.charAt(0) }}
                    }
                  </div>

                  <div class="flex-1 overflow-hidden">
                    <p class="text-sm font-bold truncate transition-colors"
                       [class.text-emerald-900]="isServerSelected(staff.id!)"
                       [class.text-slate-700]="!isServerSelected(staff.id!)">
                      {{ staff.nom }}
                    </p>
                    <p class="text-xs truncate"
                       [class.text-emerald-700]="isServerSelected(staff.id!)"
                       [class.text-slate-500]="!isServerSelected(staff.id!)">
                      {{ staff.specialite || 'Serveur' }}
                    </p>
                  </div>
                </div>

                <div class="absolute top-1 right-1 flex opacity-0 group-hover:opacity-100 transition-opacity bg-white/80 rounded backdrop-blur-sm shadow-sm">
                  
                  <button type="button" (click)="editStaff(staff, $event)" class="p-1 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded transition" title="Modifier les infos">
                    <span class="material-icons text-[16px]">edit</span>
                  </button>
                  
                  <button type="button" (click)="deleteStaff(staff, $event)" class="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition" title="Supprimer de la base">
                    <span class="material-icons text-[16px]">delete</span>
                  </button>
                </div>

              </div>
            } @empty {
              <div class="col-span-full text-center py-6 text-slate-400 bg-slate-50 rounded border border-dashed flex flex-col items-center">
                <span class="material-icons text-3xl mb-2 opacity-50">badge</span>
                <p class="mb-2">Aucun membre du personnel disponible.</p>
                <button type="button" (click)="openStaffModal()" class="text-blue-600 font-bold hover:underline flex items-center">
                   <span class="material-icons text-sm mr-1">add_circle</span> Ajouter un membre
                </button>
              </div>
            }
          </div>
          <p class="text-[10px] text-slate-400 text-right mt-1 italic">
            * Cliquez sur la carte pour affecter. Survolez pour modifier/supprimer le membre.
          </p>
        </div>

        @if (isEditMode()) {
           <div>
             <label class="block text-sm font-bold text-slate-700 mb-1">Statut Réservation</label>
             <select formControlName="status" class="w-full px-4 py-3 border border-slate-300 rounded-lg bg-white">
               <option value="CONFIRMED">✅ Confirmé</option>
               <option value="PENDING">⏳ En attente</option>
               <option value="CANCELLED">🚫 Annulé</option>
             </select>
           </div>
        }

        <div class="flex justify-end space-x-3 pt-6 border-t border-slate-100 relative z-0">
          <button type="button" (click)="cancel()" class="px-5 py-2.5 border border-slate-300 rounded-lg text-slate-600 hover:bg-slate-50 font-medium transition">Annuler</button>
          <button type="submit" [disabled]="form.invalid" class="px-6 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg font-bold shadow-md hover:shadow-lg disabled:opacity-50 transition transform hover:-translate-y-0.5">
            {{ isEditMode() ? 'Mettre à jour' : 'Confirmer' }}
          </button>
        </div>
      </form>
    </div>

    @if (showClientModal()) {
      <div class="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm animate-fade-in p-4">
        <div class="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
          <div class="bg-emerald-600 px-6 py-4 flex justify-between items-center shrink-0">
            <h3 class="text-white font-bold text-lg flex items-center"><span class="material-icons mr-2">person_add</span> Création Rapide</h3>
            <button (click)="closeClientModal()" class="text-emerald-100 hover:text-white"><span class="material-icons">close</span></button>
          </div>
          <form [formGroup]="quickClientForm" (ngSubmit)="saveQuickClient()" class="p-6 space-y-4 overflow-y-auto">
            <div><label class="block text-xs font-bold text-slate-500 uppercase mb-1">Nom complet *</label><input formControlName="nom" class="w-full px-4 py-2 border rounded-lg focus:ring-emerald-500"></div>
            <div><label class="block text-xs font-bold text-slate-500 uppercase mb-1">Téléphone *</label><input formControlName="telephone" type="tel" class="w-full px-4 py-2 border rounded-lg focus:ring-emerald-500"></div>
            <div><label class="block text-xs font-bold text-slate-500 uppercase mb-1">Email</label><input formControlName="email" type="email" class="w-full px-4 py-2 border rounded-lg focus:ring-emerald-500"></div>
            <div><label class="block text-xs font-bold text-slate-500 uppercase mb-1">Adresse</label><textarea formControlName="adresse" rows="2" class="w-full px-4 py-2 border rounded-lg resize-none"></textarea></div>
            <div class="pt-4 mt-2 border-t"><button type="submit" [disabled]="quickClientForm.invalid || isSavingClient()" class="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 rounded-lg shadow disabled:opacity-70">Enregistrer</button></div>
          </form>
        </div>
      </div>
    }

    @if (showStaffModal()) {
      <div class="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm animate-fade-in p-4">
        <div class="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col">
          
          <div class="bg-blue-600 px-6 py-4 flex justify-between items-center shrink-0">
            <h3 class="text-white font-bold text-lg flex items-center">
              <span class="material-icons mr-2">{{ editingStaffId() ? 'edit' : 'badge' }}</span> 
              {{ editingStaffId() ? 'Modifier Membre' : 'Nouveau Membre' }}
            </h3>
            <button (click)="closeStaffModal()" class="text-blue-100 hover:text-white">
              <span class="material-icons">close</span>
            </button>
          </div>

          <form [formGroup]="quickStaffForm" (ngSubmit)="saveQuickStaff()" class="p-6 space-y-4">
            
            <div>
              <label class="block text-xs font-bold text-slate-500 uppercase mb-1">Nom complet <span class="text-red-500">*</span></label>
              <input formControlName="nom" type="text" class="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none">
            </div>

            <div>
              <label class="block text-xs font-bold text-slate-500 uppercase mb-1">Email (Identifiant) <span class="text-red-500">*</span></label>
              <input formControlName="email" type="email" class="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none">
            </div>

            <div>
              <label class="block text-xs font-bold text-slate-500 uppercase mb-1">Téléphone <span class="text-red-500">*</span></label>
              <input formControlName="telephone" type="tel" class="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none">
            </div>

            <div>
              <label class="block text-xs font-bold text-slate-500 uppercase mb-1">Spécialité</label>
              <select formControlName="specialite" class="w-full px-4 py-2 border border-slate-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 outline-none">
                <option value="Salle">Salle</option>
                <option value="Bar">Bar</option>
                <option value="Cuisine">Cuisine</option>
              </select>
            </div>

            <div class="pt-4 mt-2 border-t">
              <button type="submit" [disabled]="quickStaffForm.invalid || isSavingStaff()" class="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-lg shadow transition flex justify-center items-center disabled:opacity-70">
                @if (isSavingStaff()) {
                  <span class="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full mr-2"></span>
                }
                {{ editingStaffId() ? 'Enregistrer les modifications' : 'Ajouter à l\'équipe' }}
              </button>
            </div>
          </form>
        </div>
      </div>
    }
  `,
  styles: [`
    @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
    .animate-fade-in { animation: fadeIn 0.2s ease-out; }
  `]
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
  slotOptions = this.configService.selectableOptions;
  
  isEditMode = signal(false);
  reservationId: string | null = null;
  searchTerm = signal('');
  isDropdownOpen = signal(false);
  filteredClients = computed(() => {
    const term = this.searchTerm().toLowerCase();
    const all = this.clients();
    return term ? all.filter(c => c.nom.toLowerCase().includes(term) || c.telephone.includes(term)) : all;
  });

  showClientModal = signal(false);
  isSavingClient = signal(false);
  
  showStaffModal = signal(false);
  isSavingStaff = signal(false);
  editingStaffId = signal<string | null>(null); // Pour savoir si on édite ou crée

  form = this.fb.group({
    date: [new Date().toISOString().split('T')[0], Validators.required],
    startTime: ['', Validators.required],
    endTime: ['', Validators.required],
    clientId: ['', Validators.required],
    clientName: [''],
    assignedServerIds: [[] as string[]],
    status: ['CONFIRMED']
  });

  quickClientForm = this.fb.group({
    nom: ['', Validators.required],
    telephone: ['', Validators.required],
    email: ['', Validators.email],
    adresse: [''],
    createdAt: [new Date().toISOString()]
  });

  quickStaffForm = this.fb.group({
    nom: ['', Validators.required],
    email: ['', [Validators.required, Validators.email]],
    telephone: ['', Validators.required],
    specialite: ['Salle'],
    role: ['SERVER'],
    active: [true]
  });

  ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.isEditMode.set(true);
      this.reservationId = id;
      this.loadReservation(id);
    }
  }

  loadReservation(id: string) {
    this.reservationService.getById(id).subscribe(res => {
      if (res) {
        this.form.patchValue({
          date: res.date,
          startTime: res.startTime,
          endTime: res.endTime,
          clientId: res.clientId,
          clientName: res.clientName,
          assignedServerIds: res.assignedServerIds || [],
          status: res.status
        });
        this.searchTerm.set(res.clientName || '');
      }
    });
  }

  // --- SELECTION STAFF ---
  isServerSelected(id: string): boolean {
    const current = this.form.value.assignedServerIds as string[];
    return current ? current.includes(id) : false;
  }
  toggleServer(id: string) {
    const current = (this.form.value.assignedServerIds as string[]) || [];
    let updated = current.includes(id) ? current.filter(sid => sid !== id) : [...current, id];
    this.form.patchValue({ assignedServerIds: updated });
  }
  getSelectedServerCount(): number { return (this.form.value.assignedServerIds as string[])?.length || 0; }

  // --- GESTION STAFF (CRUD) ---
  
  // 1. Ouvrir pour création
  openStaffModal() {
    this.editingStaffId.set(null);
    this.quickStaffForm.reset({ role: 'SERVER', specialite: 'Salle', active: true });
    this.showStaffModal.set(true);
  }

  // 2. Ouvrir pour modification
  editStaff(staff: any, event: Event) {
    event.stopPropagation(); // Empêche de toggle la sélection
    this.editingStaffId.set(staff.id);
    this.quickStaffForm.patchValue({
      nom: staff.nom,
      email: staff.email,
      telephone: staff.telephone,
      specialite: staff.specialite,
      role: staff.role || 'SERVER',
      active: staff.active !== undefined ? staff.active : true
    });
    this.showStaffModal.set(true);
  }

  // 3. Supprimer
  async deleteStaff(staff: any, event: Event) {
    event.stopPropagation();
    if (confirm('Voulez-vous vraiment supprimer ' + staff.nom + ' de l\'équipe ? Cette action est irréversible.')) {
      await this.staffService.delete(staff.id);
      // On retire aussi de la sélection si présent
      if (this.isServerSelected(staff.id)) {
        this.toggleServer(staff.id);
      }
    }
  }

  closeStaffModal() {
    this.showStaffModal.set(false);
    this.editingStaffId.set(null);
  }

  async saveQuickStaff() {
    if (this.quickStaffForm.valid) {
      this.isSavingStaff.set(true);
      try {
        const staffData = this.quickStaffForm.value;
        const editId = this.editingStaffId();

        if (editId) {
          // UPDATE
          await this.staffService.update(editId, staffData as any);
          this.closeStaffModal();
          // Pas besoin de toggle, on a juste mis à jour les infos
        } else {
          // CREATE
          const docRef = await this.staffService.add(staffData as any);
          this.closeStaffModal();
          // Sélection auto du nouveau
          this.toggleServer(docRef.id);
        }
      } catch (err) {
        console.error(err);
        alert("Erreur lors de l'enregistrement.");
      } finally {
        this.isSavingStaff.set(false);
      }
    }
  }

  // Shared Logic
  onSlotChange(event: any) {
    const startVal = event.target.value;
    const selectedSlot = this.configService.settings().creneaux.find(c => c.start === startVal);
    if (selectedSlot) this.form.patchValue({ endTime: selectedSlot.end });
  }
  onSearchInput(event: any) { this.searchTerm.set(event.target.value); this.isDropdownOpen.set(true); this.form.patchValue({ clientId: '', clientName: '' }); }
  openDropdown(ev: Event) { ev.stopPropagation(); this.isDropdownOpen.set(true); }
  closeDropdown() { setTimeout(() => this.isDropdownOpen.set(false), 200); }
  selectClient(client: any) { this.searchTerm.set(client.nom); this.form.patchValue({ clientId: client.id, clientName: client.nom }); this.isDropdownOpen.set(false); }
  clearSelection() { this.searchTerm.set(''); this.form.patchValue({ clientId: '', clientName: '' }); this.isDropdownOpen.set(true); }

  async onSubmit() {
    if (this.form.valid) {
      if (this.isEditMode() && this.reservationId) await this.reservationService.update(this.reservationId, this.form.value as any);
      else await this.reservationService.add(this.form.value as any);
      this.router.navigate(['/reservations']);
    }
  }
  cancel() { this.router.navigate(['/reservations']); }

  openClientModal() { this.quickClientForm.reset({ createdAt: new Date().toISOString() }); this.showClientModal.set(true); }
  closeClientModal() { this.showClientModal.set(false); }
  async saveQuickClient() {
    if (this.quickClientForm.valid) {
      this.isSavingClient.set(true);
      try {
        const newData = this.quickClientForm.value;
        const docRef = await this.clientService.add(newData as any);
        this.closeClientModal();
        this.selectClient({ id: docRef.id, nom: newData.nom, telephone: newData.telephone });
      } catch (err) { console.error(err); } finally { this.isSavingClient.set(false); }
    }
  }
}
