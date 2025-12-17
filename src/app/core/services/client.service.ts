import { Injectable } from '@angular/core';
import { FirestoreCrudService } from './firestore-crud.service';
import { Client } from '../models/client.model';

@Injectable({ providedIn: 'root' })
export class ClientService extends FirestoreCrudService<Client> {
  protected collectionName = 'clients';
}
