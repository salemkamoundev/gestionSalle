import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { StaffService } from '../../../core/services/staff.service';
import { toSignal } from '@angular/core/rxjs-interop';

@Component({
  selector: 'app-staff-list',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <div class="max-w-7xl mx-auto space-y-6">
      
      <div class="flex justify-between items-center">
        <div>
          <h1 class="text-2xl font-bold text-slate-800 flex items-center">
            <span class="material-icons mr-3 text-slate-400">badge</span>
            Équipe & Staff
          </h1>
          <p class="text-slate-500 mt-1">Gestion des accès ({{ team().length }} membres)</p>
        </div>
        <a routerLink="/admin/serveurs/new" class="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg font-medium shadow transition flex items-center">
          <span class="material-icons text-sm mr-2">person_add</span> Ajouter
        </a>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        @for (staff of team(); track staff.id) {
          <div class="bg-white rounded-xl shadow-sm border border-slate-200 p-6 flex flex-col hover:shadow-md transition relative group">
            
            <div class="flex items-start justify-between mb-4">
               <div class="w-12 h-12 rounded-full bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center text-lg text-slate-500 font-bold uppercase">
                  {{ staff.nom.charAt(0) }}
               </div>
               <span class="px-2 py-1 text-[10px] uppercase font-bold tracking-wider rounded border"
                  [class.bg-purple-50]="staff.role === 'ADMIN'"
                  [class.text-purple-700]="staff.role === 'ADMIN'"
                  [class.border-purple-200]="staff.role === 'ADMIN'"
                  [class.bg-blue-50]="staff.role === 'SERVER'"
                  [class.text-blue-700]="staff.role === 'SERVER'"
                  [class.border-blue-200]="staff.role === 'SERVER'">
                  {{ staff.role }}
               </span>
            </div>
            
            <h3 class="font-bold text-slate-800 text-lg">{{ staff.nom }}</h3>
            <p class="text-sm text-slate-500 flex items-center mt-1">
              <span class="material-icons text-[14px] mr-1">alternate_email</span> 
              {{ staff.email }}
            </p>

            <div class="mt-4 pt-4 border-t border-slate-100 flex justify-between items-center">
              <div class="flex items-center">
                <span class="w-2 h-2 rounded-full mr-2" [class.bg-green-500]="staff.active" [class.bg-red-400]="!staff.active"></span>
                <span class="text-xs text-slate-500">{{ staff.active ? 'Actif' : 'Inactif' }}</span>
              </div>
              
              <button (click)="delete(staff.id!)" class="text-slate-300 hover:text-red-500 transition" title="Révoquer l'accès">
                <span class="material-icons">delete</span>
              </button>
            </div>
          </div>
        }
      </div>
    </div>
  `
})
export class StaffListComponent {
  private service = inject(StaffService);
  team = toSignal(this.service.getAll(), { initialValue: [] });

  async delete(id: string) {
    if(confirm('Attention : Cela supprimera définitivement ce profil. Continuer ?')) {
      await this.service.delete(id);
    }
  }
}
