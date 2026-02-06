import { Component, OnInit, computed, effect, inject, signal, Input, Output, EventEmitter, Injector, runInInjectionContext } from '@angular/core';
import { CommonModule, DatePipe, Location } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { firstValueFrom, of } from 'rxjs';
import { Firestore, collection, query, where, getDocs, addDoc, doc, deleteDoc } from '@angular/fire/firestore';

import { ReservationService } from '../../../core/services/reservation.service';
import { ClientService } from '../../../core/services/client.service';
import { ServiceService } from '../../../core/services/service.service';
import { PartenaireService } from '../../../core/services/partenaire.service';
import { PackService } from '../../../core/services/pack.service';
import { UiService } from '../../../core/services/ui.service';
import { ConfigService } from '../../../core/services/config.service';
import { PaymentPdfService } from '../../../core/services/payment-pdf.service';
import { ContractPdfService } from '../../../core/services/contract-pdf.service';
import { AuthService } from '../../../core/services/auth.service';
import { PaymentService } from '../../../core/services/payment.service';

import { ClientFormComponent } from '../../clients/client-form/client-form.component';
import { PaymentModalComponent } from '../../payments/payment-modal/payment-modal.component';
import { PartenaireFormComponent } from '../../partenaire/partenaire-form/partenaire-form.component';
import { AdminConfirmDialogComponent } from '../../../shared/components/admin-confirm-dialog/admin-confirm-dialog.component';

@Component({
  selector: 'app-reservation-form',
  standalone: true,
  imports: [
    CommonModule, ReactiveFormsModule, ClientFormComponent, 
    PaymentModalComponent, PartenaireFormComponent, AdminConfirmDialogComponent
  ],
  providers: [DatePipe],
  templateUrl: './reservation-form.component.html'
})
export class ReservationFormComponent implements OnInit {
  private fb = inject(FormBuilder);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private location = inject(Location);
  private reservationService = inject(ReservationService);
  private clientService = inject(ClientService);
  private serviceService = inject(ServiceService);
  private partenaireService = inject(PartenaireService);
  private packService = inject(PackService);
  private paymentService = inject(PaymentService);
  public configService = inject(ConfigService);
  private ui = inject(UiService);
  private paymentPdfService = inject(PaymentPdfService);
  private contractPdfService = inject(ContractPdfService);
  private authService = inject(AuthService);
  private firestore = inject(Firestore);
  private injector = inject(Injector);

  @Input() isModal = false; 
  @Output() close = new EventEmitter<void>();
  @Output() reservationSaved = new EventEmitter<any>();

  isAdmin = this.authService.isAdmin;
  activeTab = signal<'info' | 'partenaire' | 'teams' | 'pack' | 'services' | 'reglement' | 'service_finance'>('info');
  isEditMode = signal(false);
  isDeleting = signal(false);
  loading = signal(false);
  
  // Propriété pour compatibilité template (même si on l'utilise pas vraiment)
  autoSaveStatus = signal<'idle' | 'saving' | 'saved' | 'error'>('idle');

  reservationId: string | null = null;
  private initialServicesIds: string = '';
  private initialPackId: string = '';

  showClientModal = signal(false);
  clientToEdit = signal<any>(null);
  showPartenaireModal = signal(false);
  partenaireToEdit = signal<any>(null);
  showPaymentModal = signal(false);
  showAdminAuth = signal(false);

  allServices = toSignal(this.serviceService.getAll(), { initialValue: [] as any[] });
  allPartenaires = toSignal(this.partenaireService.getAll(), { initialValue: [] as any[] });
  rawClients = toSignal(this.clientService.getAll(), { initialValue: [] as any[] });
  
  // Correction: On garde 'packs' comme signal principal et on ajoute 'packs$' pour le template si besoin
  packs = toSignal(this.packService.getAll(), { initialValue: [] as any[] });
  packs$ = this.packService.getAll(); 

  clientSearch = signal('');
  partenaireSearch = signal(''); 
  serviceSearch = signal('');

  selectedServices = signal<any[]>([]);
  selectedDate = signal<string>('');
  selectedClientId = signal<string | null>(null);
  payments = signal<any[]>([]); 

  restrictedSlotType = signal<string | null>(null);
  pendingParams = signal<any>(null);

  showClientCredits = signal(false); 
  availableCredits = signal<any[]>([]);
  availableCreditSearch = signal('');
  availableCreditPage = signal(1);
  readonly ITEMS_PER_PAGE = 5;

  serviceExpenseForm: FormGroup;

  form: FormGroup = this.fb.group({
    date: ['', Validators.required],
    slotId: ['', Validators.required],
    startTime: [''], endTime: [''], clientId: ['', Validators.required],
    packId: [null], packs: [[]], assignedServerIds: [[] as string[]], uidsToRemove: [[] as string[]], 
    staffIds: [[] as string[]], services: [[] as any[]],
    totalPrice: [0, [Validators.required, Validators.min(0)]],
    advance: [0], status: ['CONFIRMED'], notes: ['']
  });

  constructor() {
    this.serviceExpenseForm = this.fb.group({
      amount: [0, [Validators.required, Validators.min(1)]],
      method: ['ESPECES', Validators.required],
      reference: ['']
    });

    effect(() => {
      const params = this.pendingParams();
      const slots = this.availableSlots();
      if (params && slots.length > 0) {
        this.selectedDate.set(params.date);
        const reqSlot = (params.slotId || '').toLowerCase();
        this.form.get('slotId')?.enable();
        this.restrictedSlotType.set(null);
        let targetId = reqSlot;
        if (reqSlot.includes('matin')) { this.restrictedSlotType.set('matin'); targetId = 'matin'; this.form.get('slotId')?.disable(); } 
        else if (reqSlot.includes('soir')) { this.restrictedSlotType.set('soir'); targetId = 'soir'; this.form.get('slotId')?.disable(); } 
        else if (reqSlot.includes('aprem')) { this.restrictedSlotType.set('aprem'); if(targetId === 'aprem') targetId = 'aprem1'; }
        this.form.patchValue({ date: params.date, slotId: targetId });
        this.applySlotTimes(targetId);
        this.calculateTotal();
        this.pendingParams.set(null);
      }
    });
  }

  ngOnInit() { 

    
    
      this.route.params.subscribe(params => {
          if (params['id']) {
              this.reservationId = params['id'];
              this.isEditMode.set(true);
              this.loadReservation(params['id']);
          }
      });
      this.route.queryParams.subscribe(params => {
          if (params['date'] && !this.reservationId) this.pendingParams.set({ date: params['date'], slotId: params['slotId'] || '' });
      });
  }

  // --- HELPERS COMPUTED ---
  availableSlots = computed(() => this.configService.settings().creneaux || []);
  filteredSlots = computed(() => {
    const date = this.selectedDate();
    const slots = this.availableSlots();
    if (!date || !slots) return [];
    let valid = slots.filter((s: any) => date >= s.validFrom && date <= s.validTo);
    const restriction = this.restrictedSlotType();
    if (restriction === 'matin') return valid.filter((s: any) => s.id === 'matin');
    if (restriction === 'soir') return valid.filter((s: any) => s.id === 'soir');
    if (restriction === 'aprem') return valid.filter((s: any) => s.id.startsWith('aprem'));
    return valid;
  });
  filteredClients = computed(() => {
    const term = this.clientSearch().toLowerCase();
    return this.rawClients().filter((c: any) => !term || (c.nom && c.nom.toLowerCase().includes(term)) || (c.telephone && c.telephone.includes(term))).slice(0, 10);
  });
  selectedClient = computed(() => this.rawClients().find((c: any) => c.id === this.selectedClientId()));
  filteredServices = computed(() => {
    const term = this.serviceSearch().toLowerCase();
    return this.allServices().filter((s: any) => !term || (s.nom && s.nom.toLowerCase().includes(term)));
  });
  
  servicesFinanceSummary = computed(() => {
    const services = this.selectedServices();
    const allPayments = this.payments(); 
    const partnersList = this.allPartenaires();
    return services.map(srv => {
        const partnerId = srv.partnerId;
        const partner = partnersList.find(p => p.id === partnerId);
        const cost = Number(srv.price || srv.prix || 0);
        const expenses = allPayments.filter(p => p.direction === 'EXPENSE' && (p.serviceId === srv.id || p.serviceName === srv.name || p.serviceId === srv.name));
        const totalPaid = expenses.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
        return {
            serviceId: srv.id, serviceName: srv.name || srv.nom, partnerId: partnerId,
            partnerName: partner ? `${partner.nom} ${partner.prenom}` : 'Non assigné',
            cost: cost, paid: totalPaid, remaining: cost - totalPaid, history: expenses
        };
    });
  });

  filteredAvailableCredits = computed(() => {
    const term = this.availableCreditSearch().toLowerCase();
    return this.availableCredits().filter(c => !term || (c.description?.toLowerCase().includes(term)) || (c.amount?.toString().includes(term)));
  });
  paginatedAvailableCredits = computed(() => {
    const start = (this.availableCreditPage() - 1) * this.ITEMS_PER_PAGE;
    return this.filteredAvailableCredits().slice(start, start + this.ITEMS_PER_PAGE);
  });
  totalAvailableCreditPages = computed(() => Math.ceil(this.filteredAvailableCredits().length / this.ITEMS_PER_PAGE));
  toggleClientCredits() { this.showClientCredits.update(v => !v); }
  prevAvailableCreditPage() { if (this.availableCreditPage() > 1) this.availableCreditPage.update(p => p - 1); }
  nextAvailableCreditPage() { if (this.availableCreditPage() < this.totalAvailableCreditPages()) this.availableCreditPage.update(p => p + 1); }

  // Propriété manquante réintégrée
  get currentReservationData() { return { id: this.reservationId, ...this.form.getRawValue(), client: this.selectedClient() }; }

  // --- CHARGEMENT ---
  async loadReservation(id: string) {
    this.loading.set(true);
    try {
      const res: any = await firstValueFrom(this.reservationService.getById(id));
      if (res) {
        this.form.patchValue(res);
        this.form.get('date')?.disable(); this.form.get('startTime')?.disable(); this.form.get('endTime')?.disable();
        const currentSlot = (res.slotId || '').toLowerCase();
        if (currentSlot.includes('aprem')) { this.form.get('slotId')?.enable(); this.restrictedSlotType.set('aprem'); } 
        else { this.form.get('slotId')?.disable(); }
        this.selectedDate.set(res.date);
        if (res.clientId) { this.selectedClientId.set(res.clientId); this.loadClientCredits(res.clientId); }
        if(res.services) { this.selectedServices.set(res.services); this.form.patchValue({ services: res.services }); }
        
        this.initialServicesIds = this.getServicesSnapshot(res.services);
        this.initialPackId = res.packId || '';

        await this.loadPayments(id);
        this.calculateTotal();
      }
    } catch (e) { console.error(e); } finally { this.loading.set(false); }
  }

  getServicesSnapshot(services: any[]): string {
      if (!services || !Array.isArray(services)) return '';
      return services.map(s => s.id).sort().join(',');
  }

  calculateTotal() {
    const val = this.form.getRawValue();
    let total = 0;
    const slot = this.availableSlots().find((s: any) => s.id === val.slotId);
    if (slot) total += (Number(slot.price) || 0);
    const servicesTotal = this.selectedServices().reduce((acc: number, s: any) => acc + (Number(s.price) || Number(s.prix) || 0), 0);
    total += servicesTotal;
    if (val.packId) {
        const pack = this.packs().find(p => p.id === val.packId);
        if (pack) total += (Number(pack.price) || 0);
    }
    if (total > 0) this.form.patchValue({ totalPrice: total }, { emitEvent: false });
  }

  updateServices(services: any[]) {
      const oldAssignedIds = this.form.get('assignedServerIds')?.value || [];
      this.selectedServices.set(services);
      const relevantPartnerIds = services.map(s => s.partnerId || s.partenaireId).filter(id => !!id);
      const uniqueNewIds = [...new Set(relevantPartnerIds)];
      const removedIds = oldAssignedIds.filter((id: string) => !uniqueNewIds.includes(id));
      const patchData: any = { services, assignedServerIds: uniqueNewIds };
      if (removedIds.length > 0) {
          const currentRemovals = this.form.get('uidsToRemove')?.value || [];
          patchData.uidsToRemove = [...new Set([...currentRemovals, ...removedIds])];
      }
      this.form.patchValue(patchData);
      this.calculateTotal();
  }
  
  getServicesTotal(): number { return this.selectedServices().reduce((acc, s) => acc + (Number(s.price) || 0), 0); }
  applySlotTimes(slotId: string) { const slot = this.availableSlots().find((s: any) => s.id === slotId); if (slot) this.form.patchValue({ startTime: slot.start, endTime: slot.end }); }
  
  async addServiceExpense(serviceItem: any) {
    if (this.serviceExpenseForm.invalid) return;
    const val = this.serviceExpenseForm.value;
    try {
        await addDoc(collection(this.firestore, 'payments'), {
            reservationId: this.reservationId, serviceId: serviceItem.serviceId || serviceItem.serviceName, 
            serviceName: serviceItem.serviceName, partnerId: serviceItem.partnerId || null, 
            amount: val.amount, type: val.method, direction: 'EXPENSE', 
            date: new Date().toISOString(), reference: val.reference || '', createdAt: new Date().toISOString()
        });
        this.ui.showToast('success', 'Règlement enregistré');
        this.serviceExpenseForm.reset({ amount: 0, method: 'ESPECES' });
        await this.loadPayments(this.reservationId!);
    } catch (e) { console.error(e); this.ui.showToast('error', 'Erreur lors de l\'enregistrement'); }
  }

  toggleService(service: any) {
      let current = [...this.selectedServices()];
      const idx = current.findIndex((s: any) => s.id === service.id);
      if (idx >= 0) current.splice(idx, 1);
      else { current.push({ ...service, price: Number(service.price !== undefined ? service.price : (service.prix || 0)) }); }
      this.updateServices(current); 
      this.serviceSearch.set('');
  }
  isServiceSelected(service: any): boolean { return this.selectedServices().some((s: any) => s.id === service.id); }
  removeService(index: number) { const current = [...this.selectedServices()]; current.splice(index, 1); this.updateServices(current); }
  
  selectPack(packId: string | null, packData: any = null) {
      if (this.isPastReservation()) return;
      this.form.patchValue({ packId });
      if (packId) {
          const newPack = this.packs().find(p => p.id === packId);
          if (newPack) {
              this.form.patchValue({ packs: [{ id: newPack.id, nom: newPack.nom || newPack.name, price: newPack.price }] });
              if (newPack.services) {
                 let currentServices = [...this.selectedServices()];
                  newPack.services.forEach((packService: any) => {
                      const fullServiceDef = this.allServices().find((s: any) => s.id === packService.id) || packService;
                      if (!currentServices.some(c => c.id === fullServiceDef.id)) {
                          currentServices.push({ ...fullServiceDef, price: Number(fullServiceDef.price || fullServiceDef.prix || 0) });
                      }
                  });
                  this.updateServices(currentServices);
              } else { this.calculateTotal(); }
          }
      } else { 
          this.form.patchValue({ packs: [] });
          this.calculateTotal(); 
      }
  }
  
  getPackTotal(pack: any) { return Number(pack.price || 0); }

  async setActiveTab(tab: any) { 
    if (!this.form.get('clientId')?.value) { this.ui.showToast('error', 'Sélectionnez un client d\'abord'); return; }
    this.activeTab.set(tab); 
  }
  
  onClose() { if (this.isModal) this.close.emit(); else this.router.navigate(['/reservations']); }
  isPastReservation() { return this.selectedDate() && new Date(this.selectedDate()) < new Date(new Date().setHours(0,0,0,0)); }
  onSlotChange(e: any) { this.applySlotTimes(e.target.value); this.calculateTotal(); }

  openClientModal() { this.clientToEdit.set(null); this.showClientModal.set(true); }
  closeClientModal() { this.showClientModal.set(false); }
  onClientModalFinish(res: any) { this.closeClientModal(); if (res?.id) this.selectClient(res); }
  openPartenaireModal() { this.partenaireToEdit.set(null); this.showPartenaireModal.set(true); }
  closePartenaireModal() { this.showPartenaireModal.set(false); }
  onPartenaireModalFinish(res: any) { this.closePartenaireModal(); }
  openPaymentModal() { if (this.reservationId) this.showPaymentModal.set(true); }
  closePaymentModal() { this.showPaymentModal.set(false); }
  async onPaymentFinished() { this.closePaymentModal(); if(this.reservationId) await this.loadPayments(this.reservationId); }

  onClientSearch(e: any) { this.clientSearch.set(e.target.value); }
  onEditClient(client: any) { if (client) { this.clientToEdit.set(client); this.showClientModal.set(true); } }
  selectClient(client: any) { this.form.patchValue({ clientId: client.id }); this.selectedClientId.set(client.id); this.clientSearch.set(''); this.loadClientCredits(client.id); }

  async loadPayments(reservationId: string) {
      try {
          this.paymentService.getByReservation(reservationId).subscribe(data => {
              this.payments.set(data);
              const totalPaid = data.filter((p: any) => !p.direction || p.direction === 'INCOME').reduce((sum, p: any) => sum + (Number(p.amount) || 0), 0);
              this.form.patchValue({ advance: totalPaid }, { emitEvent: false });
              if (this.reservationId) this.reservationService.update(this.reservationId, { advance: totalPaid });
          });
      } catch(e) { console.error(e); }
  }
  
  async loadClientCredits(clientId: string) {
    try {
        runInInjectionContext(this.injector, async () => {
            const q = query(collection(this.firestore, 'provisional_receipts'), where('clientId', '==', clientId), where('status', '==', 'AVAILABLE'));
            const snap = await getDocs(q);
            const unique = new Map(); snap.docs.forEach(d => unique.set(d.id, { id: d.id, ...d.data() }));
            this.availableCredits.set(Array.from(unique.values()));
        });
    } catch(e) { console.error(e); }
  }

  async useCredit(credit: any) {
      if (!this.reservationId) return;
      if (!confirm('Utiliser cet avoir ?')) return;
      try {
          await this.reservationService.applyCredit(this.reservationId, credit);
          this.ui.showToast('success', 'Avoir appliqué');
          this.availableCredits.update(list => list.filter(c => c.id !== credit.id));
          await this.loadPayments(this.reservationId);
      } catch (e) { this.ui.showToast('error', 'Erreur'); }
  }
  
  async deletePayment(p: any) {
      if(confirm('Supprimer ce paiement ?')) { await this.paymentService.delete(p.id); this.ui.showToast('success', 'Supprimé'); if(this.reservationId) await this.loadPayments(this.reservationId); }
  }

  async onSubmit() {
    if (this.form.invalid) return;
    this.loading.set(true);
    this.calculateTotal();
    const val = this.form.getRawValue();

    const currentServicesIds = this.getServicesSnapshot(val.services);
    const currentPackId = val.packId || '';
    const structureChanged = (currentServicesIds !== this.initialServicesIds) || (currentPackId !== this.initialPackId);
    const shouldNotify = !this.reservationId || structureChanged;

    val.triggerPush = shouldNotify; 

    try {
        if (this.isEditMode() && this.reservationId) {
            await this.reservationService.updateReservation(this.reservationId, val);
            this.ui.showToast('success', 'Mise à jour réussie');
            this.initialServicesIds = currentServicesIds;
            this.initialPackId = currentPackId;
        } else {
            const res = await this.reservationService.addReservation(val);
            this.reservationId = res.id;
            this.isEditMode.set(true);
            this.ui.showToast('success', 'Création réussie');
            this.location.replaceState('/reservations/edit/' + res.id);
            this.initialServicesIds = currentServicesIds;
            this.initialPackId = currentPackId;
        }
        this.reservationSaved.emit(true);
    } catch (e) { this.ui.showToast('error', 'Erreur'); }
    finally { this.loading.set(false); }
  }

  onDeleteReservation() { this.showAdminAuth.set(true); }
  async onAdminAuthSuccess() {
      this.showAdminAuth.set(false);
      if (!this.reservationId) return;
      this.isDeleting.set(true);
      this.form.disable({ emitEvent: false });
      this.loading.set(true);
      try {
          await this.reservationService.delete(this.reservationId);
          this.ui.showToast("success", "Réservation annulée");
          if (this.isModal) this.close.emit(); else this.router.navigate(['/reservations']);
      } catch (e) { this.isDeleting.set(false); this.form.enable(); this.ui.showToast("error", "Erreur annulation"); } 
      finally { this.loading.set(false); }
  }

  printGlobalPartnerReport() { this.ui.showToast('info', 'Impression Bilan non implémentée'); }
  async onPrint() { if (this.reservationId) this.contractPdfService.generateContract({ id: this.reservationId, ...this.form.getRawValue() }, this.selectedClient() || {}); }
  onPrintPayments() { if (this.reservationId) this.paymentPdfService.generateReceipt({ id: this.reservationId, ...this.form.getRawValue() }, this.selectedClient() || {}, this.payments().filter(p => !p.direction || p.direction === 'INCOME')); }
  getDateObject(ts: any): Date { return ts?.toDate ? ts.toDate() : new Date(ts || new Date()); }
}
