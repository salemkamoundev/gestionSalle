import { Component, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { PackService } from '../../../core/services/pack.service';
import { toSignal } from '@angular/core/rxjs-interop';

@Component({
  selector: 'app-pack-list',
  standalone: true,
  imports: [CommonModule, RouterLink, FormsModule],
  templateUrl: './pack-list.component.html'
})
export class PackListComponent {
  private packService = inject(PackService);

  // Récupération réactive des packs
  packs = toSignal(this.packService.getAll(), { initialValue: [] });
  
  searchQuery = signal('');

  // Filtrage robuste (gère 'name' ou 'nom')
  filteredPacks = computed(() => {
    const query = this.searchQuery().toLowerCase();
    const list = this.packs();
    if (!list) return [];
    
    return list.filter(p => {
      const name = p.name || p.nom || '';
      return name.toLowerCase().includes(query);
    });
  });

  async deletePack(id: string) {
    if (confirm('Êtes-vous sûr de vouloir supprimer ce pack ?')) {
      try {
        await this.packService.delete(id);
      } catch (e) {
        console.error("Erreur suppression:", e);
      }
    }
  }
}
