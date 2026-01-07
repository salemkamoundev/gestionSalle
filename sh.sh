#!/bin/bash

# Couleurs pour le terminal
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}=== Application des correctifs Onglets & Partenaires ===${NC}"

# ==============================================================================
# 1. Mise à jour du COMPOSANT TYPESCRIPT (.ts)
# ==============================================================================
TS_FILE="src/app/features/calendar/reservation-form/reservation-form.component.ts"
echo "Mise à jour de $TS_FILE..."

cat << 'EOF' > "$TS_FILE"
import { Component, OnInit, computed, effect, inject, signal, Input, Output, EventEmitter, Injector, runInInjectionContext } from '@angular/core';
import { CommonModule, DatePipe, Location } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { toSignal, takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { firstValueFrom, from } from 'rxjs';
import { debounceTime, filter, distinctUntilChanged, tap, switchMap, catchError } from 'rxjs/operators';

import { ReservationService } from '../../../core/services/reservation.service';
import { ClientService } from '../../../core/services/client.service';
import { ServiceService } from '../../../core/services/service.service';
import { PartenaireService } from '../../../core/services/partenaire.service';
import { PackService } from '../../../core/services/pack.service';
import { UiService } from '../../../core/services/ui.service';
import { ConfigService } from '../../../core/services/config.service';
import { PaymentPdfService } from '../../../core/services/payment-pdf.service';
import { ContractPdfService } from '../../../core/services/contract-pdf.service';
import { PdfService } from '../../../core/services/pdf.service'; // AJOUTÉ
import { AuthService } from '../../../core/services/auth.service';
import { PaymentService } from '../../../core/services/payment.service';
import { Firestore, collection, query, where, getDocs } from '@angular/fire/firestore';

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
  private pdfService = inject(PdfService); // AJOUTÉ
  private authService = inject(AuthService);
  private firestore = inject(Firestore);
  private injector = inject(Injector);

  @Input() isModal = false; 
  @Output() close = new EventEmitter<void>();
  @Output() reservationSaved = new EventEmitter<any>();

  isAdmin = this.authService.isAdmin;

  // AJOUT DE 'partner_finance' DANS LE TYPE
  activeTab = signal<'info' | 'partenaire' | 'teams' | 'pack' | 'services' | 'reglement' | 'partner_finance'>('info');
  isEditMode = signal(false);
  isDeleting = signal(false);
  loading = signal(false);
  autoSaveStatus = signal<'idle' | 'saving' | 'saved' | 'error'>('idle');

  reservationId: string | null = null;
  
  showClientModal = signal(false);
  clientToEdit = signal<any>(null);
  showPartenaireModal = signal(false);
  partenaireToEdit = signal<any>(null);
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

  // --- GESTION ACCORDÉONS AVOIRS ---
  showClientCredits = signal(false); 
  showGlobalCredits = signal(false); 

  toggleClientCredits() { this.showClientCredits.update(v => !v); }
  toggleGlobalCredits() { this.showGlobalCredits.update(v => !v); }

  // --- LOGIQUE PARTENAIRES FINANCE (NOUVEAU) ---
  partnerPaymentForm: FormGroup;
  // Stocke les paiements partenaires chargés depuis la DB (supposé faire partie de la réservation ou collection à part)
  // Pour simplifier, on suppose qu'ils sont dans la réservation sous 'partnerPayments'
  partnerPayments = signal<any[]>([]); 

  groupedPartners = computed(() => {
    const selectedPartenaireIds = this.form.get('assignedServerIds')?.value || [];
    const services = this.selectedServices();
    const payments = this.partnerPayments();
    const partnersList = this.allPartenaires();

    return selectedPartenaireIds.map((pid: string) => {
        const partnerDef = partnersList.find((p: any) => p.id === pid);
        // Trouver les services liés à ce partenaire
        // On suppose que le partenaire a une liste 'serviceIds' OU que le service a un 'partnerId'
        // Ici on utilise la logique inverse de addPartenaire : si le partenaire "possède" le service
        const partnerServices = services.filter(s => 
            (partnerDef?.serviceIds && partnerDef.serviceIds.includes(s.id)) || 
            (s.partnerId === pid)
        );

        // Calcul du coût total dû au partenaire
        // Priorité : s.cost (coût réel) > s.price (prix vente) > 0
        const totalCost = partnerServices.reduce((acc, s) => acc + (Number(s.cost || s.price || 0)), 0);

        // Calcul du total payé
        const totalPaid = payments
            .filter(pay => pay.partnerId === pid)
            .reduce((acc, pay) => acc + (Number(pay.amount) || 0), 0);

        return {
            partnerId: pid,
            partnerName: partnerDef ? `${partnerDef.nom} ${partnerDef.prenom || ''}` : 'Inconnu',
            services: partnerServices.map(s => s.name || s.nom),
            totalCost: totalCost,
            totalPaid: totalPaid,
            remaining: totalCost - totalPaid
        };
    });
  });

  // --- LOGIQUE AVOIRS (PAGINATION) ---
  readonly ITEMS_PER_PAGE = 5;
  availableCredits = signal<any[]>([]);
  availableCreditSearch = signal('');
  availableCreditPage = signal(1);

  filteredAvailableCredits = computed(() => {
    const term = this.availableCreditSearch().toLowerCase();
    return this.availableCredits().filter(c => 
        !term || 
        (c.description && c.description.toLowerCase().includes(term)) || 
        (c.amount && c.amount.toString().includes(term))
    );
  });

  paginatedAvailableCredits = computed(() => {
    const list = this.filteredAvailableCredits();
    const page = this.availableCreditPage();
    const start = (page - 1) * this.ITEMS_PER_PAGE;
    return list.slice(start, start + this.ITEMS_PER_PAGE);
  });

  totalAvailableCreditPages = computed(() => Math.ceil(this.filteredAvailableCredits().length / this.ITEMS_PER_PAGE));

  globalCredits = signal<any[]>([]);
  globalCreditSearch = signal('');
  globalCreditsPage = signal(1);

  filteredGlobalCredits = computed(() => {
    const term = this.globalCreditSearch().toLowerCase();
    const allGlobal = this.globalCredits();
    const clientCreditIds = this.availableCredits().map(c => c.id);
    return allGlobal.filter(c => 
        !clientCreditIds.includes(c.id) && (
            !term || 
            (c.description && c.description.toLowerCase().includes(term)) || 
            (c.amount && c.amount.toString().includes(term)) ||
            (this.getClientName(c.clientId).toLowerCase().includes(term))
        )
    );
  });

  paginatedGlobalCredits = computed(() => {
    const list = this.filteredGlobalCredits();
    const page = this.globalCreditsPage();
    const start = (page - 1) * this.ITEMS_PER_PAGE;
    return list.slice(start, start + this.ITEMS_PER_PAGE);
  });

  totalGlobalCreditsPages = computed(() => Math.ceil(this.filteredGlobalCredits().length / this.ITEMS_PER_PAGE));
  
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
    partnerPayments: [[]] // Pour la persistence
  });

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
    const list = this.allPartenaires() || [];
    return list.filter((p: any) => 
      !term || (p.nom && p.nom.toLowerCase().includes(term)) || (p.prenom && p.prenom.toLowerCase().includes(term))
    );
  });

  filteredClients = computed(() => {
    const term = this.clientSearch().toLowerCase();
    return this.rawClients().filter((c: any) => 
      !term || (c.nom && c.nom.toLowerCase().includes(term)) || (c.telephone && c.telephone.includes(term))
    ).slice(0, 10);
  });

  selectedClient = computed(() => {
    const id = this.selectedClientId();
    return this.rawClients().find((c: any) => c.id === id);
  });
  
  filteredServices = computed(() => {
    const term = this.serviceSearch().toLowerCase();
    return this.allServices().filter((s: any) => 
      !term || (s.nom && s.nom.toLowerCase().includes(term)) || (s.name && s.name.toLowerCase().includes(term))
    );
  });

  get currentReservationData() { 
      return { id: this.reservationId, ...this.form.getRawValue(), client: this.selectedClient() }; 
  }

  constructor() {
    this.partnerPaymentForm = this.fb.group({
      partnerId: ['', Validators.required],
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

        if (reqSlot.includes('matin')) { 
            this.restrictedSlotType.set('matin'); targetId = 'matin'; this.form.get('slotId')?.disable();
        } else if (reqSlot.includes('soir')) { 
            this.restrictedSlotType.set('soir'); targetId = 'soir'; this.form.get('slotId')?.disable();
        } else if (reqSlot.includes('aprem')) { 
            this.restrictedSlotType.set('aprem'); if(targetId === 'aprem') targetId = 'aprem1';
        }

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
      switchMap(val => 
        from(this.reservationService.updateReservation(this.reservationId!, val)).pipe(
          catchError(err => {
            console.error('Auto-save failed', err);
            this.autoSaveStatus.set('error');
            return [];
          })
        )
      )
    ).subscribe(() => {
      this.autoSaveStatus.set('saved');
      setTimeout(() => this.autoSaveStatus.set('idle'), 3000);
    });
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

  async loadReservation(id: string) {
    this.loading.set(true);
    try {
      const res: any = await firstValueFrom(this.reservationService.getById(id));
      if (res) {
        this.form.patchValue(res);
        this.form.get('date')?.disable();
        this.form.get('startTime')?.disable();
        this.form.get('endTime')?.disable();

        const currentSlot = (res.slotId || '').toLowerCase();
        if (currentSlot.includes('aprem')) {
            this.form.get('slotId')?.enable(); 
            this.restrictedSlotType.set('aprem'); 
        } else {
            this.form.get('slotId')?.disable();
        }
        
        this.selectedDate.set(res.date);
        if (res.clientId) this.selectedClientId.set(res.clientId);

        if(res.services) {
            this.selectedServices.set(res.services);
            this.form.patchValue({ services: res.services });
        }
        const staff = res.staffIds || res.assignedServerIds || [];
        this.form.patchValue({ staffIds: staff, assignedServerIds: staff });
        
        // Load Partner Payments
        if (res.partnerPayments) {
            this.partnerPayments.set(res.partnerPayments);
        }

        if (res.clientId) this.loadClientCredits(res.clientId);
        
        await this.loadPayments(id);
        this.calculateTotal();
      }
    } catch (e) { console.error(e); } finally { this.loading.set(false); }
  }

  // --- ACTIONS PARTENAIRES ---
  addPartnerPayment() {
    if (this.partnerPaymentForm.invalid) return;
    const val = this.partnerPaymentForm.value;
    
    // Trouver le nom du partenaire
    const partner = this.allPartenaires().find(p => p.id === val.partnerId);
    
    const newPay = {
        partnerId: val.partnerId,
        partnerName: partner ? `${partner.nom}` : 'Inconnu',
        amount: val.amount,
        method: val.method,
        reference: val.reference,
        date: new Date() // Important pour le tri et l'affichage
    };

    const currentPayments = this.partnerPayments();
    const updatedPayments = [...currentPayments, newPay];
    
    this.partnerPayments.set(updatedPayments);
    this.form.patchValue({ partnerPayments: updatedPayments });
    
    this.partnerPaymentForm.patchValue({ amount: 0, reference: '' });
    this.ui.showToast('success', 'Règlement partenaire ajouté');
    
    // Si on est en mode édition, on sauvegarde tout de suite
    if (this.isEditMode() && this.reservationId) {
        this.onSubmit(); 
    }
  }

  printPartnerReceipt(payment: any) {
    // Reconstruire l'objet reservation pour le PDF
    const resData = {
        ...this.form.getRawValue(),
        clientName: this.selectedClient() ? `${this.selectedClient()?.nom} ${this.selectedClient()?.prenom}` : 'Client'
    };
    this.pdfService.generatePartnerReceipt(resData, payment);
  }

  printGlobalPartnerReport() {
    const resData = {
        ...this.form.getRawValue(),
        clientName: this.selectedClient() ? `${this.selectedClient()?.nom} ${this.selectedClient()?.prenom}` : 'Client'
    };
    this.pdfService.generatePartnersSummary(resData, this.groupedPartners());
  }

  calculateTotal() {
    const val = this.form.getRawValue();
    let total = 0;
    const slot = this.availableSlots().find((s: any) => s.id === val.slotId);
    if (slot) total += (Number(slot.price) || 0);
    
    const services = this.selectedServices();
    const servicesTotal = services.reduce((acc: number, s: any) => acc + (Number(s.price) || Number(s.prix) || 0), 0);
    total += servicesTotal;

    if (val.packId) {
        const pack = this.packs().find(p => p.id === val.packId);
        if (pack) total += (Number(pack.price) || 0);
    }

    if (total > 0) this.form.patchValue({ totalPrice: total }, { emitEvent: false });
  }

  updateServices(services: any[]) {
      const newArray = [...services];
      this.selectedServices.set(newArray);
      this.form.patchValue({ services: newArray });
      this.calculateTotal();
  }

  getServicesTotal(): number {
      return this.selectedServices().reduce((acc, s) => acc + (Number(s.price) || 0), 0);
  }

  applySlotTimes(slotId: string) {
    if(!slotId) return;
    const slot = this.availableSlots().find((s: any) => s.id === slotId);
    if (slot) this.form.patchValue({ startTime: slot.start, endTime: slot.end });
  }

  togglePartenaire(id: string) {
    if (this.isPartenaireSelected(id)) this.removePartenaire(id);
    else this.addPartenaire(id);
  }

  isPartenaireSelected(id: string): boolean {
      return (this.form.get('assignedServerIds')?.value || []).includes(id);
  }
  
  addPartenaire(id: string) {
    const currentIds = this.form.get('assignedServerIds')?.value || [];
    if (!currentIds.includes(id)) {
        const newIds = [...currentIds, id];
        this.form.patchValue({ staffIds: newIds, assignedServerIds: newIds });
        
        const partner = this.allPartenaires().find((p: any) => p.id === id);
        let addedCount = 0;

        if (partner && partner.serviceIds && Array.isArray(partner.serviceIds)) {
            let currentServices = [...this.selectedServices()];
            partner.serviceIds.forEach((srvId: string) => {
                const srvDef = this.allServices().find((s: any) => s.id === srvId);
                if (srvDef && !currentServices.some(s => s.id === srvDef.id)) {
                    currentServices.push({ 
                        ...srvDef, 
                        price: Number(srvDef.price || srvDef.prix || 0) 
                    });
                    addedCount++;
                }
            });
            if (addedCount > 0) {
                this.updateServices(currentServices);
            }
        }

        if (addedCount > 0) {
            this.ui.showToast('success', `Personnel ajouté (+${addedCount} services)`);
        } else {
            this.ui.showToast('success', 'Personnel ajouté');
        }
    }
    this.partenaireSearch.set('');
  }

  removePartenaire(id: string) {
    const currentIds = this.form.get('assignedServerIds')?.value || [];
    const newIds = currentIds.filter((x: string) => x !== id);
    this.form.patchValue({ staffIds: newIds, assignedServerIds: newIds });

    const partner = this.allPartenaires().find((p: any) => p.id === id);
    if (partner && partner.serviceIds && Array.isArray(partner.serviceIds)) {
        let currentServices = [...this.selectedServices()];
        const initialCount = currentServices.length;
        currentServices = currentServices.filter(s => !partner.serviceIds.includes(s.id));
        const removedCount = initialCount - currentServices.length;
        this.updateServices(currentServices);
        
        if (removedCount > 0) {
            this.ui.showToast('info', `-${removedCount} services retirés`);
        }
    }
  }

  toggleService(service: any) {
      let current = [...this.selectedServices()];
      const idx = current.findIndex((s: any) => s.id === service.id);
      if (idx >= 0) current.splice(idx, 1);
      else {
          const price = Number(service.price !== undefined ? service.price : (service.prix || 0));
          current.push({ ...service, price: price });
      }
      this.updateServices(current);
      this.serviceSearch.set('');
  }

  isServiceSelected(service: any): boolean {
      return this.selectedServices().some((s: any) => s.id === service.id);
  }

  removeService(index: number) {
      const current = [...this.selectedServices()];
      current.splice(index, 1);
      this.updateServices(current);
  }

  selectPack(packId: string | null, packData: any = null) {
      if (this.isPastReservation()) return;

      const oldPackId = this.form.get('packId')?.value;
      let currentServices = [...this.selectedServices()];

      if (oldPackId) {
          const oldPack = this.packs().find(p => p.id === oldPackId);
          if (oldPack && oldPack.services && Array.isArray(oldPack.services)) {
              const oldServiceIds = oldPack.services.map((s: any) => s.id);
              currentServices = currentServices.filter(s => !oldServiceIds.includes(s.id));
          }
      }

      this.form.patchValue({ packId });
      
      if (packId) {
          const newPack = this.packs().find(p => p.id === packId);
          if (newPack && newPack.services && Array.isArray(newPack.services)) {
              let addedCount = 0;
              newPack.services.forEach((packService: any) => {
                  const fullServiceDef = this.allServices().find((s: any) => s.id === packService.id) || packService;
                  if (!currentServices.some(c => c.id === fullServiceDef.id)) {
                      currentServices.push({ 
                          ...fullServiceDef, 
                          price: Number(fullServiceDef.price || fullServiceDef.prix || 0) 
                      });
                      addedCount++;
                  }
              });
              
              if (addedCount > 0) {
                  this.ui.showToast('success', `Pack appliqué (+${addedCount} services)`);
              } else {
                  this.ui.showToast('info', 'Pack appliqué (Services déjà inclus)');
              }
              this.updateServices(currentServices);
          } else {
              this.calculateTotal(); 
          }
      } else {
          if (oldPackId) this.ui.showToast('info', 'Pack retiré');
          this.calculateTotal();
          this.updateServices(currentServices); 
      }
  }
  
  getPackTotal(pack: any) { return Number(pack.price || 0); }

  async setActiveTab(tab: any) { 
    if (!this.form.get('clientId')?.value) {
        this.ui.showToast('error', 'Sélectionnez un client d\'abord');
        return;
    }
    this.activeTab.set(tab); 
    if (this.form.valid) await this.onSubmit(); 
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
  
  async onPaymentFinished() { 
      this.closePaymentModal(); 
      if(this.reservationId) {
          await this.loadPayments(this.reservationId);
      }
  }

  onClientSearch(e: any) { this.clientSearch.set(e.target.value); }
  onEditClient(client: any) { if (client) { this.clientToEdit.set(client); this.showClientModal.set(true); } }
  
  selectClient(client: any) { 
    const isEditing = !!this.reservationId || this.isEditMode();
    const currentClientId = this.selectedClientId();
    const isDifferent = currentClientId && currentClientId !== client.id;

    if (isEditing && isDifferent) {
        if (!confirm("Êtes-vous sûr de vouloir changer le client pour cette réservation ?")) {
            return;
        }
    }

    this.form.patchValue({ clientId: client.id }); 
    this.selectedClientId.set(client.id); 
    this.clientSearch.set(''); 
    this.loadClientCredits(client.id); 

    if (isEditing && isDifferent) {
        this.ui.showToast('success', 'Client modifié avec succès');
    }
  }

  async loadPayments(reservationId: string) {
      try {
          this.paymentService.getByReservation(reservationId).subscribe(data => {
              this.payments.set(data);
              const totalPaid = data.reduce((sum, p: any) => sum + (Number(p.amount) || 0), 0);
              this.form.patchValue({ advance: totalPaid }, { emitEvent: false });
              if (this.reservationId) {
                  this.reservationService.update(this.reservationId, { advance: totalPaid });
              }
          });
      } catch(e) { console.error(e); }
  }

  async loadClientCredits(clientId: string) {
    try {
        runInInjectionContext(this.injector, async () => {
            const q = query(collection(this.firestore, 'provisional_receipts'), where('clientId', '==', clientId), where('status', '==', 'AVAILABLE'));
            const snap = await getDocs(q);
            const unique = new Map();
            snap.docs.forEach(d => unique.set(d.id, { id: d.id, ...d.data() }));
            this.availableCredits.set(Array.from(unique.values()));
        });
    } catch(e) { console.error("Credits client error:", e); }
  }
  
  async loadGlobalCredits() {
    try {
        runInInjectionContext(this.injector, async () => {
            const q = query(collection(this.firestore, 'provisional_receipts'), where('status', '==', 'AVAILABLE'));
            const snap = await getDocs(q);
            const unique = new Map();
            snap.docs.forEach(d => unique.set(d.id, { id: d.id, ...d.data() }));
            this.globalCredits.set(Array.from(unique.values()));
        });
    } catch(e) { console.error("Credits global error:", e); }
  }

  async useCredit(credit: any) {
      if (!this.reservationId || this.loading()) return;
      if (!confirm('Utiliser cet avoir ?')) return;
      
      this.loading.set(true);
      try {
          await this.reservationService.applyCredit(this.reservationId, credit);
          this.ui.showToast('success', 'Avoir appliqué');
          this.availableCredits.update(list => list.filter(c => c.id !== credit.id));
          this.globalCredits.update(list => list.filter(c => c.id !== credit.id));
          await this.loadPayments(this.reservationId);
      } catch (e) { this.ui.showToast('error', 'Erreur'); } finally { this.loading.set(false); }
  }

  async deletePayment(p: any) { 
      if(confirm('Supprimer ce paiement ?')) {
          await this.paymentService.delete(p.id);
          await this.loadPayments(this.reservationId!);
          this.ui.showToast('success', 'Supprimé');
      }
  }

  // --- CONTROLES PAGINATION ---
  prevAvailableCreditPage() { if (this.availableCreditPage() > 1) this.availableCreditPage.update(p => p - 1); }
  nextAvailableCreditPage() { if (this.availableCreditPage() < this.totalAvailableCreditPages()) this.availableCreditPage.update(p => p + 1); }

  prevGlobalCreditsPage() { if (this.globalCreditsPage() > 1) this.globalCreditsPage.update(p => p - 1); }
  nextGlobalCreditsPage() { if (this.globalCreditsPage() < this.totalGlobalCreditsPages()) this.globalCreditsPage.update(p => p + 1); }

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
          if (this.isModal) this.close.emit();
          else this.router.navigate(['/reservations']);
      } catch (e) { 
          this.isDeleting.set(false);
          this.form.enable();
          this.ui.showToast("error", "Erreur annulation"); 
          console.error(e); 
      } finally {
          this.loading.set(false);
      }
  }

  async onPrint() { if (this.reservationId) this.contractPdfService.generateContract({ id: this.reservationId, ...this.form.getRawValue() }, this.selectedClient() || {}); }
  onPrintPayments() { if (this.reservationId) this.paymentPdfService.generateReceipt({ id: this.reservationId, ...this.form.getRawValue() }, this.selectedClient() || {}, this.payments()); }
  getClientName(id: string): string { const c = this.rawClients().find((x: any) => x.id === id); return c ? c.nom + ' ' + c.prenom : 'Client'; }
  getDateObject(ts: any): Date { return ts?.toDate ? ts.toDate() : new Date(ts || new Date()); }
}
EOF

# ==============================================================================
# 2. Mise à jour du TEMPLATE HTML (.html)
# ==============================================================================
HTML_FILE="src/app/features/calendar/reservation-form/reservation-form.component.html"
echo "Mise à jour de $HTML_FILE..."

cat << 'EOF' > "$HTML_FILE"
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
          <button type="button" (click)="onPrintPayments()" class="flex items-center gap-2 px-3 py-1.5 bg-emerald-100 text-emerald-700 rounded-lg font-bold hover:bg-emerald-200 transition text-sm">
            <span class="material-icons text-sm">receipt_long</span> Règlements
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

      <button (click)="setActiveTab('partenaire')" 
              [class]="activeTab() === 'partenaire' ? 'bg-orange-500 text-white shadow-md shadow-orange-200' : 'bg-slate-50 text-slate-500 hover:bg-slate-100'"
              class="px-4 py-2 rounded-lg font-bold text-xs uppercase tracking-wide transition flex items-center gap-2 whitespace-nowrap">
        <span class="material-icons text-sm">badge</span> Pers. Salle
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
      </button>
      
      <button (click)="setActiveTab('reglement')" 
              [class]="activeTab() === 'reglement' ? 'bg-emerald-600 text-white shadow-md shadow-emerald-200' : 'bg-slate-50 text-slate-500 hover:bg-slate-100'"
              class="px-4 py-2 rounded-lg font-bold text-xs uppercase tracking-wide transition flex items-center gap-2 whitespace-nowrap">
        <span class="material-icons text-sm">payments</span> Règlements Clients
      </button>

      <button (click)="setActiveTab('partner_finance')" 
              [class]="activeTab() === 'partner_finance' ? 'bg-purple-600 text-white shadow-md shadow-purple-200' : 'bg-slate-50 text-slate-500 hover:bg-slate-100'"
              class="px-4 py-2 rounded-lg font-bold text-xs uppercase tracking-wide transition flex items-center gap-2 whitespace-nowrap">
        <span class="material-icons text-sm">handshake</span> Règlements Partenaires
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
               </div>
            </div>
            @for (pack of (packs$ | async) || []; track pack.id) {
              <div (click)="selectPack(pack.id || null, pack)"
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
                }
              </div>
            }
          </div>
        </div>
      }

      @if (activeTab() === 'info') {
        <div class="tab-content">
          <div class="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div class="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm text-center">
              <div class="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Total Dossier</div>
              <div class="text-2xl font-black text-slate-700">{{ form.value.totalPrice || 0 }} DT</div>
            </div>
            <div class="bg-emerald-50 p-5 rounded-2xl border border-emerald-100 shadow-sm text-center">
              <div class="text-xs font-bold text-emerald-600 uppercase tracking-widest mb-2">Déjà Payé</div>
              <div class="text-2xl font-black text-emerald-700">{{ form.value.advance || 0 }} DT</div>
            </div>
            <div class="bg-slate-800 p-5 rounded-2xl shadow-lg text-center text-white">
              <div class="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Reste à payer</div>
              <div class="font-black text-2xl">{{ (form.value.totalPrice || 0) - (form.value.advance || 0) }} DT</div>
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
                    <label class="block text-xs font-bold text-slate-500 mb-1">Date</label>
                    <input formControlName="date" type="date" readonly class="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-100 text-slate-500 pointer-events-none font-bold shadow-inner cursor-not-allowed">
                  </div>
                  <div>
                    <label class="block text-xs font-bold text-slate-500 mb-1">Créneau</label>
                    <select formControlName="slotId" (change)="onSlotChange($event)" class="w-full px-4 py-3 rounded-xl border border-slate-200 bg-white outline-none">
                      <option value="">Sélectionner un créneau...</option>
                      @for (slot of filteredSlots(); track slot.id) {
                        <option [value]="slot.id">{{ slot.label }}</option>
                      }
                    </select>
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
                         <div class="text-xs text-slate-500">{{ c.telephone }}</div>
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
                <div class="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm h-full flex flex-col">
                  
                  <div class="flex items-center gap-3 border-b pb-4 mb-4">
                    <div class="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold text-xl uppercase">
                      {{ selectedClient()?.nom?.charAt(0) }}
                    </div>
                    <div>
                      <h3 class="font-bold text-lg text-slate-800">{{ selectedClient()?.nom }} {{ selectedClient()?.prenom }}</h3>
                      <button type="button" (click)="onEditClient(selectedClient())" class="text-xs text-blue-600 hover:underline flex items-center gap-1">
                         <span class="material-icons text-[14px]">edit</span> Modifier fiche client
                      </button>
                    </div>
                  </div>
                  
                  <div class="space-y-4 text-sm flex-1">
                     <div class="grid grid-cols-3 gap-2 border-b border-slate-50 pb-2">
                       <span class="text-slate-400 font-medium">Téléphone</span>
                       <span class="col-span-2 text-slate-800 font-bold flex items-center gap-2">
                           <span class="material-icons text-slate-300 text-[16px]">phone</span>
                           {{ selectedClient()?.telephone }}
                           @if(selectedClient()?.telephone2) { <span class="text-slate-300">/</span> {{ selectedClient()?.telephone2 }} }
                       </span>
                     </div>
                     
                     <div class="grid grid-cols-3 gap-2 border-b border-slate-50 pb-2">
                       <span class="text-slate-400 font-medium">Identité</span>
                       <div class="col-span-2">
                         <span class="text-slate-800 font-bold flex items-center gap-2">
                             <span class="material-icons text-slate-300 text-[16px]">badge</span>
                             {{ selectedClient()?.cin || '-' }}
                         </span>
                         @if(selectedClient()?.dateCin) {
                           <div class="text-xs text-slate-500 mt-1 pl-6 flex items-center gap-1">
                             <span class="material-icons text-[10px]">calendar_today</span>
                             Délivrée le {{ selectedClient()?.dateCin | date:'dd/MM/yyyy' }}
                           </div>
                         }
                       </div>
                     </div>

                     <div class="grid grid-cols-3 gap-2 border-b border-slate-50 pb-2">
                       <span class="text-slate-400 font-medium">Email</span>
                       <span class="col-span-2 text-slate-800 font-medium flex items-center gap-2 break-all">
                           <span class="material-icons text-slate-300 text-[16px]">email</span>
                           {{ selectedClient()?.email || '-' }}
                       </span>
                     </div>

                     <div class="grid grid-cols-3 gap-2">
                       <span class="text-slate-400 font-medium">Adresse</span>
                       <span class="col-span-2 text-slate-800 font-medium flex items-center gap-2">
                           <span class="material-icons text-slate-300 text-[16px]">home</span>
                           <span>
                             {{ selectedClient()?.adresse || '' }} 
                             @if(selectedClient()?.adresse && selectedClient()?.ville) { , }
                             {{ selectedClient()?.ville || '' }}
                           </span>
                           @if(!selectedClient()?.adresse && !selectedClient()?.ville) { - }
                       </span>
                     </div>
                  </div>

                  @if (selectedClient()?.notes) {
                    <div class="mt-4 p-3 bg-amber-50 border border-amber-100 rounded-lg text-xs text-amber-800">
                        <span class="font-bold block mb-1 flex items-center gap-1">
                            <span class="material-icons text-[14px]">sticky_note_2</span> Note interne :
                        </span>
                        <p class="italic">{{ selectedClient()?.notes }}</p>
                    </div>
                  }
                </div>
              } @else {
                <div class="bg-slate-50 p-6 rounded-2xl border border-slate-200 border-dashed h-full flex flex-col items-center justify-center text-slate-400">
                    <span class="material-icons text-4xl mb-2">person_search</span>
                    <p class="text-sm font-medium">Veuillez sélectionner un client dans la liste à gauche</p>
                </div>
              }
            </div>
          </div>
          
          <div class="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm mt-6">
            <h3 class="font-bold text-slate-700 mb-3 flex items-center gap-2">
              <span class="material-icons text-slate-400">sticky_note_2</span>
              Notes & Commentaires (Réservation)
            </h3>
            <textarea formControlName="notes" rows="4" placeholder="Instructions spécifiques pour cet événement..." class="w-full p-4 rounded-xl border border-slate-200 bg-slate-50"></textarea>
          </div>
        </div>
      }

      @if (activeTab() === 'reglement') {
        <div class="tab-content max-w-4xl mx-auto space-y-8">
          
          <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div class="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm text-center">
              <div class="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Total Dossier</div>
              <div class="text-2xl font-black text-slate-700">{{ form.value.totalPrice || 0 }} DT</div>
            </div>
            <div class="bg-emerald-50 p-5 rounded-2xl border border-emerald-100 shadow-sm text-center">
              <div class="text-xs font-bold text-emerald-600 uppercase tracking-widest mb-2">Déjà Payé</div>
              <div class="text-2xl font-black text-emerald-700">{{ form.value.advance || 0 }} DT</div>
            </div>
            <div class="bg-slate-800 p-5 rounded-2xl shadow-lg text-center text-white">
              <div class="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Reste à payer</div>
              <div class="font-black text-2xl">{{ (form.value.totalPrice || 0) - (form.value.advance || 0) }} DT</div>
            </div>
          </div>

          @if (availableCredits().length > 0) {
            <div class="bg-purple-50 rounded-2xl border border-purple-100 shadow-sm overflow-hidden">
                <div (click)="toggleClientCredits()" class="p-6 flex justify-between items-center cursor-pointer hover:bg-purple-100 transition select-none">
                    <h4 class="font-black text-purple-800 flex items-center gap-2">
                        <span class="material-icons">card_giftcard</span> Bons & Avoirs Disponibles (Client)
                        <span class="text-xs bg-purple-200 text-purple-800 px-2 py-0.5 rounded-full ml-2">{{ availableCredits().length }}</span>
                    </h4>
                    <span class="material-icons text-purple-600 transition-transform duration-300" [class.rotate-180]="showClientCredits()">expand_more</span>
                </div>

                @if (showClientCredits()) {
                    <div class="p-6 pt-0 border-t border-purple-100">
                        <div class="mb-4 mt-4">
                           <input type="text" [value]="availableCreditSearch()" (input)="availableCreditSearch.set($any($event.target).value)" 
                                  placeholder="Filtrer..." class="w-full px-4 py-2 rounded-lg border border-purple-200 text-sm focus:ring-2 focus:ring-purple-500 outline-none">
                        </div>

                        <div class="space-y-3">
                            @for (credit of paginatedAvailableCredits(); track credit.id) {
                                <div class="bg-white p-4 rounded-xl border border-purple-100 shadow-sm flex items-center justify-between group hover:border-purple-300 transition">
                                    <div class="flex-1">
                                        <div class="flex items-center gap-2 mb-1">
                                            <span class="text-[10px] font-bold bg-purple-100 text-purple-700 px-2 py-0.5 rounded">AVOIR</span>
                                            <span class="font-black text-slate-800">{{ credit.amount }} DT</span>
                                            <span class="text-xs text-slate-400">- {{ getDateObject(credit.createdAt) | date:'dd/MM/yyyy' }}</span>
                                        </div>
                                        <div class="text-xs text-slate-500 italic">{{ credit.description }}</div>
                                    </div>
                                    <button type="button" (click)="useCredit(credit)" class="px-3 py-1.5 bg-purple-600 text-white rounded-lg font-bold text-xs hover:bg-purple-700 transition">
                                        Utiliser
                                    </button>
                                </div>
                            }
                        </div>

                        @if (totalAvailableCreditPages() > 1) {
                          <div class="flex justify-center items-center gap-4 mt-4">
                            <button type="button" (click)="prevAvailableCreditPage()" [disabled]="availableCreditPage() === 1" class="p-1 rounded-full hover:bg-purple-200 disabled:opacity-30">
                               <span class="material-icons text-purple-700">chevron_left</span>
                            </button>
                            <span class="text-xs font-bold text-purple-800">{{ availableCreditPage() }} / {{ totalAvailableCreditPages() }}</span>
                            <button type="button" (click)="nextAvailableCreditPage()" [disabled]="availableCreditPage() === totalAvailableCreditPages()" class="p-1 rounded-full hover:bg-purple-200 disabled:opacity-30">
                               <span class="material-icons text-purple-700">chevron_right</span>
                            </button>
                          </div>
                        }
                    </div>
                }
            </div>
          }

          <div class="bg-indigo-50 rounded-2xl border border-indigo-100 shadow-sm overflow-hidden">
            <div (click)="toggleGlobalCredits()" class="p-6 flex justify-between items-center cursor-pointer hover:bg-indigo-100 transition select-none">
                <h4 class="font-black text-indigo-800 flex items-center gap-2">
                    <span class="material-icons">all_inclusive</span> Bons & Avoirs (Tous Clients)
                </h4>
                <span class="material-icons text-indigo-600 transition-transform duration-300" [class.rotate-180]="showGlobalCredits()">expand_more</span>
            </div>

            @if (showGlobalCredits()) {
                <div class="p-6 pt-0 border-t border-indigo-100">
                    <div class="mb-4 mt-4">
                       <input type="text" [value]="globalCreditSearch()" (input)="globalCreditSearch.set($any($event.target).value)" 
                              placeholder="Rechercher client, montant..." class="w-full px-4 py-2 rounded-lg border border-indigo-200 text-sm focus:ring-2 focus:ring-indigo-500 outline-none">
                    </div>

                    <div class="space-y-3">
                        @for (gCredit of paginatedGlobalCredits(); track gCredit.id) {
                            <div class="bg-white p-4 rounded-xl border border-indigo-100 shadow-sm flex items-center justify-between group hover:border-indigo-400 transition">
                                <div class="flex-1">
                                    <div class="flex items-center gap-2 mb-1">
                                        <span class="text-[10px] font-black bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded uppercase">Global</span>
                                        <span class="font-black text-slate-800">{{ gCredit.amount }} DT</span>
                                        <span class="text-xs text-slate-400">- {{ getDateObject(gCredit.createdAt) | date:'dd/MM/yyyy' }}</span>
                                    </div>
                                    <div class="flex items-center gap-2 mb-1">
                                        <span class="material-icons text-slate-300 text-[14px]">person</span>
                                        <span class="text-xs font-bold text-slate-600">{{ getClientName(gCredit.clientId) }}</span>
                                    </div>
                                </div>
                                <button type="button" (click)="useCredit(gCredit)" class="px-3 py-1.5 bg-indigo-600 text-white rounded-lg font-bold text-xs hover:bg-indigo-700 transition">
                                    Utiliser
                                </button>
                            </div>
                        }
                        @if (paginatedGlobalCredits().length === 0) {
                             <div class="text-center py-4 text-indigo-400 text-sm italic">Aucun résultat.</div>
                        }
                    </div>

                    @if (totalGlobalCreditsPages() > 1) {
                      <div class="flex justify-center items-center gap-4 mt-4">
                        <button type="button" (click)="prevGlobalCreditsPage()" [disabled]="globalCreditsPage() === 1" class="p-1 rounded-full hover:bg-indigo-200 disabled:opacity-30">
                           <span class="material-icons text-indigo-700">chevron_left</span>
                        </button>
                        <span class="text-xs font-bold text-indigo-800">{{ globalCreditsPage() }} / {{ totalGlobalCreditsPages() }}</span>
                        <button type="button" (click)="nextGlobalCreditsPage()" [disabled]="globalCreditsPage() === totalGlobalCreditsPages()" class="p-1 rounded-full hover:bg-indigo-200 disabled:opacity-30">
                           <span class="material-icons text-indigo-700">chevron_right</span>
                        </button>
                      </div>
                    }
                </div>
            }
          </div>
          
          <div class="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div class="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h3 class="font-bold text-slate-700 flex items-center gap-2">
                <span class="material-icons text-emerald-500">receipt_long</span>
                Historique des Règlements
              </h3>
              @if (reservationId) {
                <button type="button" (click)="openPaymentModal()" class="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg font-bold shadow hover:bg-emerald-700 transition text-sm">
                  <span class="material-icons text-sm">add</span> Ajouter
                </button>
              }
            </div>
            <div class="overflow-x-auto">
              <table class="w-full text-sm text-left">
                <thead class="bg-slate-50 text-slate-500 font-bold text-xs uppercase">
                  <tr>
                    <th class="px-6 py-3">Date Paiement</th>
                    <th class="px-6 py-3">Date Résa</th>
                    <th class="px-6 py-3">Mode</th>
                    <th class="px-6 py-3 text-right">Montant</th>
                    <th class="px-6 py-3 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-slate-100">
                  @for (pay of payments(); track pay.id) {
                    <tr class="hover:bg-slate-50 transition">
                      <td class="px-6 py-3 font-medium text-slate-700">{{ getDateObject(pay.date) | date:'dd/MM/yyyy' }}</td>
                      <td class="px-6 py-3 text-slate-500">{{ getDateObject(form.value.date) | date:'dd/MM/yyyy' }}</td>
                      <td class="px-6 py-3"><span class="font-bold">{{ pay.type }}</span></td>
                      <td class="px-6 py-3 text-right font-bold text-emerald-600">+{{ pay.amount }} DT</td>
                      <td class="px-6 py-3 text-center">
                        <button type="button" (click)="deletePayment(pay)" class="text-slate-400 hover:text-red-600">
                          <span class="material-icons text-sm">delete</span>
                        </button>
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          </div>
        </div>
      }

      @if (activeTab() === 'partenaire') {
        <div class="tab-content max-w-4xl mx-auto">
          <div class="flex justify-between items-center mb-6">
            <h3 class="text-lg font-black text-slate-700 flex items-center gap-2">
              <span class="material-icons text-orange-500">badge</span> Personnel
            </h3>
            <div class="flex items-center gap-3">
              <button type="button" (click)="openPartenaireModal()" class="text-xs font-bold text-orange-600 bg-orange-50 px-3 py-1.5 rounded-lg hover:bg-orange-100 transition whitespace-nowrap">
                + Nouveau
              </button>
              <input type="text" (input)="partenaireSearch.set($any($event.target).value)" placeholder="Filtrer..." class="w-48 px-3 py-1.5 rounded-lg border border-slate-200 text-sm">
            </div>
          </div>
          <div class="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3">
            @for (partenaire of filteredPartenaire(); track partenaire.id) {
              <div (click)="togglePartenaire(partenaire.id!)" 
                   class="p-3 rounded-xl cursor-pointer border transition-all hover:bg-orange-50 text-center relative bg-white"
                   [class.border-orange-500]="isPartenaireSelected(partenaire.id!)" 
                   [class.bg-orange-50]="isPartenaireSelected(partenaire.id!)">
                <div class="font-bold text-sm text-slate-800 truncate">{{ partenaire.nom }}</div>
                <div class="text-[10px] text-slate-500 truncate">{{ partenaire.role || 'Partenaire' }}</div>
                @if (isPartenaireSelected(partenaire.id!)) {
                  <span class="material-icons text-orange-500 text-sm absolute top-1 right-1">check_circle</span>
                }
              </div>
            }
          </div>
        </div>
      }

      @if (activeTab() === 'services') {
        <div class="tab-content">
          @if (selectedServices().length > 0) {
            <div class="bg-white p-5 rounded-xl border border-slate-200 shadow-sm mb-6">
              <div class="flex justify-between items-center mb-4 pb-3 border-b border-slate-100">
                <h4 class="font-bold text-slate-700 flex items-center gap-2">
                  <span class="material-icons text-emerald-500">check_circle</span> Inclus ({{ selectedServices().length }})
                </h4>
                <div class="text-sm font-bold text-slate-500">Total: <span class="text-emerald-600">{{ getServicesTotal() | number:'1.0-2' }} DT</span></div>
              </div>
              <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                @for (service of selectedServices(); track $index; let i = $index) {
                  <div class="flex items-center gap-3 p-2 bg-slate-50 rounded-lg border border-slate-200">
                    <div class="flex-1 min-w-0">
                      <div class="font-bold text-slate-700 text-sm whitespace-normal break-words" title="{{ service.name || service.nom }}">
                        {{ service.description || service.name || service.nom }}
                      </div>
                      <div class="text-xs text-slate-400">{{ service.price | number:'1.0-2' }} DT</div>
                    </div>
                    <button type="button" (click)="removeService(i)" class="text-red-400 hover:text-red-600"><span class="material-icons">close</span></button>
                  </div>
                }
              </div>
            </div>
          }
          <div class="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
            <div class="flex justify-between items-center mb-6">
                <h3 class="font-bold text-slate-700">Catalogue</h3>
                <input type="text" (input)="serviceSearch.set($any($event.target).value)" placeholder="Rechercher..." class="w-64 px-3 py-1.5 rounded-lg border border-slate-200 text-sm">
            </div>
            <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
              @for (service of filteredServices(); track service.id) {
                <div (click)="toggleService(service)"
                     class="cursor-pointer border rounded-xl p-4 transition-all relative group hover:shadow-md bg-white h-auto"
                     [ngClass]="isServiceSelected(service) ? 'border-indigo-500 bg-indigo-50' : 'border-slate-200'">
                  <div class="font-bold text-sm text-slate-800 whitespace-normal break-words" title="{{ service.name || service.nom }}">
                    {{ service.description || service.name || service.nom }}
                  </div>
                  <div class="text-xs font-bold text-slate-600 mt-2">{{ service.price || service.prix }} DT</div>
                  @if(isServiceSelected(service)) {
                    <span class="material-icons text-indigo-600 text-lg absolute top-2 right-2">check_circle</span>
                  }
                </div>
              }
            </div>
          </div>
        </div>
      }

      @if (activeTab() === 'partner_finance') {
        <div class="tab-content max-w-4xl mx-auto space-y-6">
            
            <div class="flex justify-between items-center mb-4 border-l-4 border-purple-500 pl-4">
                <h3 class="text-xl font-black text-slate-700">Suivi des Règlements Partenaires</h3>
                <button (click)="printGlobalPartnerReport()" class="text-xs bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 px-4 py-2 rounded-lg shadow-sm flex items-center gap-2 transition font-bold">
                    <span class="material-icons text-sm">print</span> Imprimer Bilan Global
                </button>
            </div>
    
            @if (groupedPartners().length === 0) {
                <div class="text-center py-12 text-slate-400 italic bg-white rounded-2xl border-2 border-dashed border-slate-200">
                    <span class="material-icons text-4xl mb-2 text-slate-300">people_outline</span>
                    <p class="text-lg font-medium">Aucun partenaire détecté.</p>
                    <p class="text-sm">Assurez-vous d'avoir assigné du personnel (Onglet "Pers. Salle") avec des services associés.</p>
                </div>
            }
    
            @for (p of groupedPartners(); track p.partnerId) {
                <div class="border border-slate-200 rounded-2xl overflow-hidden shadow-sm mb-6 bg-white">
                    <div class="bg-slate-50 px-6 py-4 border-b border-slate-100 flex justify-between items-start">
                        <div>
                            <span class="block font-black text-slate-800 text-lg">{{ p.partnerName }}</span>
                            <div class="flex flex-wrap gap-1 mt-2">
                                @for (srv of p.services; track $index) {
                                    <span class="text-[10px] font-bold uppercase bg-white border border-slate-200 text-slate-500 px-2 py-0.5 rounded">{{ srv }}</span>
                                }
                            </div>
                        </div>
                        <div class="text-right">
                            <span class="block text-xs text-slate-400 font-bold uppercase tracking-wider">Total Dû</span>
                            <span class="block font-black text-slate-800 text-xl">{{ p.totalCost }} DT</span>
                        </div>
                    </div>
    
                    <div class="p-6">
                        <div class="flex items-center gap-6 text-sm mb-6 p-4 bg-slate-50 rounded-xl border border-slate-100">
                            <div class="text-emerald-700 font-bold flex items-center gap-2">
                                <span class="material-icons text-emerald-500">check_circle</span> 
                                Déjà payé: <span class="text-lg">{{ p.totalPaid }} DT</span>
                            </div>
                            <div class="font-black flex items-center gap-2" [ngClass]="{'text-red-600': p.remaining > 0, 'text-emerald-600': p.remaining <= 0}">
                                <span class="material-icons">account_balance_wallet</span> 
                                Reste à payer: <span class="text-lg">{{ p.remaining }} DT</span>
                            </div>
                        </div>
    
                        <form [formGroup]="partnerPaymentForm" (ngSubmit)="addPartnerPayment()" 
                              class="bg-purple-50 p-5 rounded-xl mb-6 border border-purple-100">
                            
                            <p class="text-xs font-black text-purple-800 mb-3 uppercase tracking-wider flex items-center gap-2">
                                <span class="material-icons text-sm">add_card</span> Nouveau Règlement
                            </p>
                            
                            <div class="flex flex-col gap-3">
                                <div class="flex gap-3" (click)="partnerPaymentForm.patchValue({partnerId: p.partnerId})">
                                    <div class="w-1/3">
                                        <input type="number" formControlName="amount" placeholder="Montant" 
                                               class="w-full text-sm font-bold border-slate-200 rounded-lg p-2.5 focus:ring-2 focus:ring-purple-500 border outline-none">
                                    </div>
                                    <div class="flex-1">
                                        <select formControlName="method" class="w-full text-sm font-medium border-slate-200 rounded-lg p-2.5 focus:ring-2 focus:ring-purple-500 border outline-none bg-white">
                                            <option value="ESPECES">Espèces</option>
                                            <option value="CHEQUE">Chèque</option>
                                            <option value="VIREMENT">Virement</option>
                                        </select>
                                    </div>
                                </div>
                                <div class="flex gap-3">
                                     <input type="text" formControlName="reference" placeholder="Référence (N° Chèque/Virement)" 
                                            class="flex-1 text-sm border-slate-200 rounded-lg p-2.5 focus:ring-2 focus:ring-purple-500 border outline-none">
                                     
                                     <button type="submit" 
                                        [disabled]="partnerPaymentForm.invalid || partnerPaymentForm.value.partnerId !== p.partnerId"
                                        class="bg-purple-600 hover:bg-purple-700 text-white text-sm font-black px-6 py-2 rounded-lg shadow-md transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2">
                                        PAYER
                                     </button>
                                </div>
                            </div>
                        </form>
    
                        @if (partnerPayments().length > 0) {
                            <div class="mt-4 border-t border-slate-100 pt-4">
                                <p class="text-xs font-bold text-slate-400 uppercase mb-3">Historique des transactions</p>
                                <div class="space-y-2">
                                    @for (pay of partnerPayments(); track $index) {
                                        @if (pay.partnerId === p.partnerId) {
                                            <div class="flex justify-between items-center text-xs py-2 px-3 bg-slate-50 rounded-lg border border-slate-100 hover:border-purple-200 transition group">
                                                <span class="text-slate-600 flex items-center gap-3">
                                                    <span class="font-medium">{{ getDateObject(pay.date) | date:'dd/MM HH:mm' }}</span>
                                                    <span class="px-2 py-0.5 bg-white border border-slate-200 rounded text-slate-500 text-[10px] uppercase font-bold tracking-wide">{{ pay.method }}</span>
                                                </span>
                                                <div class="flex items-center gap-4">
                                                    <span class="font-black text-slate-800 text-sm">{{ pay.amount }} DT</span>
                                                    <button (click)="printPartnerReceipt(pay)" class="text-slate-400 hover:text-purple-600 p-1 rounded transition" title="Imprimer le reçu">
                                                        <span class="material-icons text-sm">print</span>
                                                    </button>
                                                </div>
                                            </div>
                                        }
                                    }
                                </div>
                            </div>
                        }
                    </div>
                </div>
            }
        </div>
      }

    </div>

    <div class="p-6 bg-white border-t border-slate-100 flex justify-end gap-3 z-10">
      <button type="button" (click)="onClose()" class="px-6 py-3 text-slate-500 font-bold hover:bg-slate-50 rounded-xl transition">Annuler</button>
      <button type="submit" [disabled]="form.invalid" class="px-8 py-3 bg-slate-900 text-white rounded-xl font-black shadow-xl hover:scale-[1.02] transition disabled:opacity-50">
        {{ isEditMode() ? 'Mettre à jour' : 'Enregistrer' }}
      </button>
    </div>

  </form>
</div>

@if (showClientModal()) {
  <div class="fixed inset-0 z-50 flex items-center justify-center p-4">
    <div class="absolute inset-0 bg-black/40 backdrop-blur-sm" (click)="closeClientModal()"></div>
    <div class="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl border border-slate-200 max-h-[90vh] flex flex-col overflow-hidden">
      <div class="flex items-center justify-between px-6 py-4 border-b border-slate-100">
        <h3 class="font-black text-slate-800 text-lg">Nouveau client</h3>
        <button type="button" (click)="closeClientModal()" class="text-slate-400 hover:text-slate-600"><span class="material-icons">close</span></button>
      </div>
      <div class="p-6 overflow-y-auto flex-1">
        <app-client-form [clientId]="clientToEdit()?.id" [isModal]="true" (finish)="onClientModalFinish($event)"></app-client-form>
      </div>
    </div>
  </div>
}

@if (showPartenaireModal()) {
  <div class="fixed inset-0 z-50 flex items-center justify-center p-4">
    <div class="absolute inset-0 bg-black/40 backdrop-blur-sm" (click)="closePartenaireModal()"></div>
    <div class="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl border border-slate-200 max-h-[90vh] flex flex-col overflow-hidden">
      <div class="flex items-center justify-between px-6 py-4 border-b border-slate-100">
        <h3 class="font-black text-slate-800 text-lg">Nouveau Partenaire</h3>
        <button type="button" (click)="closePartenaireModal()" class="text-slate-400 hover:text-slate-600"><span class="material-icons">close</span></button>
      </div>
      <div class="p-6 overflow-y-auto flex-1">
        <app-partenaire-form [isModal]="true" (finish)="onPartenaireModalFinish($event)"></app-partenaire-form>
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

<app-admin-confirm-dialog *ngIf="showAdminAuth()" (confirmed)="onAdminAuthSuccess()" (cancelled)="showAdminAuth.set(false)"></app-admin-confirm-dialog>
EOF

echo -e "${GREEN}Fichiers mis à jour avec succès.${NC}"