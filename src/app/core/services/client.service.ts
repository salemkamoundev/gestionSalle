import { Injectable, inject } from '@angular/core';
import { FirestoreCrudService } from './firestore-crud.service';
import { Client } from '../models/client.model';
import { ActivityService } from './activity.service';

@Injectable({ providedIn: 'root' })
export class ClientService extends FirestoreCrudService<Client> {
  protected collectionName = 'clients';
  private logger = inject(ActivityService);

  override async add(item: Client): Promise<any> {
    const docRef = await super.add(item);
    // On passe l'ID dans les métadonnées (4ème argument)
    this.logger.log('CREATE', 'CLIENT', `Nouveau client : ${item.nom}`, { id: docRef.id });
    return docRef;
  }

  override async update(id: string, item: Partial<Client>): Promise<void> {
    await super.update(id, item);
    this.logger.log('UPDATE', 'CLIENT', `Mise à jour client : ${item.nom || 'ID ' + id}`, { id });
  }

  override async delete(id: string): Promise<void> {
    await super.delete(id);
    this.logger.log('DELETE', 'CLIENT', `Suppression client (ID: ${id})`, { id });
  }
}
