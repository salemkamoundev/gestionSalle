import { Component, inject, OnInit, signal, computed } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { firstValueFrom } from 'rxjs';

// Firebase
import { Firestore, collection, query, where, getDocs, doc, runTransaction, orderBy } from '@angular/fire/firestore';

// Services
import { ReservationService } from '../../../core/services/reservation.service';
import { ClientService } from '../../../core/services/client.service';
import { TeamService } from '../../../core/services/team.service';
import { ServiceService } from '../../../core/services/service.service';
import { UiService } from '../../../core/services/ui.service';

// Components
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
  // --- INJECTIONS ---
  private fb = inject(FormBuilder);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private location = inject(Location);
  private firestore = inject(Firestore); // Ajout Firestore
  
  private reservationService = inject(ReservationService);
  private clientService = inject(ClientService);
  private teamService = inject(TeamService);
  private serviceService = inject(ServiceService);
  private ui = inject(UiService);

  // --- ETAT (SIGNALS) ---
  isEditMode = signal(false);
  loading = signal(false);
  activeTab = signal('pack');

  // Modales
  showClientModal = signal(false);
  showPaymentModal = signal(false);

  // Recherche
  clientSearch = signal('');
  teamSearch = signal('');
  staffSearch = signal('');

  // --- DONNÉES ---
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

  // Liste des paiements pour le CRUD
  payments = signal<any[]>([]);

  // --- FORMULAIRE ---
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

            const slotId = (res.selectedSlotId || res.slotId || 'matin');
            this.form.patchValue({ ...res, date: dateStr, slotId, selectedSlotId: slotId });
            this.applySlotTimes(slotId);
            
            if (res.services) this.selectedServices.set(res.services);
            
            this.setActiveTab('info');
            
            // Charger les paiements
            this.loadPayments(id);
        }
    } catch (e) {
        console.error(e);
        this.ui.showToast('error', 'Erreur chargement réservation');
    }
    this.loading.set(false);
  }

  // --- GESTION PAIEMENTS (CRUD) ---

  async loadPayments(reservationId: string) {
    try {
      const q = query(
        collection(this.firestore, 'payments'), 
        where('reservationId', '==', reservationId)
      );
      const snap = await getDocs(q);
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      
      // Tri par date décroissante (plus récent en premier)
      data.sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime());
      
      this.payments.set(data);
    } catch (e) {
      console.error("Erreur chargement paiements", e);
    }
  }

  async deletePayment(payment: any) {
    if (!this.reservationId) return;
    const confirm = await this.ui.confirm('Annuler ce paiement ?', 'Cette action mettra à jour le solde de la réservation.');
    if (!confirm) return;

    this.loading.set(true);
    try {
      await runTransaction(this.firestore, async (transaction) => {
        // 1. Lire la réservation pour avoir l'avance à jour
        const resRef = doc(this.firestore, 'reservations', this.reservationId!);
        const resSnap = await transaction.get(resRef);
        if (!resSnap.exists()) throw 'Reservation introuvable';
        
        const currentData = resSnap.data();
        const currentAdvance = Number(currentData['advance'] || 0);
        const amountToDelete = Number(payment.amount || 0);
        
        // 2. Calculer nouvelle avance (ne pas descendre sous 0)
        const newAdvance = Math.max(0, currentAdvance - amountToDelete);
        
        // 3. Mettre à jour réservation
        transaction.update(resRef, { advance: newAdvance });
        
        // 4. Supprimer le paiement
        const payRef = doc(this.firestore, 'payments', payment.id);
        transaction.delete(payRef);
      });

      this.ui.showToast('success', 'Paiement supprimé');
      
      // Recharger tout pour rafraîchir l'UI
      await this.loadReservation(this.reservationId);

    } catch (e) {
      console.error(e);
      this.ui.showToast('error', 'Impossible de supprimer le paiement');
    }
    this.loading.set(false);
  }

  // --- NAVIGATION ONGLETS ---
  setActiveTab(tab: string) { this.activeTab.set(tab); }

  // --- COMPUTED / FILTRES ---
  filteredClients = computed(() => {
    const term = this.clientSearch().toLowerCase();
    const all = this.rawClients();
    if (!term) return all.slice(0, 5);
    return all.filter(c => 
        (c.nom && c.nom.toLowerCase().includes(term)) || 
        (c.prenom && c.prenom.toLowerCase().includes(term)) ||
        (c.telephone && c.telephone.includes(term))
    );
  });

  filteredTeams = computed(() => {
    const term = this.teamSearch().toLowerCase();
    return this.rawTeams().filter(t => !term || (t.nom && t.nom.toLowerCase().includes(term)));
  });

  filteredStaff = computed(() => {
    const term = this.staffSearch().toLowerCase();
    return this.rawStaff().filter(s => !term || (s.nom && s.nom.toLowerCase().includes(term)));
  });

  selectedClient = computed(() => {
    const id = this.form.get('clientId')?.value;
    return this.rawClients().find(c => c.id === id) || null;
  });

  // --- ACTIONS ---
  openClientModal() { this.showClientModal.set(true); }
  closeClientModal() { this.showClientModal.set(false); }
  
  onClientModalFinish(newClientId: string) {
    if (newClientId) this.form.patchValue({ clientId: newClientId });
    this.closeClientModal();
  }

  selectClient(client: any) {
    this.form.patchValue({ clientId: client.id });
    this.clearClientSearch();
  }
  onClientSearch(event: any) { this.clientSearch.set(event.target.value); }
  clearClientSearch() { this.clientSearch.set(''); }

  private toggleIdInArray(controlName: string, id: string) {
    const current = this.form.get(controlName)?.value || [];
    const idx = current.indexOf(id);
    let updated = idx > -1 ? current.filter((x: string) => x !== id) : [...current, id];
    this.form.patchValue({ [controlName]: updated });
  }

  toggleTeam(id: string) { this.toggleIdInArray('assignedTeamIds', id); }
  isTeamSelected(id: string): boolean { return (this.form.get('assignedTeamIds')?.value || []).includes(id); }

  toggleStaff(id: string) { this.toggleIdInArray('assignedServerIds', id); }
  isStaffSelected(id: string): boolean { return (this.form.get('assignedServerIds')?.value || []).includes(id); }

  toggleService(service: any) {
    const current = this.selectedServices();
    const exists = current.find(s => s.id === service.id);
    let updated = exists ? current.filter(s => s.id !== service.id) : [...current, service];
    this.selectedServices.set(updated);
    this.form.patchValue({ services: updated });
    this.calculateTotal();
  }
  isServiceSelected(service: any): boolean { return !!this.selectedServices().find(s => s.id === service.id); }

  calculateTotal() {
    let total = 0;
    const services = this.selectedServices();
    if (services.length) {
        total += services.reduce((sum, s) => sum + Number(s.price || s.prix || 0), 0);
    }
    this.form.patchValue({ totalPrice: total }, { emitEvent: false });
  }

  getPackTotal(pack: any): number { return Number(pack.price || pack.prix || 0); }
  onPackChange(event: any) { this.calculateTotal(); }
  
  private applySlotTimes(slotId: string) {
    const slot = this.availableSlots().find(s => s.id === slotId);
    if (!slot) return;
    this.form.patchValue({ selectedSlotId: slotId, startTime: slot.start, endTime: slot.end }, { emitEvent: false });
  }
  onSlotChange(event: any) { this.applySlotTimes(event?.target?.value || 'matin'); }

  async onSubmit() {
    if (this.form.invalid) {
      this.ui.showToast('error', 'Formulaire invalide.');
      if (this.form.get('clientId')?.invalid || this.form.get('date')?.invalid) {
        this.setActiveTab('info');
      }
      return;
    }
    this.loading.set(true);
    const formData = this.form.value;
    const slotId = (formData.slotId || 'matin');
    const slot = this.availableSlots().find(s => s.id === slotId);
    const dataToSave = {
      ...formData,
      date: formData.date,
      slotId,
      selectedSlotId: slotId,
      startTime: slot?.start || formData.startTime,
      endTime: slot?.end || formData.endTime
    };

    try {
      if (this.isEditMode() && this.reservationId) {
        await this.reservationService.updateReservation(this.reservationId, dataToSave);
        this.ui.showToast('success', 'Réservation mise à jour');
      } else {
        await this.reservationService.addReservation(dataToSave);
        this.ui.showToast('success', 'Réservation créée');
      }
      this.onClose();
    } catch (e) {
      console.error(e);
      this.ui.showToast('error', 'Erreur sauvegarde');
    }
    this.loading.set(false);
  }

  async onDeleteReservation() {
    if (!this.reservationId) return;
    const confirm = await this.ui.confirm('Supprimer ?', 'Cette action est irréversible.');
    if (confirm) {
        await this.reservationService.deleteReservation(this.reservationId);
        this.onClose();
    }
  }

  onPrint() { window.print(); }
  onClose() { this.router.navigate(['/calendar']); }

  // Paiement
  get currentReservationData() {
    return { id: this.reservationId, ...this.form.getRawValue() };
  }
  openPaymentModal() { 
    if (!this.reservationId) {
        this.ui.showToast('info', 'Enregistrez d\'abord la réservation');
        return;
    }
    this.showPaymentModal.set(true); 
  }
  closePaymentModal() { this.showPaymentModal.set(false); }
  
  onPaymentFinished() {
    this.closePaymentModal();
    if (this.reservationId) this.loadReservation(this.reservationId);
  }
}
