import { Injectable, inject } from '@angular/core';
import { FirestoreCrudService } from './firestore-crud.service';
import { ServiceCatalog } from '../models/service-catalog.model';
import { ActivityService } from './activity.service';

@Injectable({ providedIn: 'root' })
export class ServiceCatalogService extends FirestoreCrudService<ServiceCatalog> {
  protected collectionName = 'services';
  private logger = inject(ActivityService);

  override async add(item: ServiceCatalog): Promise<any> {
    const docRef = await super.add({
      ...item,
      active: item.active ?? true,
      createdAt: item.createdAt ?? new Date().toISOString(),
    });
    this.logger.log('CREATE', 'CONFIG', `Nouveau service ajouté : ${item.nom}`, { id: docRef.id });
    return docRef;
  }

  override async update(id: string, item: Partial<ServiceCatalog>): Promise<void> {
    await super.update(id, item);
    this.logger.log('UPDATE', 'CONFIG', `Mise à jour service : ${item.nom || 'ID ' + id}`, { id });
  }

  override async delete(id: string): Promise<void> {
    await super.delete(id);
    this.logger.log('DELETE', 'CONFIG', `Suppression service ID: ${id}`, { id });
  }
}