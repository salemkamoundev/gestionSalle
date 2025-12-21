import { Injectable } from '@angular/core';
import {
  Firestore,
  collection,
  addDoc,
  serverTimestamp,
  query,
  orderBy,
  limit,
  CollectionReference,
  DocumentData
} from '@angular/fire/firestore';
import { collectionData } from '@angular/fire/firestore';
import { Observable } from 'rxjs';

export type AdminMessage = {
  id?: string;
  text: string;
  fromEmail: string;
  createdAt?: any;
};

@Injectable({ providedIn: 'root' })
export class AdminChatService {
  private readonly col: CollectionReference<DocumentData>;

  constructor(private firestore: Firestore) {
    this.col = collection(this.firestore, 'admin_messages');
  }

  watchLatest$(max = 150): Observable<AdminMessage[]> {
    const q = query(this.col, orderBy('createdAt', 'desc'), limit(max));
    return collectionData(q, { idField: 'id' }) as Observable<AdminMessage[]>;
  }

  async sendMessage(text: string, fromEmail: string): Promise<void> {
    const clean = (text || '').trim();
    if (!clean) return;
    await addDoc(this.col, { text: clean, fromEmail, createdAt: serverTimestamp() });
  }
}
