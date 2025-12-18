import { Component, inject, signal, computed, OnInit, effect, ChangeDetectorRef } from '@angular/core';
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
  private cdr = inject(ChangeDetectorRef);

  clients = toSignal(this.clientService.getAll(), { initialValue: [] });
  servers = toSignal(this.staffService.getAll(), { initialValue: [] });
  teams = toSignal(this.teamService.getAll(), { initialValue: [] });
  
  isEditMode = signal(false);
  reservationId: string | null = null;
  clientSearch = signal('');
  teamSearch = signal('');
  staffSearch = signal('');

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
    effect(() => {
      const slots = this.availableSlots();
      const params = this.route.snapshot.queryParams;
      const slotKeyword = params['slotId'];

      if (!this.isEditMode() && slots.length > 0 && slotKeyword) {
        const foundSlot = slots.find(s => 
          s.id.toLowerCase().includes(slotKeyword.toLowerCase()) || 
          s.label.toLowerCase().includes(slotKeyword.toLowerCase())
        );
        if (foundSlot && this.form.get('selectedSlotId')?.value !== foundSlot.id) {
          this.form.patchValue({ 
            selectedSlotId: foundSlot.id,
            startTime: foundSlot.start,
            endTime: foundSlot.end,
            totalPrice: foundSlot.price
          });
          this.cdr.detectChanges();
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
    } else if (params['date']) {
      this.form.patchValue({ date: params['date'] });
    }
  }

  onSlotChange(ev: any) {
    const slotId = ev.target.value;
    const slot = this.availableSlots().find(s => s.id === slotId);
    if (slot) {
      this.form.patchValue({ startTime: slot.start, endTime: slot.end, totalPrice: slot.price });
    }
  }

  onPrint() {
    if (this.form.value) {
      // On enrichit les données avec les infos client pour le PdfService
      const client = this.clients().find(c => c.id === this.form.value.clientId);
      const printData = {
        ...this.form.value,
        clientPhone: client?.telephone,
        clientCin: client?.cin
      };
      this.pdfService.generateContract(printData);
    }
  }

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

  filteredTeams = computed(() => {
    const q = this.teamSearch().toLowerCase();
    return q ? this.teams().filter(t => t.nom.toLowerCase().includes(q)) : this.teams();
  });

  filteredStaff = computed(() => {
    const q = this.staffSearch().toLowerCase();
    return q ? this.servers().filter(s => s.nom.toLowerCase().includes(q)) : this.servers();
  });
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
  onClose() { this.router.navigate(['/reservations']); }
}
