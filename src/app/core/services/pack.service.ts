import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { Pack } from '../models/pack.model';

@Injectable({
  providedIn: 'root'
})
export class PackService {

  // Données factices complètes
  private packs: Pack[] = [
    {
      id: 'pack_mariage',
      nom: 'Pack Mariage Royal',
      description: 'Tout inclus pour un mariage de rêve',
      active: true,
      services: [
        { nom: 'Traiteur VIP', prix: 5000 },
        { nom: 'Décoration Salle', prix: 2000 },
        { nom: 'Troupe Musicale', prix: 1500 }
      ],
      staffIds: ['staff1', 'staff2'],
      teamIds: ['team1']
    },
    {
      id: 'pack_anniversaire',
      nom: 'Pack Anniversaire',
      description: 'Animation et gâteau inclus',
      active: true,
      services: [
        { nom: 'DJ', prix: 800 },
        { nom: 'Gâteau', prix: 400 }
      ],
      staffIds: [],
      teamIds: []
    }
  ];

  getAll(): Observable<Pack[]> {
    return of(this.packs);
  }

  // Ajouté pour corriger l'erreur dans pack-form
  getById(id: string): Observable<Pack | undefined> {
    const pack = this.packs.find(p => p.id === id);
    return of(pack);
  }

  // Ajouté pour corriger l'erreur dans pack-form
  add(pack: Pack): Promise<void> {
    this.packs.push({ ...pack, id: Date.now().toString() });
    return Promise.resolve();
  }

  // Ajouté pour corriger l'erreur dans pack-form
  update(id: string, pack: Partial<Pack>): Promise<void> {
    const index = this.packs.findIndex(p => p.id === id);
    if (index !== -1) {
      this.packs[index] = { ...this.packs[index], ...pack };
    }
    return Promise.resolve();
  }

  // Ajouté pour corriger l'erreur dans pack-list
  delete(id: string): Promise<void> {
    this.packs = this.packs.filter(p => p.id !== id);
    return Promise.resolve();
  }
}
