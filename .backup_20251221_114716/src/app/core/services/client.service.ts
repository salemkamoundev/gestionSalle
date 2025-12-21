import { Injectable, inject } from '@angular/core';
import { FirestoreCrudService } from './firestore-crud.service';
import { Client } from '../models/client.model';
import { ActivityService } from './activity.service';
import { firstValueFrom } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class ClientService extends FirestoreCrudService<Client> {
  protected collectionName = 'clients';
  private logger = inject(ActivityService);

  /**
   * NETTOYAGE COMPLET ET GÉNÉRATION
   */
  async generateMockClients() {
    // 1. Récupérer tous les anciens clients pour les supprimer
    const oldClients = await firstValueFrom(this.getAll());
    for (const c of oldClients) {
      if (c.id) await this.delete(c.id);
    }

    // 2. Nouvelles données propres et complètes
    const mocks: Client[] = [
      {
        nom: 'ABOUB',
        prenom: 'Skander',
        cin: '08800316',
        dateCin: '2004-05-14',
        prenomMarie1: 'Skander',
        prenomMarie2: 'Inès',
        telephone: '28550055',
        email: 'skander.aboub@gmail.com',
        adresse: 'Avenue Hedi Chaker Sakiet Ezzit km 8,5 Route de Tunis',
        createdAt: new Date().toISOString()
      },
      {
        nom: 'MAALEJ',
        prenom: 'Mohamed',
        cin: '07712345',
        dateCin: '2015-10-20',
        prenomMarie1: 'Mohamed',
        prenomMarie2: 'Sonia',
        telephone: '22111333',
        email: 'mohamed.maalej@princesse.tn',
        adresse: 'Route de Tunis Km 10, Sfax',
        createdAt: new Date().toISOString()
      },
      {
        nom: 'BEN SALEM',
        prenom: 'Yassine',
        cin: '09955443',
        dateCin: '2019-02-12',
        prenomMarie1: 'Yassine',
        prenomMarie2: 'Amira',
        telephone: '98444555',
        email: 'yassine.bs@gmail.com',
        adresse: 'Sakit Ezzit, Sfax',
        createdAt: new Date().toISOString()
      }
    ];

    for (const client of mocks) {
      await this.add({
        ...client,
        // Sécurité anti-undefined pour Firebase
        cin: client.cin || '',
        dateCin: client.dateCin || '',
        prenomMarie1: client.prenomMarie1 || '',
        prenomMarie2: client.prenomMarie2 || '',
        adresse: client.adresse || ''
      });
    }
  }

  override async add(item: Client): Promise<any> {
    const docRef = await super.add(item);
    this.logger.log('CREATE', 'CLIENT', `Nouveau client : ${item.nom} ${item.prenom}`, { id: docRef.id });
    return docRef;
  }

  override async update(id: string, item: Partial<Client>): Promise<void> {
    const cleanUpdate = Object.fromEntries(
      Object.entries(item).map(([key, value]) => [key, value === undefined ? '' : value])
    );
    await super.update(id, cleanUpdate as any);
  }

  override async delete(id: string): Promise<void> {
    await super.delete(id);
  }
}
