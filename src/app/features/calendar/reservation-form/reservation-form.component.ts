import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators, FormGroup } from '@angular/forms';
import { ReservationService } from '../../../core/services/reservation.service';
import { ClientService } from '../../../core/services/client.service';
import { ConfigService } from '../../../core/services/config.service';
import { Router } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';

@Component({
  selector: 'app-reservation-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  template: `
    <div class="max-w-2xl mx-auto bg-white p-8 rounded-xl shadow-lg mt-6 border border-slate-100 relative">
      <h2 class="text-2xl font-bold mb-6 text-slate-800 flex items-center">
        <span class="material-icons mr-2 text-blue-600">event_available</span>
        Nouvelle Réservation
      </h2>
      
      <form [formGroup]="form" (ngSubmit)="onSubmit()" class="space-y-6">
        
        <div>
          <label class="block text-sm font-bold text-slate-700 mb-1">Date de l'événement</label>
          <input formControlName="date" type="date" class="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition shadow-sm">
        </div>

        <div>
          <label class="block text-sm font-bold text-slate-700 mb-1">Créneau Horaire</label>
          <div class="relative">
            <select formControlName="startTime" (change)="onSlotChange($event)" class="w-full px-4 py-3 border border-slate-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 outline-none appearance-none shadow-sm cursor-pointer">
              <option value="">-- Choisir un créneau --</option>
              @for (opt of slotOptions(); track opt.value) {
                <option [value]="opt.value">{{ opt.label }}</option>
              }
            </select>
            <span class="material-icons absolute right-3 top-3 text-slate-400 pointer-events-none">expand_more</span>
          </div>
          <input type="hidden" formControlName="endTime">
        </div>

        <div>
          <label class="block text-sm font-bold text-slate-700 mb-1">Client</label>
          <div class="flex gap-2">
            <div class="relative flex-1">
              <select formControlName="clientId" (change)="onClientChange($event)" class="w-full px-4 py-3 border border-slate-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 outline-none appearance-none shadow-sm cursor-pointer">
                <option value="">-- Sélectionner un client existant --</option>
                @for (client of clients(); track client.id) {
                  <option [value]="client.id">{{ client.nom }}</option>
                }
              </select>
              <span class="material-icons absolute right-3 top-3 text-slate-400 pointer-events-none">person_search</span>
            </div>
            
            <button type="button" (click)="openClientModal()" class="bg-emerald-500 hover:bg-emerald-600 text-white px-3 rounded-lg shadow transition flex items-center justify-center" title="Nouveau Client">
              <span class="material-icons">add</span>
            </button>
          </div>
        </div>

        <div class="flex justify-end space-x-3 pt-6 border-t border-slate-100">
          <button type="button" (click)="cancel()" class="px-5 py-2.5 border border-slate-300 rounded-lg text-slate-600 hover:bg-slate-50 font-medium transition">Annuler</button>
          <button type="submit" [disabled]="form.invalid" class="px-6 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg font-bold shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transition transform hover:-translate-y-0.5">
            Confirmer la réservation
          </button>
        </div>
      </form>
    </div>

    @if (showClientModal()) {
      <div class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm animate-fade-in p-4">
        <div class="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden transform transition-all scale-100 flex flex-col max-h-[90vh]">
          
          <div class="bg-emerald-600 px-6 py-4 flex justify-between items-center shrink-0">
            <h3 class="text-white font-bold text-lg flex items-center">
              <span class="material-icons mr-2">person_add</span> Création Rapide
            </h3>
            <button (click)="closeClientModal()" class="text-emerald-100 hover:text-white transition">
              <span class="material-icons">close</span>
            </button>
          </div>

          <form [formGroup]="quickClientForm" (ngSubmit)="saveQuickClient()" class="p-6 space-y-4 overflow-y-auto">
            
            <div>
              <label class="block text-xs font-bold text-slate-500 uppercase mb-1">Nom complet <span class="text-red-500">*</span></label>
              <input formControlName="nom" type="text" class="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none" placeholder="Ex: Salah Ben Amor">
            </div>
            
            <div>
              <label class="block text-xs font-bold text-slate-500 uppercase mb-1">Téléphone <span class="text-red-500">*</span></label>
              <input formControlName="telephone" type="tel" class="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none" placeholder="Ex: 20 123 456">
            </div>

            <div>
              <label class="block text-xs font-bold text-slate-500 uppercase mb-1">Email</label>
              <input formControlName="email" type="email" class="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none" placeholder="client@exemple.com">
            </div>

            <div>
              <label class="block text-xs font-bold text-slate-500 uppercase mb-1">Adresse</label>
              <textarea formControlName="adresse" rows="2" class="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none resize-none" placeholder="Adresse complète..."></textarea>
            </div>

            <div class="pt-4 mt-2 border-t border-slate-100">
              <button type="submit" [disabled]="quickClientForm.invalid || isSavingClient()" class="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 rounded-lg shadow transition flex justify-center items-center disabled:opacity-70">
                @if (isSavingClient()) {
                  <span class="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full mr-2"></span>
                }
                Enregistrer & Sélectionner
              </button>
            </div>
          </form>

        </div>
      </div>
    }
  `,
  styles: [`
    @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
    .animate-fade-in { animation: fadeIn 0.2s ease-out; }
  `]
})
export class ReservationFormComponent {
  private fb = inject(FormBuilder);
  private reservationService = inject(ReservationService);
  private clientService = inject(ClientService);
  private configService = inject(ConfigService);
  private router = inject(Router);

  // Data
  clients = toSignal(this.clientService.getAll(), { initialValue: [] });
  slotOptions = this.configService.selectableOptions;

  // UI State
  showClientModal = signal(false);
  isSavingClient = signal(false);

  // Main Form
  form = this.fb.group({
    date: [new Date().toISOString().split('T')[0], Validators.required],
    startTime: ['', Validators.required],
    endTime: ['', Validators.required],
    clientId: ['', Validators.required],
    clientName: [''],
    assignedServerIds: [[] as string[]],
    status: ['CONFIRMED']
  });

  // Quick Client Form (Mise à jour)
  quickClientForm = this.fb.group({
    nom: ['', Validators.required],
    telephone: ['', Validators.required],
    email: ['', Validators.email],
    adresse: [''],
    createdAt: [new Date().toISOString()]
  });

  // --- Actions Principales ---

  onSlotChange(event: any) {
    const startVal = event.target.value;
    const selectedSlot = this.configService.settings().creneaux.find(c => c.start === startVal);
    if (selectedSlot) {
      this.form.patchValue({ endTime: selectedSlot.end });
    }
  }

  onClientChange(event: any) {
    const id = event.target.value;
    const client = this.clients().find(c => c.id === id);
    if (client) this.form.patchValue({ clientName: client.nom });
  }

  async onSubmit() {
    if (this.form.valid) {
      await this.reservationService.add(this.form.value as any);
      this.router.navigate(['/reservations']);
    }
  }

  cancel() {
    this.router.navigate(['/reservations']);
  }

  // --- Gestion Modale Client ---

  openClientModal() {
    this.quickClientForm.reset({ createdAt: new Date().toISOString() });
    this.showClientModal.set(true);
  }

  closeClientModal() {
    this.showClientModal.set(false);
  }

  async saveQuickClient() {
    if (this.quickClientForm.valid) {
      this.isSavingClient.set(true);
      try {
        const newClientData = this.quickClientForm.value;
        const docRef = await this.clientService.add(newClientData as any);
        
        this.closeClientModal();

        this.form.patchValue({ 
          clientId: docRef.id,
          clientName: newClientData.nom!
        });

      } catch (err) {
        console.error(err);
        alert("Erreur lors de la création du client");
      } finally {
        this.isSavingClient.set(false);
      }
    }
  }
}
