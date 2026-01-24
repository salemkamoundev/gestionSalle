import { Component, OnInit, computed, effect, inject, signal, Input, Output, EventEmitter, Injector, runInInjectionContext } from '@angular/core';
import { CommonModule, DatePipe, Location } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { toSignal, takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { firstValueFrom, from } from 'rxjs';
import { debounceTime, filter, distinctUntilChanged, tap, switchMap, catchError } from 'rxjs/operators';
import { Firestore, collection, query, where, getDocs } from '@angular/fire/firestore';

// Services
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

// Components
import { ClientFormComponent } from '../../clients/client-form/client-form.component';
import { PaymentModalComponent } from './components/payment-modal/payment-modal.component';
import { PartenaireFormComponent } from '../../partenaire/partenaire-form/partenaire-form.component';
import { AdminConfirmDialogComponent } from '../../../shared/components/admin-confirm-dialog/admin-confirm-dialog.component';
import { ReservationPartnerFinanceComponent } from './components/partner-finance/partner-finance.component';
import { ReservationClientBillingComponent } from './components/client-billing/client-billing.component';

@Component({
  selector: 'app-reservation-form',
  standalone: true,
  imports: [
    CommonModule, ReactiveFormsModule, ClientFormComponent, 
    PaymentModalComponent, PartenaireFormComponent, AdminConfirmDialogComponent,
    ReservationPartnerFinanceComponent, ReservationClientBillingComponent
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
  activeTab = signal<'info' | 'partenaire' | 'teams' | 'pack' | 'services' | 'reglement' | 'partner_finance'>('info');
  isEditMode = signal(false);
  isDeleting = signal(false);
  loading = signal(false);
  autoSaveStatus = signal<'idle' | 'saving' | 'saved' | 'error'>('idle');

  reservationId: string | null = null;
  showClientModal = signal(false);
  clientToEdit = signal<any>(null);
  showPartenaireModal = signal(false);
  showPaymentModal = signal(false);
  showAdminAuth = signal(false);

  allServices = toSignal(this.serviceService.getAll(), { initialValue: [] as any[] });
  allPartenaires = toSignal(this.partenaireService.getAll(), { initialValue: [] as any[] });
  rawClients = toSignal(this.clientService.getAll(), { initialValue: [] as any[] });
  packs = toSignal(this.packService.getAll(), { initialValue: [] as any[] });
  packs$ = this.packService.getAll();

  clientSearch = signal('');
  partenaireSearch = signal(''); 
  serviceSearch = signal('');
  selectedServices = signal<any[]>([]);
  selectedDate = signal<string>('');
  selectedClientId = signal<string | null>(null);
  restrictedSlotType = signal<string | null>(null);
  pendingParams = signal<any>(null);
  
  availableCredits = signal<any[]>([]);
  globalCredits = signal<any[]>([]);
  payments = signal<any[]>([]);
  
  form: FormGroup = this.fb.group({
    date: ['', Validators.required],
    slotId: ['', Validators.required],
    startTime: [''],
    endTime: [''],
    clientId: ['', Validators.required],
    packId: [null],
    staffIds: [[] as string[]], 
    assignedServerIds: [[] as string[]], 
    services: [[] as any[]],
    totalPrice: [0, [Validators.required, Validators.min(0)]],
    advance: [0],
    status: ['CONFIRMED'],
    notes: [''],
    partnerPayments: [[]]
  });

  constructor() {
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

    this.form.valueChanges.pipe(
      takeUntilDestroyed(),
      debounceTime(10000), 
      filter(() => this.form.valid && !!this.reservationId && this.isEditMode() && !this.isDeleting()),
      distinctUntilChanged((a, b) => JSON.stringify(a) === JSON.stringify(b)),
      tap(() => this.autoSaveStatus.set('saving')),
      switchMap(val => from(this.reservationService.updateReservation(this.reservationId!, val)).pipe(catchError(err => { this.autoSaveStatus.set('error'); return []; })))
    ).subscribe(() => { this.autoSaveStatus.set('saved'); setTimeout(() => this.autoSaveStatus.set('idle'), 3000); });
  }

  ngOnInit() { 
      this.loadGlobalCredits(); 
      this.route.params.subscribe(params => {
          if (params['id']) {
              this.reservationId = params['id'];
              this.isEditMode.set(true);
              this.loadReservation(params['id']);
          }
      });
      this.route.queryParams.subscribe(params => {
          if (params['date'] && !this.reservationId) {
              this.pendingParams.set({ date: params['date'], slotId: params['slotId'] || '' });
          }
      });
  }

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
  
  filteredPartenaire = computed(() => {
    const term = this.partenaireSearch().toLowerCase();
    return (this.allPartenaires() || []).filter((p: any) => !term || (p.nom && p.nom.toLowerCase().includes(term)));
  });
  
  filteredClients = computed(() => {
    const term = this.clientSearch().toLowerCase();
    return this.rawClients().filter((c: any) => !term || (c.nom && c.nom.toLowerCase().includes(term)) || (c.telephone && c.telephone.includes(term))).slice(0, 10);
  });
  
  selectedClient = computed(() => this.rawClients().find((c: any) => c.id === this.selectedClientId()));
  
  filteredServices = computed(() => {
    const term = this.serviceSearch().toLowerCase();
    return this.allServices().filter((s: any) => !term || (s.nom && s.nom.toLowerCase().includes(term)) || (s.name && s.name.toLowerCase().includes(term)));
  });
  
  get currentReservationData() { return { id: this.reservationId, ...this.form.getRawValue(), client: this.selectedClient() }; }

  async loadReservation(id: string) {
    this.loading.set(true);
    try {
      const res: any = await firstValueFrom(this.reservationService.getById(id));
      if (res) {
        this.form.patchValue(res);
        this.form.get('date')?.disable(); this.form.get('startTime')?.disable(); this.form.get('endTime')?.disable();
        const currentSlot = (res.slotId || '').toLowerCase();
        if (currentSlot.includes('aprem')) { this.form.get('slotId')?.enable(); this.restrictedSlotType.set('aprem'); } else { this.form.get('slotId')?.disable(); }
        this.selectedDate.set(res.date);
        if (res.clientId) { this.selectedClientId.set(res.clientId); this.loadClientCredits(res.clientId); }
        if(res.services) { this.selectedServices.set(res.services); this.form.patchValue({ services: res.services }); }
        await this.loadPayments(id);
        this.calculateTotal();
      }
    } catch (e) { console.error(e); } finally { this.loading.set(false); }
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
      this.selectedServices.set(services);
      this.form.patchValue({ services });
      this.calculateTotal();
  }
  
  getServicesTotal(): number { return this.selectedServices().reduce((acc, s) => acc + (Number(s.price) || 0), 0); }
  applySlotTimes(slotId: string) { const slot = this.availableSlots().find((s: any) => s.id === slotId); if (slot) this.form.patchValue({ startTime: slot.start, endTime: slot.end }); }
  
  togglePartenaire(id: string) { if (this.isPartenaireSelected(id)) this.removePartenaire(id); else this.addPartenaire(id); }
  isPartenaireSelected(id: string): boolean { return (this.form.get('assignedServerIds')?.value || []).includes(id); }
  addPartenaire(id: string) {
    const currentIds = this.form.get('assignedServerIds')?.value || [];
    if (!currentIds.includes(id)) {
        const newIds = [...currentIds, id];
        this.form.patchValue({ staffIds: newIds, assignedServerIds: newIds });
        const partner = this.allPartenaires().find((p: any) => p.id === id);
        if (partner && partner.serviceIds && Array.isArray(partner.serviceIds)) {
            let currentServices = [...this.selectedServices()];
            partner.serviceIds.forEach((srvId: string) => {
                const srvDef = this.allServices().find((s: any) => s.id === srvId);
                if (srvDef && !currentServices.some(s => s.id === srvDef.id)) {
                    currentServices.push({ ...srvDef, price: Number(srvDef.price || srvDef.prix || 0) });
                }
            });
            this.updateServices(currentServices);
        }
    }
    this.partenaireSearch.set('');
  }
  removePartenaire(id: string) {
    const currentIds = this.form.get('assignedServerIds')?.value || [];
    const newIds = currentIds.filter((x: string) => x !== id);
    this.form.patchValue({ staffIds: newIds, assignedServerIds: newIds });
    const partner = this.allPartenaires().find((p: any) => p.id === id);
    if (partner && partner.serviceIds) {
        let currentServices = [...this.selectedServices()];
        currentServices = currentServices.filter(s => !partner.serviceIds.includes(s.id));
        this.updateServices(currentServices);
    }
  }
  updatePartnerPayments(newPayments: any[]) {
      this.form.patchValue({ partnerPayments: newPayments });
      if (this.isEditMode() && this.reservationId) this.onSubmit();
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
          if (newPack && newPack.services) {
             let currentServices = [...this.selectedServices()];
              newPack.services.forEach((packService: any) => {
                  const fullServiceDef = this.allServices().find((s: any) => s.id === packService.id) || packService;
                  if (!currentServices.some(c => c.id === fullServiceDef.id)) {
                      currentServices.push({ ...fullServiceDef, price: Number(fullServiceDef.price || fullServiceDef.prix || 0) });
                  }
              });
              this.updateServices(currentServices);
          } else { this.calculateTotal(); }
      } else { this.calculateTotal(); }
  }
  getPackTotal(pack: any) { return Number(pack.price || 0); }

  async setActiveTab(tab: any) { 
    if (!this.form.get('clientId')?.value) { this.ui.showToast('error', 'Sélectionnez un client d\'abord'); return; }
    this.activeTab.set(tab); 
    if (this.form.valid) await this.onSubmit(); 
  }
  onClose() { if (this.isModal) this.close.emit(); else this.router.navigate(['/reservations']); }
  isPastReservation() { return this.selectedDate() && new Date(this.selectedDate()) < new Date(new Date().setHours(0,0,0,0)); }
  onSlotChange(e: any) { this.applySlotTimes(e.target.value); this.calculateTotal(); }

  openClientModal() { this.clientToEdit.set(null); this.showClientModal.set(true); }
  closeClientModal() { this.showClientModal.set(false); }
  onClientModalFinish(res: any) { this.closeClientModal(); if (res?.id) this.selectClient(res); }
  openPartenaireModal() { this.showPartenaireModal.set(true); }
  closePartenaireModal() { this.showPartenaireModal.set(false); }
  onPartenaireModalFinish(res: any) { this.closePartenaireModal(); }
  
  openPaymentModal() { if (this.reservationId) this.showPaymentModal.set(true); }
  closePaymentModal() { this.showPaymentModal.set(false); }
  async onPaymentFinished() { this.closePaymentModal(); if(this.reservationId) await this.loadPayments(this.reservationId); }

  onClientSearch(e: any) { this.clientSearch.set(e.target.value); }
  onEditClient(client: any) { if (client) { this.clientToEdit.set(client); this.showClientModal.set(true); } }
  selectClient(client: any) { 
    this.form.patchValue({ clientId: client.id }); 
    this.selectedClientId.set(client.id); 
    this.clientSearch.set(''); 
    this.loadClientCredits(client.id); 
  }

  async loadPayments(reservationId: string) {
      try {
          this.paymentService.getByReservation(reservationId).subscribe(data => {
              this.payments.set(data);
              const totalPaid = data.reduce((sum, p: any) => sum + (Number(p.amount) || 0), 0);
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
    } catch(e) { console.error("Credits client error:", e); }
  }
  async loadGlobalCredits() {
    try {
        runInInjectionContext(this.injector, async () => {
            const q = query(collection(this.firestore, 'provisional_receipts'), where('status', '==', 'AVAILABLE'));
            const snap = await getDocs(q);
            const unique = new Map(); snap.docs.forEach(d => unique.set(d.id, { id: d.id, ...d.data() }));
            this.globalCredits.set(Array.from(unique.values()));
        });
    } catch(e) { console.error("Credits global error:", e); }
  }

  async onSubmit() {
    if (this.form.invalid) return;
    this.loading.set(true);
    this.calculateTotal();
    const val = this.form.getRawValue();
    try {
        if (this.isEditMode() && this.reservationId) {
            await this.reservationService.updateReservation(this.reservationId, val);
            this.ui.showToast('success', 'Mise à jour réussie');
        } else {
            const res = await this.reservationService.addReservation(val);
            this.reservationId = res.id;
            this.isEditMode.set(true);
            this.ui.showToast('success', 'Création réussie');
            this.location.replaceState('/reservations/edit/' + res.id);
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

  async onPrint() { if (this.reservationId) this.contractPdfService.generateContract({ id: this.reservationId, ...this.form.getRawValue() }, this.selectedClient() || {}); }
  onPrintPayments() { if (this.reservationId) this.paymentPdfService.generateReceipt({ id: this.reservationId, ...this.form.getRawValue() }, this.selectedClient() || {}, this.payments()); }
  getDateObject(ts: any): Date { return ts?.toDate ? ts.toDate() : new Date(ts || new Date()); }
}
