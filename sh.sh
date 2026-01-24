#!/bin/bash

TS_FILE="src/app/features/calendar/reservation-form/reservation-form.component.ts"
HTML_FILE="src/app/features/calendar/reservation-form/reservation-form.component.html"

echo "🚀 Remplacement de la gestion Partenaires par la gestion des Services..."

# 1. Mise à jour du TypeScript (Logique orientée Services)
echo "📝 Mise à jour de $TS_FILE..."
cat << 'EOF' > "$TS_FILE"
import { Component, OnInit, computed, effect, inject, signal, Input, Output, EventEmitter, Injector, runInInjectionContext } from '@angular/core';
import { CommonModule, DatePipe, Location } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { toSignal, takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { firstValueFrom, from } from 'rxjs';
import { debounceTime, filter, distinctUntilChanged, tap, switchMap, catchError } from 'rxjs/operators';
import { Firestore, collection, query, where, getDocs, addDoc, doc, deleteDoc } from '@angular/fire/firestore';

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
  autoSaveStatus = signal<'idle' | 'saving' | 'saved' | 'error'>('idle');

  reservationId: string | null = null;
  
  // Modals State
  showClientModal = signal(false);
  clientToEdit = signal<any>(null);
  showPartenaireModal = signal(false);
  partenaireToEdit = signal<any>(null);
  showPaymentModal = signal(false);
  showAdminAuth = signal(false);

  // Data Signals
  allServices = toSignal(this.serviceService.getAll(), { initialValue: [] as any[] });
  allPartenaires = toSignal(this.partenaireService.getAll(), { initialValue: [] as any[] });
  rawClients = toSignal(this.clientService.getAll(), { initialValue: [] as any[] });
  packs = toSignal(this.packService.getAll(), { initialValue: [] as any[] });
  packs$ = this.packService.getAll();

  // Search Signals
  clientSearch = signal('');
  partenaireSearch = signal(''); 
  serviceSearch = signal('');

  // Selected Data
  selectedServices = signal<any[]>([]);
  selectedDate = signal<string>('');
  selectedClientId = signal<string | null>(null);
  payments = signal<any[]>([]); // Tous les paiements (Recettes + Dépenses)

  restrictedSlotType = signal<string | null>(null);
  pendingParams = signal<any>(null);

  // --- LOGIQUE CREDITS CLIENTS ---
  showClientCredits = signal(false); 
  availableCredits = signal<any[]>([]);
  availableCreditSearch = signal('');
  availableCreditPage = signal(1);
  readonly ITEMS_PER_PAGE = 5;

  toggleClientCredits() { this.showClientCredits.update(v => !v); }

  // --- LOGIQUE FINANCE SERVICES (NOUVEAU) ---
  // Formulaire pour ajouter une dépense rapide sur un service
  serviceExpenseForm: FormGroup;

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
    notes: ['']
  });

  constructor() {
    // Formulaire pour paiement service
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

    this.form.valueChanges.pipe(
      takeUntilDestroyed(),
      debounceTime(5000), 
      filter(() => this.form.valid && !!this.reservationId && this.isEditMode() && !this.isDeleting()),
      distinctUntilChanged((a, b) => JSON.stringify(a) === JSON.stringify(b)),
      tap(() => this.autoSaveStatus.set('saving')),
      switchMap(val => from(this.reservationService.updateReservation(this.reservationId!, val)).pipe(catchError(() => { this.autoSaveStatus.set('error'); return []; })))
    ).subscribe(() => { this.autoSaveStatus.set('saved'); setTimeout(() => this.autoSaveStatus.set('idle'), 3000); });
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
          if (params['date'] && !this.reservationId) {
              this.pendingParams.set({ date: params['date'], slotId: params['slotId'] || '' });
          }
      });
  }

  // --- COMPUTED SIGNALS ---

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

  // --- LOGIQUE FINANCIERE SERVICES (Replacement de groupedPartners) ---
  servicesFinanceSummary = computed(() => {
    const services = this.selectedServices();
    const allPayments = this.payments(); // Contient Recettes et Dépenses
    const partnersList = this.allPartenaires();

    return services.map(srv => {
        // Identification du partenaire lié au service
        const partnerId = srv.partnerId;
        const partner = partnersList.find(p => p.id === partnerId);
        
        // Coût du service
        const cost = Number(srv.price || srv.prix || 0);

        // Paiements (Dépenses) liés à ce service
        // On suppose que le paiement a 'serviceId' stocké ou 'serviceName'
        const expenses = allPayments.filter(p => 
            p.direction === 'EXPENSE' && 
            (p.serviceId === srv.id || p.serviceName === srv.name || p.serviceId === srv.name) // Flexibilité sur la liaison
        );

        const totalPaid = expenses.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);

        return {
            serviceId: srv.id,
            serviceName: srv.name || srv.nom,
            partnerId: partnerId,
            partnerName: partner ? `${partner.nom} ${partner.prenom}` : 'Non assigné',
            cost: cost,
            paid: totalPaid,
            remaining: cost - totalPaid,
            history: expenses
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

  get currentReservationData() { return { id: this.reservationId, ...this.form.getRawValue(), client: this.selectedClient() }; }

  // --- ACTIONS ---

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
  
  // --- GESTION DES DEPENSES SERVICES ---

  async addServiceExpense(serviceItem: any) {
    if (this.serviceExpenseForm.invalid) return;
    const val = this.serviceExpenseForm.value;
    
    try {
        await addDoc(collection(this.firestore, 'payments'), {
            reservationId: this.reservationId,
            serviceId: serviceItem.serviceId || serviceItem.serviceName, // Lien vers le service
            serviceName: serviceItem.serviceName,
            partnerId: serviceItem.partnerId || null, // Lien vers le partenaire (pour info)
            amount: val.amount,
            type: val.method,
            direction: 'EXPENSE', // Important: C'est une dépense
            date: new Date().toISOString(),
            reference: val.reference || '',
            createdAt: new Date().toISOString()
        });

        this.ui.showToast('success', 'Règlement enregistré');
        this.serviceExpenseForm.reset({ amount: 0, method: 'ESPECES' });
        await this.loadPayments(this.reservationId!);
    } catch (e) {
        console.error(e);
        this.ui.showToast('error', 'Erreur lors de l\'enregistrement');
    }
  }

  // Services Selection Logic
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

  // Modals
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
  selectClient(client: any) { 
    this.form.patchValue({ clientId: client.id }); 
    this.selectedClientId.set(client.id); 
    this.clientSearch.set(''); 
    this.loadClientCredits(client.id); 
  }

  // Loading Data
  async loadPayments(reservationId: string) {
      try {
          // Charge tous les paiements (Recettes ET Dépenses)
          this.paymentService.getByReservation(reservationId).subscribe(data => {
              this.payments.set(data);
              // Calcul des recettes (INCOME) pour mettre à jour 'advance'
              const totalPaid = data
                .filter((p: any) => !p.direction || p.direction === 'INCOME')
                .reduce((sum, p: any) => sum + (Number(p.amount) || 0), 0);
              
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

  // Credits Actions
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
  
  prevAvailableCreditPage() { if (this.availableCreditPage() > 1) this.availableCreditPage.update(p => p - 1); }
  nextAvailableCreditPage() { if (this.availableCreditPage() < this.totalAvailableCreditPages()) this.availableCreditPage.update(p => p + 1); }

  async deletePayment(p: any) {
      if(confirm('Supprimer ce paiement ?')) {
          await this.paymentService.delete(p.id);
          this.ui.showToast('success', 'Supprimé');
          if(this.reservationId) await this.loadPayments(this.reservationId);
      }
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

  printGlobalPartnerReport() {
    // Cette fonction pourrait être adaptée pour imprimer un bilan par service si besoin
    this.ui.showToast('info', 'Impression Bilan Service non implémentée (utilisez le bouton standard)');
  }
  
  async onPrint() { if (this.reservationId) this.contractPdfService.generateContract({ id: this.reservationId, ...this.form.getRawValue() }, this.selectedClient() || {}); }
  onPrintPayments() { if (this.reservationId) this.paymentPdfService.generateReceipt({ id: this.reservationId, ...this.form.getRawValue() }, this.selectedClient() || {}, this.payments().filter(p => !p.direction || p.direction === 'INCOME')); }
  getDateObject(ts: any): Date { return ts?.toDate ? ts.toDate() : new Date(ts || new Date()); }
}
EOF

# 2. Mise à jour du HTML (Nouveau design Tab Finance Service)
echo "📝 Mise à jour de $HTML_FILE..."
cat << 'EOF' > "$HTML_FILE"
<div class="max-w-5xl mx-auto bg-white rounded-2xl shadow-xl mt-6 border border-slate-100 flex flex-col min-h-[600px] overflow-hidden">
  
  <div class="px-8 py-5 border-b border-slate-100 bg-white z-10">
    <div class="flex justify-between items-center mb-6">
      <h2 class="text-2xl font-black text-slate-800 flex items-center">
        <span class="material-icons mr-3 text-blue-600">event_available</span>
        {{ isEditMode() ? 'Modifier la Réservation' : 'Nouvelle Réservation' }}
      </h2>
      <div class="flex gap-2">
        <ng-container *ngIf="isEditMode()">
          <button type="button" (click)="onPrint()" class="flex items-center gap-2 px-3 py-1.5 bg-purple-100 text-purple-700 rounded-lg font-bold hover:bg-purple-200 transition text-sm">
            <span class="material-icons text-sm">print</span> Contrat
          </button>
          <button type="button" (click)="onPrintPayments()" class="flex items-center gap-2 px-3 py-1.5 bg-emerald-100 text-emerald-700 rounded-lg font-bold hover:bg-emerald-200 transition text-sm">
            <span class="material-icons text-sm">receipt_long</span> Règlements
          </button>
          <button type="button" (click)="onDeleteReservation()" class="flex items-center gap-2 px-3 py-1.5 bg-red-100 text-red-700 rounded-lg font-bold hover:bg-red-200 transition text-sm">
            <span class="material-icons text-sm">delete</span>
          </button>
        </ng-container>
        <button type="button" (click)="onClose()" class="text-slate-400 hover:text-slate-600 p-2 ml-2">
          <span class="material-icons">close</span>
        </button>
      </div>
    </div>

    <div class="flex items-center gap-1 overflow-x-auto no-scrollbar pb-1">
      <button (click)="setActiveTab('info')" [class]="activeTab() === 'info' ? 'bg-blue-600 text-white shadow-md shadow-blue-200' : 'bg-slate-50 text-slate-500 hover:bg-slate-100'" class="px-4 py-2 rounded-lg font-bold text-xs uppercase tracking-wide transition flex items-center gap-2 whitespace-nowrap"><span class="material-icons text-sm">person</span> Informations</button>
      <button (click)="setActiveTab('pack')" [class]="activeTab() === 'pack' ? 'bg-slate-800 text-white' : 'bg-slate-50 text-slate-500 hover:bg-slate-100'" class="px-4 py-2 rounded-lg font-bold text-xs uppercase tracking-wide transition flex items-center gap-2 whitespace-nowrap"><span class="material-icons text-sm">inventory_2</span> Choix du Pack</button>
      <button (click)="setActiveTab('services')" [class]="activeTab() === 'services' ? 'bg-indigo-600 text-white shadow-md shadow-indigo-200' : 'bg-slate-50 text-slate-500 hover:bg-slate-100'" class="px-4 py-2 rounded-lg font-bold text-xs uppercase tracking-wide transition flex items-center gap-2 whitespace-nowrap"><span class="material-icons text-sm">room_service</span> Services</button>
      <button (click)="setActiveTab('reglement')" [class]="activeTab() === 'reglement' ? 'bg-emerald-600 text-white shadow-md shadow-emerald-200' : 'bg-slate-50 text-slate-500 hover:bg-slate-100'" class="px-4 py-2 rounded-lg font-bold text-xs uppercase tracking-wide transition flex items-center gap-2 whitespace-nowrap"><span class="material-icons text-sm">payments</span> Règlements Clients</button>
      <button (click)="setActiveTab('service_finance')" [class]="activeTab() === 'service_finance' ? 'bg-purple-600 text-white shadow-md shadow-purple-200' : 'bg-slate-50 text-slate-500 hover:bg-slate-100'" class="px-4 py-2 rounded-lg font-bold text-xs uppercase tracking-wide transition flex items-center gap-2 whitespace-nowrap"><span class="material-icons text-sm">handshake</span> Règlements de Services</button>
    </div>
  </div>

  <form [formGroup]="form" (ngSubmit)="onSubmit()" class="flex-1 flex flex-col relative overflow-hidden bg-slate-50/50">
    <div class="flex-1 p-8 overflow-y-auto custom-scrollbar">

      <div *ngIf="activeTab() === 'pack'" class="tab-content max-w-2xl mx-auto space-y-6">
          <div *ngIf="isPastReservation()" class="bg-orange-50 border-l-4 border-orange-400 p-4 rounded shadow-sm mb-6 flex items-start gap-3">
              <span class="material-icons text-orange-500 mt-0.5">lock_clock</span>
              <div><h4 class="font-bold text-orange-800 text-sm uppercase">Modification Verrouillée</h4></div>
          </div>
          <div class="text-center mb-8">
            <h3 class="text-xl font-black text-slate-700">Sélectionnez un Pack</h3>
            <p class="text-slate-400 text-sm">Choisissez une base pour pré-remplir les services</p>
          </div>
          <div class="space-y-4">
            <div (click)="selectPack(null)" class="p-5 rounded-xl border-2 transition-all flex items-center gap-4 relative cursor-pointer"
                 [class.pointer-events-none]="isPastReservation()" [class.opacity-60]="isPastReservation()"
                 [class.border-slate-800]="form.value.packId === null" [class.bg-white]="form.value.packId === null" [class.border-slate-200]="form.value.packId !== null">
               <div class="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center"><span class="material-icons text-slate-500">edit_off</span></div>
               <div class="font-bold text-slate-800">Sur Mesure (Aucun Pack)</div>
            </div>
            <div *ngFor="let pack of (packs$ | async) || []" (click)="selectPack(pack.id || null, pack)"
                 class="p-5 rounded-xl border-2 transition-all flex items-center gap-4 bg-white relative cursor-pointer"
                 [class.border-blue-600]="form.value.packId === pack.id" [class.border-transparent]="form.value.packId !== pack.id">
                <div class="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center"><span class="material-icons text-blue-600">inventory_2</span></div>
                <div class="flex-1">
                  <div class="font-bold text-slate-800">{{ pack.nom }}</div>
                  <div class="text-xs text-slate-500">{{ getPackTotal(pack) }} DT</div>
                </div>
                <span *ngIf="form.value.packId === pack.id" class="material-icons text-blue-600">check_circle</span>
            </div>
          </div>
      </div>

      <div *ngIf="activeTab() === 'info'" class="tab-content">
          <div class="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div class="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm text-center"><div class="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Total Dossier</div><div class="text-2xl font-black text-slate-700">{{ form.value.totalPrice || 0 }} DT</div></div>
            <div class="bg-emerald-50 p-5 rounded-2xl border border-emerald-100 shadow-sm text-center"><div class="text-xs font-bold text-emerald-600 uppercase tracking-widest mb-2">Déjà Payé</div><div class="text-2xl font-black text-emerald-700">{{ form.value.advance || 0 }} DT</div></div>
            <div class="bg-slate-800 p-5 rounded-2xl shadow-lg text-center text-white"><div class="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Reste à payer</div><div class="font-black text-2xl">{{ (form.value.totalPrice || 0) - (form.value.advance || 0) }} DT</div></div>
          </div>

          <div class="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div class="space-y-6">
              <div class="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                <h4 class="text-sm font-black text-slate-500 uppercase mb-4 flex items-center gap-2"><span class="material-icons text-blue-500">calendar_today</span> Date & Horaire</h4>
                <div class="space-y-4">
                  <div><label class="block text-xs font-bold text-slate-500 mb-1">Date</label><input formControlName="date" type="date" readonly class="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-100 text-slate-500 font-bold"></div>
                  <div><label class="block text-xs font-bold text-slate-500 mb-1">Créneau</label>
                    <select formControlName="slotId" (change)="onSlotChange($event)" class="w-full px-4 py-3 rounded-xl border border-slate-200 bg-white outline-none">
                      <option value="">Sélectionner un créneau...</option>
                      <option *ngFor="let slot of filteredSlots()" [value]="slot.id">{{ slot.label }}</option>
                    </select>
                  </div>
                </div>
              </div>
              <div class="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex-1 flex flex-col">
                 <div class="flex justify-between items-center mb-4"><h4 class="text-sm font-black text-slate-500 uppercase flex items-center gap-2"><span class="material-icons text-blue-500">search</span> Sélection Client</h4><button type="button" (click)="openClientModal()" class="text-xs font-bold text-blue-600 bg-blue-50 px-3 py-1.5 rounded-lg hover:bg-blue-100 transition">+ Nouveau</button></div>
                 <input type="text" [value]="clientSearch()" (input)="onClientSearch($event)" placeholder="Rechercher nom, tél..." class="w-full px-4 py-2 rounded-lg border border-slate-200 outline-none mb-3">
                 <div class="flex-1 overflow-y-auto max-h-[250px] space-y-2 custom-scrollbar pr-1">
                   <div *ngFor="let c of filteredClients()" (click)="selectClient(c)" class="p-3 rounded-xl cursor-pointer border transition-all flex justify-between items-center" [class.bg-blue-50]="form.value.clientId === c.id" [class.border-blue-500]="form.value.clientId === c.id">
                       <div><div class="font-bold text-slate-800 text-sm">{{ c.nom }} {{ c.prenom }}</div><div class="text-xs text-slate-500">{{ c.telephone }}</div></div>
                       <span *ngIf="form.value.clientId === c.id" class="material-icons text-blue-600 text-sm">check_circle</span>
                   </div>
                 </div>
              </div>
            </div>

            <div>
              <div *ngIf="selectedClient()" class="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                  <div class="flex items-center gap-3 border-b pb-4 mb-4">
                    <div class="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold text-xl uppercase">{{ selectedClient()?.nom?.charAt(0) }}</div>
                    <div><h3 class="font-bold text-lg text-slate-800">{{ selectedClient()?.nom }} {{ selectedClient()?.prenom }}</h3><button type="button" (click)="onEditClient(selectedClient())" class="text-xs text-blue-600 hover:underline flex items-center gap-1"><span class="material-icons text-[14px]">edit</span> Modifier fiche client</button></div>
                  </div>
                  <div class="space-y-4 text-sm">
                     <div class="grid grid-cols-3 gap-2 border-b border-slate-50 pb-2"><span class="text-slate-400 font-medium">Téléphone</span><span class="col-span-2 text-slate-800 font-bold">{{ selectedClient()?.telephone }}</span></div>
                     <div class="grid grid-cols-3 gap-2 border-b border-slate-50 pb-2"><span class="text-slate-400 font-medium">Email</span><span class="col-span-2 text-slate-800 font-medium">{{ selectedClient()?.email || '-' }}</span></div>
                  </div>
                  <div *ngIf="selectedClient()?.notes" class="mt-4 p-3 bg-amber-50 border border-amber-100 rounded-lg text-xs text-amber-800"><p class="italic">{{ selectedClient()?.notes }}</p></div>
              </div>

              <div class="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm mt-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                <div class="flex justify-between items-center mb-4 border-b border-slate-100 pb-2">
                    <h3 class="font-bold text-slate-700 flex items-center gap-2">
                        <span class="material-icons text-indigo-500">room_service</span> Services Inclus
                    </h3>
                    <span class="text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-1 rounded-full">{{ selectedServices().length }}</span>
                </div>
                <div *ngIf="selectedServices().length === 0" class="py-4 text-center text-slate-400 italic text-sm border-2 border-dashed border-slate-100 rounded-lg">Aucun service sélectionné.</div>
                <div *ngIf="selectedServices().length > 0" class="space-y-1 max-h-60 overflow-y-auto custom-scrollbar pr-1">
                    <div *ngFor="let s of selectedServices()" class="flex justify-between items-center text-sm p-2 hover:bg-slate-50 rounded-lg transition group border border-transparent hover:border-slate-100">
                        <span class="text-slate-700 font-medium flex items-center gap-2">
                            <span class="material-icons text-xs text-indigo-300 group-hover:text-indigo-500">check_circle</span> 
                            {{ s.name || s.nom }}
                        </span>
                        <span class="font-bold text-slate-600">{{ s.price || s.prix }} DT</span>
                    </div>
                </div>
                <div class="mt-3 pt-3 border-t border-slate-100 flex justify-between items-center bg-slate-50 p-2 rounded-lg">
                    <span class="text-xs font-bold text-slate-500 uppercase tracking-wider">Total Services</span>
                    <span class="font-black text-indigo-700 text-lg">{{ getServicesTotal() | number:'1.0-2' }} DT</span>
                </div>
              </div>
            </div>
          </div>

          <div class="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm mt-6">
            <h3 class="font-bold text-slate-700 mb-3 flex items-center gap-2"><span class="material-icons text-slate-400">sticky_note_2</span> Notes & Commentaires</h3>
            <textarea formControlName="notes" rows="4" placeholder="Instructions..." class="w-full p-4 rounded-xl border border-slate-200 bg-slate-50"></textarea>
          </div>
      </div>

      <div *ngIf="activeTab() === 'services'" class="tab-content">
          <div *ngIf="selectedServices().length > 0" class="bg-white p-5 rounded-xl border border-slate-200 shadow-sm mb-6">
              <div class="flex justify-between items-center mb-4 pb-3 border-b border-slate-100">
                <h4 class="font-bold text-slate-700 flex items-center gap-2"><span class="material-icons text-emerald-500">check_circle</span> Inclus ({{ selectedServices().length }})</h4>
                <div class="text-sm font-bold text-slate-500">Total: <span class="text-emerald-600">{{ getServicesTotal() | number:'1.0-2' }} DT</span></div>
              </div>
              <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div *ngFor="let service of selectedServices(); let i = index" class="flex items-center gap-3 p-2 bg-slate-50 rounded-lg border border-slate-200">
                    <div class="flex-1 min-w-0"><div class="font-bold text-slate-700 text-sm truncate">{{ service.name || service.nom }}</div><div class="text-xs text-slate-400">{{ service.price | number:'1.0-2' }} DT</div></div>
                    <button type="button" (click)="removeService(i)" class="text-red-400 hover:text-red-600"><span class="material-icons">close</span></button>
                </div>
              </div>
          </div>
          <div class="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
            <div class="flex justify-between items-center mb-6"><h3 class="font-bold text-slate-700">Catalogue</h3><input type="text" (input)="serviceSearch.set($any($event.target).value)" placeholder="Rechercher..." class="w-64 px-3 py-1.5 rounded-lg border border-slate-200 text-sm"></div>
            <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
              <div *ngFor="let service of filteredServices()" (click)="toggleService(service)"
                   class="cursor-pointer border rounded-xl p-4 transition-all relative group hover:shadow-md bg-white h-auto"
                   [ngClass]="isServiceSelected(service) ? 'border-indigo-500 bg-indigo-50' : 'border-slate-200'">
                  <div class="font-bold text-sm text-slate-800">{{ service.name || service.nom }}</div>
                  <div class="text-xs font-bold text-slate-600 mt-2">{{ service.price || service.prix }} DT</div>
                  <span *ngIf="isServiceSelected(service)" class="material-icons text-indigo-600 text-lg absolute top-2 right-2">check_circle</span>
              </div>
            </div>
          </div>
      </div>

      <div *ngIf="activeTab() === 'reglement'" class="tab-content">
          <div *ngIf="availableCredits().length > 0" class="bg-purple-50 rounded-2xl border border-purple-100 shadow-sm overflow-hidden mb-6">
              <div (click)="toggleClientCredits()" class="p-6 flex justify-between items-center cursor-pointer hover:bg-purple-100 transition select-none">
                  <h4 class="font-black text-purple-800 flex items-center gap-2">
                      <span class="material-icons">card_giftcard</span> Bons & Avoirs Disponibles (Client)
                      <span class="text-xs bg-purple-200 text-purple-800 px-2 py-0.5 rounded-full ml-2">{{ availableCredits().length }}</span>
                  </h4>
                  <span class="material-icons text-purple-600 transition-transform duration-300" [class.rotate-180]="showClientCredits()">expand_more</span>
              </div>
              <div *ngIf="showClientCredits()" class="p-6 pt-0 border-t border-purple-100">
                  <div class="space-y-3 mt-4">
                      <div *ngFor="let credit of paginatedAvailableCredits()" class="bg-white p-4 rounded-xl border border-purple-100 shadow-sm flex items-center justify-between">
                          <div>
                              <div class="flex items-center gap-2 mb-1">
                                  <span class="text-[10px] font-bold bg-purple-100 text-purple-700 px-2 py-0.5 rounded">AVOIR</span>
                                  <span class="font-black text-slate-800">{{ credit.amount }} DT</span>
                              </div>
                              <div class="text-xs text-slate-500 italic">{{ credit.description }}</div>
                          </div>
                          <button type="button" (click)="useCredit(credit)" class="px-3 py-1.5 bg-purple-600 text-white rounded-lg font-bold text-xs hover:bg-purple-700 transition">Utiliser</button>
                      </div>
                  </div>
                  <div *ngIf="totalAvailableCreditPages() > 1" class="flex justify-center gap-4 mt-4">
                      <button (click)="prevAvailableCreditPage()" [disabled]="availableCreditPage()===1" class="text-purple-700 disabled:opacity-30"><span class="material-icons">chevron_left</span></button>
                      <span class="text-xs font-bold text-purple-800">{{ availableCreditPage() }} / {{ totalAvailableCreditPages() }}</span>
                      <button (click)="nextAvailableCreditPage()" [disabled]="availableCreditPage()===totalAvailableCreditPages()" class="text-purple-700 disabled:opacity-30"><span class="material-icons">chevron_right</span></button>
                  </div>
              </div>
          </div>
          
          <div class="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div class="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h3 class="font-bold text-slate-700 flex items-center gap-2">
                <span class="material-icons text-emerald-500">receipt_long</span> Historique des Règlements
              </h3>
              <button *ngIf="reservationId" type="button" (click)="openPaymentModal()" class="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg font-bold shadow hover:bg-emerald-700 transition text-sm">
                <span class="material-icons text-sm">add</span> Ajouter
              </button>
            </div>
            <div class="overflow-x-auto">
              <table class="w-full text-sm text-left">
                <thead class="bg-slate-50 text-slate-500 font-bold text-xs uppercase">
                  <tr><th class="px-6 py-3">Date</th><th class="px-6 py-3">Mode</th><th class="px-6 py-3 text-right">Montant</th><th class="px-6 py-3 text-center">Actions</th></tr>
                </thead>
                <tbody class="divide-y divide-slate-100">
                  <tr *ngFor="let pay of payments()" class="hover:bg-slate-50 transition">
                    <td class="px-6 py-3 font-medium text-slate-700">{{ getDateObject(pay.date) | date:'dd/MM/yyyy' }}</td>
                    <td class="px-6 py-3"><span class="font-bold">{{ pay.type }}</span></td>
                    <td class="px-6 py-3 text-right font-bold text-emerald-600">+{{ pay.amount }} DT</td>
                    <td class="px-6 py-3 text-center">
                      <button type="button" (click)="deletePayment(pay)" class="text-slate-400 hover:text-red-600"><span class="material-icons text-sm">delete</span></button>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
      </div>

      <div *ngIf="activeTab() === 'service_finance'" class="tab-content">
          <div class="max-w-4xl mx-auto space-y-6">
            <div class="flex justify-between items-center mb-4 border-l-4 border-purple-500 pl-4">
                <h3 class="text-xl font-black text-slate-700">Règlements par Service</h3>
                <button (click)="printGlobalPartnerReport()" class="text-xs bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 px-4 py-2 rounded-lg shadow-sm flex items-center gap-2 transition font-bold">
                    <span class="material-icons text-sm">print</span> Bilan
                </button>
            </div>

            <div *ngIf="servicesFinanceSummary().length === 0" class="text-center py-12 text-slate-400 italic bg-white rounded-2xl border-2 border-dashed border-slate-200">
                <span class="material-icons text-4xl mb-2 text-slate-300">room_service</span>
                <p class="text-lg font-medium">Aucun service sélectionné.</p>
                <p class="text-sm">Ajoutez des services à la réservation pour gérer leurs paiements.</p>
            </div>

            <div *ngFor="let item of servicesFinanceSummary()" class="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm mb-6 transition-all hover:shadow-md">
                
                <div class="bg-slate-50 px-6 py-4 border-b border-slate-100 flex justify-between items-start">
                    <div>
                        <div class="flex items-center gap-2">
                            <span class="font-black text-slate-800 text-lg">{{ item.serviceName }}</span>
                            <span *ngIf="item.partnerName !== 'Non assigné'" class="text-[10px] uppercase font-bold bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded">{{ item.partnerName }}</span>
                        </div>
                        <div class="text-xs text-slate-500 mt-1">Coût du service : <span class="font-bold text-slate-700">{{ item.cost }} DT</span></div>
                    </div>
                    
                    <div class="text-right">
                        <div class="text-xs text-slate-400 uppercase font-bold tracking-wider mb-1">Reste à Payer</div>
                        <div class="font-black text-xl" [ngClass]="{'text-red-600': item.remaining > 0, 'text-emerald-600': item.remaining <= 0}">
                            {{ item.remaining }} DT
                        </div>
                    </div>
                </div>

                <div class="p-6">
                    <form [formGroup]="serviceExpenseForm" (ngSubmit)="addServiceExpense(item)" class="flex items-end gap-3 mb-6 p-4 bg-purple-50 rounded-xl border border-purple-100">
                        <div class="flex-1">
                            <label class="block text-[10px] font-bold text-purple-800 uppercase mb-1">Montant à régler</label>
                            <input type="number" formControlName="amount" class="w-full text-sm font-bold border-purple-200 rounded-lg p-2 focus:ring-2 focus:ring-purple-500 outline-none" [placeholder]="item.remaining">
                        </div>
                        <div class="w-32">
                            <label class="block text-[10px] font-bold text-purple-800 uppercase mb-1">Mode</label>
                            <select formControlName="method" class="w-full text-sm font-medium border-purple-200 rounded-lg p-2 bg-white focus:ring-2 focus:ring-purple-500 outline-none">
                                <option value="ESPECES">Espèces</option>
                                <option value="CHEQUE">Chèque</option>
                                <option value="VIREMENT">Virement</option>
                            </select>
                        </div>
                        <button type="submit" [disabled]="serviceExpenseForm.invalid" class="bg-purple-600 hover:bg-purple-700 text-white font-bold text-sm px-4 py-2 rounded-lg shadow transition h-[38px] flex items-center gap-1 disabled:opacity-50">
                            <span class="material-icons text-xs">add</span> Payer
                        </button>
                    </form>

                    <div *ngIf="item.history.length > 0">
                        <div class="text-[10px] font-bold text-slate-400 uppercase mb-2">Historique des règlements</div>
                        <div class="space-y-2">
                            <div *ngFor="let p of item.history" class="flex justify-between items-center text-xs py-2 px-3 bg-slate-50 rounded-lg border border-slate-100 hover:border-purple-200 transition">
                                <span class="flex items-center gap-2 text-slate-600">
                                    <span class="font-medium">{{ getDateObject(p.date) | date:'dd/MM HH:mm' }}</span>
                                    <span class="px-1.5 py-0.5 bg-white border border-slate-200 rounded text-[10px] uppercase font-bold">{{ p.type }}</span>
                                </span>
                                <div class="flex items-center gap-3">
                                    <span class="font-black text-slate-800">{{ p.amount }} DT</span>
                                    <button type="button" (click)="deletePayment(p)" class="text-slate-400 hover:text-red-500 transition"><span class="material-icons text-sm">delete</span></button>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div *ngIf="item.history.length === 0" class="text-center text-xs text-slate-400 italic py-2">Aucun règlement effectué pour ce service.</div>
                </div>
            </div>
          </div>
      </div>

    </div>

    <div class="p-6 bg-white border-t border-slate-100 flex justify-end gap-3 z-10">
      <button type="button" (click)="onClose()" class="px-6 py-3 text-slate-500 font-bold hover:bg-slate-50 rounded-xl transition">Annuler</button>
      <button type="submit" [disabled]="form.invalid" class="px-8 py-3 bg-slate-900 text-white rounded-xl font-black shadow-xl hover:scale-[1.02] transition disabled:opacity-50">
        {{ isEditMode() ? 'Mettre à jour' : 'Enregistrer' }}
      </button>
    </div>
  </form>
</div>

<app-client-form *ngIf="showClientModal()" [clientId]="clientToEdit()?.id" [isModal]="true" (finish)="onClientModalFinish($event)"></app-client-form>
<app-partenaire-form *ngIf="showPartenaireModal()" [isModal]="true" (finish)="onPartenaireModalFinish($event)"></app-partenaire-form>
<app-payment-modal *ngIf="showPaymentModal()" [reservation]="currentReservationData" (close)="closePaymentModal()" (paymentSuccess)="onPaymentFinished()"></app-payment-modal>
<app-admin-confirm-dialog *ngIf="showAdminAuth()" (confirmed)="onAdminAuthSuccess()" (cancelled)="showAdminAuth.set(false)"></app-admin-confirm-dialog>
EOF

echo "✅ Onglet 'Règlements de Services' déployé avec succès."