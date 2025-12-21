import { Component, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { toSignal } from '@angular/core/rxjs-interop';

import { PackService } from '../../../core/services/pack.service';
import { UiService } from '../../../core/services/ui.service';
import { Pack } from '../../../core/models/pack.model';

@Component({
  selector: 'app-pack-list',
  standalone: true,
  imports: [CommonModule, RouterLink, FormsModule],
  template: `
    <div class="max-w-7xl mx-auto space-y-6">
      <div class="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 class="text-2xl font-bold text-slate-800 flex items-center">
            <span class="material-icons mr-3 text-slate-400">local_offer</span>
            Packs
          </h1>
          <p class="text-slate-500 mt-1">Gestion des packs (services + staff + équipes).</p>
        </div>

        <div class="flex gap-3 w-full md:w-auto">
          <div class="relative flex-1 md:w-64">
            <span class="material-icons absolute left-3 top-2.5 text-slate-400 text-sm">search</span>
            <input
              type="text"
              [(ngModel)]="searchQuery"
              placeholder="Nom du pack..."
              class="w-full pl-9 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none text-sm"
            />
          </div>

          <a routerLink="/admin/packs/new"
             class="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg font-medium shadow transition flex items-center whitespace-nowrap">
            <span class="material-icons text-sm mr-2">add</span> Nouveau Pack
          </a>
        </div>
      </div>

      <div class="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div class="overflow-x-auto">
          <table class="w-full text-left">
            <thead class="bg-slate-50 border-b border-slate-200">
              <tr>
                <th class="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Nom</th>
                <th class="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Services</th>
                <th class="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Staff</th>
                <th class="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Équipes</th>
                <th class="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider text-right">Actions</th>
              </tr>
            </thead>

            <tbody class="divide-y divide-slate-200">
              @for (p of filteredPacks(); track p.id) {
                <tr class="hover:bg-slate-50">
                  <td class="px-6 py-4">
                    <div class="font-semibold text-slate-800">{{ p.nom }}</div>
                    <div class="text-xs text-slate-500 line-clamp-2">{{ p.description || '' }}</div>
                    <div class="mt-1">
                      @if (p.active) {
                        <span class="text-[11px] bg-green-100 text-green-700 px-2 py-0.5 rounded font-bold">ACTIF</span>
                      } @else {
                        <span class="text-[11px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-bold">INACTIF</span>
                      }
                    </div>
                  </td>

                  <td class="px-6 py-4 text-sm text-slate-700">{{ (p.services?.length || 0) }}</td>
                  <td class="px-6 py-4 text-sm text-slate-700">{{ (p.staffIds?.length || 0) }}</td>
                  <td class="px-6 py-4 text-sm text-slate-700">{{ (p.teamIds?.length || 0) }}</td>

                  <td class="px-6 py-4 text-right">
                    <div class="flex justify-end gap-2">
                      <button (click)="edit(p)"
                        class="px-3 py-1.5 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-100 text-sm font-bold flex items-center">
                        <span class="material-icons text-sm mr-1">edit</span> Modifier
                      </button>

                      <button (click)="remove(p)"
                        class="px-3 py-1.5 rounded-lg border border-red-200 text-red-700 hover:bg-red-50 text-sm font-bold flex items-center">
                        <span class="material-icons text-sm mr-1">delete</span> Supprimer
                      </button>
                    </div>
                  </td>
                </tr>
              }

              @if (filteredPacks().length === 0) {
                <tr>
                  <td colspan="5" class="px-6 py-10 text-center text-slate-400 italic">
                    Aucun pack trouvé.
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `
})
export class PackListComponent {
  private service = inject(PackService);
  private ui = inject(UiService);
  private router = inject(Router);

  searchQuery = '';
  packs = toSignal(this.service.getAll(), { initialValue: [] as Pack[] });

  filteredPacks = computed(() => {
    const q = (this.searchQuery || '').trim().toLowerCase();
    const list = this.packs() || [];
    if (!q) return list;
    return list.filter(p => (p.nom || '').toLowerCase().includes(q));
  });

  edit(p: Pack) {
    this.router.navigate(['/admin/packs/edit', p.id]);
  }

  async remove(p: Pack) {
    const confirmed = await this.ui.confirm(
      'Supprimer le pack ?',
      `Attention, vous allez supprimer "${p.nom}".`,
      'Supprimer',
      'Annuler'
    );

    if (confirmed && p.id) {
      try {
        await this.service.delete(p.id);
        this.ui.showToast('success', 'Pack supprimé');
      } catch {
        this.ui.showToast('error', 'Erreur lors de la suppression');
      }
    }
  }
}
