import { Component, inject, computed, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReservationService } from '../../core/services/reservation.service';
import { ActivityService } from '../../core/services/activity.service';
import { toSignal } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { ActivityLog } from '../../core/models/activity.model';
import { DocumentSnapshot } from '@angular/fire/firestore';

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
          <div class="relative z-10"><p class="text-purple-200 text-sm font-medium uppercase tracking-wider mb-1">Chiffre d'Affaires</p><h3 class="text-3xl font-bold">{{ stats().totalCA | number:'1.0-2' }} <span class="text-lg opacity-70">TND</span></h3><p class="text-xs text-purple-200 mt-2 opacity-80">Sur {{ stats().count }} réservations</p></div><span class="material-icons absolute bottom-4 right-4 text-white opacity-20 text-6xl">savings</span>
        </div>
        <div class="bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl p-6 text-white shadow-lg relative overflow-hidden">
          <div class="absolute top-0 right-0 -mt-4 -mr-4 w-24 h-24 bg-white opacity-10 rounded-full blur-xl"></div>
          <div class="relative z-10"><p class="text-emerald-100 text-sm font-medium uppercase tracking-wider mb-1">Trésorerie (Reçu)</p><h3 class="text-3xl font-bold">{{ stats().totalCollected | number:'1.0-2' }} <span class="text-lg opacity-70">TND</span></h3><div class="w-full bg-black/20 h-1.5 rounded-full mt-3 overflow-hidden"><div class="bg-white h-full rounded-full" [style.width.%]="stats().percentCollected"></div></div><p class="text-xs text-emerald-100 mt-1">{{ stats().percentCollected | number:'1.0-0' }}% du total</p></div><span class="material-icons absolute bottom-4 right-4 text-white opacity-20 text-6xl">payments</span>
        </div>
        <div class="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm relative">
          <p class="text-slate-500 text-sm font-medium uppercase tracking-wider mb-1">Reste à Percevoir</p><h3 class="text-3xl font-bold text-slate-800">{{ stats().pending | number:'1.0-2' }} <span class="text-lg text-slate-400">TND</span></h3><p class="text-xs text-slate-400 mt-2">Solde restant des clients</p><span class="material-icons absolute bottom-4 right-4 text-slate-100 text-6xl">account_balance_wallet</span>
        </div>
      </div>

      <div class="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
        <div class="flex items-center justify-between mb-6">
          <h3 class="font-bold text-slate-800 text-lg flex items-center">
            <span class="material-icons mr-2 text-slate-400">history</span> Dernières Activités
          </h3>
          <span class="text-xs text-slate-400 bg-slate-100 px-2 py-1 rounded">Temps réel</span>
        </div>
        
        <div class="relative pl-4 border-l-2 border-slate-100 space-y-8">
          @for (log of loadedActivities(); track log.id) {
            <div class="relative pl-6 group">
              <div class="absolute -left-[21px] top-1 w-8 h-8 rounded-full border-4 border-white flex items-center justify-center shadow-sm z-10"
                   [class.bg-blue-100]="log.action === 'CREATE'" [class.text-blue-600]="log.action === 'CREATE'"
                   [class.bg-orange-100]="log.action === 'UPDATE'" [class.text-orange-600]="log.action === 'UPDATE'"
                   [class.bg-red-100]="log.action === 'DELETE'" [class.text-red-600]="log.action === 'DELETE'"
                   [class.bg-emerald-100]="log.action === 'PAYMENT'" [class.text-emerald-600]="log.action === 'PAYMENT'">
                <span class="material-icons text-sm">{{ getIcon(log.action) }}</span>
              </div>

              <div class="bg-slate-50/50 p-3 rounded-lg hover:bg-slate-50 transition border border-transparent hover:border-slate-200 cursor-pointer" (click)="viewDetails(log)">
                <div class="flex justify-between items-start">
                  <div>
                    <p class="text-sm font-bold text-slate-800">{{ log.description }}</p>
                    <div class="flex items-center gap-2 mt-1">
                      <span class="text-xs text-slate-500 bg-white px-2 py-0.5 rounded border border-slate-200 shadow-sm">{{ log.userEmail }}</span>
                      <span class="text-xs text-slate-400">{{ log.timestamp | date:'dd/MM/yyyy HH:mm' }}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          } @empty {
            <p class="text-slate-400 text-sm italic pl-6">Aucune activité enregistrée.</p>
          }
        </div>

        @if (hasMore) {
          <div class="mt-8 text-center">
            <button (click)="loadMore()" [disabled]="isLoading" class="bg-slate-100 hover:bg-slate-200 text-slate-600 px-6 py-2 rounded-full text-sm font-bold shadow-sm transition flex items-center justify-center mx-auto disabled:opacity-50">
              @if(isLoading) { <span class="animate-spin h-4 w-4 border-2 border-slate-400 border-t-transparent rounded-full mr-2"></span> }
              👇 Charger plus d'activités
            </button>
          </div>
        }
      </div>
    </div>

    @if (selectedLog()) {
      <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-fade-in" (click)="closeDetails()">
        <div class="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col max-h-[90vh]" (click)="$event.stopPropagation()">
          
          <div class="bg-slate-800 px-6 py-4 flex justify-between items-center text-white shrink-0">
            <h3 class="font-bold flex items-center"><span class="material-icons mr-2">info</span> Détails Activité</h3>
            <button (click)="closeDetails()" class="text-slate-400 hover:text-white transition"><span class="material-icons">close</span></button>
          </div>

          <div class="p-6 space-y-5 overflow-y-auto">
            <div><p class="text-xs font-bold text-slate-500 uppercase mb-1">Description</p><p class="text-sm font-medium text-slate-800 bg-slate-50 p-2 rounded border border-slate-100">{{ selectedLog()?.description }}</p></div>
            <div class="grid grid-cols-2 gap-4"><div><p class="text-xs font-bold text-slate-500 uppercase mb-1">Action</p><span class="px-2 py-1 rounded text-xs font-bold inline-block bg-slate-200">{{ selectedLog()?.action }}</span></div><div><p class="text-xs font-bold text-slate-500 uppercase mb-1">Entité</p><p class="text-sm font-bold text-slate-700">{{ selectedLog()?.entity }}</p></div></div>
            <div><p class="text-xs font-bold text-slate-500 uppercase mb-1">Utilisateur</p><p class="text-sm text-slate-700">{{ selectedLog()?.userEmail }}</p></div>
            <div class="bg-slate-50 p-3 rounded border border-slate-200 font-mono text-[10px] text-slate-600 overflow-auto max-h-32"><pre>{{ selectedLog()?.metadata | json }}</pre></div>
          </div>

          <div class="bg-slate-50 px-6 py-4 border-t border-slate-200 flex justify-end gap-3 shrink-0">
            <button (click)="closeDetails()" class="px-4 py-2 border border-slate-300 rounded-lg text-slate-600 hover:bg-slate-100 font-medium text-sm transition">
              Fermer
            </button>
            
            @if (canEdit(selectedLog()!)) {
              <button (click)="goToEdit(selectedLog()!)" class="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold text-sm shadow transition flex items-center">
                <span class="material-icons text-sm mr-2">edit</span> Modifier l'élément
              </button>
            }
          </div>

        </div>
      </div>
    }
  `,
  styles: [` @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } } .animate-fade-in { animation: fadeIn 0.2s ease-out; } `]
})
export class DashboardComponent implements OnInit {
  private reservationService = inject(ReservationService);
  private activityService = inject(ActivityService);
  private router = inject(Router);
  
  reservations = toSignal(this.reservationService.getAll(), { initialValue: [] });
  
  loadedActivities = signal<ActivityLog[]>([]);
  lastDoc: DocumentSnapshot | null = null;
  isLoading = false;
  hasMore = true;
  readonly PAGE_SIZE = 10;

  selectedLog = signal<ActivityLog | null>(null);

  ngOnInit() { this.loadMore(); }

  async loadMore() {
    if (this.isLoading) return;
    this.isLoading = true;
    try {
      const result = await this.activityService.getPaginated(this.PAGE_SIZE, this.lastDoc);
      this.loadedActivities.update(current => [...current, ...result.data]);
      this.lastDoc = result.lastDoc;
      if (result.data.length < this.PAGE_SIZE) this.hasMore = false;
    } catch (err) { console.error(err); } finally { this.isLoading = false; }
  }

  stats = computed(() => {
    const list = this.reservations();
    let totalCA = 0, totalCollected = 0;
    list.forEach(r => { const res = r as any; totalCA += Number(res.totalPrice) || 0; totalCollected += Number(res.advance) || 0; });
    return { count: list.length, totalCA, totalCollected, pending: totalCA - totalCollected, percentCollected: totalCA > 0 ? (totalCollected / totalCA) * 100 : 0 };
  });

  getIcon(action: string): string { switch(action) { case 'CREATE': return 'add'; case 'UPDATE': return 'edit'; case 'DELETE': return 'delete'; case 'PAYMENT': return 'attach_money'; default: return 'info'; } }
  
  viewDetails(log: ActivityLog) { this.selectedLog.set(log); }
  closeDetails() { this.selectedLog.set(null); }

  canEdit(log: ActivityLog): boolean {
    if (!log || log.action === 'DELETE') return false;
    // Le bouton ne s'affichera que si l'ID est présent dans les métadonnées
    return !!log.metadata?.id;
  }

  goToEdit(log: ActivityLog) {
    const id = log.metadata?.id;
    if (!id) return;
    this.closeDetails();

    switch (log.entity) {
      case 'RESERVATION': this.router.navigate(['/reservations/edit', id]); break;
      case 'CLIENT': this.router.navigate(['/admin/clients/edit', id]); break;
      case 'STAFF': this.router.navigate(['/admin/serveurs/edit', id]); break;
      case 'CONFIG': this.router.navigate(['/admin/config']); break;
    }
  }
}
