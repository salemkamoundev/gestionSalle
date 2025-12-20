import { Injectable, inject } from '@angular/core';
import { FirestoreCrudService } from './firestore-crud.service';
import { Pack } from '../models/pack.model';
import { ActivityService } from './activity.service';

@Injectable({ providedIn: 'root' })
export class PackService extends FirestoreCrudService<Pack> {
  protected collectionName = 'packs';
  private logger = inject(ActivityService);

  override async add(item: Pack): Promise<any> {
    const ref = await super.add(item);
    this.logger.log('CREATE', 'CONFIG', `Nouveau pack ajouté : ${item.nom}`, { id: ref.id });
    return ref;
  }

  override async update(id: string, item: Partial<Pack>): Promise<void> {
    await super.update(id, item);
    this.logger.log('UPDATE', 'CONFIG', `Mise à jour pack : ${item.nom ?? id}`, { id });
  }

  override async delete(id: string): Promise<void> {
    await super.delete(id);
    this.logger.log('DELETE', 'CONFIG', `Suppression pack : ${id}`, { id });
  }
}
