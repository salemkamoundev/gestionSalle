#!/bin/bash

# ==============================================================================
# TITRE : Global Activity Logging
# DESCRIPTION : Historique centralisé de toutes les opérations dans le Dashboard
# ==============================================================================

set -euo pipefail

# Couleurs
COLOR_RESET='\033[0m'
COLOR_SUCCESS='\033[0;32m'
COLOR_INFO='\033[0;36m'

log_info() { echo -e "${COLOR_INFO}[INFO] $1${COLOR_RESET}"; }
log_success() { echo -e "${COLOR_SUCCESS}[OK] $1${COLOR_RESET}"; }

# Vérification racine
if [ ! -f "angular.json" ]; then
    echo "Erreur : Exécute ce script à la racine du projet."
    exit 1
fi

# ==============================================================================
# ÉTAPE 1 : MODÈLE ET SERVICE D'ACTIVITÉ
# ==============================================================================
log_info "Création du modèle et du service ActivityLog..."

# Modèle
cat <<'EOF' > src/app/core/models/activity.model.ts
export interface ActivityLog {
  id?: string;
  action: 'CREATE' | 'UPDATE' | 'DELETE' | 'PAYMENT';
  entity: 'RESERVATION' | 'CLIENT' | 'STAFF' | 'CONFIG';
  description: string;
  userEmail: string;
  timestamp: string; // ISO String
  metadata?: any;    // ID de l'objet concerné, montant, etc.
}
EOF

# Service
cat <<'EOF' > src/app/core/services/activity.service.ts
import { Injectable, inject } from '@angular/core';
import { Firestore, collection, addDoc, query, orderBy, limit, collectionData } from '@angular/fire/firestore';
import { Auth } from '@angular/fire/auth';
import { ActivityLog } from '../models/activity.model';
import { Observable } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class ActivityService {
  private firestore = inject(Firestore);
  private auth = inject(Auth);
  private collectionName = 'activity_logs';

  // Enregistrer une action
  async log(
    action: 'CREATE' | 'UPDATE' | 'DELETE' | 'PAYMENT',
    entity: 'RESERVATION' | 'CLIENT' | 'STAFF' | 'CONFIG',
    description: string,
    metadata: any = {}
  ) {
    const userEmail = this.auth.currentUser?.email || 'Système';
    
    const activity: ActivityLog = {
      action,
      entity,
      description,
      userEmail,
      timestamp: new Date().toISOString(),
      metadata
    };

    try {
      const col = collection(this.firestore, this.collectionName);
      await addDoc(col, activity);
    } catch (e) {
      console.error('Erreur logging activity', e);
    }
  }

  // Récupérer les dernières activités (ex: 20 dernières)
  getLatest(count: number = 20): Observable<ActivityLog[]> {
    const col = collection(this.firestore, this.collectionName);
    const q = query(col, orderBy('timestamp', 'desc'), limit(count));
    return collectionData(q, { idField: 'id' }) as Observable<ActivityLog[]>;
  }
}
EOF

# ==============================================================================
# ÉTAPE 2 : MISE À JOUR DASHBOARD (AFFICHAGE TIMELINE)
# ==============================================================================
log_info "Mise à jour du Dashboard pour afficher l'historique..."

cat <<'EOF' > src/app/features/dashboard/dashboard.component.ts
import { Component, inject, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReservationService } from '../../core/services/reservation.service';
import { ActivityService } from '../../core/services/activity.service';
import { toSignal } from '@angular/core/rxjs-interop';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="space-y-6">
      
      <div>
        <h1 class="text-2xl font-bold text-slate-800">Tableau de Bord</h1>
        <p class="text-slate-500">Aperçu de l'activité et de la trésorerie</p>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div class="bg-gradient-to-br from-purple-600 to-indigo-700 rounded-2xl p-6 text-white shadow-lg relative overflow-hidden">
          <div class="absolute top-0 right-0 -mt-4 -mr-4 w-24 h-24 bg-white opacity-10 rounded-full blur-xl"></div>
          <div class="relative z-10">
            <p class="text-purple-200 text-sm font-medium uppercase tracking-wider mb-1">Chiffre d'Affaires</p>
            <h3 class="text-3xl font-bold">{{ stats().totalCA | number:'1.0-2' }} <span class="text-lg opacity-70">TND</span></h3>
            <p class="text-xs text-purple-200 mt-2 opacity-80">Sur {{ stats().count }} réservations</p>
          </div>
          <span class="material-icons absolute bottom-4 right-4 text-white opacity-20 text-6xl">savings</span>
        </div>

        <div class="bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl p-6 text-white shadow-lg relative overflow-hidden">
          <div class="absolute top-0 right-0 -mt-4 -mr-4 w-24 h-24 bg-white opacity-10 rounded-full blur-xl"></div>
          <div class="relative z-10">
            <p class="text-emerald-100 text-sm font-medium uppercase tracking-wider mb-1">Trésorerie (Reçu)</p>
            <h3 class="text-3xl font-bold">{{ stats().totalCollected | number:'1.0-2' }} <span class="text-lg opacity-70">TND</span></h3>
            <div class="w-full bg-black/20 h-1.5 rounded-full mt-3 overflow-hidden">
               <div class="bg-white h-full rounded-full" [style.width.%]="stats().percentCollected"></div>
            </div>
            <p class="text-xs text-emerald-100 mt-1">{{ stats().percentCollected | number:'1.0-0' }}% du total</p>
          </div>
          <span class="material-icons absolute bottom-4 right-4 text-white opacity-20 text-6xl">payments</span>
        </div>

        <div class="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm relative">
          <p class="text-slate-500 text-sm font-medium uppercase tracking-wider mb-1">Reste à Percevoir</p>
          <h3 class="text-3xl font-bold text-slate-800">{{ stats().pending | number:'1.0-2' }} <span class="text-lg text-slate-400">TND</span></h3>
          <p class="text-xs text-slate-400 mt-2">Solde restant des clients</p>
          <span class="material-icons absolute bottom-4 right-4 text-slate-100 text-6xl">account_balance_wallet</span>
        </div>
      </div>

      <div class="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
        <div class="flex items-center justify-between mb-6">
          <h3 class="font-bold text-slate-800 text-lg flex items-center">
            <span class="material-icons mr-2 text-slate-400">history</span> Dernières Activités
          </h3>
          <span class="text-xs text-slate-400 bg-slate-100 px-2 py-1 rounded">Temps réel</span>
        </div>
        
        <div class="relative pl-4 border-l-2 border-slate-100 space-y-6">
          @for (log of activities(); track log.id) {
            <div class="relative pl-6">
              <div class="absolute -left-[21px] top-1 w-8 h-8 rounded-full border-4 border-white flex items-center justify-center shadow-sm"
                   [class.bg-blue-100]="log.action === 'CREATE'"
                   [class.text-blue-600]="log.action === 'CREATE'"
                   [class.bg-orange-100]="log.action === 'UPDATE'"
                   [class.text-orange-600]="log.action === 'UPDATE'"
                   [class.bg-red-100]="log.action === 'DELETE'"
                   [class.text-red-600]="log.action === 'DELETE'"
                   [class.bg-emerald-100]="log.action === 'PAYMENT'"
                   [class.text-emerald-600]="log.action === 'PAYMENT'">
                <span class="material-icons text-sm">
                  {{ getIcon(log.action) }}
                </span>
              </div>

              <div>
                <p class="text-sm font-bold text-slate-800">
                  {{ log.description }}
                </p>
                <div class="flex items-center gap-2 mt-1">
                  <span class="text-xs text-slate-500 bg-slate-50 px-2 py-0.5 rounded border border-slate-200">
                    {{ log.userEmail }}
                  </span>
                  <span class="text-xs text-slate-400">
                    {{ log.timestamp | date:'dd/MM/yyyy HH:mm' }}
                  </span>
                </div>
              </div>
            </div>
          } @empty {
            <p class="text-slate-400 text-sm italic pl-6">Aucune activité enregistrée.</p>
          }
        </div>
      </div>
    </div>
  `
})
export class DashboardComponent {
  private reservationService = inject(ReservationService);
  private activityService = inject(ActivityService);
  
  // Data
  reservations = toSignal(this.reservationService.getAll(), { initialValue: [] });
  activities = toSignal(this.activityService.getLatest(15), { initialValue: [] });

  // Stats Logic
  stats = computed(() => {
    const list = this.reservations();
    let totalCA = 0;
    let totalCollected = 0;
    list.forEach(r => {
      const res = r as any; 
      totalCA += Number(res.totalPrice) || 0;
      totalCollected += Number(res.advance) || 0;
    });
    return {
      count: list.length,
      totalCA,
      totalCollected,
      pending: totalCA - totalCollected,
      percentCollected: totalCA > 0 ? (totalCollected / totalCA) * 100 : 0
    };
  });

  // Helpers UI
  getIcon(action: string): string {
    switch(action) {
      case 'CREATE': return 'add';
      case 'UPDATE': return 'edit';
      case 'DELETE': return 'delete';
      case 'PAYMENT': return 'attach_money';
      default: return 'info';
    }
  }
}
EOF

# ==============================================================================
# ÉTAPE 3 : INSTRUMENTATION DES SERVICES (AUTO-LOGGING)
# ==============================================================================
log_info "Injection du Logger dans les Services CRUD..."

# 1. CLIENT SERVICE
cat <<'EOF' > src/app/core/services/client.service.ts
import { Injectable, inject } from '@angular/core';
import { FirestoreCrudService } from './firestore-crud.service';
import { Client } from '../models/client.model';
import { ActivityService } from './activity.service';

@Injectable({ providedIn: 'root' })
export class ClientService extends FirestoreCrudService<Client> {
  protected collectionName = 'clients';
  private logger = inject(ActivityService);

  override async add(item: Client): Promise<any> {
    const docRef = await super.add(item);
    this.logger.log('CREATE', 'CLIENT', `Nouveau client : ${item.nom}`);
    return docRef;
  }

  override async update(id: string, item: Partial<Client>): Promise<void> {
    await super.update(id, item);
    this.logger.log('UPDATE', 'CLIENT', `Mise à jour client : ${item.nom || 'ID ' + id}`);
  }

  override async delete(id: string): Promise<void> {
    await super.delete(id);
    this.logger.log('DELETE', 'CLIENT', `Suppression client (ID: ${id})`);
  }
}
EOF

# 2. STAFF SERVICE
cat <<'EOF' > src/app/core/services/staff.service.ts
import { Injectable, inject } from '@angular/core';
import { FirestoreCrudService } from './firestore-crud.service';
import { ServerStaff } from '../models/staff.model';
import { ActivityService } from './activity.service';

@Injectable({ providedIn: 'root' })
export class StaffService extends FirestoreCrudService<ServerStaff> {
  protected collectionName = 'users';
  private logger = inject(ActivityService);

  override async add(item: ServerStaff): Promise<any> {
    const docRef = await super.add(item);
    this.logger.log('CREATE', 'STAFF', `Nouveau membre : ${item.nom} (${item.role})`);
    return docRef;
  }

  override async update(id: string, item: Partial<ServerStaff>): Promise<void> {
    await super.update(id, item);
    this.logger.log('UPDATE', 'STAFF', `Mise à jour staff : ${item.nom || id}`);
  }

  override async delete(id: string): Promise<void> {
    await super.delete(id);
    this.logger.log('DELETE', 'STAFF', `Suppression membre staff (ID: ${id})`);
  }
}
EOF

# 3. RESERVATION SERVICE (Attention aux détails)
cat <<'EOF' > src/app/core/services/reservation.service.ts
import { Injectable, inject } from '@angular/core';
import { FirestoreCrudService } from './firestore-crud.service';
import { Reservation } from '../models/reservation.model';
import { where, QueryConstraint } from '@angular/fire/firestore';
import { Observable } from 'rxjs';
import { ActivityService } from './activity.service';

@Injectable({ providedIn: 'root' })
export class ReservationService extends FirestoreCrudService<Reservation> {
  protected collectionName = 'reservations';
  private logger = inject(ActivityService);

  override async add(item: Reservation): Promise<any> {
    const docRef = await super.add(item);
    this.logger.log('CREATE', 'RESERVATION', `Nouvelle réservation : ${item.clientName} le ${item.date}`);
    return docRef;
  }

  override async update(id: string, item: Partial<Reservation>): Promise<void> {
    await super.update(id, item);
    // On ne loggue ici que les modifs génériques. 
    // Les paiements spécifiques sont gérés par le composant pour avoir un message précis.
    if (!(item as any).advanceOnly) {
       this.logger.log('UPDATE', 'RESERVATION', `Modification réservation ID: ${id}`);
    }
  }

  override async delete(id: string): Promise<void> {
    await super.delete(id);
    this.logger.log('DELETE', 'RESERVATION', `Suppression réservation ID: ${id}`);
  }

  getByDate(dateStr: string): Observable<Reservation[]> {
    return super.getAll([where('date', '==', dateStr)]);
  }

  getRange(startDate: string, endDate: string): Observable<Reservation[]> {
    return super.getAll([where('date', '>=', startDate), where('date', '<=', endDate)]);
  }
}
EOF

# ==============================================================================
# ÉTAPE 4 : LOGGING DES PAIEMENTS (DANS CALENDAR VIEW)
# ==============================================================================
log_info "Ajout du logging Paiement dans CalendarView..."

# Note : On doit injecter ActivityService et appeler log('PAYMENT') dans submitPayment
# Je réécris le composant CalendarView (c'est la version finale qui contient Secure Delete + Staff Assign + Payment + LOGGING)

cat <<'EOF' > src/app/features/calendar/calendar-view/calendar-view.component.ts
import { Component, inject, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReservationService } from '../../../core/services/reservation.service';
import { AuthService } from '../../../core/services/auth.service';
import { StaffService } from '../../../core/services/staff.service';
import { ActivityService } from '../../../core/services/activity.service'; // <--- NEW
import { RouterLink, Router } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { startOfMonth, endOfMonth, startOfWeek, endOfWeek, format, addMonths, subMonths, eachDayOfInterval, isSameMonth, isSameDay, isToday } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Reservation } from '../../../core/models/reservation.model';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-calendar-view',
  standalone: true,
  imports: [CommonModule, RouterLink, FormsModule],
  template: `
    <div class="p-6 bg-white min-h-screen flex flex-col">
      <div class="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
        <div class="flex items-center gap-4">
          <button (click)="previousMonth()" class="p-2 rounded-full hover:bg-gray-100 border transition"><span class="material-icons text-gray-600">chevron_left</span></button>
          <h2 class="text-2xl font-bold text-slate-800 capitalize min-w-[200px] text-center">{{ currentMonthLabel() }}</h2>
          <button (click)="nextMonth()" class="p-2 rounded-full hover:bg-gray-100 border transition"><span class="material-icons text-gray-600">chevron_right</span></button>
        </div>
        <div class="flex items-center gap-3">
          <button (click)="goToToday()" class="px-3 py-1 text-sm border rounded hover:bg-gray-50 text-gray-600">Aujourd'hui</button>
          <a routerLink="/reservations/new" class="bg-blue-600 text-white px-4 py-2 rounded shadow hover:bg-blue-700 transition flex items-center"><span class="material-icons text-sm mr-2">add</span> Réservation</a>
        </div>
      </div>

      <div class="flex-1 border rounded-lg overflow-hidden bg-slate-50 flex flex-col">
        <div class="grid grid-cols-7 bg-white border-b">
          @for (day of weekDays; track day) { <div class="py-2 text-center text-sm font-semibold text-slate-500 uppercase">{{ day }}</div> }
        </div>
        <div class="grid grid-cols-7 flex-1 auto-rows-fr">
          @for (day of calendarDays(); track day) {
            <div class="min-h-[120px] bg-white border-b border-r p-1 relative flex flex-col" [class.bg-blue-50]="isToday(day)" [class.bg-slate-50]="!isCurrentMonth(day)">
              <div class="text-right text-xs mb-1 font-medium" [class.text-blue-600]="isToday(day)" [class.text-slate-400]="!isCurrentMonth(day)">{{ day | date:'d' }}</div>
              <div class="flex-1 overflow-y-auto space-y-1 custom-scrollbar">
                @for (res of getReservationsForDay(day); track res.id) {
                  <div (click)="openDetails(res)" class="text-[10px] p-1.5 rounded border-l-4 shadow-sm cursor-pointer truncate bg-white hover:brightness-95 transition"
                       [class.border-green-500]="res.status === 'CONFIRMED'" [class.border-yellow-500]="res.status === 'PENDING'" [class.border-red-500]="res.status === 'CANCELLED'">
                    <span class="font-bold">{{ res.startTime }}</span> {{ res.clientName }}
                  </div>
                }
              </div>
            </div>
          }
        </div>
      </div>
    </div>

    @if (selectedReservation()) {
      <div class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-fade-in" (click)="closeDetails()">
        <div class="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]" (click)="$event.stopPropagation()">
          <div class="bg-gradient-to-r from-slate-800 to-slate-900 px-6 py-4 flex justify-between items-center text-white shrink-0">
            <div><h3 class="font-bold text-xl">{{ selectedReservation()?.clientName }}</h3><p class="text-slate-400 text-xs mt-1">{{ selectedReservation()?.date | date:'fullDate' }}</p></div>
            <button (click)="closeDetails()" class="text-slate-400 hover:text-white"><span class="material-icons">close</span></button>
          </div>
          <div class="p-6 space-y-6 overflow-y-auto custom-scrollbar">
             <div class="bg-purple-50 p-4 rounded-xl border border-purple-100 shadow-sm">
               <div class="flex justify-between items-center mb-3 border-b border-purple-200 pb-2">
                 <span class="text-xs font-bold text-purple-700 uppercase tracking-wider">Trésorerie</span>
                 <button (click)="openPayment()" class="text-purple-600 hover:bg-purple-100 p-1 rounded transition" title="Ajouter paiement"><span class="material-icons text-sm">add</span></button>
               </div>
               <div class="grid grid-cols-3 gap-2 text-center">
                 <div><p class="text-[10px] text-slate-500 uppercase">Total</p><p class="font-bold text-slate-800">{{ getResPrice(selectedReservation()) }} DT</p></div>
                 <div><p class="text-[10px] text-slate-500 uppercase">Reçu</p><p class="font-bold text-emerald-600">{{ getResAdvance(selectedReservation()) }} DT</p></div>
                 <div><p class="text-[10px] text-slate-500 uppercase">Reste</p><p class="font-bold text-red-500">{{ (getResPrice(selectedReservation()) - getResAdvance(selectedReservation())) }} DT</p></div>
               </div>
             </div>
             <div>
               <div class="flex items-center justify-between mb-3">
                 <h4 class="text-xs font-bold text-slate-500 uppercase tracking-wider">Affectation Équipe</h4>
                 <span class="text-xs bg-slate-100 px-2 py-1 rounded text-slate-600 font-bold">{{ (selectedReservation()?.assignedServerIds || []).length }} membres</span>
               </div>
               <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
                 @for (staff of allStaff(); track staff.id) {
                   <div (click)="toggleStaffAssignment(staff.id!)" class="flex items-center p-2 rounded-lg border cursor-pointer select-none transition-all duration-200 hover:shadow-sm"
                        [class.border-emerald-500]="isStaffAssigned(staff.id!)" [class.bg-emerald-50]="isStaffAssigned(staff.id!)" [class.border-slate-200]="!isStaffAssigned(staff.id!)">
                     <div class="w-6 h-6 rounded-full flex items-center justify-center text-[10px] mr-2 transition-colors"
                          [class.bg-emerald-500]="isStaffAssigned(staff.id!)" [class.text-white]="isStaffAssigned(staff.id!)" [class.bg-slate-200]="!isStaffAssigned(staff.id!)" [class.text-slate-400]="!isStaffAssigned(staff.id!)">
                        @if(isStaffAssigned(staff.id!)){ <span class="material-icons text-[14px]">check</span> }
                     </div>
                     <div class="flex-1 min-w-0">
                       <p class="text-sm font-bold truncate" [class.text-emerald-900]="isStaffAssigned(staff.id!)">{{ staff.nom }}</p>
                       <p class="text-[10px] truncate" [class.text-emerald-700]="isStaffAssigned(staff.id!)" [class.text-slate-500]="!isStaffAssigned(staff.id!)">{{ staff.specialite }}</p>
                     </div>
                   </div>
                 }
               </div>
             </div>
          </div>
          <div class="bg-slate-50 px-6 py-4 border-t border-slate-200 flex justify-between shrink-0">
            <button (click)="initiateDelete()" class="text-red-500 hover:bg-red-50 px-3 py-2 rounded text-sm font-bold transition flex items-center"><span class="material-icons text-sm mr-2">delete</span> Supprimer</button>
            <button (click)="editCurrent()" class="bg-slate-800 hover:bg-slate-700 text-white px-5 py-2 rounded text-sm font-bold transition flex items-center"><span class="material-icons text-sm mr-2">edit</span> Éditer tout</button>
          </div>
        </div>
      </div>
    }

    @if (showPaymentModal()) {
      <div class="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm animate-fade-in">
        <div class="bg-white rounded-xl shadow-2xl p-6 w-72">
          <h3 class="font-bold text-lg mb-4 text-center">Ajouter Paiement</h3>
          <div class="mb-4"><input type="number" [(ngModel)]="amountToAdd" class="w-full text-center text-3xl font-bold border-b-2 border-emerald-500 outline-none pb-2 text-slate-800" placeholder="0"><p class="text-center text-xs text-slate-400 mt-1">Montant en TND</p></div>
          <div class="flex gap-2"><button (click)="closePayment()" class="flex-1 py-2 border rounded text-slate-600 hover:bg-slate-50">Annuler</button><button (click)="submitPayment()" class="flex-1 py-2 bg-emerald-600 text-white rounded font-bold hover:bg-emerald-700">Valider</button></div>
        </div>
      </div>
    }

    @if (showDeleteModal()) {
      <div class="fixed inset-0 z-[70] flex items-center justify-center bg-red-900/80 backdrop-blur-sm animate-fade-in">
        <div class="bg-white rounded-xl shadow-2xl p-8 w-96 transform scale-100">
          <div class="flex flex-col items-center mb-6"><div class="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4"><span class="material-icons text-red-600 text-3xl">gpp_maybe</span></div><h3 class="font-bold text-xl text-slate-800 text-center">Zone de Danger</h3><p class="text-sm text-slate-500 text-center mt-2">Vous êtes sur le point de supprimer définitivement cette réservation.</p></div>
          <div class="space-y-4"><div><label class="block text-xs font-bold text-slate-700 uppercase mb-1">Mot de passe Admin</label><input type="password" [(ngModel)]="deletePassword" class="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-red-500 outline-none transition" placeholder="••••••••" (keyup.enter)="confirmDelete()">@if (deleteError()) { <p class="text-xs text-red-600 mt-1 flex items-center animate-pulse"><span class="material-icons text-xs mr-1">error</span> Mot de passe incorrect</p> }</div><button (click)="confirmDelete()" [disabled]="isDeleting()" class="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-3 rounded-lg shadow-lg transition flex justify-center items-center disabled:opacity-70 disabled:cursor-not-allowed">@if (isDeleting()) { <span class="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full mr-2"></span> } Confirmer la suppression</button><button (click)="closeDeleteModal()" class="w-full text-slate-500 hover:text-slate-800 font-medium py-2">Annuler</button></div>
        </div>
      </div>
    }
  `,
  styles: [`
    .custom-scrollbar::-webkit-scrollbar { width: 4px; }
    .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
    .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 2px; }
    @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
    .animate-fade-in { animation: fadeIn 0.2s ease-out; }
  `]
})
export class CalendarViewComponent {
  private reservationService = inject(ReservationService);
  private staffService = inject(StaffService);
  private activityService = inject(ActivityService); // <--- LOGGING
  private router = inject(Router);
  authService = inject(AuthService);

  viewDate = signal(new Date());
  weekDays = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
  reservations = toSignal(this.reservationService.getAll(), { initialValue: [] });
  allStaff = toSignal(this.staffService.getAll(), { initialValue: [] });
  selectedReservation = signal<Reservation | null>(null);

  showPaymentModal = signal(false);
  amountToAdd = 0;
  showDeleteModal = signal(false);
  deletePassword = signal('');
  deleteError = signal(false);
  isDeleting = signal(false);

  // --- ACTIONS ---
  openDetails(res: Reservation) { this.selectedReservation.set(res); }
  closeDetails() { this.selectedReservation.set(null); }
  editCurrent() { const res = this.selectedReservation(); if (res?.id) this.router.navigate(['/reservations/edit', res.id]); }
  
  initiateDelete() { this.deletePassword.set(''); this.deleteError.set(false); this.showDeleteModal.set(true); }
  closeDeleteModal() { this.showDeleteModal.set(false); }
  async confirmDelete() {
    if (!this.deletePassword()) return;
    this.isDeleting.set(true);
    this.deleteError.set(false);
    const isValid = await this.authService.verifyPassword(this.deletePassword());
    if (isValid) {
      const res = this.selectedReservation();
      if (res && res.id) {
        await this.reservationService.delete(res.id);
        this.closeDeleteModal();
        this.closeDetails();
      }
    } else { this.deleteError.set(true); }
    this.isDeleting.set(false);
  }

  isStaffAssigned(staffId: string): boolean { const res = this.selectedReservation(); if (!res || !res.assignedServerIds) return false; return res.assignedServerIds.includes(staffId); }
  async toggleStaffAssignment(staffId: string) { const res = this.selectedReservation(); if (!res || !res.id) return; const currentIds = res.assignedServerIds || []; let newIds = currentIds.includes(staffId) ? currentIds.filter(id => id !== staffId) : [...currentIds, staffId]; await this.reservationService.update(res.id, { assignedServerIds: newIds } as any); this.selectedReservation.update(prev => { if (!prev) return null; return { ...prev, assignedServerIds: newIds }; }); }
  
  getResPrice(res: any) { return Number(res?.totalPrice) || 0; }
  getResAdvance(res: any) { return Number(res?.advance) || 0; }
  openPayment() { this.amountToAdd = 0; this.showPaymentModal.set(true); }
  closePayment() { this.showPaymentModal.set(false); }
  
  async submitPayment() { 
    const res = this.selectedReservation(); 
    if (res && this.amountToAdd > 0) { 
      const newAdvance = this.getResAdvance(res) + this.amountToAdd; 
      // Flag advanceOnly pour éviter le double log générique
      await this.reservationService.update(res.id!, { advance: newAdvance, advanceOnly: true } as any);
      
      // LOGGING EXPLICTE DU PAIEMENT
      this.activityService.log('PAYMENT', 'RESERVATION', `Paiement reçu : ${this.amountToAdd} TND (Client: ${res.clientName})`);

      this.closePayment(); 
      this.selectedReservation.update(prev => { if (!prev) return null; return { ...prev, advance: newAdvance } as any; }); 
    } 
  }

  nextMonth() { this.viewDate.update(d => addMonths(d, 1)); }
  previousMonth() { this.viewDate.update(d => subMonths(d, 1)); }
  goToToday() { this.viewDate.set(new Date()); }
  currentMonthLabel = computed(() => format(this.viewDate(), 'MMMM yyyy', { locale: fr }));
  calendarDays = computed(() => eachDayOfInterval({ start: startOfWeek(startOfMonth(this.viewDate()), { weekStartsOn: 1 }), end: endOfWeek(endOfMonth(this.viewDate()), { weekStartsOn: 1 }) }));
  isToday(d: Date) { return isToday(d); }
  isCurrentMonth(d: Date) { return isSameMonth(d, this.viewDate()); }
  getReservationsForDay(date: Date): Reservation[] { return this.reservations().filter(r => r.date === format(date, 'yyyy-MM-dd')); }
}
EOF

log_success "Logging global activé sur toutes les opérations !"
echo -e "${COLOR_INFO}👉 Va dans Dashboard : Tu verras la liste vide. Crée une résa ou ajoute un staff, ça apparaîtra.${COLOR_RESET}"