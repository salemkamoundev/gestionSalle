import { Component, inject, OnInit, signal, computed } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { firstValueFrom } from 'rxjs';
import { Firestore, collection, query, where, getDocs, doc, runTransaction } from '@angular/fire/firestore';

import { ReservationService } from '../../../core/services/reservation.service';
import { ClientService } from '../../../core/services/client.service';
import { TeamService } from '../../../core/services/team.service';
import { ServiceService } from '../../../core/services/service.service';
import { UiService } from '../../../core/services/ui.service';
import { ClientFormComponent } from '../../clients/client-form/client-form.component';
import { PaymentModalComponent } from './components/payment-modal/payment-modal.component';

@Component({
  selector: 'app-reservation-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, ClientFormComponent, PaymentModalComponent],
  templateUrl: './reservation-form.component.html',
  styles: [\`.tab-content { animation: fadeIn 0.3s ease-in-out; } @keyframes fadeIn { from { opacity: 0; transform: translateY(5px); } to { opacity: 1; transform: translateY(0); } }\`]
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

  isEditMode = signal(false);
  loading = signal(false);
  activeTab = signal('pack');
  showClientModal = signal(false);
  showPaymentModal = signal(false);
  
  // État "Passé"
  isPastReservation = signal(false);

  clientSearch = signal('');
  teamSearch = signal('');
  staffSearch = signal('');
  manualClientOverride = signal<any>(null);

  packs$ = this.teamService.getPacks();
  private rawClients = toSignal(this.clientService.getAll(), { initialValue: [] });
  private rawTeams = toSignal(this.teamService.getTeams(), { initialValue: [] });
  private rawStaff = toSignal(this.teamService.getStaff(), { initialValue: [] });
  servicesList = toSignal(this.serviceService.getAll(), { initialValue: [] });
  
  availableSlots = signal([
    { id: 'matin', label: 'Matin', start: '08:00', end: '12:00' },
    { id: 'aprem', label: 'Après-midi', start: '13:00', end: '17:00' },
    { id: 'soir', label: 'Soir', start: '18:00', end: '02:00' }
  ]);

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
      packId: [''],
      assignedTeamIds: [[]],
      assignedServerIds: [[]],
      services: [[]],
      notes: [''],
      status: ['CONFIRMED'],
      totalPrice: [0],
      advance: [0]
    });
    this.form.valueChanges.subscribe(() => this.calculateTotal());
  }

  async ngOnInit() {
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
      this.setActiveTab('info');
    }
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

            // Vérification date passée
            const resDate = new Date(dateStr);
            const today = new Date();
            today.setHours(0,0,0,0);
            
            if (resDate < today) {
                this.isPastReservation.set(true);
                this.form.disable(); 
            }

            const slotId = (res.selectedSlotId || res.slotId || 'matin');
            this.form.patchValue({ ...res, date: dateStr, slotId, selectedSlotId: slotId });
            this.applySlotTimes(slotId);
            if (res.services) this.selectedServices.set(res.services);
            this.setActiveTab('info');
            this.loadPayments(id);
        }
    } catch (e) { console.error(e); }
    this.loading.set(false);
  }

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
    if (term) {
        clients = clients.filter(c => (c.nom?.toLowerCase().includes(term)) || (c.prenom?.toLowerCase().includes(term)) || (c.telephone?.includes(term)));
    }
    return clients.slice(0, 5);
  });
  
  selectedClient = computed(() => {
    const id = this.form.get('clientId')?.value;
    if (!id) return null;
    if (this.manualClientOverride() && this.manualClientOverride().id === id) return this.manualClientOverride();
    return this.rawClients().find(c => c.id === id) || null;
  });

  openClientModal() { 
    if (this.isPastReservation()) return; 
    this.showClientModal.set(true); 
  }
  closeClientModal() { this.showClientModal.set(false); }
  
  onClientModalFinish(res: any) {
    this.closeClientModal();
    if (res && res.id) {
      this.manualClientOverride.set(res);
      this.form.patchValue({ clientId: res.id });
      this.clearClientSearch();
    }
  }

  selectClient(client: any) {
    if (this.isPastReservation()) return;
    this.manualClientOverride.set(null);
    this.form.patchValue({ clientId: client.id });
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

  toggleService(service: any) {
    if (this.isPastReservation()) return;
    const current = this.selectedServices();
    const updated = current.find(s => s.id === service.id) ? current.filter(s => s.id !== service.id) : [...current, service];
    this.selectedServices.set(updated);
    this.form.patchValue({ services: updated });
    this.calculateTotal();
  }
  isServiceSelected(service: any): boolean { return !!this.selectedServices().find(s => s.id === service.id); }

  calculateTotal() {
    let total = 0;
    const services = this.selectedServices();
    if (services.length) total += services.reduce((sum, s) => sum + Number(s.price || s.prix || 0), 0);
    this.form.patchValue({ totalPrice: total }, { emitEvent: false });
  }
  getPackTotal(pack: any): number { return Number(pack.price || pack.prix || 0); }
  
  selectPack(packId: string | null, packData: any = null) {
    if (this.isPastReservation()) return;
    
    this.form.patchValue({ packId });
    
    if (packData) {
      this.calculateTotal(); 
    } else {
      this.calculateTotal();
    }
  }

  onPackChange(pack: any) {
    if (this.isPastReservation()) return;
    this.calculateTotal();
  }
  
  private applySlotTimes(slotId: string) {
    const slot = this.availableSlots().find(s => s.id === slotId);
    if (slot) this.form.patchValue({ selectedSlotId: slotId, startTime: slot.start, endTime: slot.end }, { emitEvent: false });
  }
  onSlotChange(event: any) { this.applySlotTimes(event?.target?.value || 'matin'); }

  // --- CRUD PAIEMENT ---
  async loadPayments(reservationId: string) {
    try {
      const q = query(collection(this.firestore, 'payments'), where('reservationId', '==', reservationId));
      const snap = await getDocs(q);
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      data.sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime());
      this.payments.set(data);
    } catch (e) {}
  }
  async deletePayment(payment: any) {
    if (!this.reservationId) return;
    if (!await this.ui.confirm('Annuler ?', 'Irréversible')) return;
    this.loading.set(true);
    try {
      await runTransaction(this.firestore, async (transaction) => {
        const resRef = doc(this.firestore, 'reservations', this.reservationId!);
        const resSnap = await transaction.get(resRef);
        const currentAdvance = Number(resSnap.data()?.['advance'] || 0);
        transaction.update(resRef, { advance: Math.max(0, currentAdvance - Number(payment.amount || 0)) });
        transaction.delete(doc(this.firestore, 'payments', payment.id));
      });
      this.ui.showToast('success', 'Supprimé');
      await this.loadReservation(this.reservationId);
    } catch (e) { this.ui.showToast('error', 'Erreur'); }
    this.loading.set(false);
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
      
      this.onClose();
    } catch (e) { this.ui.showToast('error', 'Erreur'); }
    this.loading.set(false);
  }
  
  async onDeleteReservation() { 
    if (!this.reservationId) return;
    if (await this.ui.confirm('Supprimer ?', 'Irréversible')) {
        await this.reservationService.deleteReservation(this.reservationId);
        this.onClose();
    }
  }
  onPrint() { window.print(); }

  onClose() { 
    this.router.navigate(['/reservations']); 
  }

  get currentReservationData() { return { id: this.reservationId, ...this.form.getRawValue() }; }
  
  openPaymentModal() { 
    if (!this.reservationId) { this.ui.showToast('info', 'Sauvegardez d\'abord'); return; }
    this.showPaymentModal.set(true); 
  }
  closePaymentModal() { this.showPaymentModal.set(false); }
  onPaymentFinished() { this.closePaymentModal(); if(this.reservationId) this.loadReservation(this.reservationId); }
  
  filteredTeams = computed(() => { const term = this.teamSearch().toLowerCase(); return this.rawTeams().filter(t => !term || (t.nom && t.nom.toLowerCase().includes(term))); });
  filteredStaff = computed(() => { const term = this.staffSearch().toLowerCase(); return this.rawStaff().filter(s => !term || (s.nom && s.nom.toLowerCase().includes(term))); });
}
