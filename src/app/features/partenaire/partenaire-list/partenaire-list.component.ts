import { Component, inject, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { toSignal } from '@angular/core/rxjs-interop';

// IMPORTS MODULAIRES (COMPATIBLES APP.CONFIG.TS)
import { Firestore, collection, query, where, getDocs } from '@angular/fire/firestore';

// SERVICES
import { PartenaireService } from '../../../core/services/partenaire.service';
import { UiService } from '../../../core/services/ui.service';
import { PdfService } from '../../../core/services/pdf.service';
import { ServerPartenaire } from '../../../core/models/partenaire.model';

@Component({
  selector: 'app-partenaire-list',
  standalone: true,
  imports: [CommonModule, RouterLink, FormsModule],
  templateUrl: './partenaire-list.component.html'
})
export class PartenaireListComponent {
  private service = inject(PartenaireService);
  private ui = inject(UiService);
  private router = inject(Router);
  private pdfService = inject(PdfService);
  private firestore = inject(Firestore); // Injection Modulaire
  
  rawPartenaire = toSignal(this.service.getAll(), { initialValue: [] });
  searchQuery = signal('');

  /* PAGINATION */
  page = signal(1);
  pageSize = signal(20);
  
  filteredPartenaire = computed(() => {
    const q = this.searchQuery().toLowerCase();
    const list = this.rawPartenaire();
    if (!list) return [];
    return list.filter(s => 
      (s.nom && s.nom.toLowerCase().includes(q)) || 
      (s.email && s.email.toLowerCase().includes(q))
    );
  });

  totalPages = computed(() => {
    const total = this.filteredPartenaire().length;
    return Math.max(1, Math.ceil(total / this.pageSize()));
  });

  paginated = computed(() => {
    const all = this.filteredPartenaire();
    const start = (this.page() - 1) * this.pageSize();
    return all.slice(start, start + this.pageSize());
  });

  prevPage() { this.page.set(Math.max(1, this.page() - 1)); }
  nextPage() { this.page.set(Math.min(this.totalPages(), this.page() + 1)); }
  setPageSize(v: any) { this.pageSize.set(Number(v) || 20); this.page.set(1); }

  edit(partenaire: ServerPartenaire) {
    this.router.navigate(['/admin/serveurs/edit', partenaire.id]);
  }

  async delete(partenaire: ServerPartenaire) {
    const confirmed = await this.ui.confirm(
      'Supprimer le membre ?',
      `Attention, vous allez supprimer ${partenaire.nom} de l'équipe.`,
      'Supprimer',
      'Annuler'
    );

    if (confirmed && partenaire.id) {
      try {
        await this.service.delete(partenaire.id);
        this.ui.showToast('success', 'Membre supprimé');
      } catch (e) {
        this.ui.showToast('error', 'Erreur lors de la suppression');
      }
    }
  }

  // --- NOUVELLE MÉTHODE D'IMPRESSION (MODULAIRE) ---
  async printPlanning(partenaire: ServerPartenaire) {
    if (!partenaire.id) return;

    this.ui.showLoading('Génération du planning...');

    try {
      // Requête Modulaire : query + collection + where
      const q = query(
        collection(this.firestore, 'reservations'), 
        where('assignedServerIds', 'array-contains', partenaire.id)
      );
      
      const snapshot = await getDocs(q);
      const resas = snapshot.docs.map(d => d.data());

      // Filtrer les annulés
      const activeResas = resas.filter((r: any) => r.status !== 'CANCELLED');
      
      await this.pdfService.generateServerPlanning(partenaire.nom || 'Partenaire', activeResas);
      this.ui.showToast('success', 'Planning téléchargé');

    } catch (e) {
      console.error("Erreur planning", e);
      this.ui.showToast('error', 'Impossible de générer le planning');
    } finally {
      this.ui.hideLoading();
    }
  }
}
