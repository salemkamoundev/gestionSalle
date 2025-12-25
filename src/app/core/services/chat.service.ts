import { Injectable, inject } from '@angular/core';
import { 
  Firestore, collection, query, orderBy, 
  doc, deleteDoc, updateDoc, getDoc, 
  writeBatch, serverTimestamp, collectionData, increment, where 
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
  likes?: string[];     // UIDs des users qui ont liké
  dislikes?: string[];  // UIDs des users qui ont disliké
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

  constructor() {}

  // --- LECTURE ---

  getUsers(): Observable<ChatUser[]> {
    const usersRef = collection(this.firestore, 'users');
    return collectionData(usersRef, { idField: 'uid' }) as Observable<ChatUser[]>;
  }

  getAllConversations(): Observable<ChatConversation[]> {
    const q = query(
      collection(this.firestore, 'chat_conversations'),
      orderBy('lastMessageTime', 'desc')
    );
    return collectionData(q, { idField: 'uid' }) as Observable<ChatConversation[]>;
  }

  getMessages(clientUid: string): Observable<ChatMessage[]> {
    const q = query(
      collection(this.firestore, 'messages'),
      orderBy('createdAt', 'asc')
    );

    return collectionData(q, { idField: 'id' }).pipe(
      map((msgs: any[]) => {
        return msgs.filter(m => 
          (m.senderId === clientUid && m.receiverId === 'ADMIN') || 
          (m.senderId === 'ADMIN' && m.receiverId === clientUid)
        ) as ChatMessage[];
      })
    );
  }

  // --- ACTIONS ---

  async sendMessage(text: string, senderUid: string, receiverUid: string, senderEmail: string = '') {
    if (!text.trim()) return;

    const batch = writeBatch(this.firestore);

    const msgRef = doc(collection(this.firestore, 'messages'));
    const newMessage: any = {
      text,
      senderId: senderUid,
      receiverId: receiverUid,
      createdAt: serverTimestamp(),
      read: false,
      likes: [],
      dislikes: []
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

  // NOUVEAU : Supprimer un message
  async deleteMessage(msgId: string) {
    if (!msgId) return;
    const msgRef = doc(this.firestore, 'messages', msgId);
    await deleteDoc(msgRef);
  }

  // NOUVEAU : Liker ou Disliker
  async toggleReaction(msgId: string, uid: string, reaction: 'like' | 'dislike') {
    if (!msgId || !uid) return;
    
    const msgRef = doc(this.firestore, 'messages', msgId);
    const snap = await getDoc(msgRef);
    
    if (!snap.exists()) return;

    const data = snap.data() as ChatMessage;
    let likes = data.likes || [];
    let dislikes = data.dislikes || [];

    // On retire l'utilisateur des deux listes pour commencer (nettoyage)
    likes = likes.filter(id => id !== uid);
    dislikes = dislikes.filter(id => id !== uid);

    // On vérifie l'état précédent pour savoir si on ajoute ou si on retire (toggle)
    const wasLiked = (data.likes || []).includes(uid);
    const wasDisliked = (data.dislikes || []).includes(uid);

    // Si c'est un Like et qu'il n'était pas déjà liké -> on ajoute
    if (reaction === 'like' && !wasLiked) {
      likes.push(uid);
    }
    // Si c'est un Dislike et qu'il n'était pas déjà disliké -> on ajoute
    else if (reaction === 'dislike' && !wasDisliked) {
      dislikes.push(uid);
    }

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

    import('@angular/fire/firestore').then(async (fs) => {
        const snapshot = await fs.getDocs(q);
        if (!snapshot.empty) {
            const batch = fs.writeBatch(this.firestore);
            snapshot.docs.forEach(doc => batch.update(doc.ref, { read: true }));
            
            if (readerRole === 'ADMIN') {
                const convRef = doc(this.firestore, 'chat_conversations', clientUid);
                batch.update(convRef, { unreadCount: 0 });
            }
            await batch.commit();
        }
    });
  }
}
