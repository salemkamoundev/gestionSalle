import { Injectable, inject } from '@angular/core';
import { Firestore, collection, addDoc, query, orderBy, limit, collectionData } from '@angular/fire/firestore';
import { Auth } from '@angular/fire/auth';
import { ActivityLog } from '../models/activity.model';
import { Observable } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class ActivityService {
  private firestore = inject(Firestore);
  private auth = inject(Auth);
  private collectionName = 'activity_logs';

  // Enregistrer une action
  async log(
    action: 'CREATE' | 'UPDATE' | 'DELETE' | 'PAYMENT',
    entity: 'RESERVATION' | 'CLIENT' | 'STAFF' | 'CONFIG',
    description: string,
    metadata: any = {}
  ) {
    const userEmail = this.auth.currentUser?.email || 'Système';
    
    const activity: ActivityLog = {
      action,
      entity,
      description,
      userEmail,
      timestamp: new Date().toISOString(),
      metadata
    };

    try {
      const col = collection(this.firestore, this.collectionName);
      await addDoc(col, activity);
    } catch (e) {
      console.error('Erreur logging activity', e);
    }
  }

  // Récupérer les dernières activités (ex: 20 dernières)
  getLatest(count: number = 20): Observable<ActivityLog[]> {
    const col = collection(this.firestore, this.collectionName);
    const q = query(col, orderBy('timestamp', 'desc'), limit(count));
    return collectionData(q, { idField: 'id' }) as Observable<ActivityLog[]>;
  }
}
