import { Component, inject, OnInit, signal, computed } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators, FormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { firstValueFrom } from 'rxjs';

// Services
import { ReservationService } from '../../../core/services/reservation.service';
import { ClientService } from '../../../core/services/client.service';
import { TeamService } from '../../../core/services/team.service';
import { ServiceService } from '../../../core/services/service.service';
import { UiService } from '../../../core/services/ui.service';

// Components
import { ClientFormComponent } from '../../clients/client-form/client-form.component';

import { StaffService } from 'src/app/core/services/staff.service';

@Component({
  selector: 'app-reservation-form',
  standalone: true,
  imports: [FormsModule, CommonModule, ReactiveFormsModule, ClientFormComponent], // Ajout de ClientFormComponent
  templateUrl: './reservation-form.component.html'
})
export class ReservationFormComponent implements OnInit {

  // STAFF_SELECT_PATCH_TS_BEGIN
  private _initStaffSelection(): void {
    try {
      const res = (this.staffService as any).getAll?.();
      if (res && typeof (res as any).subscribe === 'function') {
        (res as any).subscribe((list: any[]) => {
          this.staffList = Array.isArray(list) ? list : [];
          this._syncSelectedFromReservation();
        });
      } else if (res && typeof (res as any).then === 'function') {
        (res as any).then((list: any[]) => {
          this.staffList = Array.isArray(list) ? list : [];
          this._syncSelectedFromReservation();
        });
      }
    } catch (_e) {
      this.staffList = [];
    }
  }
  private staffService = inject(StaffService);

  staffSearch: string = '';
  staffList: any[] = [];
  selectedStaffIds: string[] = [];
    // Si ton composant avait déjà un ngOnInit existant, le patch ci-dessus
    // peut être dupliqué — on évite ça en insérant UNIQUEMENT si absent.
  }

  private _syncSelectedFromReservation(): void {
    // Récupérer une valeur existante du modèle / form si disponible
    const anyThis: any = this as any;
    const r = anyThis?.reservation || anyThis?.data?.reservation || anyThis?.form?.value || null;

    // Essaye plusieurs clés possibles
    const ids =
      (r?.staffIds) ||
      (r?.serveursIds) ||
      (r?.employeesIds) ||
      (r?.assignedStaffIds) ||
      [];

    if (Array.isArray(ids)) {
      this.selectedStaffIds = ids.filter(Boolean);
    }
  }

  onStaffSearchChange(): void {
    // Rien, juste pour reset pagination si tu en as (resté volontairement neutre)
  }

  trackStaffById = (_: number, s: any) => s?.id || s?._id || s?.uid || s?.email || _;

  filteredStaffList(): any[] {
    const q = (this.staffSearch || '').toLowerCase().trim();
    const list = Array.isArray(this.staffList) ? this.staffList : [];
    if (!q) return list;

    return list.filter((s: any) => {
      const nom = String(s?.nom ?? s?.name ?? '').toLowerCase();
      const email = String(s?.email ?? '').toLowerCase();
      const tel = String(s?.telephone ?? s?.phone ?? '').toLowerCase();
      return nom.includes(q) || email.includes(q) || tel.includes(q);
    });
  }

  isStaffSelected(s: any): boolean {
    const id = s?.id || s?._id || s?.uid;
    if (!id) return false;
    return this.selectedStaffIds.includes(String(id));
  }

  toggleStaff(s: any): void {
    const id = s?.id || s?._id || s?.uid;
    if (!id) return;

    const sid = String(id);
    const i = this.selectedStaffIds.indexOf(sid);
    if (i >= 0) this.selectedStaffIds.splice(i, 1);
    else this.selectedStaffIds.push(sid);

    // Synchroniser vers l’objet reservation / form si présent
    const anyThis: any = this as any;
    if (anyThis?.reservation) {
      anyThis.reservation.staffIds = [...this.selectedStaffIds];
    }
    if (anyThis?.form?.patchValue) {
      // patchValue si ReactiveForm
      try { anyThis.form.patchValue({ staffIds: [...this.selectedStaffIds] }); } catch (_e) {}
    }
  }
  // STAFF_SELECT_PATCH_TS_END


  // --- INJECTIONS ---
  private fb = inject(FormBuilder);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private location = inject(Location);
  
  private reservationService = inject(ReservationService);
  private clientService = inject(ClientService);
  private teamService = inject(TeamService);
  private serviceService = inject(ServiceService);
  private ui = inject(UiService);

  // --- ETAT (SIGNALS) ---
  isEditMode = signal(false);
  loading = signal(false);
  
  // Modales
  showClientModal = signal(false);
  showPaymentModal = signal(false);

  // Recherche
  clientSearch = signal('');
  teamSearch = signal('');
  staffSearch = signal('');

  // --- DONNÉES ---
  // On utilise des Observables directs pour les pipes async (comme demandé par le template packs$ | async)
  packs$ = this.teamService.getPacks();
  
  // Pour les autres, on utilise des Signals pour faciliter le filtrage
  private rawClients = toSignal(this.clientService.getAll(), { initialValue: [] });
  private rawTeams = toSignal(this.teamService.getTeams(), { initialValue: [] });
  private rawStaff = toSignal(this.teamService.getStaff(), { initialValue: [] });
  servicesList = toSignal(this.serviceService.getAll(), { initialValue: [] });

  availableSlots = signal([
    { id: 'matin', label: 'Matin', start: '08:00', end: '16:00' },
    { id: 'soir', label: 'Soir', start: '18:00', end: '02:00' }
  ]);

  // --- FORMULAIRE ---
  form: FormGroup;
  reservationId: string | null = null;
  
  // État local de sélection (Service) - synchronisé avec le form
  selectedServices = signal<any[]>([]);

  constructor() {
    this.form = this.fb.group({
      date: ['', Validators.required],
      slotId: ['matin', Validators.required],
      clientId: ['', Validators.required],
      packId: [''],
      
      // Tableaux d'IDs pour le multi-select
      assignedTeamIds: [[]],
      assignedServerIds: [[]],
      services: [[]],
      
      notes: [''],
      status: ['CONFIRMED'],
      totalPrice: [0],
      advance: [0] // Avance payée
    });

    // Recalcul du total quand le formulaire change
    this.form.valueChanges.subscribe(() => this.calculateTotal());
  }

  async ngOnInit() {
    
    this._initStaffSelection();
this.reservationId = this.route.snapshot.paramMap.get('id');
    const queryDate = this.route.snapshot.queryParamMap.get('date');
    const querySlot = this.route.snapshot.queryParamMap.get('slotId');

    if (this.reservationId) {
      this.isEditMode.set(true);
      await this.loadReservation(this.reservationId);
    } else if (queryDate) {
      this.form.patchValue({
        date: queryDate,
        slotId: querySlot || 'matin'
      });
    }
  }

  private async loadReservation(id: string) {
    this.loading.set(true);
    try {
        const list = await firstValueFrom(this.reservationService.getReservations());
        const res = list.find((r: any) => r.id === id);
        if (res) {
            // Conversion Date
            let dateStr = res.date;
            if (res.date && res.date.toDate) dateStr = res.date.toDate().toISOString().split('T')[0];
            else if (res.date instanceof Date) dateStr = res.date.toISOString().split('T')[0];

            this.form.patchValue({ ...res, date: dateStr });
            
            // Restauration des états locaux
            if (res.services) this.selectedServices.set(res.services);
        }
    } catch (e) {
        console.error(e);
        this.ui.showToast('error', 'Erreur chargement réservation');
    }
    this.loading.set(false);
  }

  // --- COMPUTED / FILTRES ---

  filteredClients = computed(() => {
    const term = this.clientSearch().toLowerCase();
    const all = this.rawClients();
    if (!term) return all.slice(0, 5); // Par défaut on en montre 5
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
    return this.rawStaff().filter(s => {
      const t = (term || '').toLowerCase();
      const nom = String((s as any)?.nom ?? (s as any)?.name ?? '').toLowerCase();
      const email = String((s as any)?.email ?? '').toLowerCase();
      const tel = String((s as any)?.telephone ?? (s as any)?.phone ?? '').toLowerCase();
      return !t || nom.includes(t) || email.includes(t) || tel.includes(t);
    });
  });

  // Client actuellement sélectionné (pour l'affichage dans le template)
  selectedClient = computed(() => {
    const id = this.form.get('clientId')?.value;
    return this.rawClients().find(c => c.id === id) || null;
  });


  // --- ACTIONS CLIENT ---

  openClientModal() { this.showClientModal.set(true); }
  closeClientModal() { this.showClientModal.set(false); }
  
  onClientModalFinish(newClientId: string) {
    if (newClientId) {
      // Recharger la liste des clients pour trouver le nouveau
      // (rawClients est réactif via toSignal, donc ça devrait être auto si Firestore push)
      this.form.patchValue({ clientId: newClientId });
    }
    this.closeClientModal();
  }

  selectClient(client: any) {
    this.form.patchValue({ clientId: client.id });
    this.clearClientSearch();
  }

  onClientSearch(event: any) { this.clientSearch.set(event.target.value); }
  clearClientSearch() { this.clientSearch.set(''); }


  // --- ACTIONS TEAMS / STAFF (Multi-Select) ---

  // Helper générique pour toggle dans un tableau d'IDs
  private toggleIdInArray(controlName: string, id: string) {
    const current = this.form.get(controlName)?.value || [];
    const idx = current.indexOf(id);
    let updated;
    if (idx > -1) {
        updated = current.filter((x: string) => x !== id);
    } else {
        updated = [...current, id];
    }
    this.form.patchValue({ [controlName]: updated });
  }

  toggleTeam(id: string) { this.toggleIdInArray('assignedTeamIds', id); }
  isTeamSelected(id: string): boolean {
    return (this.form.get('assignedTeamIds')?.value || []).includes(id);
  }

  toggleStaff(id: string) { this.toggleIdInArray('assignedServerIds', id); }
  isStaffSelected(id: string): boolean {
    return (this.form.get('assignedServerIds')?.value || []).includes(id);
  }


  // --- ACTIONS SERVICES ---

  toggleService(service: any) {
    const current = this.selectedServices();
    const exists = current.find(s => s.id === service.id);
    let updated = exists ? current.filter(s => s.id !== service.id) : [...current, service];
    
    this.selectedServices.set(updated);
    this.form.patchValue({ services: updated });
    this.calculateTotal();
  }

  isServiceSelected(service: any): boolean {
    return !!this.selectedServices().find(s => s.id === service.id);
  }


  // --- CALCUL PRIX ---

  calculateTotal() {
    let total = 0;
    const val = this.form.value;

    // Pack (On doit récupérer le prix depuis l'observable packs$, un peu tricky en synchrone)
    // Astuce: Comme c'est un observable, on ne l'a pas en direct ici. 
    // Idéalement on aurait dû utiliser toSignal pour packs aussi.
    // Pour simplifier, on suppose que getPackTotal gère l'affichage, 
    // mais pour le form value 'totalPrice', on a besoin des données.
    // SOLUTION: On ne calcule le total du pack que si on a accès aux données.
    // L'utilisateur peut entrer le prix manuellement si besoin ou on se base sur l'UI.
    // Ici, on va ignorer le calcul auto du pack si on n'a pas la liste chargée, 
    // le template gère l'affichage.
    
    // Services
    const services = this.selectedServices();
    if (services.length) {
        total += services.reduce((sum, s) => sum + Number(s.price || s.prix || 0), 0);
    }

    // On met à jour sans émettre d'event pour éviter boucle infinie
    // Note: C'est une simplification. Dans une vraie app, on utiliserait un signal computed pour le total global.
    this.form.patchValue({ totalPrice: total }, { emitEvent: false });
  }

  getPackTotal(pack: any): number {
    return Number(pack.price || pack.prix || 0);
  }

  onPackChange(event: any) {
    // Si on voulait pré-remplir le prix en fonction du pack
    this.calculateTotal();
  }
  
  onSlotChange(event: any) {}


  // --- ACTIONS GLOBALES ---

  async onSubmit() {
    if (this.form.invalid) return;
    this.loading.set(true);

    const formData = this.form.value;
    const dataToSave = {
        ...formData,
        date: new Date(formData.date) // Conversion string -> Date object
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

  onPrint() {
    window.print();
  }

  onClose() {
    this.router.navigate(['/calendar']); // ou location.back()
  }

  // --- MODAL PAIEMENT ---
  openPaymentModal() { this.showPaymentModal.set(true); }
  // (La fermeture et logique sont gérées par le composant modal lui-même ou non implémentées ici)
}
