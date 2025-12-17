import { Component, inject, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, Router } from '@angular/router';
import { TeamService } from '../../../core/services/team.service';
import { UiService } from '../../../core/services/ui.service';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { Team } from '../../../core/models/team.model';

@Component({
  selector: 'app-team-list',
  standalone: true,
  imports: [CommonModule, RouterLink, FormsModule],
  template: `
    <div class="max-w-7xl mx-auto space-y-6">
      
      <div class="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 class="text-2xl font-bold text-slate-800 flex items-center">
            <span class="material-icons mr-3 text-slate-400">groups_3</span>
            Équipes & Prestataires
          </h1>
          <p class="text-slate-500 mt-1">Gestion des partenaires (Orchestres, Traiteurs...)</p>
        </div>
        <div class="flex gap-3 w-full md:w-auto">
          <div class="relative flex-1 md:w-64">
            <span class="material-icons absolute left-3 top-2.5 text-slate-400 text-sm">search</span>
            <input type="text" [(ngModel)]="searchQuery" placeholder="Nom ou type..." class="w-full pl-9 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none text-sm">
          </div>
          <a routerLink="/admin/teams/new" class="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg font-medium shadow transition flex items-center whitespace-nowrap">
            <span class="material-icons text-sm mr-2">add</span> Nouvelle Équipe
          </a>
        </div>
      </div>

      <div class="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div class="overflow-x-auto">
          <table class="w-full text-left">
            <thead class="bg-slate-50 border-b border-slate-200">
              <tr>
                <th class="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Nom de l'équipe</th>
                <th class="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Type</th>
                <th class="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Responsable / Contact</th>
                <th class="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider text-right">Tarif Réf.</th>
                <th class="px-6 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100">
              @for (team of filteredTeams(); track team.id) {
                <tr class="hover:bg-slate-50 transition group">
                  <td class="px-6 py-4">
                    <div class="font-bold text-slate-900">{{ team.nom }}</div>
                    <div class="text-xs text-slate-400" *ngIf="!team.active">Inactif</div>
                  </td>
                  <td class="px-6 py-4">
                    <span class="px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wide border"
                      [class.bg-orange-50]="team.type === 'ORCHESTRE'" [class.text-orange-600]="team.type === 'ORCHESTRE'" [class.border-orange-100]="team.type === 'ORCHESTRE'"
                      [class.bg-blue-50]="team.type === 'PHOTOGRAPHE'" [class.text-blue-600]="team.type === 'PHOTOGRAPHE'" [class.border-blue-100]="team.type === 'PHOTOGRAPHE'"
                      [class.bg-green-50]="team.type === 'TRAITEUR'" [class.text-green-600]="team.type === 'TRAITEUR'" [class.border-green-100]="team.type === 'TRAITEUR'"
                      [class.bg-slate-100]="team.type === 'AUTRE'" [class.text-slate-600]="team.type === 'AUTRE'">
                      {{ team.type }}
                    </span>
                  </td>
                  <td class="px-6 py-4 text-sm text-slate-600">
                    <div class="font-medium text-slate-800">{{ team.chefEquipe || '-' }}</div>
                    <div class="text-xs flex items-center mt-0.5"><span class="material-icons text-[10px] mr-1">phone</span> {{ team.telephone }}</div>
                  </td>
                  <td class="px-6 py-4 text-right font-mono text-sm text-slate-600">
                    {{ team.prixReference ? (team.prixReference | number:'1.0-2') + ' DT' : '-' }}
                  </td>
                  <td class="px-6 py-4 text-right">
                    <div class="flex justify-end gap-2">
                      <button (click)="edit(team)" class="text-slate-400 hover:text-purple-600 p-2 rounded-full hover:bg-purple-50 transition"><span class="material-icons text-lg">edit</span></button>
                      <button (click)="delete(team)" class="text-slate-400 hover:text-red-600 p-2 rounded-full hover:bg-red-50 transition"><span class="material-icons text-lg">delete</span></button>
                    </div>
                  </td>
                </tr>
              } @empty {
                <tr><td colspan="5" class="px-6 py-12 text-center text-slate-400"><p>Aucune équipe trouvée.</p></td></tr>
              }
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `
})
export class TeamListComponent {
  private service = inject(TeamService);
  private ui = inject(UiService);
  private router = inject(Router);
  
  rawTeams = toSignal(this.service.getAll(), { initialValue: [] });
  searchQuery = signal('');

  filteredTeams = computed(() => {
    const q = this.searchQuery().toLowerCase();
    return this.rawTeams().filter(t => 
      t.nom.toLowerCase().includes(q) || 
      t.type.toLowerCase().includes(q) ||
      (t.chefEquipe && t.chefEquipe.toLowerCase().includes(q))
    );
  });

  edit(team: Team) {
    this.router.navigate(['/admin/teams/edit', team.id]);
  }

  async delete(team: Team) {
    const confirmed = await this.ui.confirm('Supprimer ?', `Supprimer l'équipe ${team.nom} ?`, 'Oui', 'Non');
    if (confirmed && team.id) {
      await this.service.delete(team.id);
      this.ui.showToast('success', 'Équipe supprimée');
    }
  }
}
