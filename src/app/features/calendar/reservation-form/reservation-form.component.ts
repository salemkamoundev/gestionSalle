import { Component, inject, signal, computed, OnInit, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ReservationService } from '../../../core/services/reservation.service';
import { ClientService } from '../../../core/services/client.service';
import { StaffService } from '../../../core/services/staff.service';
import { TeamService } from '../../../core/services/team.service';
import { ConfigService } from '../../../core/services/config.service';
import { UiService } from '../../../core/services/ui.service';
import { PdfService } from '../../../core/services/pdf.service';
import { Router, ActivatedRoute } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';

@Component({
  selector: 'app-reservation-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './reservation-form.component.html'
})
export class ReservationFormComponent implements OnInit {
  private fb = inject(FormBuilder);
  private reservationService = inject(ReservationService);
  private clientService = inject(ClientService);
  private staffService = inject(StaffService);
  private teamService = inject(TeamService);
  private configService = inject(ConfigService);
  private ui = inject(UiService);
  private pdfService = inject(PdfService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  clients = toSignal(this.clientService.getAll(), { initialValue: [] });
  servers = toSignal(this.staffService.getAll(), { initialValue: [] });
  teams = toSignal(this.teamService.getAll(), { initialValue: [] });
  
  isEditMode = signal(false);
  reservationId: string | null = null;
  clientSearch = signal('');

  form = this.fb.group({
    date: ['', Validators.required],
    selectedSlotId: ['', Validators.required],
    startTime: [''],
    endTime: [''],
    clientId: ['', Validators.required],
    clientName: [''],
    assignedTeamIds: [[] as string[]],
    assignedServerIds: [[] as string[]],
    totalPrice: [0, [Validators.required, Validators.min(0)]],
    advance: [0, [Validators.required, Validators.min(0)]],
    status: ['CONFIRMED']
  });

  availableSlots = computed(() => {
    const date = this.form.value.date;
    const settings = this.configService.settings();
    if (!settings || !settings.creneaux) return [];
    return settings.creneaux.filter(s => !date || (date >= s.validFrom && date <= s.validTo));
  });

  constructor() {
    /**
     * LOGIQUE DE MAPPAGE INTELLIGENTE
     * On surveille l'arrivée des créneaux techniques (ex: as_matin_2025)
     * et on les compare au mot-clé envoyé par le calendrier (ex: matin)
     */
    effect(() => {
      const slots = this.availableSlots();
      const params = this.route.snapshot.queryParams;
      const slotKeyword = params['slotId']; // 'matin', 'apres-midi' ou 'soir'

      if (!this.isEditMode() && slots.length > 0 && slotKeyword) {
        // On cherche un slot dont l'ID ou le Label contient le mot-clé (ex: 'as_matin_2025' contient 'matin')
        const foundSlot = slots.find(s => 
          s.id.toLowerCase().includes(slotKeyword.toLowerCase()) || 
          s.label.toLowerCase().includes(slotKeyword.toLowerCase())
        );
        
        if (foundSlot) {
          if (this.form.get('selectedSlotId')?.value !== foundSlot.id) {
            this.form.patchValue({ 
              selectedSlotId: foundSlot.id,
              startTime: foundSlot.start,
              endTime: foundSlot.end,
              totalPrice: foundSlot.price
            });
          }
        }
      }
    });
  }

  ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id');
    const params = this.route.snapshot.queryParams;

    if (id) {
      this.isEditMode.set(true);
      this.reservationId = id;
      this.reservationService.getById(id).subscribe(res => {
        if (res) {
          this.form.patchValue(res as any);
          this.clientSearch.set(res.clientName || '');
        }
      });
    } else {
      if (params['date']) {
        this.form.patchValue({ date: params['date'] });
      }
    }
  }

  onSlotChange(ev: any) {
    const slotId = ev.target.value;
    const slot = this.availableSlots().find(s => s.id === slotId);
    if (slot) {
      this.form.patchValue({
        startTime: slot.start,
        endTime: slot.end,
        totalPrice: slot.price
      });
    }
  }

  // MÉTHODES CLIENTS / STAFF / TEAMS (conservées sans changement)
  filteredClients = computed(() => {
    const q = this.clientSearch().toLowerCase();
    return q ? this.clients().filter(c => c.nom.toLowerCase().includes(q) || c.telephone.includes(q)) : this.clients().slice(0, 10);
  });
  onClientSearch(ev: any) { this.clientSearch.set(ev.target.value); }
  selectClient(c: any) {
    this.form.patchValue({ clientId: c.id, clientName: `${c.nom} ${c.prenom}` });
    this.clientSearch.set(`${c.nom} ${c.prenom}`);
  }
  toggleTeam(id: string) {
    const current = this.form.value.assignedTeamIds || [];
    this.form.patchValue({ assignedTeamIds: current.includes(id) ? current.filter(i => i !== id) : [...current, id] });
  }
  toggleStaff(id: string) {
    const current = this.form.value.assignedServerIds || [];
    this.form.patchValue({ assignedServerIds: current.includes(id) ? current.filter(i => i !== id) : [...current, id] });
  }
  isTeamSelected(id: string) { return (this.form.value.assignedTeamIds || []).includes(id); }
  isStaffSelected(id: string) { return (this.form.value.assignedServerIds || []).includes(id); }
  onPrint() { if (this.form.value) this.pdfService.generateContract(this.form.value as any); }
  onClose() { this.router.navigate(['/reservations']); }

  async onSubmit() {
    if (this.form.valid) {
      try {
        if (this.isEditMode()) await this.reservationService.update(this.reservationId!, this.form.value as any);
        else await this.reservationService.add(this.form.value as any);
        this.ui.showToast('success', 'Réservation enregistrée');
        this.onClose();
      } catch (e) { this.ui.showToast('error', 'Erreur'); }
    }
  }
}
