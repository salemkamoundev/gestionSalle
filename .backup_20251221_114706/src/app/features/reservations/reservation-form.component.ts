import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Firestore, collection, addDoc, collectionData } from '@angular/fire/firestore';
import { StaffService } from '../../core/services/staff.service';
import { toSignal } from '@angular/core/rxjs-interop';
import { Observable } from 'rxjs';

@Component({
  selector: 'app-reservation-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  template: `
    <div class="max-w-3xl mx-auto p-6 bg-white rounded-2xl shadow-xl mt-10">
      <h2 class="text-2xl font-bold mb-6 text-gray-800 border-b pb-4">📅 Réservation & Créneau</h2>
      
      <form [formGroup]="form" (ngSubmit)="onSubmit()" class="space-y-6">
        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label class="block text-sm font-bold text-gray-700">Date de l'événement</label>
            <input type="date" formControlName="date" class="mt-1 block w-full p-3 border rounded-xl bg-gray-50">
          </div>
          <div>
            <label class="block text-sm font-bold text-gray-700">Créneau Disponible</label>
            <select formControlName="slotId" class="mt-1 block w-full p-3 border rounded-xl bg-indigo-50 text-indigo-700 font-bold">
              <option value="">-- Choisir --</option>
              <option value="as_matin_2025">Matin (Hiver 2025) (08:00 - 12:00) - 600 DT</option>
              <option value="as_aprem_2025">Après-midi (Hiver 2025) (13:00 - 17:00) - 600 DT</option>
            </select>
          </div>
        </div>

        <div class="p-5 bg-gray-50 rounded-2xl border border-gray-100">
          <h3 class="text-xs font-black text-gray-400 uppercase tracking-widest mb-4">Infos Client (Recherche)</h3>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <input formControlName="customerFirstName" placeholder="Prénom du client" class="p-3 border rounded-xl">
            <input formControlName="customerLastName" placeholder="Nom du client" class="p-3 border rounded-xl">
            <input formControlName="customerPhone" placeholder="Téléphone (ex: 28606...)" class="p-3 border rounded-xl md:col-span-2">
          </div>
        </div>

        <button type="submit" [disabled]="form.invalid" class="w-full bg-indigo-600 text-white py-4 rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200">
          Confirmer la Réservation
        </button>
      </form>
    </div>
  `
})
export class ReservationFormComponent implements OnInit {
  private fb = inject(FormBuilder);
  private route = inject(ActivatedRoute);
  private firestore = inject(Firestore);
  private router = inject(Router);

  form = this.fb.group({
    date: ['', Validators.required],
    slotId: ['', Validators.required],
    customerFirstName: ['', Validators.required],
    customerLastName: ['', Validators.required],
    customerPhone: ['', [Validators.required, Validators.pattern('^[0-9+ ]{8,15}$')]]
  });

  ngOnInit() {
    this.route.queryParams.subscribe(params => {
      const date = params['date'];
      const slot = params['slotId'];

      // Mapping spécifique demandé : matin -> as_matin_2025
      let mappedSlot = '';
      if (slot === 'matin') mappedSlot = 'as_matin_2025';
      else if (slot === 'aprem') mappedSlot = 'as_aprem_2025';

      if (date || mappedSlot) {
        this.form.patchValue({
          date: date || '',
          slotId: mappedSlot
        });
      }
    });
  }

  async onSubmit() {
    if (this.form.valid) {
      await addDoc(collection(this.firestore, 'reservations'), {
        ...this.form.value,
        createdAt: new Date()
      });
      alert('Réservation enregistrée !');
      this.router.navigate(['/dashboard']);
    }
  }
}
