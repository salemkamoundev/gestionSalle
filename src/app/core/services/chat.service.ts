import { Injectable, inject, Injector, runInInjectionContext } from '@angular/core';
import { 
  Firestore, collection, query, orderBy, 
  doc, deleteDoc, updateDoc, getDoc, 
  writeBatch, serverTimestamp, collectionData, increment, where, onSnapshot, getDocs
} from '@angular/fire/firestore';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { AuthService } from './auth.service';

export interface ChatMessage {
  id?: string;
  text: string;
  senderId: string;
  receiverId: string;
  createdAt: any;
  read: boolean;
  likes?: string[];
  dislikes?: string[];
  isAdmin?: boolean;
}

export interface ChatConversation {
  uid: string;
  email: string;
  displayName?: string;
  lastMessage?: string;
  lastMessageTime?: any;
  unreadCount?: number;
}

export interface ChatUser {
  uid: string;
  email: string;
  role?: string;
  displayName?: string;
}

@Injectable({ providedIn: 'root' })
export class ChatService {
  private firestore = inject(Firestore);
  private authService = inject(AuthService);
  private injector = inject(Injector); // Requis pour le contexte d'injection

  constructor() {}

  // FIX: Utilisation de 'users' dans le contexte d'injection
  getUsers(): Observable<ChatUser[]> {
    return runInInjectionContext(this.injector, () => {
      const usersRef = collection(this.firestore, 'users');
      return collectionData(usersRef, { idField: 'uid' }) as Observable<ChatUser[]>;
    });
  }

  getAllConversations(): Observable<ChatConversation[]> {
    return runInInjectionContext(this.injector, () => {
      const q = query(collection(this.firestore, 'chat_conversations'), orderBy('lastMessageTime', 'desc'));
      return collectionData(q, { idField: 'uid' }) as Observable<ChatConversation[]>;
    });
  }

  getMessages(clientUid: string): Observable<ChatMessage[]> {
    return runInInjectionContext(this.injector, () => {
      const q = query(collection(this.firestore, 'messages'), orderBy('createdAt', 'asc'));
      return collectionData(q, { idField: 'id' }).pipe(
        map((msgs: any[]) => {
          return msgs.filter(m => 
            (m.senderId === clientUid && m.receiverId === 'ADMIN') || 
            (m.senderId === 'ADMIN' && m.receiverId === clientUid)
          ).map(m => ({ ...m, isAdmin: m.senderId === 'ADMIN' }));
        })
      );
    }) as Observable<ChatMessage[]>;
  }

  async sendMessage(text: string, senderUid: string, receiverUid: string, senderEmail: string = '') {
    if (!text.trim()) return;
    const batch = writeBatch(this.firestore);
    const msgRef = doc(collection(this.firestore, 'messages'));
    const newMessage: any = {
      text, senderId: senderUid, receiverId: receiverUid,
      createdAt: serverTimestamp(), read: false, likes: [], dislikes: []
    };
    batch.set(msgRef, newMessage);

    const clientUid = receiverUid === 'ADMIN' ? senderUid : receiverUid;
    const convRef = doc(this.firestore, 'chat_conversations', clientUid);
    
    const convUpdate: any = { 
      uid: clientUid, 
      lastMessage: text, 
      lastMessageTime: serverTimestamp() 
    };
    if (senderEmail) convUpdate.email = senderEmail; 
    if (receiverUid === 'ADMIN') convUpdate.unreadCount = increment(1);

    batch.set(convRef, convUpdate, { merge: true });
    await batch.commit();
  }

  async deleteMessage(msgId: string) {
    if (!msgId) return;
    await deleteDoc(doc(this.firestore, 'messages', msgId));
  }

  async toggleReaction(msgId: string, uid: string, reaction: 'like' | 'dislike') {
    if (!msgId || !uid) return;
    const msgRef = doc(this.firestore, 'messages', msgId);
    const snap = await getDoc(msgRef);
    if (!snap.exists()) return;
    const data = snap.data() as ChatMessage;
    let likes = data.likes || [];
    let dislikes = data.dislikes || [];
    likes = likes.filter(id => id !== uid);
    dislikes = dislikes.filter(id => id !== uid);
    if (reaction === 'like' && !(data.likes || []).includes(uid)) likes.push(uid);
    else if (reaction === 'dislike' && !(data.dislikes || []).includes(uid)) dislikes.push(uid);
    await updateDoc(msgRef, { likes, dislikes });
  }

  async markAsRead(clientUid: string, readerRole: 'ADMIN' | 'USER') {
    const senderToFind = readerRole === 'ADMIN' ? clientUid : 'ADMIN';
    const receiverToFind = readerRole === 'ADMIN' ? 'ADMIN' : clientUid;
    
    const q = query(
      collection(this.firestore, 'messages'),
      where('senderId', '==', senderToFind),
      where('receiverId', '==', receiverToFind),
      where('read', '==', false)
    );
    const snapshot = await getDocs(q);
    if (!snapshot.empty) {
        const batch = writeBatch(this.firestore);
        snapshot.docs.forEach(doc => batch.update(doc.ref, { read: true }));
        if (readerRole === 'ADMIN') {
            const convRef = doc(this.firestore, 'chat_conversations', clientUid);
            batch.update(convRef, { unreadCount: 0 });
        }
        await batch.commit();
    }
  }

  getUnreadCountForClient(clientUid: string): Observable<number> {
    return runInInjectionContext(this.injector, () => {
        const q = query(
          collection(this.firestore, 'messages'),
          where('senderId', '==', 'ADMIN'),
          where('receiverId', '==', clientUid),
          where('read', '==', false)
        );
        return new Observable<number>(obs => onSnapshot(q, s => obs.next(s.size)));
    });
  }
}
