import { Injectable, inject } from '@angular/core';
import { FirestoreCrudService } from './firestore-crud.service';
import { Team } from '../models/team.model';
import { ActivityService } from './activity.service';

@Injectable({ providedIn: 'root' })
export class TeamService extends FirestoreCrudService<Team> {
  protected collectionName = 'teams';
  private logger = inject(ActivityService);

  override async add(item: Team): Promise<any> {
    const docRef = await super.add(item);
    this.logger.log('CREATE', 'CONFIG', `Nouvelle équipe ajoutée : ${item.nom}`, { id: docRef.id });
    return docRef;
  }

  override async update(id: string, item: Partial<Team>): Promise<void> {
    await super.update(id, item);
    this.logger.log('UPDATE', 'CONFIG', `Mise à jour équipe : ${item.nom || 'ID ' + id}`, { id });
  }

  override async delete(id: string): Promise<void> {
    await super.delete(id);
    this.logger.log('DELETE', 'CONFIG', `Suppression équipe ID: ${id}`, { id });
  }
}
