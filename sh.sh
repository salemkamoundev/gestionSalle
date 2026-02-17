#!/bin/bash

# Fichier cible
TS_FILE="src/app/features/services/service-list/service-list.component.ts"

echo "🔄 Mise à jour de ServiceListComponent pour sécuriser la suppression..."

# Réécriture complète du fichier pour inclure les contrôles d'intégrité
cat > "$TS_FILE" << 'EOF'
import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { toSignal } from '@angular/core/rxjs-interop';
import { firstValueFrom } from 'rxjs';

import { ServiceCatalogService } from '../../../core/services/service-catalog.service';
import { PartenaireService } from '../../../core/services/partenaire.service';
import { ReservationService } from '../../../core/services/reservation.service';
import { PackService } from '../../../core/services/pack.service';
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
          <p class="text-slate-500 mt-1">Gérez ici les prestations et associez-les à vos partenaires.</p>
        </div>

        <div class="flex gap-3 w-full md:w-auto">
          <div class="relative flex-1 md:w-64">
            <span class="material-icons absolute left-3 top-2.5 text-slate-400 text-sm">search</span>
            <input type="text"
              [(ngModel)]="searchQuery"
              placeholder="Rechercher..."
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
                <th class="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Nom du Service</th>
                <th class="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Partenaire Associé</th>
                <th class="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Prix Défaut</th>
                <th class="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Statut</th>
                <th class="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider text-right">Actions</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100">
              @for (s of paginated(); track s.id) {
                <tr class="hover:bg-slate-50 transition">
                  <td class="px-6 py-4">
                    <div class="font-bold text-slate-800">{{ s.nom }}</div>
                    @if (s.description) { <div class="text-xs text-slate-500 mt-0.5 line-clamp-1">{{ s.description }}</div> }
                  </td>

                  <td class="px-6 py-4">
                    @if (s.partnerId) {
                      <div class="flex items-center gap-2">
                        <div class="w-6 h-6 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center text-[10px] font-bold">
                            {{ getPartnerInitial(s.partnerId) }}
                        </div>
                        <span class="text-sm font-medium text-slate-700">{{ getPartnerName(s.partnerId) }}</span>
                      </div>
                    } @else {
                      <span class="text-slate-400 text-xs italic pl-2">-- Non assigné --</span>
                    }
                  </td>

                  <td class="px-6 py-4 font-mono text-sm text-slate-600 font-bold">
                    {{ (s.prix ?? 0) | number:'1.0-2' }} TND
                  </td>

                  <td class="px-6 py-4">
                    <span class="inline-flex items-center px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide border"
                      [class.bg-emerald-50]="s.active !== false"
                      [class.text-emerald-700]="s.active !== false"
                      [class.border-emerald-100]="s.active !== false"
                      [class.bg-slate-50]="s.active === false"
                      [class.text-slate-500]="s.active === false"
                      [class.border-slate-200]="s.active === false">
                      {{ s.active === false ? 'Inactif' : 'Actif' }}
                    </span>
                  </td>

                  <td class="px-6 py-4 text-right">
                    <div class="flex justify-end gap-2">
                      <button (click)="edit(s)" class="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded transition" title="Modifier">
                        <span class="material-icons text-sm">edit</span>
                      </button>
                      <button (click)="remove(s)" class="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition" title="Supprimer">
                        <span class="material-icons text-sm">delete</span>
                      </button>
                    </div>
                  </td>
                </tr>
              }
              @if (filtered().length === 0) {
                <tr><td colspan="5" class="px-6 py-12 text-center text-slate-400 italic">Aucun service trouvé correspondant à votre recherche.</td></tr>
              }
            </tbody>
          </table>
        </div>

        @if (totalPages() > 1) {
          <div class="flex items-center justify-between px-6 py-4 border-t bg-slate-50">
            <p class="text-xs text-slate-500">Page {{ page() }} / {{ totalPages() }}</p>
            <div class="flex gap-2">
              <button (click)="prev()" [disabled]="page() === 1"
                class="px-3 py-1 text-xs font-bold rounded-lg border bg-white hover:bg-slate-100 disabled:opacity-50 text-slate-600">
                Précédent
              </button>
              <button (click)="next()" [disabled]="page() === totalPages()"
                class="px-3 py-1 text-xs font-bold rounded-lg border bg-white hover:bg-slate-100 disabled:opacity-50 text-slate-600">
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
  private partenaireService = inject(PartenaireService);
  private reservationService = inject(ReservationService);
  private packService = inject(PackService);
  private ui = inject(UiService);

  searchQuery = '';
  page = signal(1);
  pageSize = 10;

  // Données
  raw = toSignal(this.service.getAll(), { initialValue: [] as ServiceCatalog[] });
  partners = toSignal(this.partenaireService.getAll(), { initialValue: [] as any[] });

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

  // Helpers pour l'affichage du partenaire
  getPartnerName(partnerId: string | undefined | null): string {
    if (!partnerId) return '';
    const p = this.partners().find(p => p.id === partnerId);
    return p ? `${p.nom} ${p.prenom}` : 'Inconnu';
  }

  getPartnerInitial(partnerId: string | undefined | null): string {
    const name = this.getPartnerName(partnerId);
    return name ? name.charAt(0).toUpperCase() : '?';
  }

  next() { this.page.set(Math.min(this.page() + 1, this.totalPages())); }
  prev() { this.page.set(Math.max(1, this.page() - 1)); }

  edit(s: ServiceCatalog) {
    if (!s.id) return;
    this.router.navigate(['/admin/services/edit', s.id]);
  }

  async remove(s: ServiceCatalog) {
    if (!s.id) return;

    // 1. Vérifier si le service est utilisé dans un Pack
    try {
        const packs = await firstValueFrom(this.packService.getAll());
        const usedInPack = packs.find(p => p.services && p.services.some((ps: any) => ps.id === s.id));
        
        if (usedInPack) {
            this.ui.showToast('error', `Impossible : Ce service est inclus dans le pack "${usedInPack.nom}".`);
            return;
        }

        // 2. Vérifier si le service est utilisé dans une Réservation
        const reservations = await firstValueFrom(this.reservationService.getAll());
        // On cherche une réservation dont la liste 'services' contient un élément avec le même ID
        const usedInRes = reservations.find(r => 
            r.services && 
            Array.isArray(r.services) && 
            r.services.some((rs: any) => rs.id === s.id)
        );

        if (usedInRes) {
            this.ui.showToast('error', `Impossible : Ce service est utilisé dans une réservation (ex: ${usedInRes.date}).`);
            return;
        }

    } catch (e) {
        console.error("Erreur lors de la vérification d'utilisation", e);
        // On continue ou on bloque selon la prudence ? Ici on bloque par sécurité.
        this.ui.showToast('error', 'Erreur lors de la vérification des dépendances.');
        return;
    }

    // 3. Confirmation et Suppression
    const ok = await this.ui.confirm(
      'Supprimer le service ?',
      `Confirmez la suppression de "${s.nom}".`,
      'Supprimer',
      'Annuler'
    );
    if (!ok) return;

    try {
      await this.service.delete(s.id);
      this.ui.showToast('success', 'Service supprimé');
    } catch {
      this.ui.showToast('error', 'Erreur technique');
    }
  }
}
EOF

echo "✅ ServiceListComponent sécurisé : Impossible de supprimer un service s'il est utilisé."