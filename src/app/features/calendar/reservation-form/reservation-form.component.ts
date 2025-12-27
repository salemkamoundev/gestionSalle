import { Component, inject, OnInit, signal, computed } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { firstValueFrom } from 'rxjs';
import { Firestore, collection, query, where, getDocs, doc, runTransaction } from '@angular/fire/firestore';

// Imports relatifs corrects (3 niveaux)
import { ReservationService } from '../../../core/services/reservation.service';
import { ClientService } from '../../../core/services/client.service';
import { TeamService } from '../../../core/services/team.service';
import { ServiceService } from '../../../core/services/service.service';
import { UiService } from '../../../core/services/ui.service';
import { AuthService } from '../../../core/services/auth.service';
import { ConfigService } from '../../../core/services/config.service';

import { ClientFormComponent } from '../../clients/client-form/client-form.component';
import { PaymentModalComponent } from './components/payment-modal/payment-modal.component';

@Component({
  selector: 'app-reservation-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, ClientFormComponent, PaymentModalComponent],
  templateUrl: './reservation-form.component.html',
  styles: [`
    .tab-content { animation: fadeIn 0.3s ease-in-out; } 
    @keyframes fadeIn { from { opacity: 0; transform: translateY(5px); } to { opacity: 1; transform: translateY(0); } }
  `]
})
export class ReservationFormComponent implements OnInit {
  private fb = inject(FormBuilder);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private location = inject(Location);
  private firestore = inject(Firestore);
  
  private reservationService = inject(ReservationService);
  private clientService = inject(ClientService);
  private teamService = inject(TeamService);
  private serviceService = inject(ServiceService);
  private ui = inject(UiService);
  private authService = inject(AuthService);
  private configService = inject(ConfigService);

  isEditMode = signal(false);
  loading = signal(false);
  activeTab = signal('pack');
  showClientModal = signal(false);
  showPaymentModal = signal(false);
  isPastReservation = signal(false);

  clientSearch = signal('');
  teamSearch = signal('');
  staffSearch = signal('');
  manualClientOverride = signal<any>(null);

  availableCredits = signal<any[]>([]);
  packs = signal<any[]>([]);
  packs$ = this.teamService.getPacks();

  private rawClients = toSignal(this.clientService.getAll(), { initialValue: [] });
  private rawTeams = toSignal(this.teamService.getTeams(), { initialValue: [] });
  private rawStaff = toSignal(this.teamService.getStaff(), { initialValue: [] });
  servicesList = toSignal(this.serviceService.getAll(), { initialValue: [] });
  
  availableSlots = computed(() => this.configService.settings().creneaux);

  payments = signal<any[]>([]);
  form: FormGroup;
  reservationId: string | null = null;
  selectedServices = signal<any[]>([]);

  constructor() {
    this.form = this.fb.group({
      date: ['', Validators.required],
      slotId: ['matin', Validators.required],
      selectedSlotId: ['matin'],
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
  }

  async ngOnInit() {
    this.teamService.getPacks().subscribe(data => {
        if (data && data.length > 0) this.packs.set(data);
    });

    this.form.get('date')?.valueChanges.subscribe(() => {
        if (!this.isPastReservation()) this.calculateTotal();
    });

    this.reservationId = this.route.snapshot.paramMap.get('id');
    const queryDate = this.route.snapshot.queryParamMap.get('date');
    const querySlot = this.route.snapshot.queryParamMap.get('slotId');

    if (this.reservationId) {
      this.isEditMode.set(true);
      await this.loadReservation(this.reservationId);
    } else if (queryDate) {
      const slotId = querySlot || 'matin';
      this.form.patchValue({ date: queryDate, slotId, selectedSlotId: slotId });
      this.applySlotTimes(slotId);
      setTimeout(() => this.calculateTotal(), 100); 
      this.setActiveTab('info');
    }
  }

  // --- HELPER DATE SÉCURISÉ ---
  getDateObject(dateField: any): Date | null {
    if (!dateField) return null;
    if (dateField.toDate && typeof dateField.toDate === 'function') {
        return dateField.toDate();
    }
    if (dateField instanceof Date) {
        return dateField;
    }
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

            const resDate = new Date(dateStr);
            const today = new Date();
            today.setHours(0,0,0,0);
            
            if (resDate < today) {
                this.isPastReservation.set(true);
                this.form.disable(); 
            }

            const slotId = (res.selectedSlotId || res.slotId || 'matin');
            
            this.form.patchValue({ 
                ...res, 
                date: dateStr, 
                slotId, 
                selectedSlotId: slotId 
            });
            
            this.applySlotTimes(slotId);
            
            if (res.services && Array.isArray(res.services)) {
                this.selectedServices.set(res.services);
            }
            
            if (res.clientId) {
                this.loadClientCredits(res.clientId);
            }

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
    // On récupère le créneau sélectionné dans la config
    const slot = this.availableSlots().find(s => s.id === slotId);
    // On retourne son prix défini (ou 0)
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
    const selectedId = this.form.get('clientId')?.value;
    if (override) { clients = clients.filter(c => c.id !== override.id); clients.unshift(override); } 
    else if (selectedId) {
        const index = clients.findIndex(c => c.id === selectedId);
        if (index > -1) { const [selected] = clients.splice(index, 1); clients.unshift(selected); }
    }
    // MODIF: Recherche dans telephone2 aussi
    if (term) clients = clients.filter(c => (c.nom?.toLowerCase().includes(term)) || (c.prenom?.toLowerCase().includes(term)) || (c.telephone?.includes(term)) || (c.telephone2?.includes(term)));
    return clients.slice(0, 5);
  });
  
  selectedClient = computed(() => {
    const id = this.form.get('clientId')?.value;
    if (!id) return null;
    if (this.manualClientOverride() && this.manualClientOverride().id === id) return this.manualClientOverride();
    return this.rawClients().find(c => c.id === id) || null;
  });

  filteredTeams = computed(() => { const term = this.teamSearch().toLowerCase(); return this.rawTeams().filter(t => !term || (t.nom && t.nom.toLowerCase().includes(term))); });
  filteredStaff = computed(() => { const term = this.staffSearch().toLowerCase(); return this.rawStaff().filter(s => !term || (s.nom && s.nom.toLowerCase().includes(term))); });

  openClientModal() { if (this.isPastReservation()) return; this.showClientModal.set(true); }
  closeClientModal() { this.showClientModal.set(false); }
  
  onClientModalFinish(res: any) {
    this.closeClientModal();
    if (res && res.id) {
      this.manualClientOverride.set(res);
      this.form.patchValue({ clientId: res.id });
      this.loadClientCredits(res.id);
      this.clearClientSearch();
    }
  }

  selectClient(client: any) {
    if (this.isPastReservation()) return;
    this.manualClientOverride.set(null);
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
    const val = event?.target?.value || 'matin';
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
    if (await this.ui.confirm('Suppression', hasPayments ? 'Avoirs seront générés. Confirmer ?' : 'Supprimer ?')) {
        this.loading.set(true);
        try {
            if (hasPayments) await this.processCancellationWithCredits();
            else await this.reservationService.deleteReservation(this.reservationId);
            this.ui.showToast('success', 'Réservation annulée');
            this.onClose();
        } catch (e) { this.ui.showToast('error', 'Erreur suppression'); }
        this.loading.set(false);
    }
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
                      description: `Avoir annulation ${reservationDate}`,
                      status: 'AVAILABLE'
                  });
              }
              transaction.delete(doc(this.firestore, 'payments', p.id));
          }
          transaction.delete(doc(this.firestore, 'reservations', this.reservationId!));
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
      else await this.reservationService.addReservation(data);
      this.ui.showToast('success', 'Enregistré');
    } catch (e) { this.ui.showToast('error', 'Erreur'); }
    this.loading.set(false);
  }
  
  onPrint() { window.print(); }
  onClose() { this.router.navigate(['/reservations']); }
  get currentReservationData() { return { id: this.reservationId, ...this.form.getRawValue() }; }
  openPaymentModal() { if (!this.reservationId) return; this.showPaymentModal.set(true); }
  closePaymentModal() { this.showPaymentModal.set(false); }
  async onPaymentFinished() { this.closePaymentModal(); if(this.reservationId) await this.loadPayments(this.reservationId); }
}
