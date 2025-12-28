import { Injectable } from '@angular/core';
import { Observable, BehaviorSubject, of } from 'rxjs';
import { Pack } from '../models/pack.model';

@Injectable({
  providedIn: 'root'
})
export class PackService {

  // Données initiales
  private initialPacks: Pack[] = [
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

  // BehaviorSubject stocke l'état actuel et émet à chaque modification
  private packsSubject = new BehaviorSubject<Pack[]>(this.initialPacks);

  getAll(): Observable<Pack[]> {
    return this.packsSubject.asObservable();
  }

  getById(id: string): Observable<Pack | undefined> {
    // On cherche dans la valeur actuelle du Subject
    const pack = this.packsSubject.value.find(p => p.id === id);
    return of(pack);
  }

  add(pack: Pack): Promise<void> {
    const currentPacks = this.packsSubject.value;
    // Simulation d'ID et ajout
    const newPack = { ...pack, id: Date.now().toString() };
    // On émet la nouvelle liste
    this.packsSubject.next([...currentPacks, newPack]);
    return Promise.resolve();
  }

  update(id: string, pack: Partial<Pack>): Promise<void> {
    const currentPacks = this.packsSubject.value;
    const index = currentPacks.findIndex(p => p.id === id);
    if (index !== -1) {
      const updatedPacks = [...currentPacks];
      updatedPacks[index] = { ...updatedPacks[index], ...pack };
      this.packsSubject.next(updatedPacks);
    }
    return Promise.resolve();
  }

  delete(id: string): Promise<void> {
    const currentPacks = this.packsSubject.value;
    const updatedPacks = currentPacks.filter(p => p.id !== id);
    // C'est cette ligne qui va déclencher la mise à jour de l'interface
    this.packsSubject.next(updatedPacks);
    return Promise.resolve();
  }
}
