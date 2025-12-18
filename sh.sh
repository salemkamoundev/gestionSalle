#!/bin/bash

TARGET="src/app/features/calendar/reservation-form/reservation-form.component.ts"

echo "🚀 Réparation finale du formulaire de réservation..."

cat > "$TARGET" << 'EOF'
import { Component, inject, signal, computed, OnInit } from '@angular/core';
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

  get clientForm() { return this.form; }

  availableSlots = computed(() => {
    const date = this.form.value.date;
    const settings = this.configService.settings();
    return settings?.creneaux?.filter(s => !date || (date >= s.validFrom && date <= s.validTo)) || [];
  });

  filteredClients = computed(() => {
    const q = this.clientSearch().toLowerCase();
    return q ? this.clients().filter(c => c.nom.toLowerCase().includes(q) || c.telephone.includes(q)) : this.clients().slice(0, 10);
  });

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
      if (params['date']) this.form.patchValue({ date: params['date'] });
      if (params['slotId']) {
        setTimeout(() => {
          const slot = this.availableSlots().find(s => s.id.toLowerCase() === params['slotId'].toLowerCase());
          if (slot) {
            this.form.patchValue({ 
              selectedSlotId: slot.id,
              startTime: slot.start,
              endTime: slot.end,
              totalPrice: slot.price
            });
          }
        }, 200);
      }
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
      this.pdfService.generateContract(this.form.value as any);
    }
  }

  async onSubmit() {
    if (this.form.valid) {
      try {
        if (this.isEditMode()) await this.reservationService.update(this.reservationId!, this.form.value as any);
        else await this.reservationService.add(this.form.value as any);
        this.ui.showToast('success', 'Enregistré');
        this.onClose();
      } catch (e) { this.ui.showToast('error', 'Erreur'); }
    }
  }

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
EOF

echo "✅ Fichier réparé avec les imports corrects et une syntaxe propre."