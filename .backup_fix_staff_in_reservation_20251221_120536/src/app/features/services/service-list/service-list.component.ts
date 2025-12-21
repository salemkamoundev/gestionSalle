import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { toSignal } from '@angular/core/rxjs-interop';
import { ServiceCatalogService } from '../../../core/services/service-catalog.service';
import { UiService } from '../../../core/services/ui.service';
import { ServiceCatalog } from '../../../core/models/service-catalog.model';

@Component({
  selector: 'app-service-list',
  standalone: true,
  imports: [CommonModule, RouterLink, FormsModule],
  template: `
    <div class="max-w-7xl mx-auto space-y-6">
      <div class="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 class="text-2xl font-bold text-slate-800 flex items-center">
            <span class="material-icons mr-3 text-slate-400">design_services</span>
            Catalogue des Services
          </h1>
          <p class="text-slate-500 mt-1">Ces services alimentent les suggestions dans les formulaires Équipe & Pack.</p>
        </div>

        <div class="flex gap-3 w-full md:w-auto">
          <div class="relative flex-1 md:w-64">
            <span class="material-icons absolute left-3 top-2.5 text-slate-400 text-sm">search</span>
            <input type="text"
              [(ngModel)]="searchQuery"
              placeholder="Rechercher (nom / description)"
              class="w-full pl-9 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none text-sm"
              (ngModelChange)="page.set(1)">
          </div>
          <a routerLink="/admin/services/new"
             class="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg font-medium shadow transition flex items-center whitespace-nowrap">
            <span class="material-icons text-sm mr-2">add</span> Nouveau Service
          </a>
        </div>
      </div>

      <div class="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div class="overflow-x-auto">
          <table class="w-full text-left">
            <thead class="bg-slate-50 border-b border-slate-200">
              <tr>
                <th class="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Nom</th>
                <th class="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Prix défaut</th>
                <th class="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Actif</th>
                <th class="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider text-right">Actions</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100">
              @for (s of paginated(); track s.id) {
                <tr class="hover:bg-slate-50">
                  <td class="px-6 py-4">
                    <div class="font-semibold text-slate-800">{{ s.nom }}</div>
                    @if (s.description) { <div class="text-xs text-slate-500 mt-0.5 line-clamp-2">{{ s.description }}</div> }
                  </td>
                  <td class="px-6 py-4 font-mono text-right">
                    {{ (s.prix ?? 0) | number:'1.0-2' }} TND
                  </td>
                  <td class="px-6 py-4">
                    <span class="inline-flex items-center px-2 py-1 rounded-full text-[11px] font-bold"
                      [class.bg-green-100]="s.active !== false"
                      [class.text-green-700]="s.active !== false"
                      [class.bg-slate-200]="s.active === false"
                      [class.text-slate-600]="s.active === false">
                      {{ s.active === false ? 'INACTIF' : 'ACTIF' }}
                    </span>
                  </td>
                  <td class="px-6 py-4">
                    <div class="flex justify-end gap-2">
                      <button (click)="edit(s)" class="px-3 py-1.5 text-xs rounded-lg bg-slate-100 hover:bg-slate-200 font-semibold flex items-center">
                        <span class="material-icons text-sm mr-1">edit</span> Modifier
                      </button>
                      <button (click)="remove(s)" class="px-3 py-1.5 text-xs rounded-lg bg-red-50 text-red-700 hover:bg-red-100 font-semibold flex items-center">
                        <span class="material-icons text-sm mr-1">delete</span> Supprimer
                      </button>
                    </div>
                  </td>
                </tr>
              }
              @if (filtered().length === 0) {
                <tr><td colspan="4" class="px-6 py-10 text-center text-slate-400 italic">Aucun service trouvé.</td></tr>
              }
            </tbody>
          </table>
        </div>

        @if (totalPages() > 1) {
          <div class="flex items-center justify-between px-6 py-4 border-t bg-slate-50">
            <p class="text-xs text-slate-500">Page {{ page() }} / {{ totalPages() }}</p>
            <div class="flex gap-2">
              <button (click)="prev()" [disabled]="page() === 1"
                class="px-3 py-1.5 text-xs rounded-lg border bg-white hover:bg-slate-100 disabled:opacity-50">
                Précédent
              </button>
              <button (click)="next()" [disabled]="page() === totalPages()"
                class="px-3 py-1.5 text-xs rounded-lg border bg-white hover:bg-slate-100 disabled:opacity-50">
                Suivant
              </button>
            </div>
          </div>
        }
      </div>
    </div>
  `
})
export class ServiceListComponent {
  private router = inject(Router);
  private service = inject(ServiceCatalogService);
  private ui = inject(UiService);

  searchQuery = '';
  page = signal(1);
  pageSize = 10;

  raw = toSignal(this.service.getAll(), { initialValue: [] as ServiceCatalog[] });

  filtered = computed(() => {
    const q = (this.searchQuery || '').trim().toLowerCase();
    const all = this.raw();
    if (!q) return all;
    return all.filter(s =>
      (s.nom || '').toLowerCase().includes(q) ||
      (s.description || '').toLowerCase().includes(q)
    );
  });

  totalPages = computed(() => Math.max(1, Math.ceil(this.filtered().length / this.pageSize)));

  paginated = computed(() => {
    const p = Math.min(this.page(), this.totalPages());
    const start = (p - 1) * this.pageSize;
    return this.filtered().slice(start, start + this.pageSize);
  });

  next() { this.page.set(Math.min(this.page() + 1, this.totalPages())); }
  prev() { this.page.set(Math.max(1, this.page() - 1)); }

  edit(s: ServiceCatalog) {
    if (!s.id) return;
    this.router.navigate(['/admin/services/edit', s.id]);
  }

  async remove(s: ServiceCatalog) {
    if (!s.id) return;
    const ok = await this.ui.confirm(
      'Supprimer le service ?',
      `Attention, vous allez supprimer "${s.nom}".`,
      'Supprimer',
      'Annuler'
    );
    if (!ok) return;

    try {
      await this.service.delete(s.id);
      this.ui.showToast('success', 'Service supprimé');
    } catch {
      this.ui.showToast('error', 'Erreur lors de la suppression');
    }
  }
}