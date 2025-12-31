import { Injectable, inject } from '@angular/core';
import { Firestore, collection, addDoc, query, orderBy, limit, startAfter, getDocs, DocumentSnapshot } from '@angular/fire/firestore';
import { Auth } from '@angular/fire/auth';
import { ActivityLog } from '../models/activity.model';

@Injectable({ providedIn: 'root' })
export class ActivityService {
  private firestore = inject(Firestore);
  private auth = inject(Auth);
  private collectionName = 'activity_logs';

  async log(
    action: 'CREATE' | 'UPDATE' | 'DELETE' | 'PAYMENT',
    entity: 'RESERVATION' | 'CLIENT' | 'PARTENAIRE' | 'CONFIG',
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

  // Récupération paginée (Promesse car on gère le curseur manuellement)
  async getPaginated(limitCount: number, lastDoc: DocumentSnapshot | null = null): Promise<{ data: ActivityLog[], lastDoc: DocumentSnapshot | null }> {
    const col = collection(this.firestore, this.collectionName);
    
    let q;
    if (lastDoc) {
      q = query(col, orderBy('timestamp', 'desc'), startAfter(lastDoc), limit(limitCount));
    } else {
      q = query(col, orderBy('timestamp', 'desc'), limit(limitCount));
    }

    const snapshot = await getDocs(q);
    const data = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as ActivityLog));
    const newLastDoc = snapshot.docs.length > 0 ? snapshot.docs[snapshot.docs.length - 1] : null;

    return { data, lastDoc: newLastDoc };
  }
}
