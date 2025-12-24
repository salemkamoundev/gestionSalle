import { Injectable, inject } from '@angular/core';
import { 
  Firestore, collection, addDoc, query, where, orderBy, 
  onSnapshot, Timestamp, doc, setDoc, updateDoc, getDoc, 
  writeBatch, serverTimestamp, collectionData 
} from '@angular/fire/firestore';
import { Observable, BehaviorSubject, combineLatest, of } from 'rxjs';
import { map } from 'rxjs/operators';
import { AuthService } from './auth.service';

export interface ChatMessage {
  id?: string;
  text: string;
  senderId: string;
  receiverId: string;
  createdAt: any;
  read: boolean;
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

  constructor() {}

  /**
   * Récupère la liste de TOUS les utilisateurs (pour afficher dans la sidebar)
   * Filtre potentiellement l'admin côté composant
   */
  getUsers(): Observable<ChatUser[]> {
    const usersRef = collection(this.firestore, 'users');
    // On récupère la collection 'users' en temps réel
    return collectionData(usersRef, { idField: 'uid' }) as Observable<ChatUser[]>;
  }

  /**
   * Récupère les métadonnées des conversations existantes (dernier message, etc.)
   */
  getAllConversations(): Observable<ChatConversation[]> {
    const q = query(
      collection(this.firestore, 'chat_conversations'),
      orderBy('lastMessageTime', 'desc')
    );
    return collectionData(q, { idField: 'uid' }) as Observable<ChatConversation[]>;
  }

  /**
   * Envoie un message et met à jour la conversation
   */
  async sendMessage(text: string, senderUid: string, receiverUid: string, senderEmail: string = '') {
    if (!text.trim()) return;

    const batch = writeBatch(this.firestore);

    // 1. Créer le message
    const msgRef = doc(collection(this.firestore, 'messages'));
    const newMessage: any = {
      text,
      senderId: senderUid,
      receiverId: receiverUid,
      createdAt: serverTimestamp(),
      read: false
    };
    batch.set(msgRef, newMessage);

    // 2. Mettre à jour les infos de conversation
    // L'ID de conversation est l'UID de l'autre personne (Client/Staff)
    const clientUid = receiverUid === 'ADMIN' ? senderUid : receiverUid;
    const convRef = doc(this.firestore, 'chat_conversations', clientUid);

    const convUpdate: any = {
      uid: clientUid,
      lastMessage: text,
      lastMessageTime: serverTimestamp()
    };
    
    // Si on a l'email dispo (premier message)
    if (senderEmail) {
      convUpdate.email = senderEmail; 
    }

    batch.set(convRef, convUpdate, { merge: true });
    await batch.commit();
  }

  /**
   * Récupère les messages d'une conversation spécifique
   */
  getMessages(clientUid: string): Observable<ChatMessage[]> {
    const q = query(
      collection(this.firestore, 'messages'),
      orderBy('createdAt', 'asc')
    );

    return collectionData(q, { idField: 'id' }).pipe(
      map((msgs: any[]) => {
        // Filtrage client-side pour simplifier les index Firestore
        return msgs.filter(m => 
          (m.senderId === clientUid && m.receiverId === 'ADMIN') || 
          (m.senderId === 'ADMIN' && m.receiverId === clientUid)
        ) as ChatMessage[];
      })
    );
  }

  /**
   * Marque les messages comme LUS
   */
  async markAsRead(clientUid: string, readerRole: 'ADMIN' | 'USER') {
    const senderToFind = readerRole === 'ADMIN' ? clientUid : 'ADMIN';
    const receiverToFind = readerRole === 'ADMIN' ? 'ADMIN' : clientUid;

    // On cherche les messages non lus envoyés par l'autre
    const q = query(
      collection(this.firestore, 'messages'),
      where('senderId', '==', senderToFind),
      where('receiverId', '==', receiverToFind),
      where('read', '==', false)
    );

    // Note: En production, utiliser une Cloud Function est plus performant pour les batch updates massifs
    // Ici on fait une lecture/écriture simple
    import('@angular/fire/firestore').then(async (fs) => {
        const snapshot = await fs.getDocs(q);
        if (snapshot.empty) return;

        const batch = fs.writeBatch(this.firestore);
        snapshot.docs.forEach(doc => {
            batch.update(doc.ref, { read: true });
        });
        await batch.commit();
    });
  }
}
