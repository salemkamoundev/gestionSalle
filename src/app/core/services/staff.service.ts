import { Injectable } from '@angular/core';
import { FirestoreCrudService } from './firestore-crud.service';
import { ServerStaff } from '../models/staff.model';

@Injectable({ providedIn: 'root' })
export class StaffService extends FirestoreCrudService<ServerStaff> {
  protected collectionName = 'users'; // On stocke le staff dans 'users'
}
