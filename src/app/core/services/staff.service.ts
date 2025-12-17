import { Injectable, inject } from '@angular/core';
import { FirestoreCrudService } from './firestore-crud.service';
import { ServerStaff } from '../models/staff.model';
import { ActivityService } from './activity.service';

@Injectable({ providedIn: 'root' })
export class StaffService extends FirestoreCrudService<ServerStaff> {
  protected collectionName = 'users';
  private logger = inject(ActivityService);

  override async add(item: ServerStaff): Promise<any> {
    const docRef = await super.add(item);
    this.logger.log('CREATE', 'STAFF', `Nouveau membre : ${item.nom} (${item.role})`);
    return docRef;
  }

  override async update(id: string, item: Partial<ServerStaff>): Promise<void> {
    await super.update(id, item);
    this.logger.log('UPDATE', 'STAFF', `Mise à jour staff : ${item.nom || id}`);
  }

  override async delete(id: string): Promise<void> {
    await super.delete(id);
    this.logger.log('DELETE', 'STAFF', `Suppression membre staff (ID: ${id})`);
  }
}
