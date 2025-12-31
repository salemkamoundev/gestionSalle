import { PaymentPdfService } from "../../../core/services/payment-pdf.service";
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
// SUPPRIMÉ : TeamService
import { PackService } from '../../../core/services/pack.service'; // AJOUTÉ
import { PartenaireService } from '../../../core/services/partenaire.service';
import { ServiceService } from '../../../core/services/service.service';
import { UiService } from '../../../core/services/ui.service';
import { AuthService } from '../../../core/services/auth.service';
import { ConfigService } from '../../../core/services/config.service';

import { ClientFormComponent } from '../../clients/client-form/client-form.component';
// SUPPRIMÉ : TeamFormComponent
import { PartenaireFormComponent } from '../../partenaire/partenaire-form/partenaire-form.component';
import { PaymentModalComponent } from './components/payment-modal/payment-modal.component';

@Component({
  selector: 'app-reservation-form',
  standalone: true,
  imports: [
    CommonModule, 
    ReactiveFormsModule, 
    ClientFormComponent, 
    // SUPPRIMÉ : TeamFormComponent
    PartenaireFormComponent, 
    PaymentModalComponent, AdminConfirmDialogComponent
  ],
  templateUrl: './reservation-form.component.html',
  styles: [`
    .tab-content { animation: fadeIn 0.3s ease-in-out; } 
    @keyframes fadeIn { from { opacity: 0; transform: translateY(5px); } to { opacity: 1; transform: translateY(0); } }
  `]
})
export class ReservationFormComponent implements OnInit {
  private paymentPdfService = inject(PaymentPdfService);
  private contractPdfService = inject(ContractPdfService);
  private fb = inject(FormBuilder);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private location = inject(Location);
  private firestore = inject(Firestore);
  
  private reservationService = inject(ReservationService);
  private clientService = inject(ClientService);
  private packService = inject(PackService); // REMPLACE TeamService
  private partenaireService = inject(PartenaireService);
  private serviceService = inject(ServiceService);
  private ui = inject(UiService);
  private authService = inject(AuthService);
  private configService = inject(ConfigService);

  isEditMode = signal(false);
  showAdminAuth = signal(false);
  loading = signal(false);
  activeTab = signal('pack');
  
  showClientModal = signal(false);
  // SUPPRIMÉ : showTeamModal
  showPartenaireModal = signal(false);
  showPaymentModal = signal(false);
  
  isPastReservation = signal(false);

  clientSearch = signal('');
  // SUPPRIMÉ : teamSearch
  partenaireSearch = signal('');
  serviceSearch = signal(''); 
  
  manualClientOverride = signal<any>(null);
  currentClientId = signal<string | null>(null);
  clientToEdit = signal<any>(null);

  availableCredits = signal<any[]>([]);
  
  globalCredits = signal<any[]>([]);
  
  // --- PAGINATION CREDITS ---
  globalCreditsPage = signal(1);
  readonly ITEMS_PER_PAGE = 6;
  
  totalGlobalCreditsPages = computed(() => Math.ceil(this.globalCredits().length / this.ITEMS_PER_PAGE));
  
  paginatedGlobalCredits = computed(() => {
    const all = this.globalCredits();
    const page = this.globalCreditsPage();
    const start = (page - 1) * this.ITEMS_PER_PAGE;
    return all.slice(start, start + this.ITEMS_PER_PAGE);
  });

  nextGlobalCreditsPage() {
    if (this.globalCreditsPage() < this.totalGlobalCreditsPages()) {
      this.globalCreditsPage.update(p => p + 1);
    }
  }

  prevGlobalCreditsPage() {
    if (this.globalCreditsPage() > 1) {
      this.globalCreditsPage.update(p => p - 1);
    }
  }
  // --------------------------

  packs = signal<any[]>([]);
  packs$ = this.packService.getAll(); // CORRIGÉ

  private rawClients = toSignal(this.clientService.getAll(), { initialValue: [] });
  // SUPPRIMÉ : rawTeams
  private rawPartenaire = toSignal(this.partenaireService.getAll(), { initialValue: [] });
  
  servicesList = toSignal(this.serviceService.getAll(), { initialValue: [] });

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
    
    // 1. Filtre par date
    let validSlots = slots.filter(s => date >= s.validFrom && date <= s.validTo);

    // 2. Filtre par restriction (règle calendrier)
    const restriction = this.restrictedSlotType();
    
    if (restriction === 'matin') {
      return validSlots.filter(s => s.id === 'matin');
    } else if (restriction === 'soir') {
      return validSlots.filter(s => s.id === 'soir');
    } else if (restriction === 'aprem') {
      // Montre toutes les options d'après-midi (aprem1, aprem2, etc.)
      return validSlots.filter(s => s.id.startsWith('aprem'));
    }

    return validSlots;
  });

  payments = signal<any[]>([]);
  form: FormGroup;
  reservationId: string | null = null;
  selectedServices = signal<any[]>([]);
  pendingParams = signal<{date: string, slot: string} | null>(null);
  restrictedSlotType = signal<string | null>(null);

  constructor() {
    this.form = this.fb.group({
      date: ['', Validators.required],
      slotId: ['', Validators.required],
      selectedSlotId: [''],
      startTime: ['08:00'],
      endTime: ['12:00'],
      clientId: ['', Validators.required],
      packId: [null],
      // On garde assignedTeamIds dans le form mais vide, pour éviter erreurs si binding existe encore caché
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
        
        // On normalise le slot demandé (ex: 'aprem' ou 'matin')
        const reqSlot = (params.slot || '').toLowerCase();
        
        // RESET : On active le champ par défaut
        this.form.get('slotId')?.enable();
        this.restrictedSlotType.set(null);
        
        let targetId = '';

        if (reqSlot.includes('matin')) {
            // CAS MATIN -> Forcé & Verrouillé
            this.restrictedSlotType.set('matin');
            targetId = 'matin';
            this.form.get('slotId')?.disable(); // <--- VERROUILLAGE
        
        } else if (reqSlot.includes('soir')) {
            // CAS SOIR -> Forcé & Verrouillé
            this.restrictedSlotType.set('soir');
            targetId = 'soir';
            this.form.get('slotId')?.disable(); // <--- VERROUILLAGE
        
        } else if (reqSlot.includes('aprem')) {
            // CAS APREM -> Filtré mais Modifiable (Choix entre 1 et 2)
            this.restrictedSlotType.set('aprem');
            
            // On essaie de pré-selectionner aprem1 par défaut, mais l'user peut changer
            // Le champ reste ENABLED (actif)
            targetId = 'aprem1'; 
        } else {
            // Cas direct (ID précis)
            targetId = reqSlot;
        }

        // Application des valeurs
        // Note: patchValue fonctionne même sur un champ disabled
        this.form.patchValue({ 
            date: params.date, 
            slotId: targetId, 
            selectedSlotId: targetId 
        });
        
        // Mise à jour des horaires
        this.applySlotTimes(targetId);

        // Recalcul du prix
        setTimeout(() => this.calculateTotal(), 200);
        
        this.pendingParams.set(null);
        setTimeout(() => this.calculateTotal(), 200);
      }
    }, { allowSignalWrites: true });
  }

  async ngOnInit() {
    // CORRIGÉ : Utilisation de PackService
    this.packService.getAll().subscribe(data => {
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
      await this.loadReservation(this.reservationId); this.loadGlobalCredits();
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

  // CORRIGÉ : Typage pour accepter null/undefined
  selectPack(packId: string | null | undefined, packData: any = null) {
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

  // SUPPRIMÉ : filteredTeams
  
  filteredPartenaire = computed(() => { const term = this.partenaireSearch().toLowerCase(); return this.rawPartenaire().filter(s => !term || (s.nom && s.nom.toLowerCase().includes(term))); });

  
  onEditClient(client: any) {
    if (this.isPastReservation()) return;
    this.clientToEdit.set(client);
    this.showClientModal.set(true);
  }

  openClientModal() { if (this.isPastReservation()) return; this.showClientModal.set(true); }
  closeClientModal() { this.clientToEdit.set(null); this.showClientModal.set(false); }
  
  // SUPPRIMÉ : openTeamModal, closeTeamModal

  openPartenaireModal() { if (this.isPastReservation()) return; this.showPartenaireModal.set(true); }
  closePartenaireModal() { this.showPartenaireModal.set(false); }

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

  // SUPPRIMÉ : onTeamModalFinish

  onPartenaireModalFinish(res: any) {
    this.closePartenaireModal();
    if (res && res.id) this.togglePartenaire(res.id);
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
  // SUPPRIMÉ : toggleTeam, isTeamSelected
  
  // --- GESTION INTELLIGENTE : PERSONNEL & SERVICES ---
  
  togglePartenaire(id: string) {
    const currentIds = this.form.get('assignedServerIds')?.value || [];
    if (currentIds.includes(id)) {
        this.removePartenaireWithServices(id);
    } else {
        this.addPartenaireWithServices(id);
    }
  }

  // AJOUT AVEC SERVICES AUTO
  addPartenaireWithServices(id: string) {
      // 1. Ajouter l'ID au formulaire
      const currentIds = this.form.get('assignedServerIds')?.value || [];
      this.form.patchValue({ assignedServerIds: [...currentIds, id] });

      // 2. Trouver le partenaire et ses services
      const partner = this.rawPartenaire().find((p: any) => p.id === id);
      
      if (partner && partner.serviceIds && Array.isArray(partner.serviceIds)) {
          const allCatalog = this.servicesList();
          const currentServices = this.selectedServices(); // On utilise le Signal existant
          const newServices = [...currentServices];
          let addedCount = 0;

          partner.serviceIds.forEach((srvId: string) => {
              // Vérifier si le service n'est pas déjà présent
              const exists = newServices.some(s => s.id === srvId);
              if (!exists) {
                  const srvDef = allCatalog.find((s: any) => s.id === srvId);
                  if (srvDef) {
                      newServices.push(srvDef);
                      addedCount++;
                  }
              }
          });

          // 3. Mise à jour si changements
          if (addedCount > 0) {
              this.selectedServices.set(newServices);
              this.form.patchValue({ services: newServices });
              this.calculateTotal(); // Recalcul du prix
              
              // Toast demandé
              this.ui.showToast('success', `${addedCount} services ont été ajoutés à la réservation`);
          }
      }
  }

  // RETRAIT INTELLIGENT
  removePartenaireWithServices(id: string) {
      // 1. Retirer l'ID
      const currentIds = this.form.get('assignedServerIds')?.value || [];
      const newIds = currentIds.filter((x: string) => x !== id);
      this.form.patchValue({ assignedServerIds: newIds });

      // 2. Vérifier les services à retirer
      const partner = this.rawPartenaire().find((p: any) => p.id === id);
      
      if (partner && partner.serviceIds && Array.isArray(partner.serviceIds)) {
          const currentServices = this.selectedServices();
          
          // Identifier les services requis par les AUTRES personnels restants
          const servicesNeededByOthers = new Set<string>();
          newIds.forEach((otherId: string) => {
              const other = this.rawPartenaire().find((p: any) => p.id === otherId);
              if (other && other.serviceIds) {
                  other.serviceIds.forEach((sid: string) => servicesNeededByOthers.add(sid));
              }
          });

          // On garde le service SI :
          // - Il n'était pas lié au personnel supprimé
          // - OU s'il est lié, MAIS qu'un autre personnel en a encore besoin
          const servicesToKeep = currentServices.filter(srv => {
              const isLinkedToRemoved = (partner.serviceIds || []).includes(srv.id);
              const isNeededByOthers = servicesNeededByOthers.has(srv.id);
              return !isLinkedToRemoved || isNeededByOthers;
          });

          const removedCount = currentServices.length - servicesToKeep.length;

          // 3. Mise à jour si changements
          if (removedCount > 0) {
              this.selectedServices.set(servicesToKeep);
              this.form.patchValue({ services: servicesToKeep });
              this.calculateTotal(); // Recalcul du prix

              // Toast demandé
              this.ui.showToast('info', `${removedCount} services ont été retirés de la réservation`);
          }
      }
  }
  
  isPartenaireSelected(id: string): boolean { return (this.form.get('assignedServerIds')?.value || []).includes(id); }

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

  
  getClientName(id: string): string {
    const client = this.rawClients().find(c => c.id === id);
    return client ? (client.nom + ' ' + client.prenom) : 'Inconnu';
  }

  async loadGlobalCredits() {
    try {
        // On récupère tous les avoirs disponibles, peu importe le client
        const q = query(collection(this.firestore, 'provisional_receipts'), where('status', '==', 'AVAILABLE'));
        const snap = await getDocs(q);
        // On exclut éventuellement ceux du client courant si on veut éviter les doublons avec la liste du dessus,
        // mais l'utilisateur a demandé "de tous les clients", donc on affiche tout ou on filtre.
        // Ici on prend tout pour être exhaustif comme demandé.
        const all = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        this.globalCredits.set(all);
    } catch (e) { console.error('Erreur loading global credits', e); }
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
          await this.loadClientCredits(this.form.get('clientId')?.value); await this.loadGlobalCredits();
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
                      description: `Avoir annulation ${reservationDate}`,
                      status: 'AVAILABLE'
                  });
              }
              transaction.delete(doc(this.firestore, 'payments', p.id));
          }
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
  
  
  onPrintPayments() {
    if (!this.reservationId) return;
    
    const client = this.selectedClient() || { nom: 'Client Inconnu' };
    const reservation = {
       date: this.form.get('date')?.value,
       slotId: this.form.get('slotId')?.value,
       totalPrice: this.form.get('totalPrice')?.value
    };
    // On passe la liste des paiements (signal)
    const paymentsList = this.payments();

    this.paymentPdfService.generateReceipt(reservation, client, paymentsList);
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