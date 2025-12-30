#!/bin/sh

# 1. Mise à jour du TypeScript pour ajouter la logique de filtrage des services
cat <<EOF > src/app/features/calendar/reservation-form/reservation-form.component.ts
import { ContractPdfService } from "../../../core/services/contract-pdf.service";
import { AdminConfirmDialogComponent } from "../../../shared/components/admin-confirm-dialog/admin-confirm-dialog.component";
import { Component, inject, OnInit, signal, computed, effect } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { firstValueFrom } from 'rxjs';
import { Firestore, collection, query, where, getDocs, doc, runTransaction } from '@angular/fire/firestore';

import { ReservationService } from '../../../core/services/reservation.service';
import { ClientService } from '../../../core/services/client.service';
import { TeamService } from '../../../core/services/team.service';
import { StaffService } from '../../../core/services/staff.service';
import { ServiceService } from '../../../core/services/service.service';
import { UiService } from '../../../core/services/ui.service';
import { AuthService } from '../../../core/services/auth.service';
import { ConfigService } from '../../../core/services/config.service';

import { ClientFormComponent } from '../../clients/client-form/client-form.component';
import { TeamFormComponent } from '../../teams/team-form/team-form.component';
import { StaffFormComponent } from '../../staff/staff-form/staff-form.component';
import { PaymentModalComponent } from './components/payment-modal/payment-modal.component';

@Component({
  selector: 'app-reservation-form',
  standalone: true,
  imports: [
    CommonModule, 
    ReactiveFormsModule, 
    ClientFormComponent, 
    TeamFormComponent, 
    StaffFormComponent, 
    PaymentModalComponent, AdminConfirmDialogComponent
  ],
  templateUrl: './reservation-form.component.html',
  styles: [\`
    .tab-content { animation: fadeIn 0.3s ease-in-out; } 
    @keyframes fadeIn { from { opacity: 0; transform: translateY(5px); } to { opacity: 1; transform: translateY(0); } }
  \`]
})
export class ReservationFormComponent implements OnInit {
  private contractPdfService = inject(ContractPdfService);
  private fb = inject(FormBuilder);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private location = inject(Location);
  private firestore = inject(Firestore);
  
  private reservationService = inject(ReservationService);
  private clientService = inject(ClientService);
  private teamService = inject(TeamService);
  private staffService = inject(StaffService);
  private serviceService = inject(ServiceService);
  private ui = inject(UiService);
  private authService = inject(AuthService);
  private configService = inject(ConfigService);

  isEditMode = signal(false);
  showAdminAuth = signal(false);
  loading = signal(false);
  activeTab = signal('pack');
  
  showClientModal = signal(false);
  showTeamModal = signal(false);
  showStaffModal = signal(false);
  showPaymentModal = signal(false);
  
  isPastReservation = signal(false);

  clientSearch = signal('');
  teamSearch = signal('');
  staffSearch = signal('');
  serviceSearch = signal(''); // Ajout du signal de recherche pour les services
  
  manualClientOverride = signal<any>(null);
  currentClientId = signal<string | null>(null);

  availableCredits = signal<any[]>([]);
  packs = signal<any[]>([]);
  packs$ = this.teamService.getPacks();

  private rawClients = toSignal(this.clientService.getAll(), { initialValue: [] });
  private rawTeams = toSignal(this.teamService.getTeams(), { initialValue: [] });
  private rawStaff = toSignal(this.staffService.getAll(), { initialValue: [] });
  
  servicesList = toSignal(this.serviceService.getAll(), { initialValue: [] });

  // Ajout du computed pour filtrer les services
  filteredServices = computed(() => {
    const term = this.serviceSearch().toLowerCase();
    const list = this.servicesList();
    if (!term) return list;
    return list.filter((s: any) => 
      (s.name && s.name.toLowerCase().includes(term)) || 
      (s.nom && s.nom.toLowerCase().includes(term))
    );
  });
  
  availableSlots = computed(() => this.configService.settings().creneaux || []);
  selectedDate = signal<string>('');

  filteredSlots = computed(() => {
    const date = this.selectedDate();
    const slots = this.availableSlots();
    if (!date || !slots) return [];
    return slots.filter(s => date >= s.validFrom && date <= s.validTo);
  });

  payments = signal<any[]>([]);
  form: FormGroup;
  reservationId: string | null = null;
  selectedServices = signal<any[]>([]);
  pendingParams = signal<{date: string, slot: string} | null>(null);

  constructor() {
    this.form = this.fb.group({
      date: ['', Validators.required],
      slotId: ['', Validators.required],
      selectedSlotId: [''],
      startTime: ['08:00'],
      endTime: ['12:00'],
      clientId: ['', Validators.required],
      packId: [null],
      assignedTeamIds: [[]],
      assignedServerIds: [[]],
      services: [[]],
      notes: [''],
      status: ['CONFIRMED'],
      totalPrice: [0],
      advance: [0]
    });

    this.form.get('clientId')?.valueChanges.subscribe(id => {
        this.currentClientId.set(id);
    });

    effect(() => {
      const slots = this.availableSlots();
      const params = this.pendingParams();
      
      if (slots && slots.length > 0 && params) {
        this.selectedDate.set(params.date);
        const genericSlot = params.slot || 'matin';
        let targetSlotId = genericSlot;
        const match = slots.find(s => 
            s.id.toLowerCase().includes(genericSlot.toLowerCase()) && 
            params.date >= s.validFrom && params.date <= s.validTo
        );
        if (match) targetSlotId = match.id;

        this.form.patchValue({ date: params.date, slotId: targetSlotId, selectedSlotId: targetSlotId });
        this.applySlotTimes(targetSlotId);
        this.pendingParams.set(null);
        setTimeout(() => this.calculateTotal(), 200);
      }
    }, { allowSignalWrites: true });
  }

  async ngOnInit() {
    this.teamService.getPacks().subscribe(data => {
        if (data && data.length > 0) this.packs.set(data);
    });

    this.form.get('date')?.valueChanges.subscribe(val => {
        this.selectedDate.set(val);
        if (!this.isPastReservation()) this.calculateTotal();
    });

    this.reservationId = this.route.snapshot.paramMap.get('id');
    const queryDate = this.route.snapshot.queryParamMap.get('date');
    const querySlot = this.route.snapshot.queryParamMap.get('slotId');

    if (this.reservationId) {
      this.isEditMode.set(true);
      await this.loadReservation(this.reservationId);
    } else if (queryDate) {
      this.pendingParams.set({ date: queryDate, slot: querySlot || 'matin' });
      this.setActiveTab('info');
    }
  }

  getDateObject(dateField: any): Date | null {
    if (!dateField) return null;
    if (dateField.toDate && typeof dateField.toDate === 'function') { return dateField.toDate(); }
    if (dateField instanceof Date) { return dateField; }
    return new Date(dateField);
  }

  private async loadReservation(id: string) {
    this.loading.set(true);
    try {
        const list = await firstValueFrom(this.reservationService.getReservations());
        const res = list.find((r: any) => r.id === id);
        if (res) {
            let dateStr = res.date;
            if (res.date && res.date.toDate) dateStr = res.date.toDate().toISOString().split('T')[0];
            else if (res.date instanceof Date) dateStr = res.date.toISOString().split('T')[0];

            this.selectedDate.set(dateStr);
            const resDate = new Date(dateStr);
            const today = new Date();
            today.setHours(0,0,0,0);
            if (resDate < today) { this.isPastReservation.set(true); this.form.disable(); }

            const slotId = (res.selectedSlotId || res.slotId || '');
            this.form.patchValue({ ...res, date: dateStr, slotId, selectedSlotId: slotId });
            
            if (res.clientId) {
                this.currentClientId.set(res.clientId);
                this.loadClientCredits(res.clientId);
            }

            this.applySlotTimes(slotId);
            if (res.services && Array.isArray(res.services)) { this.selectedServices.set(res.services); }
            
            this.setActiveTab('info');
            await this.loadPayments(id);
        }
    } catch (e) { console.error(e); }
    this.loading.set(false);
  }

  selectPack(packId: string | null, packData: any = null) {
    if (this.isPastReservation()) return;
    this.form.patchValue({ packId });
    this.calculateTotal(); 
  }

  toggleService(service: any) {
    if (this.isPastReservation()) return;
    const current = this.selectedServices();
    const updated = current.find(s => s.id === service.id) ? current.filter(s => s.id !== service.id) : [...current, service];
    this.selectedServices.set(updated);
    this.form.patchValue({ services: updated });
    this.calculateTotal(); 
  }

  getDynamicSlotPrice(dateStr: string, slotId: string): number {
    if (!dateStr || !slotId) return 0;
    const slot = this.availableSlots().find(s => s.id === slotId);
    return slot ? Number(slot.price) : 0;
  }

  calculateTotal() {
    let total = 0;
    const packId = this.form.get('packId')?.value;
    const packs = this.packs();
    if (packId && packs.length > 0) {
      const pack = packs.find(p => p.id == packId);
      if (pack) total += Number(pack.price || pack.prix || 0);
    } else {
      const dateVal = this.form.get('date')?.value;
      const slotVal = this.form.get('slotId')?.value;
      total += this.getDynamicSlotPrice(dateVal, slotVal);
    }
    const services = this.selectedServices();
    if (services && services.length > 0) {
      total += services.reduce((sum, s) => sum + Number(s.price || s.prix || 0), 0);
    }
    if (this.form.get('totalPrice')?.value !== total) {
       this.form.patchValue({ totalPrice: total }, { emitEvent: false });
    }
  }

  getPackTotal(pack: any): number { return Number(pack.price || pack.prix || 0); }
  setActiveTab(tab: string) { this.activeTab.set(tab); }

  filteredClients = computed(() => {
    const term = this.clientSearch().toLowerCase();
    let clients = [...this.rawClients()]; 
    const override = this.manualClientOverride();
    const selectedId = this.currentClientId();
    if (override) { 
        clients = clients.filter(c => c.id !== override.id); 
        clients.unshift(override); 
    } else if (selectedId) {
        const index = clients.findIndex(c => c.id === selectedId);
        if (index > -1) { const [selected] = clients.splice(index, 1); clients.unshift(selected); }
    }
    if (term) clients = clients.filter(c => (c.nom?.toLowerCase().includes(term)) || (c.prenom?.toLowerCase().includes(term)) || (c.telephone?.includes(term)) || (c.telephone2?.includes(term)));
    return clients.slice(0, 5);
  });
  
  selectedClient = computed(() => {
    const id = this.currentClientId();
    if (!id) return null;
    const override = this.manualClientOverride();
    if (override && override.id === id) return override;
    return this.rawClients().find(c => c.id === id) || null;
  });

  filteredTeams = computed(() => { const term = this.teamSearch().toLowerCase(); return this.rawTeams().filter(t => !term || (t.nom && t.nom.toLowerCase().includes(term))); });
  
  filteredStaff = computed(() => { const term = this.staffSearch().toLowerCase(); return this.rawStaff().filter(s => !term || (s.nom && s.nom.toLowerCase().includes(term))); });

  openClientModal() { if (this.isPastReservation()) return; this.showClientModal.set(true); }
  closeClientModal() { this.showClientModal.set(false); }
  
  openTeamModal() { if (this.isPastReservation()) return; this.showTeamModal.set(true); }
  closeTeamModal() { this.showTeamModal.set(false); }

  openStaffModal() { if (this.isPastReservation()) return; this.showStaffModal.set(true); }
  closeStaffModal() { this.showStaffModal.set(false); }

  onClientModalFinish(res: any) {
    this.closeClientModal();
    if (res && res.id) {
      this.manualClientOverride.set(res);
      this.currentClientId.set(res.id);
      this.form.patchValue({ clientId: res.id });
      this.loadClientCredits(res.id);
      this.clearClientSearch();
    }
  }

  onTeamModalFinish(res: any) {
    this.closeTeamModal();
    if (res && res.id) this.toggleTeam(res.id);
  }

  onStaffModalFinish(res: any) {
    this.closeStaffModal();
    if (res && res.id) this.toggleStaff(res.id);
  }

  selectClient(client: any) {
    if (this.isPastReservation()) return;
    this.manualClientOverride.set(null);
    this.currentClientId.set(client.id);
    this.form.patchValue({ clientId: client.id });
    this.loadClientCredits(client.id);
    this.clearClientSearch();
  }
  onClientSearch(event: any) { this.clientSearch.set(event.target.value); }
  clearClientSearch() { this.clientSearch.set(''); }

  private toggleIdInArray(controlName: string, id: string) {
    if (this.isPastReservation()) return;
    const current = this.form.get(controlName)?.value || [];
    const updated = current.includes(id) ? current.filter((x: string) => x !== id) : [...current, id];
    this.form.patchValue({ [controlName]: updated });
  }
  toggleTeam(id: string) { this.toggleIdInArray('assignedTeamIds', id); }
  isTeamSelected(id: string): boolean { return (this.form.get('assignedTeamIds')?.value || []).includes(id); }
  toggleStaff(id: string) { this.toggleIdInArray('assignedServerIds', id); }
  isStaffSelected(id: string): boolean { return (this.form.get('assignedServerIds')?.value || []).includes(id); }

  isServiceSelected(service: any): boolean { return !!this.selectedServices().find(s => s.id === service.id); }

  private applySlotTimes(slotId: string) {
    const slot = this.availableSlots().find(s => s.id === slotId);
    if (slot) this.form.patchValue({ selectedSlotId: slotId, startTime: slot.start, endTime: slot.end }, { emitEvent: false });
  }
  
  onSlotChange(event: any) { 
    const val = event?.target?.value || '';
    this.applySlotTimes(val);
    if (!this.isPastReservation()) this.calculateTotal();
  }

  async loadClientCredits(clientId: string) {
      if (!clientId) return;
      try {
          const q = query(collection(this.firestore, 'provisional_receipts'), where('clientId', '==', clientId), where('status', '==', 'AVAILABLE'));
          const snap = await getDocs(q);
          this.availableCredits.set(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      } catch (e) { console.error(e); }
  }

  async useCredit(credit: any) {
      if (!this.reservationId) { this.ui.showToast('info', 'Enregistrez d\'abord'); return; }
      if (!await this.ui.confirm('Utiliser cet avoir ?', 'Montant: ' + credit.amount + ' DT')) return;
      this.loading.set(true);
      try {
          await runTransaction(this.firestore, async (transaction) => {
              const resRef = doc(this.firestore, 'reservations', this.reservationId!);
              const resSnap = await transaction.get(resRef);
              const creditRef = doc(this.firestore, 'provisional_receipts', credit.id);
              transaction.update(creditRef, { status: 'USED', usedForReservationId: this.reservationId, usedAt: new Date() });
              const newPaymentRef = doc(collection(this.firestore, 'payments'));
              transaction.set(newPaymentRef, {
                  reservationId: this.reservationId,
                  amount: credit.amount,
                  type: 'BON',
                  date: new Date(),
                  creditId: credit.id,
                  description: 'Utilisation avoir'
              });
              const currentAdvance = Number(resSnap.data()?.['advance'] || 0);
              transaction.update(resRef, { advance: currentAdvance + Number(credit.amount) });
          });
          this.ui.showToast('success', 'Avoir utilisé');
          await this.loadPayments(this.reservationId);
          await this.loadClientCredits(this.form.get('clientId')?.value);
      } catch (e) { this.ui.showToast('error', 'Erreur transaction'); }
      this.loading.set(false);
  }

  async loadPayments(reservationId: string) {
    try {
      const q = query(collection(this.firestore, 'payments'), where('reservationId', '==', reservationId));
      const snap = await getDocs(q);
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      data.sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime());
      this.payments.set(data);
      const totalPaid = data.reduce((sum, p: any) => sum + Number(p.amount || 0), 0);
      this.form.patchValue({ advance: totalPaid }, { emitEvent: false });
    } catch (e) { console.error("Erreur paiements", e); }
  }

  async deletePayment(payment: any) {
    if (!this.reservationId) return;
    if (!await this.ui.confirm('Annuler ?', 'Irréversible')) return;
    this.loading.set(true);
    try {
      await runTransaction(this.firestore, async (transaction) => {
        const resRef = doc(this.firestore, 'reservations', this.reservationId!);
        const resSnap = await transaction.get(resRef);
        if (payment.type === 'BON' && payment.creditId) {
            const creditRef = doc(this.firestore, 'provisional_receipts', payment.creditId);
            transaction.update(creditRef, { status: 'AVAILABLE', usedForReservationId: null, usedAt: null });
        }
        transaction.delete(doc(this.firestore, 'payments', payment.id));
        const currentAdvance = Number(resSnap.data()?.['advance'] || 0);
        transaction.update(resRef, { advance: Math.max(0, currentAdvance - Number(payment.amount || 0)) });
      });
      this.ui.showToast('success', 'Supprimé');
      await this.loadPayments(this.reservationId);
      if (payment.type === 'BON') this.loadClientCredits(this.form.get('clientId')?.value);
    } catch (e) { console.error(e); this.ui.showToast('error', 'Erreur transaction'); }
    this.loading.set(false);
  }

  
  async onDeleteReservation() { 
    if (!this.reservationId) return;
    const hasPayments = this.payments().length > 0;
    
    if (await this.ui.confirm("Suppression", hasPayments ? "Avoirs seront générés. Confirmer ?" : "Supprimer ?")) {
        this.showAdminAuth.set(true);
    }
  }

  async onAdminAuthSuccess() {
    this.showAdminAuth.set(false);
    this.loading.set(true);
    try {
        const hasPayments = this.payments().length > 0;
        if (hasPayments) await this.processCancellationWithCredits();
        else if (this.reservationId) await this.reservationService.updateReservation(this.reservationId, { status: 'CANCELLED' });
        
        this.ui.showToast("success", "Réservation annulée");
        this.onClose();
    } catch (e) { 
        console.error(e);
        this.ui.showToast("error", "Erreur suppression"); 
    }
    this.loading.set(false);
  }


  private async processCancellationWithCredits() {
      if (!this.reservationId) return;
      const payments = this.payments();
      const clientId = this.form.get('clientId')?.value;
      const reservationDate = this.form.get('date')?.value;
      await runTransaction(this.firestore, async (transaction) => {
          for (const p of payments) {
              if (p.type === 'BON' && p.creditId) {
                  const creditRef = doc(this.firestore, 'provisional_receipts', p.creditId);
                  transaction.update(creditRef, { status: 'AVAILABLE', usedForReservationId: null, usedAt: null });
              } else {
                  const newReceiptRef = doc(collection(this.firestore, 'provisional_receipts'));
                  transaction.set(newReceiptRef, {
                      clientId: clientId,
                      amount: p.amount,
                      createdAt: new Date(),
                      originalPaymentDate: p.date,
                      originalPaymentType: p.type || 'INCONNU',
                      source: 'CANCELLATION',
                      sourceReservationId: this.reservationId,
                      description: \`Avoir annulation \${reservationDate}\`,
                      status: 'AVAILABLE'
                  });
              }
              transaction.delete(doc(this.firestore, 'payments', p.id));
          }
          // SOFT DELETE : On met à jour le statut au lieu de supprimer physiquement le document
          const resRef = doc(this.firestore, 'reservations', this.reservationId!);
          transaction.update(resRef, { status: 'CANCELLED', updatedAt: new Date().toISOString() });
      });
  }

  async onSubmit() {
    if (this.isPastReservation()) return; 
    if (this.form.invalid) {
      if (this.form.get('clientId')?.invalid || this.form.get('date')?.invalid) this.setActiveTab('info');
      return;
    }
    this.loading.set(true);
    const data = { ...this.form.value };
    try {
      if (this.isEditMode() && this.reservationId) await this.reservationService.updateReservation(this.reservationId, data);
      else { const docRef = await this.reservationService.addReservation(data); this.reservationId = docRef.id; this.isEditMode.set(true); this.location.replaceState("/reservations/edit/" + docRef.id); }
      this.ui.showToast('success', 'Enregistré');
    } catch (e) { this.ui.showToast('error', 'Erreur'); }
    this.loading.set(false);
  }
  
  
async onPrint() {
    if (!this.reservationId) {
       this.ui.showToast("error", "Enregistrez d'abord la réservation");
       return;
    }
    this.loading.set(true);
    try {
       const clientId = this.form.get("clientId")?.value;
       let clientData = {};
       if (clientId) {
           clientData = await firstValueFrom(this.clientService.getClient(clientId)) || {};
       }
       
       const fullReservationData = { 
           ...this.currentReservationData, 
           client: clientData 
       };

       this.contractPdfService.generateContract(fullReservationData);
       
    } catch(e) {
       console.error(e);
       this.ui.showToast("error", "Erreur lors de la génération du PDF");
    }
    this.loading.set(false);
  }

  onClose() { this.router.navigate(['/reservations']); }
  get currentReservationData() { return { id: this.reservationId, ...this.form.getRawValue() }; }
  
  openPaymentModal() { if (!this.reservationId) return; this.showPaymentModal.set(true); }
  closePaymentModal() { this.showPaymentModal.set(false); }
  async onPaymentFinished() { this.closePaymentModal(); if(this.reservationId) await this.loadPayments(this.reservationId); }
}
EOF

# 2. Mise à jour du Template HTML pour ajouter le champ de recherche dans l'onglet Services
cat <<'EOF' > src/app/features/calendar/reservation-form/reservation-form.component.html
<div class="max-w-5xl mx-auto bg-white rounded-2xl shadow-xl mt-6 border border-slate-100 flex flex-col min-h-[600px] overflow-hidden">
  
  <div class="px-8 py-5 border-b border-slate-100 bg-white z-10">
    <div class="flex justify-between items-center mb-6">
      <h2 class="text-2xl font-black text-slate-800 flex items-center">
        <span class="material-icons mr-3 text-blue-600">event_available</span>
        {{ isEditMode() ? 'Modifier la Réservation' : 'Nouvelle Réservation' }}
      </h2>
      <div class="flex gap-2">
        @if (isEditMode()) {
          <button type="button" (click)="onPrint()" class="flex items-center gap-2 px-3 py-1.5 bg-purple-100 text-purple-700 rounded-lg font-bold hover:bg-purple-200 transition text-sm">
            <span class="material-icons text-sm">print</span> Contrat
          </button>
          
          <button type="button" (click)="onDeleteReservation()" class="flex items-center gap-2 px-3 py-1.5 bg-red-100 text-red-700 rounded-lg font-bold hover:bg-red-200 transition text-sm">
            <span class="material-icons text-sm">delete</span>
          </button>
        }
        <button type="button" (click)="onClose()" class="text-slate-400 hover:text-slate-600 p-2 ml-2">
          <span class="material-icons">close</span>
        </button>
      </div>
    </div>

    <div class="flex items-center gap-1 overflow-x-auto no-scrollbar pb-1">
      <button (click)="setActiveTab('info')" 
              [class]="activeTab() === 'info' ? 'bg-blue-600 text-white shadow-md shadow-blue-200' : 'bg-slate-50 text-slate-500 hover:bg-slate-100'"
              class="px-4 py-2 rounded-lg font-bold text-xs uppercase tracking-wide transition flex items-center gap-2 whitespace-nowrap">
        <span class="material-icons text-sm">person</span> Informations
      </button>

      <button (click)="setActiveTab('staff')" 
              [class]="activeTab() === 'staff' ? 'bg-orange-500 text-white shadow-md shadow-orange-200' : 'bg-slate-50 text-slate-500 hover:bg-slate-100'"
              class="px-4 py-2 rounded-lg font-bold text-xs uppercase tracking-wide transition flex items-center gap-2 whitespace-nowrap">
        <span class="material-icons text-sm">badge</span> Pers. Salle
      </button>

      <button (click)="setActiveTab('teams')" 
              [class]="activeTab() === 'teams' ? 'bg-purple-600 text-white shadow-md shadow-purple-200' : 'bg-slate-50 text-slate-500 hover:bg-slate-100'"
              class="px-4 py-2 rounded-lg font-bold text-xs uppercase tracking-wide transition flex items-center gap-2 whitespace-nowrap">
        <span class="material-icons text-sm">groups</span> Équipes
      </button>
      <button (click)="setActiveTab('pack')" 
              [class]="activeTab() === 'pack' ? 'bg-slate-800 text-white' : 'bg-slate-50 text-slate-500 hover:bg-slate-100'"
              class="px-4 py-2 rounded-lg font-bold text-xs uppercase tracking-wide transition flex items-center gap-2 whitespace-nowrap">
        <span class="material-icons text-sm">inventory_2</span> Choix du Pack
      </button>
      <button (click)="setActiveTab('services')" 
              [class]="activeTab() === 'services' ? 'bg-indigo-600 text-white shadow-md shadow-indigo-200' : 'bg-slate-50 text-slate-500 hover:bg-slate-100'"
              class="px-4 py-2 rounded-lg font-bold text-xs uppercase tracking-wide transition flex items-center gap-2 whitespace-nowrap">
        <span class="material-icons text-sm">room_service</span> Services
      </button><button (click)="setActiveTab('reglement')" 
              [class]="activeTab() === 'reglement' ? 'bg-emerald-600 text-white shadow-md shadow-emerald-200' : 'bg-slate-50 text-slate-500 hover:bg-slate-100'"
              class="px-4 py-2 rounded-lg font-bold text-xs uppercase tracking-wide transition flex items-center gap-2 whitespace-nowrap">
        <span class="material-icons text-sm">payments</span> Règlements
      </button>
    </div>
  </div>

  <form [formGroup]="form" (ngSubmit)="onSubmit()" class="flex-1 flex flex-col relative overflow-hidden bg-slate-50/50">
    
    <div class="flex-1 p-8 overflow-y-auto custom-scrollbar">

      @if (activeTab() === 'pack') {
        <div class="tab-content max-w-2xl mx-auto space-y-6">
          
          @if (isPastReservation()) {
            <div class="bg-orange-50 border-l-4 border-orange-400 p-4 rounded shadow-sm mb-6 flex items-start gap-3">
              <span class="material-icons text-orange-500 mt-0.5">lock_clock</span>
              <div>
                <h4 class="font-bold text-orange-800 text-sm uppercase">Modification Verrouillée</h4>
                <p class="text-sm text-orange-700">Cette réservation est passée. Le choix du pack est verrouillé.</p>
              </div>
            </div>
          }

          <div class="text-center mb-8">
            <h3 class="text-xl font-black text-slate-700">Sélectionnez un Pack</h3>
            <p class="text-slate-400 text-sm">Choisissez une base pour pré-remplir les services</p>
          </div>
          
          <div class="space-y-4">
            <div (click)="selectPack(null)"
                 class="p-5 rounded-xl border-2 transition-all flex items-center gap-4 relative"
                 [class.pointer-events-none]="isPastReservation()"
                 [class.opacity-60]="isPastReservation()"
                 [class.cursor-pointer]="!isPastReservation()"
                 [class.border-slate-800]="form.value.packId === null"
                 [class.bg-white]="form.value.packId === null"
                 [class.border-slate-200]="form.value.packId !== null">
               
               <div class="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center">
                 <span class="material-icons text-slate-500">edit_off</span>
               </div>
               <div>
                 <div class="font-bold text-slate-800">Sur Mesure (Aucun Pack)</div>
                 <div class="text-xs text-slate-500">Prix calculé selon Date & Créneau</div>
               </div>
               
               @if (isPastReservation() && form.value.packId === null) {
                  <span class="material-icons text-slate-400 absolute right-4">lock</span>
               }
            </div>

            @for (pack of packs$ | async; track pack.id) {
              <div (click)="selectPack(pack.id, pack)"
                   class="p-5 rounded-xl border-2 transition-all flex items-center gap-4 bg-white relative"
                   [class.pointer-events-none]="isPastReservation()"
                   [class.opacity-60]="isPastReservation()"
                   [class.cursor-pointer]="!isPastReservation()"
                   [class.hover:border-blue-300]="!isPastReservation()"
                   [class.border-blue-600]="form.value.packId === pack.id"
                   [class.ring-1]="form.value.packId === pack.id"
                   [class.ring-blue-600]="form.value.packId === pack.id"
                   [class.border-transparent]="form.value.packId !== pack.id">
                
                <div class="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center">
                  <span class="material-icons text-blue-600">inventory_2</span>
                </div>
                <div class="flex-1">
                  <div class="font-bold text-slate-800">{{ pack.nom }}</div>
                  <div class="text-xs text-slate-500">{{ getPackTotal(pack) }} DT</div>
                </div>
                
                @if (form.value.packId === pack.id) {
                  <span class="material-icons text-blue-600">check_circle</span>
                  @if (isPastReservation()) {
                    <span class="material-icons text-slate-400 ml-2">lock</span>
                  }
                }
              </div>
            }
          </div>
          
          <div class="pt-8 text-center">
            <button type="button" (click)="setActiveTab('info')" class="px-6 py-2 bg-slate-800 text-white rounded-lg font-bold hover:bg-slate-900 transition">
              Suivant : Informations
            </button>
          </div>
        </div>
      }

      @if (activeTab() === 'info') {
        <div class="tab-content">
          
          <div class="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div class="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm text-center">
              <div class="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Total Dossier</div>
              <div class="flex items-center justify-center gap-1">
                <input formControlName="totalPrice" type="number" class="w-24 text-center font-black text-2xl text-slate-700 bg-transparent outline-none border-b border-dashed border-slate-200 focus:border-slate-500">
                <span class="font-bold text-slate-600">DT</span>
              </div>
            </div>

            <div class="bg-emerald-50 p-5 rounded-2xl border border-emerald-100 shadow-sm text-center">
              <div class="text-xs font-bold text-emerald-600 uppercase tracking-widest mb-2">Déjà Payé</div>
              <div class="text-2xl font-black text-emerald-700">
                {{ form.value.advance || 0 }} DT
              </div>
            </div>

            <div class="bg-slate-800 p-5 rounded-2xl shadow-lg text-center text-white">
              <div class="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Reste à payer</div>
              <div class="font-black text-2xl">
                {{ (form.value.totalPrice || 0) - (form.value.advance || 0) }} DT
              </div>
            </div>
          </div>

          <div class="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div class="space-y-6">
              <div class="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                <h4 class="text-sm font-black text-slate-500 uppercase mb-4 flex items-center gap-2">
                  <span class="material-icons text-blue-500">calendar_today</span> Date & Horaire
                </h4>
                <div class="space-y-4">
                  <div>
                    <label class="block text-xs font-bold text-slate-500 mb-1">Date de l'événement</label>
                    <input formControlName="date" type="date" class="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none font-semibold text-slate-700">
                  </div>
                  <div>
                    <label class="block text-xs font-bold text-slate-500 mb-1">Créneau</label>
                    <select formControlName="slotId" (change)="onSlotChange($event)" class="w-full px-4 py-3 rounded-xl border border-slate-200 bg-white outline-none">
                      <option value="">Sélectionner un créneau...</option>
                      @for (slot of filteredSlots(); track slot.id) {
                        <option [value]="slot.id">{{ slot.label }} ({{ slot.start }} - {{ slot.end }})</option>
                      }
                    </select>
                  </div>
                  <div class="grid grid-cols-2 gap-4 pt-2">
                     <div>
                       <label class="text-[10px] uppercase text-slate-400 font-bold">Début</label>
                       <input type="time" formControlName="startTime" class="w-full p-2 bg-slate-50 rounded border border-slate-200 text-sm">
                     </div>
                     <div>
                       <label class="text-[10px] uppercase text-slate-400 font-bold">Fin</label>
                       <input type="time" formControlName="endTime" class="w-full p-2 bg-slate-50 rounded border border-slate-200 text-sm">
                     </div>
                  </div>
                </div>
              </div>

              <div class="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex-1 flex flex-col">
                 <div class="flex justify-between items-center mb-4">
                   <h4 class="text-sm font-black text-slate-500 uppercase flex items-center gap-2">
                     <span class="material-icons text-blue-500">search</span> Sélection Client
                   </h4>
                   <button type="button" (click)="openClientModal()" class="text-xs font-bold text-blue-600 bg-blue-50 px-3 py-1.5 rounded-lg hover:bg-blue-100 transition">
                     + Nouveau
                   </button>
                 </div>
                 
                 <input type="text" [value]="clientSearch()" (input)="onClientSearch($event)" placeholder="Rechercher nom, tél..." class="w-full px-4 py-2 rounded-lg border border-slate-200 outline-none focus:border-blue-400 mb-3">
                 
                 <div class="flex-1 overflow-y-auto max-h-[250px] space-y-2 custom-scrollbar pr-1">
                   @for (c of filteredClients(); track c.id) {
                     <div (click)="selectClient(c)" 
                          class="p-3 rounded-xl cursor-pointer border transition-all flex justify-between items-center"
                          [class.bg-blue-50]="form.value.clientId === c.id"
                          [class.border-blue-500]="form.value.clientId === c.id"
                          [class.border-slate-100]="form.value.clientId !== c.id">
                       <div>
                         <div class="font-bold text-slate-800 text-sm">{{ c.nom }} {{ c.prenom }}</div>
                         <div class="text-xs text-slate-500">
                            {{ c.telephone }}
                            <span *ngIf="c.telephone2" class="text-slate-400">/ {{ c.telephone2 }}</span>
                         </div>
                       </div>
                       @if(form.value.clientId === c.id) {
                         <span class="material-icons text-blue-600 text-sm">check_circle</span>
                       }
                     </div>
                   }
                 </div>
              </div>
            </div>

            <div>
              @if (selectedClient()) {
                <div class="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm h-full">
                  <div class="flex items-center gap-3 border-b pb-4 mb-4">
                    <div class="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold text-xl">
                      {{ selectedClient()?.nom?.charAt(0) }}
                    </div>
                    <div>
                      <h3 class="font-bold text-lg text-slate-800">{{ selectedClient()?.nom }} {{ selectedClient()?.prenom }}</h3>
                      <div class="text-slate-500 text-sm flex items-center gap-1">
                        <span class="material-icons text-[14px]">phone</span> {{ selectedClient()?.telephone }}
                        @if(selectedClient()?.telephone2) { <span class="mx-1 text-slate-400">/</span> {{ selectedClient()?.telephone2 }} }
                      </div>
                    </div>
                  </div>

                  <div class="space-y-3 text-sm">
                     <div class="grid grid-cols-3 gap-2 py-1 border-b border-slate-50">
                       <span class="text-slate-400 font-medium">Email</span>
                       <span class="col-span-2 text-slate-800 font-semibold truncate">{{ selectedClient()?.email || '-' }}</span>
                     </div>
                     <div class="grid grid-cols-3 gap-2 py-1 border-b border-slate-50">
                       <span class="text-slate-400 font-medium">Adresse</span>
                       <span class="col-span-2 text-slate-800 font-semibold">{{ selectedClient()?.adresse || '-' }}</span>
                     </div>
                     <div class="grid grid-cols-3 gap-2 py-1 border-b border-slate-50">
                       <span class="text-slate-400 font-medium">Ville</span>
                       <span class="col-span-2 text-slate-800 font-semibold">{{ selectedClient()?.ville || '-' }}</span>
                     </div>
                     <div class="grid grid-cols-3 gap-2 py-1 border-b border-slate-50">
                       <span class="text-slate-400 font-medium">CIN</span>
                       <span class="col-span-2 text-slate-800 font-semibold">{{ selectedClient()?.cin || '-' }}</span>
                     </div>
                     <div class="pt-4">
                       <span class="block text-slate-400 font-medium mb-1">Notes Client</span>
                       <div class="bg-slate-50 p-3 rounded-lg text-slate-600 italic border border-slate-100 min-h-[80px]">
                         {{ selectedClient()?.notes || 'Aucune note.' }}
                       </div>
                     </div>
                  </div>
                </div>
              } @else {
                <div class="h-full flex flex-col items-center justify-center text-slate-400 p-8 border-2 border-dashed border-slate-200 rounded-2xl bg-slate-50">
                  <span class="material-icons text-6xl mb-4 text-slate-300">person_search</span>
                  <p>Veuillez sélectionner ou créer un client</p>
                </div>
              }
            </div>
          </div>

          <div class="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm mt-6">
            <h3 class="font-bold text-slate-700 mb-3 flex items-center gap-2">
              <span class="material-icons text-slate-400">sticky_note_2</span>
              Notes & Commentaires
            </h3>
            <textarea 
              formControlName="notes" 
              rows="4" 
              placeholder="Instructions spéciales..."
              class="w-full p-4 rounded-xl border border-slate-200 text-slate-700 focus:ring-2 focus:ring-indigo-500 outline-none transition resize-none bg-slate-50"></textarea>
          </div>

                  </div>
      }

      @if (activeTab() === 'teams') {
        <div class="tab-content max-w-4xl mx-auto">
          <div class="flex justify-between items-center mb-6">
            <h3 class="text-lg font-black text-slate-700 flex items-center gap-2">
              <span class="material-icons text-purple-600">handshake</span> Prestataires Externes
            </h3>
            <div class="flex items-center gap-3">
              <button type="button" (click)="openTeamModal()" class="text-xs font-bold text-purple-600 bg-purple-50 px-3 py-1.5 rounded-lg hover:bg-purple-100 transition whitespace-nowrap">
                + Nouveau
              </button>
              <div class="relative w-64">
                <input type="text" (input)="teamSearch.set($any($event.target).value)" placeholder="Filtrer..." class="w-full pl-9 pr-4 py-2 rounded-lg border border-slate-200 text-sm">
                <span class="material-icons absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 text-lg">search</span>
              </div>
            </div>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            @for (team of filteredTeams(); track team.id) {
              <div (click)="toggleTeam(team.id!)" 
                   class="group relative p-4 rounded-xl border-2 cursor-pointer transition-all hover:shadow-md bg-white overflow-hidden"
                   [class.border-purple-500]="isTeamSelected(team.id!)" 
                   [class.bg-purple-50]="isTeamSelected(team.id!)"
                   [class.border-slate-100]="!isTeamSelected(team.id!)">
                
                <div class="flex justify-between items-start mb-2">
                  <div class="font-bold text-slate-800">{{ team.nom }}</div>
                  @if(isTeamSelected(team.id!)) {
                    <span class="material-icons text-purple-600">check_circle</span>
                  }
                </div>
                <div class="text-xs text-slate-500 line-clamp-2 mb-2">{{ team.specialite || 'Aucune spécialité' }}</div>
                <div class="text-xs font-semibold text-slate-400 flex items-center gap-1">
                   <span class="material-icons text-[12px]">phone</span> {{ team.contact || '-' }}
                </div>
                
                <div class="absolute inset-0 bg-purple-600/5 opacity-0 group-hover:opacity-100 transition pointer-events-none"></div>
              </div>
            }
          </div>
        </div>
      }

      @if (activeTab() === 'staff') {
        <div class="tab-content max-w-4xl mx-auto">
          <div class="flex justify-between items-center mb-6">
            <h3 class="text-lg font-black text-slate-700 flex items-center gap-2">
              <span class="material-icons text-orange-500">badge</span> Personnel de Salle
            </h3>
            <div class="flex items-center gap-3">
              <button type="button" (click)="openStaffModal()" class="text-xs font-bold text-orange-600 bg-orange-50 px-3 py-1.5 rounded-lg hover:bg-orange-100 transition whitespace-nowrap">
                + Nouveau
              </button>
              <div class="relative w-64">
                <input type="text" (input)="staffSearch.set($any($event.target).value)" placeholder="Filtrer staff..." class="w-full pl-9 pr-4 py-2 rounded-lg border border-slate-200 text-sm">
                <span class="material-icons absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 text-lg">search</span>
              </div>
            </div>
          </div>

          <div class="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3">
            @for (staff of filteredStaff(); track staff.id) {
              <div (click)="toggleStaff(staff.id!)" 
                   class="p-3 rounded-xl border cursor-pointer transition-all hover:bg-orange-50 text-center relative bg-white"
                   [class.border-orange-500]="isStaffSelected(staff.id!)" 
                   [class.bg-orange-50]="isStaffSelected(staff.id!)"
                   [class.border-slate-200]="!isStaffSelected(staff.id!)">
                
                <div class="w-12 h-12 mx-auto rounded-full bg-slate-100 mb-2 flex items-center justify-center text-slate-500 font-bold border border-slate-200">
                  {{ staff.nom.charAt(0) }}
                </div>
                <div class="font-bold text-sm text-slate-800 truncate">{{ staff.nom }}</div>
                <div class="text-[10px] text-slate-500 truncate">{{ staff.role || 'Staff' }}</div>

                @if (isStaffSelected(staff.id!)) {
                  <div class="absolute top-1 right-1">
                    <span class="material-icons text-orange-500 text-sm">check_circle</span>
                  </div>
                }
              </div>
            }
          </div>
        </div>
      }

      @if (activeTab() === 'reglement') {
        <div class="tab-content max-w-4xl mx-auto">
          
          <div class="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div class="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm text-center">
              <div class="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Total Dossier</div>
              <div class="flex items-center justify-center gap-1">
                <input formControlName="totalPrice" type="number" class="w-24 text-center font-black text-2xl text-slate-700 bg-transparent outline-none border-b border-dashed border-slate-200 focus:border-slate-500">
                <span class="font-bold text-slate-600">DT</span>
              </div>
            </div>

            <div class="bg-emerald-50 p-5 rounded-2xl border border-emerald-100 shadow-sm text-center">
              <div class="text-xs font-bold text-emerald-600 uppercase tracking-widest mb-2">Déjà Payé</div>
              <div class="text-2xl font-black text-emerald-700">
                {{ form.value.advance || 0 }} DT
              </div>
            </div>

            <div class="bg-slate-800 p-5 rounded-2xl shadow-lg text-center text-white">
              <div class="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Reste à payer</div>
              <div class="font-black text-2xl">
                {{ (form.value.totalPrice || 0) - (form.value.advance || 0) }} DT
              </div>
            </div>
          </div>

          @if (availableCredits().length > 0) {
            <div class="mb-8 p-6 bg-purple-50 rounded-2xl border border-purple-100 shadow-sm relative overflow-hidden">
                <div class="absolute top-0 right-0 p-4 opacity-10">
                    <span class="material-icons text-9xl text-purple-600">local_offer</span>
                </div>
                <h4 class="font-black text-purple-800 flex items-center gap-2 mb-4 relative z-10">
                    <span class="material-icons">card_giftcard</span> Bons & Avoirs Disponibles
                </h4>
                <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 relative z-10">
                    @for (credit of availableCredits(); track credit.id) {
                        <div class="bg-white p-4 rounded-xl border border-purple-100 shadow-sm flex flex-col justify-between group hover:border-purple-300 transition">
                            <div>
                                <div class="flex justify-between items-start mb-2">
                                    <span class="text-xs font-bold bg-purple-100 text-purple-700 px-2 py-1 rounded">AVOIR</span>
                                    <span class="text-xs text-slate-400">{{ getDateObject(credit.createdAt) | date:'dd/MM/yyyy' }}</span>
                                </div>
                                <div class="font-bold text-lg text-slate-800 mb-1">{{ credit.amount }} DT</div>
                                <p class="text-xs text-slate-500 line-clamp-2" title="{{ credit.description }}">{{ credit.description }}</p>
                            </div>
                            <button type="button" (click)="useCredit(credit)" class="mt-4 w-full py-2 bg-purple-600 text-white rounded-lg font-bold text-sm hover:bg-purple-700 transition flex items-center justify-center gap-2">
                                <span class="material-icons text-sm">add_circle</span> Utiliser maintenant
                            </button>
                        </div>
                    }
                </div>
            </div>
          }

          <div class="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div class="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h3 class="font-bold text-slate-700 flex items-center gap-2">
                <span class="material-icons text-emerald-500">receipt_long</span>
                Historique des Règlements
              </h3>
              @if (reservationId) {
                <button type="button" (click)="openPaymentModal()" class="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg font-bold shadow hover:bg-emerald-700 transition text-sm">
                  <span class="material-icons text-sm">add</span> Ajouter un règlement
                </button>
              } @else {
                 <div class="text-xs text-orange-500 font-bold bg-orange-100 px-3 py-1 rounded">Enregistrez d'abord la réservation</div>
              }
            </div>

            <div class="overflow-x-auto">
              <table class="w-full text-sm text-left">
                <thead class="bg-slate-50 text-slate-500 font-bold text-xs uppercase">
                  <tr>
                    <th class="px-6 py-3">Date</th>
                    <th class="px-6 py-3">Mode</th>
                    <th class="px-6 py-3">Réf/Chèque</th>
                    <th class="px-6 py-3 text-right">Montant</th>
                    <th class="px-6 py-3 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-slate-100">
                  @for (pay of payments(); track pay.id) {
                    <tr class="hover:bg-slate-50 transition">
                      <td class="px-6 py-3 font-medium text-slate-700">{{ getDateObject(pay.date) | date:'dd/MM/yyyy' }}</td>
                      <td class="px-6 py-3">
                        <span class="px-2 py-1 rounded text-[10px] font-bold border uppercase"
                              [ngClass]="{
                                'bg-green-50 text-green-700 border-green-100': pay.type === 'ESPECES',
                                'bg-blue-50 text-blue-700 border-blue-100': pay.type === 'CHEQUE',
                                'bg-purple-50 text-purple-700 border-purple-100': pay.type === 'VIREMENT',
                                'bg-indigo-50 text-indigo-700 border-indigo-100': pay.type === 'BON'
                              }">
                          {{ pay.type }}
                        </span>
                      </td>
                      <td class="px-6 py-3 text-slate-500 text-xs">
                        @if (pay.type === 'CHEQUE') {
                          <div class="flex flex-col">
                            <span>N°: {{ pay.checkNumber }}</span>
                            <span class="text-[10px] text-slate-400">Échéance: {{ getDateObject(pay.checkDate) | date:'dd/MM/yyyy' }}</span>
                          </div>
                        } @else if (pay.type === 'BON') {
                            <span class="text-indigo-500 italic">Crédit utilisé</span>
                        } @else {
                          -
                        }
                      </td>
                      <td class="px-6 py-3 text-right font-bold text-emerald-600">
                        +{{ pay.amount }} DT
                      </td>
                      <td class="px-6 py-3 text-center">
                        <button type="button" (click)="deletePayment(pay)" class="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition" title="Supprimer">
                          <span class="material-icons text-sm">delete</span>
                        </button>
                      </td>
                    </tr>
                  }
                  @empty {
                    <tr>
                      <td colspan="5" class="px-6 py-8 text-center text-slate-400 italic">
                        Aucun paiement enregistré pour cette réservation.
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          </div>
        </div>
      }

      @if (activeTab() === 'services') {
        <div class="tab-content">
          <div class="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm mb-6">
            <div class="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
              <h3 class="font-bold text-slate-700 flex items-center gap-2">
                <span class="material-icons text-indigo-500">room_service</span>
                Catalogue des Services
              </h3>
              <div class="relative w-full md:w-64">
                <input type="text" (input)="serviceSearch.set($any($event.target).value)" placeholder="Rechercher service..." class="w-full pl-9 pr-4 py-2 rounded-lg border border-slate-200 text-sm focus:ring-2 focus:ring-indigo-500 outline-none">
                <span class="material-icons absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 text-lg">search</span>
              </div>
            </div>
            
            <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              @for (service of filteredServices(); track service.id) {
                <div (click)="toggleService(service)"
                     class="cursor-pointer border rounded-xl p-4 transition-all relative overflow-hidden group hover:shadow-md bg-white"
                     [ngClass]="isServiceSelected(service) ? 'border-indigo-500 bg-indigo-50 ring-1 ring-indigo-500' : 'border-slate-200 hover:border-indigo-300'">
                  
                  <div class="flex justify-between items-start mb-2">
                    <span class="font-bold text-sm text-slate-800 line-clamp-2">{{ service.name || service.nom }}</span>
                  </div>
                  <div class="flex justify-between items-end mt-2">
                     <span class="text-xs font-bold px-2 py-1 rounded bg-white text-slate-600 border border-slate-100 shadow-sm">
                      {{ service.price || service.prix }} DT
                    </span>
                  </div>
                  
                  <div class="absolute top-2 right-2 opacity-0 transition-opacity"
                       [class.opacity-100]="isServiceSelected(service)">
                    <span class="material-icons text-indigo-600 text-lg">check_circle</span>
                  </div>
                </div>
              }
            </div>
          </div>
        </div>
      }

    </div>

    <div class="p-6 bg-white border-t border-slate-100 flex justify-end gap-3 z-10">
      <button type="button" (click)="onClose()" class="px-6 py-3 text-slate-500 font-bold hover:bg-slate-50 rounded-xl transition">
        Annuler
      </button>
      <button type="submit" [disabled]="form.invalid" class="px-8 py-3 bg-slate-900 text-white rounded-xl font-black shadow-xl hover:scale-[1.02] active:scale-[0.98] transition disabled:opacity-50 disabled:cursor-not-allowed">
        {{ isEditMode() ? 'Mettre à jour' : 'Enregistrer' }}
      </button>
    </div>

  </form>
</div>

@if (showClientModal()) {
  <div class="fixed inset-0 z-50 flex items-center justify-center p-4">
    <div class="absolute inset-0 bg-black/40 backdrop-blur-sm" (click)="closeClientModal()"></div>
    <div class="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl border border-slate-200 max-h-[90vh] flex flex-col overflow-hidden animate-fade-in-up">
      <div class="flex items-center justify-between px-6 py-4 border-b border-slate-100">
        <h3 class="font-black text-slate-800 text-lg">Nouveau client</h3>
        <button type="button" (click)="closeClientModal()" class="text-slate-400 hover:text-slate-600">
          <span class="material-icons">close</span>
        </button>
      </div>
      <div class="p-6 overflow-y-auto flex-1">
        <app-client-form [isModal]="true" (finish)="onClientModalFinish($event)"></app-client-form>
      </div>
    </div>
  </div>
}

@if (showStaffModal()) {
  <div class="fixed inset-0 z-50 flex items-center justify-center p-4">
    <div class="absolute inset-0 bg-black/40 backdrop-blur-sm" (click)="closeStaffModal()"></div>
    <div class="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl border border-slate-200 max-h-[90vh] flex flex-col overflow-hidden animate-fade-in-up">
      <div class="flex items-center justify-between px-6 py-4 border-b border-slate-100">
        <h3 class="font-black text-slate-800 text-lg">Nouveau Membre Staff</h3>
        <button type="button" (click)="closeStaffModal()" class="text-slate-400 hover:text-slate-600">
          <span class="material-icons">close</span>
        </button>
      </div>
      <div class="p-6 overflow-y-auto flex-1">
        <app-staff-form [isModal]="true" (finish)="onStaffModalFinish($event)"></app-staff-form>
      </div>
    </div>
  </div>
}

@if (showTeamModal()) {
  <div class="fixed inset-0 z-50 flex items-center justify-center p-4">
    <div class="absolute inset-0 bg-black/40 backdrop-blur-sm" (click)="closeTeamModal()"></div>
    <div class="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl border border-slate-200 max-h-[90vh] flex flex-col overflow-hidden animate-fade-in-up">
      <div class="flex items-center justify-between px-6 py-4 border-b border-slate-100">
        <h3 class="font-black text-slate-800 text-lg">Nouvelle Équipe</h3>
        <button type="button" (click)="closeTeamModal()" class="text-slate-400 hover:text-slate-600">
          <span class="material-icons">close</span>
        </button>
      </div>
      <div class="p-6 overflow-y-auto flex-1">
        <app-team-form [isModal]="true" (finish)="onTeamModalFinish($event)"></app-team-form>
      </div>
    </div>
  </div>
}

@if (showPaymentModal()) {
  <app-payment-modal 
    [reservation]="currentReservationData"
    (close)="closePaymentModal()"
    (paymentSuccess)="onPaymentFinished()">
  </app-payment-modal>
}


<app-admin-confirm-dialog *ngIf="showAdminAuth()" (close)="$event ? onAdminAuthSuccess() : showAdminAuth.set(false)"></app-admin-confirm-dialog>
EOF