import { Component, inject, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, Router } from '@angular/router';
import { StaffService } from '../../../core/services/staff.service';
import { UiService } from '../../../core/services/ui.service'; // <--- NEW
import { toSignal } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ServerStaff } from '../../../core/models/staff.model';

@Component({
  selector: 'app-staff-list',
  standalone: true,
  imports: [CommonModule, RouterLink, FormsModule],
  template: `
    <div class="max-w-7xl mx-auto space-y-6">
      
      <div class="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div><h1 class="text-2xl font-bold text-slate-800 flex items-center"><span class="material-icons mr-3 text-slate-400">badge</span> Équipe & Staff</h1><p class="text-slate-500 mt-1">Gestion du personnel ({{ filteredStaff().length }})</p></div>
        <div class="flex gap-3 w-full md:w-auto"><div class="relative flex-1 md:w-64"><span class="material-icons absolute left-3 top-2.5 text-slate-400 text-sm">search</span><input type="text" [(ngModel)]="searchQuery" placeholder="Rechercher..." class="w-full pl-9 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm"></div><a routerLink="/admin/serveurs/new" class="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium shadow transition flex items-center whitespace-nowrap"><span class="material-icons text-sm mr-2">add</span> Nouveau</a></div>
      </div>

      <div class="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div class="overflow-x-auto">
          <table class="w-full text-left">
            <thead class="bg-slate-50 border-b border-slate-200">
              <tr>
                <th class="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Membre</th>
                <th class="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Rôle / Spécialité</th>
                <th class="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Contact</th>
                <th class="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider text-center">Statut</th>
                <th class="px-6 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100">
              @for (staff of filteredStaff(); track staff.id) {
                <tr class="hover:bg-slate-50 transition group">
                  <td class="px-6 py-4"><div class="font-medium text-slate-900">{{ staff.nom }}</div></td>
                  <td class="px-6 py-4"><span class="text-xs font-bold px-2 py-1 rounded bg-slate-100 text-slate-600 uppercase">{{ staff.role }}</span> <span class="text-xs text-slate-500 ml-2">{{ staff.specialite }}</span></td>
                  <td class="px-6 py-4 text-sm text-slate-600">{{ staff.email }}<br><span class="text-xs text-slate-400">{{ staff.telephone }}</span></td>
                  <td class="px-6 py-4 text-center">
                    <span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium" [class.bg-green-100]="staff.active" [class.text-green-800]="staff.active" [class.bg-red-100]="!staff.active" [class.text-red-800]="!staff.active">
                      {{ staff.active ? 'Actif' : 'Inactif' }}
                    </span>
                  </td>
                  <td class="px-6 py-4 text-right">
                    <div class="flex justify-end gap-2">
                      <button (click)="edit(staff)" class="text-slate-400 hover:text-blue-600 p-2 rounded-full hover:bg-blue-50 transition" title="Modifier"><span class="material-icons text-lg">edit</span></button>
                      <button (click)="delete(staff)" class="text-slate-400 hover:text-red-600 p-2 rounded-full hover:bg-red-50 transition" title="Supprimer"><span class="material-icons text-lg">delete</span></button>
                    </div>
                  </td>
                </tr>
              } @empty { <tr><td colspan="5" class="px-6 py-12 text-center"><div class="flex flex-col items-center justify-center text-slate-400"><span class="material-icons text-4xl mb-2">badge</span><p>Aucun membre trouvé.</p></div></td></tr> }
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `
})
export class StaffListComponent {
  private service = inject(StaffService);
  private ui = inject(UiService); // <--- Inject UI
  private router = inject(Router);
  
  rawStaff = toSignal(this.service.getAll(), { initialValue: [] });
  searchQuery = signal('');

  filteredStaff = computed(() => {
    const q = this.searchQuery().toLowerCase();
    return this.rawStaff().filter(s => s.nom.toLowerCase().includes(q) || s.email.toLowerCase().includes(q));
  });

  edit(staff: ServerStaff) {
    this.router.navigate(['/admin/serveurs/edit', staff.id]);
  }

  async delete(staff: ServerStaff) {
    const confirmed = await this.ui.confirm(
      'Supprimer le membre ?',
      `Attention, vous allez supprimer ${staff.nom} de l'équipe.`,
      'Supprimer',
      'Annuler'
    );

    if (confirmed && staff.id) {
      try {
        await this.service.delete(staff.id);
        this.ui.showToast('success', 'Membre supprimé');
      } catch (e) {
        this.ui.showToast('error', 'Erreur lors de la suppression');
      }
    }
  }
}
