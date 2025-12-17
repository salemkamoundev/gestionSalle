import { Component, inject, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, Router } from '@angular/router';
import { ClientService } from '../../../core/services/client.service';
import { UiService } from '../../../core/services/ui.service'; // <--- NEW
import { toSignal } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { Client } from '../../../core/models/client.model';

@Component({
  selector: 'app-client-list',
  standalone: true,
  imports: [CommonModule, RouterLink, FormsModule],
  template: `
    <div class="max-w-7xl mx-auto space-y-6">
      
      <div class="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div><h1 class="text-2xl font-bold text-slate-800 flex items-center"><span class="material-icons mr-3 text-slate-400">groups</span> Clients</h1><p class="text-slate-500 mt-1">Base de données contacts ({{ filteredClients().length }})</p></div>
        <div class="flex gap-3 w-full md:w-auto"><div class="relative flex-1 md:w-64"><span class="material-icons absolute left-3 top-2.5 text-slate-400 text-sm">search</span><input type="text" [(ngModel)]="searchQuery" placeholder="Rechercher..." class="w-full pl-9 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm"></div><a routerLink="/admin/clients/new" class="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium shadow transition flex items-center whitespace-nowrap"><span class="material-icons text-sm mr-2">add</span> Nouveau</a></div>
      </div>

      <div class="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div class="overflow-x-auto">
          <table class="w-full text-left">
            <thead class="bg-slate-50 border-b border-slate-200">
              <tr>
                <th class="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Identité</th>
                <th class="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Contact</th>
                <th class="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Adresse</th>
                <th class="px-6 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100">
              @for (client of filteredClients(); track client.id) {
                <tr class="hover:bg-slate-50 transition group">
                  <td class="px-6 py-4"><div class="font-medium text-slate-900">{{ client.nom }}</div><div class="text-xs text-slate-400">Ajouté le {{ client.createdAt | date:'shortDate' }}</div></td>
                  <td class="px-6 py-4"><div class="flex flex-col text-sm text-slate-600"><span class="flex items-center"><span class="material-icons text-[14px] mr-1 text-slate-400">phone</span> {{ client.telephone }}</span>@if(client.email) { <span class="flex items-center mt-1"><span class="material-icons text-[14px] mr-1 text-slate-400">email</span> {{ client.email }}</span> }</div></td>
                  <td class="px-6 py-4 text-slate-600 text-sm max-w-xs truncate">{{ client.adresse || '-' }}</td>
                  <td class="px-6 py-4 text-right">
                    <div class="flex justify-end gap-2">
                      <button (click)="edit(client)" class="text-slate-400 hover:text-blue-600 p-2 rounded-full hover:bg-blue-50 transition" title="Modifier"><span class="material-icons text-lg">edit</span></button>
                      <button (click)="delete(client)" class="text-slate-400 hover:text-red-600 p-2 rounded-full hover:bg-red-50 transition" title="Supprimer"><span class="material-icons text-lg">delete</span></button>
                    </div>
                  </td>
                </tr>
              } @empty { <tr><td colspan="4" class="px-6 py-12 text-center"><div class="flex flex-col items-center justify-center text-slate-400"><span class="material-icons text-4xl mb-2">search_off</span><p>Aucun client trouvé.</p></div></td></tr> }
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `
})
export class ClientListComponent {
  private service = inject(ClientService);
  private ui = inject(UiService); // <--- Inject UI Service
  private router = inject(Router);
  
  rawClients = toSignal(this.service.getAll(), { initialValue: [] });
  searchQuery = signal('');

  filteredClients = computed(() => {
    const q = this.searchQuery().toLowerCase();
    return this.rawClients().filter(c => c.nom.toLowerCase().includes(q) || c.telephone.includes(q) || (c.email && c.email.toLowerCase().includes(q)));
  });

  edit(client: Client) {
    this.router.navigate(['/admin/clients/edit', client.id]);
  }

  // --- DELETE AVEC UI.CONFIRM ---
  async delete(client: Client) {
    const confirmed = await this.ui.confirm(
      'Supprimer le client ?',
      `Êtes-vous sûr de vouloir supprimer définitivement ${client.nom} ?`,
      'Oui, supprimer',
      'Annuler'
    );

    if (confirmed && client.id) {
      try {
        await this.service.delete(client.id);
        this.ui.showToast('success', 'Client supprimé avec succès');
      } catch (e) {
        this.ui.showToast('error', 'Impossible de supprimer ce client');
      }
    }
  }
}
