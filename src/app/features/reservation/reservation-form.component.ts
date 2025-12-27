import { Component, inject, OnInit, computed } from '@angular/core';
import { ConfigService } from "../../core/services/config.service";
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Firestore, collection, addDoc } from '@angular/fire/firestore';

@Component({
  selector: 'app-reservation-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  template: `
    <div class="max-w-6xl mx-auto p-4 sm:p-8 bg-slate-50 min-h-screen">
      
      <div class="flex flex-col md:flex-row justify-between items-center mb-6 bg-white p-5 rounded-2xl shadow-sm border border-slate-200">
        <div class="mb-4 md:mb-0">
          <h2 class="text-2xl font-black text-slate-800 flex items-center">
            <span class="material-icons mr-3 text-indigo-600">event_available</span> 
            Nouvelle Réservation
          </h2>
          <p class="text-sm text-slate-500 font-medium ml-10">
            Étape <span class="text-indigo-600 font-bold">{{ currentStepIndex + 1 }}</span> sur {{ tabs.length }}
          </p>
        </div>
        <button (click)="cancel()" class="px-4 py-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition flex items-center">
          <span class="material-icons text-sm mr-2">close</span> Annuler
        </button>
      </div>

      <form [formGroup]="mainForm" (ngSubmit)="onSubmit()">
        
        <div class="bg-white rounded-xl shadow-sm border border-slate-200 mb-6 px-2 overflow-x-auto">
          <nav class="flex space-x-2 p-2 min-w-max" aria-label="Tabs">
            <button *ngFor="let tab of tabs" type="button"
              (click)="selectTab(tab.id)"
              class="flex-1 py-3 px-4 rounded-lg text-sm font-bold flex items-center justify-center transition-all focus:outline-none"
              [class.bg-indigo-50]="activeTab === tab.id"
              [class.text-indigo-700]="activeTab === tab.id"
              [class.text-slate-500]="activeTab !== tab.id"
              [class.hover:bg-slate-50]="activeTab !== tab.id">
              <span class="material-icons mr-2 text-lg" 
                    [class.text-indigo-600]="activeTab === tab.id"
                    [class.text-slate-400]="activeTab !== tab.id">
                {{ tab.icon }}
              </span>
              {{ tab.label }}
            </button>
          </nav>
        </div>

        <div class="bg-white p-6 md:p-8 rounded-2xl shadow-xl border border-slate-200 min-h-[500px]">
          
          <div *ngIf="activeTab === 'client'" formGroupName="clientInfo" class="animate-fade-in space-y-6">
            <h3 class="text-xs font-black text-slate-400 uppercase tracking-widest border-l-4 border-indigo-500 pl-3 mb-6">
              Informations du Client
            </h3>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label class="block text-xs font-bold text-slate-700 uppercase mb-2">Prénom</label>
                <input formControlName="firstName" type="text" class="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none transition font-semibold">
              </div>
              <div>
                <label class="block text-xs font-bold text-slate-700 uppercase mb-2">Nom</label>
                <input formControlName="lastName" type="text" class="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none transition font-semibold">
              </div>
              <div class="md:col-span-2">
                <label class="block text-xs font-bold text-slate-700 uppercase mb-2">Téléphone</label>
                <input formControlName="phone" type="tel" class="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none transition font-semibold">
              </div>
              <div class="md:col-span-2">
                <label class="block text-xs font-bold text-slate-700 uppercase mb-2">Email (Optionnel)</label>
                <input formControlName="email" type="email" class="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none transition font-semibold">
              </div>
            </div>
          </div>

          <div *ngIf="activeTab === 'event'" formGroupName="eventDetails" class="animate-fade-in space-y-6">
            <h3 class="text-xs font-black text-slate-400 uppercase tracking-widest border-l-4 border-blue-500 pl-3 mb-6">
              Détails de l'événement
            </h3>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label class="block text-xs font-bold text-slate-700 uppercase mb-2">Date</label>
                <input formControlName="date" type="date" class="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none font-semibold">
              </div>
              <div>
                <label class="block text-xs font-bold text-slate-700 uppercase mb-2">Créneau</label>
                <select formControlName="slotId" class="w-full px-4 py-3 rounded-xl border border-slate-200 bg-white outline-none focus:ring-2 focus:ring-blue-500 font-semibold">
                  <option value="">-- Choisir --</option>
                  @for (slot of availableSlots(); track slot.id) {
                    <option [value]="slot.id">{{ slot.label }} ({{ slot.start }} - {{ slot.end }}) - {{ slot.price }} DT</option>
                  }
                </select>
              </div>
              <div>
                 <label class="block text-xs font-bold text-slate-700 uppercase mb-2">Type d'événement</label>
                 <select formControlName="eventType" class="w-full px-4 py-3 rounded-xl border border-slate-200 bg-white outline-none font-semibold">
                  <option value="mariage">Mariage</option>
                  <option value="fiancailles">Fiançailles</option>
                  <option value="anniversaire">Anniversaire</option>
                  <option value="conference">Conférence</option>
                </select>
              </div>
              <div>
                <label class="block text-xs font-bold text-slate-700 uppercase mb-2">Nombre d'invités</label>
                <input formControlName="guestCount" type="number" class="w-full px-4 py-3 rounded-xl border border-slate-200 outline-none font-semibold">
              </div>
            </div>
          </div>

          <div *ngIf="activeTab === 'packs'" formGroupName="services" class="animate-fade-in space-y-6">
             <h3 class="text-xs font-black text-slate-400 uppercase tracking-widest border-l-4 border-purple-500 pl-3 mb-6">
               Services & Packs
             </h3>
             <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
               
               <label class="cursor-pointer border-2 rounded-2xl p-5 transition-all hover:border-purple-300 relative group bg-slate-50 hover:bg-white"
                      [class.border-purple-600]="mainForm.get('services.packDecoration')?.value"
                      [class.bg-purple-50]="mainForm.get('services.packDecoration')?.value">
                 <div class="flex items-start space-x-4">
                   <input type="checkbox" formControlName="packDecoration" class="mt-1 h-5 w-5 text-purple-600 rounded focus:ring-purple-500">
                   <div>
                     <span class="block font-bold text-slate-800 text-lg">Décoration Royale</span>
                     <span class="block text-xs text-purple-600 font-black uppercase mt-1">+1200 DT</span>
                     <p class="text-sm text-slate-500 mt-2">Décoration complète de la salle et des tables.</p>
                   </div>
                 </div>
               </label>

               <label class="cursor-pointer border-2 rounded-2xl p-5 transition-all hover:border-purple-300 relative group bg-slate-50 hover:bg-white"
                      [class.border-purple-600]="mainForm.get('services.packPhoto')?.value"
                      [class.bg-purple-50]="mainForm.get('services.packPhoto')?.value">
                 <div class="flex items-start space-x-4">
                   <input type="checkbox" formControlName="packPhoto" class="mt-1 h-5 w-5 text-purple-600 rounded focus:ring-purple-500">
                   <div>
                     <span class="block font-bold text-slate-800 text-lg">Photo & Vidéo</span>
                     <span class="block text-xs text-purple-600 font-black uppercase mt-1">+800 DT</span>
                     <p class="text-sm text-slate-500 mt-2">Couverture photo et vidéo HD de l'événement.</p>
                   </div>
                 </div>
               </label>

             </div>
          </div>

          <div *ngIf="activeTab === 'staff'" formGroupName="staff" class="animate-fade-in space-y-6">
            <h3 class="text-xs font-black text-slate-400 uppercase tracking-widest border-l-4 border-emerald-500 pl-3 mb-6">
              Personnel de Salle
            </h3>
            <div class="space-y-6 max-w-lg">
               <div>
                  <label class="block text-xs font-bold text-slate-700 uppercase mb-2">Chef de Cuisine</label>
                  <input formControlName="chefName" type="text" placeholder="Nom (optionnel)" class="w-full px-4 py-3 rounded-xl border border-slate-200 outline-none font-semibold">
               </div>
               <div>
                  <label class="block text-xs font-bold text-slate-700 uppercase mb-2">Nombre de serveurs</label>
                  <input formControlName="waitersCount" type="number" class="w-full px-4 py-3 rounded-xl border border-slate-200 outline-none font-semibold">
               </div>
            </div>
          </div>

          <div *ngIf="activeTab === 'payment'" formGroupName="payment" class="animate-fade-in space-y-6">
            <h3 class="text-xs font-black text-slate-400 uppercase tracking-widest border-l-4 border-green-600 pl-3 mb-6">
              Finances
            </h3>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
               <div class="p-6 bg-emerald-50 rounded-2xl border border-emerald-100">
                  <label class="block text-xs font-black text-emerald-700 uppercase mb-2">Prix Total (DT)</label>
                  <input formControlName="totalAmount" type="number" class="w-full bg-transparent text-3xl font-black text-emerald-900 border-none outline-none placeholder-emerald-300">
               </div>
               <div class="p-6 bg-blue-50 rounded-2xl border border-blue-100">
                  <label class="block text-xs font-black text-blue-700 uppercase mb-2">Avance (DT)</label>
                  <input formControlName="advancePayment" type="number" class="w-full bg-transparent text-3xl font-black text-blue-900 border-none outline-none placeholder-blue-300">
               </div>
            </div>
          </div>

        </div>

        <div class="flex justify-between items-center mt-8">
          <button type="button" 
                  *ngIf="currentStepIndex > 0"
                  (click)="prevTab()"
                  class="px-8 py-3 bg-white border border-slate-300 text-slate-600 font-bold rounded-xl hover:bg-slate-50 transition shadow-sm">
            ← Précédent
          </button>
          
          <div class="flex-1"></div>
          
          <button *ngIf="currentStepIndex < tabs.length - 1"
                  type="button" 
                  (click)="nextTab()"
                  class="px-8 py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 shadow-lg shadow-indigo-200 transition transform hover:scale-[1.02]">
            Suivant →
          </button>

          <button *ngIf="currentStepIndex === tabs.length - 1"
                  type="submit" 
                  [disabled]="mainForm.invalid"
                  class="px-8 py-3 bg-green-600 text-white rounded-xl font-bold hover:bg-green-700 shadow-lg shadow-green-200 transition transform hover:scale-[1.02] flex items-center disabled:opacity-50 disabled:cursor-not-allowed">
            <span class="material-icons mr-2">check</span> Confirmer
          </button>
        </div>

      </form>
    </div>
  `,
  styles: [`
    .animate-fade-in { animation: fadeIn 0.3s ease-out forwards; }
    @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
  `]
})
export class ReservationFormComponent implements OnInit {
  private fb = inject(FormBuilder);
  private route = inject(ActivatedRoute);
  private firestore = inject(Firestore);
  private configService = inject(ConfigService);
  
  
  availableSlots = computed(() => this.configService.settings().creneaux);
  private router = inject(Router);

  tabs = [
    { id: 'client', label: 'Client', icon: 'person' },
    { id: 'event', label: 'Événement', icon: 'event' },
    { id: 'packs', label: 'Packs', icon: 'inventory_2' },
    { id: 'staff', label: 'Staff', icon: 'groups' },
    { id: 'payment', label: 'Finances', icon: 'payments' }
  ];

  activeTab = 'client';

  mainForm = this.fb.group({
    clientInfo: this.fb.group({
      firstName: ['', Validators.required],
      lastName: ['', Validators.required],
      phone: ['', [Validators.required]],
      email: ['']
    }),
    eventDetails: this.fb.group({
      date: ['', Validators.required],
      slotId: ['', Validators.required],
      eventType: ['mariage'],
      guestCount: [100]
    }),
    services: this.fb.group({
      packDecoration: [false],
      packPhoto: [false]
    }),
    staff: this.fb.group({
      chefName: [''],
      waitersCount: [2]
    }),
    payment: this.fb.group({
      totalAmount: [0, Validators.required],
      advancePayment: [0]
    })
  });

  ngOnInit() {
    this.route.queryParams.subscribe(params => {
      if (params['date'] || params['slotId']) {
        this.mainForm.patchValue({
          eventDetails: {
            date: params['date'],
            slotId: params['slotId']
          }
        });
      }
    });
  }

  get currentStepIndex() { return this.tabs.findIndex(t => t.id === this.activeTab); }
  selectTab(tabId: string) { this.activeTab = tabId; }
  
  nextTab() {
    const idx = this.currentStepIndex;
    if (idx < this.tabs.length - 1) {
      this.activeTab = this.tabs[idx + 1].id;
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  prevTab() {
    const idx = this.currentStepIndex;
    if (idx > 0) {
      this.activeTab = this.tabs[idx - 1].id;
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  cancel() { this.router.navigate(['/dashboard']); }

  async onSubmit() {
    if (this.mainForm.valid) {
      try {
        const data = this.mainForm.value;
        const flatData = {
            customerName: data.clientInfo?.firstName + ' ' + data.clientInfo?.lastName,
            customerPhone: data.clientInfo?.phone,
            eventDate: data.eventDetails?.date,
            status: 'PENDING',
            createdAt: new Date(),
            ...data
        };
        await addDoc(collection(this.firestore, 'reservations'), flatData);
        alert('✅ Réservation enregistrée !');
        this.router.navigate(['/dashboard']);
      } catch (e) {
        console.error(e);
        alert('Erreur technique lors de la sauvegarde.');
      }
    } else {
      this.mainForm.markAllAsTouched();
      alert('⚠️ Vérifiez les champs obligatoires.');
    }
  }
}
