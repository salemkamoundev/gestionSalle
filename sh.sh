#!/bin/bash

# 1. Mise à jour du ChatService pour récupérer TOUS les utilisateurs
cat <<EOF > src/app/core/services/chat.service.ts
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
EOF

# 2. Mise à jour du Composant Admin Chat (Fusion Users + Conversations)
cat <<EOF > src/app/features/admin/chat/chat.component.ts
import { Component, OnInit, inject, signal, effect, ViewChild, ElementRef, AfterViewChecked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Observable, combineLatest } from 'rxjs';
import { map, startWith } from 'rxjs/operators';

import { ChatService, ChatConversation, ChatMessage, ChatUser } from '../../../core/services/chat.service';
import { AuthService } from '../../../core/services/auth.service';

interface AdminChatUser extends ChatUser {
  lastMessage?: string;
  lastMessageTime?: any;
  unreadCount?: number; // Pourrait être calculé
}

@Component({
  selector: 'app-admin-chat',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './chat.component.html',
  styles: [\`
    .custom-scrollbar::-webkit-scrollbar { width: 5px; }
    .custom-scrollbar::-webkit-scrollbar-track { background: #f8fafc; }
    .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 10px; }
    .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #94a3b8; }
  \`]
})
export class ChatComponent implements OnInit, AfterViewChecked {
  private chatService = inject(ChatService);
  private authService = inject(AuthService);

  @ViewChild('scrollContainer') private scrollContainer!: ElementRef;

  // Flux de données combiné : Tous les users + Infos de conversation
  usersList$: Observable<AdminChatUser[]> = combineLatest([
    this.chatService.getUsers(),
    this.chatService.getAllConversations().pipe(startWith([]))
  ]).pipe(
    map(([users, conversations]) => {
      // 1. Filtrer l'admin lui-même pour ne pas qu'il apparaisse dans sa liste
      const filteredUsers = users.filter(u => 
        u.email?.toLowerCase() !== 'admin@gmail.com' && u.role !== 'ADMIN'
      );

      // 2. Fusionner avec les infos de conversation
      return filteredUsers.map(user => {
        const conv = conversations.find(c => c.uid === user.uid);
        return {
          ...user,
          lastMessage: conv?.lastMessage || '',
          lastMessageTime: conv?.lastMessageTime || null,
          displayName: user.displayName || user.email?.split('@')[0] || 'Utilisateur'
        };
      })
      // 3. Trier : Ceux avec messages récents en premier, puis alphabétique
      .sort((a, b) => {
        const timeA = a.lastMessageTime?.seconds || 0;
        const timeB = b.lastMessageTime?.seconds || 0;
        if (timeA !== timeB) return timeB - timeA;
        return (a.email || '').localeCompare(b.email || '');
      });
    })
  );
  
  // État
  selectedUser = signal<AdminChatUser | null>(null);
  messages = signal<ChatMessage[]>([]);
  newMessage = '';
  searchText = '';

  constructor() {}

  ngOnInit(): void {}

  ngAfterViewChecked() {
    this.scrollToBottom();
  }

  scrollToBottom(): void {
    try {
      if (this.scrollContainer) {
        this.scrollContainer.nativeElement.scrollTop = this.scrollContainer.nativeElement.scrollHeight;
      }
    } catch(err) { }
  }

  selectUser(user: AdminChatUser) {
    this.selectedUser.set(user);
    
    // Charger les messages
    this.chatService.getMessages(user.uid).subscribe(msgs => {
      this.messages.set(msgs);
      
      // Marquer comme LU dès qu'on ouvre
      this.chatService.markAsRead(user.uid, 'ADMIN');
    });
  }

  async sendMessage() {
    if (!this.newMessage.trim() || !this.selectedUser()) return;
    
    const text = this.newMessage;
    this.newMessage = ''; 

    const targetUid = this.selectedUser()!.uid;
    
    await this.chatService.sendMessage(text, 'ADMIN', targetUid);
  }

  // Filtrage local pour la recherche
  getFilteredUsers(users: AdminChatUser[] | null): AdminChatUser[] {
    if (!users) return [];
    if (!this.searchText) return users;
    const term = this.searchText.toLowerCase();
    return users.filter(u => 
      (u.email && u.email.toLowerCase().includes(term)) || 
      (u.displayName && u.displayName.toLowerCase().includes(term))
    );
  }

  formatTime(ts: any): string {
    if (!ts) return '';
    const date = ts.toDate ? ts.toDate() : new Date(ts);
    // Si c'est aujourd'hui, afficher l'heure, sinon la date
    const today = new Date();
    const isToday = date.getDate() === today.getDate() &&
                    date.getMonth() === today.getMonth() &&
                    date.getFullYear() === today.getFullYear();
    
    return isToday 
      ? date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      : date.toLocaleDateString([], { day: '2-digit', month: '2-digit' });
  }
}
EOF

# 3. Mise à jour du HTML (Affichage complet)
cat <<EOF > src/app/features/admin/chat/chat.component.html
<div class="flex h-[calc(100vh-100px)] bg-white rounded-xl shadow-xl border border-slate-200 overflow-hidden m-4 font-sans">
  
  <div class="w-1/3 min-w-[300px] flex flex-col border-r border-slate-200 bg-white">
    
    <div class="p-5 border-b border-slate-100 bg-slate-50/50">
      <h2 class="font-black text-slate-800 text-lg mb-4 flex items-center gap-2">
        <span class="material-icons text-blue-600">forum</span> 
        Discussions Staff
      </h2>
      
      <div class="relative group">
        <input type="text" [(ngModel)]="searchText" placeholder="Rechercher un membre..." 
               class="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 bg-white text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition shadow-sm">
        <span class="material-icons absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500 transition">search</span>
      </div>
    </div>

    <div class="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-1">
      @if (usersList$ | async; as users) {
        @for (user of getFilteredUsers(users); track user.uid) {
          
          <div (click)="selectUser(user)"
               class="p-3 rounded-xl cursor-pointer transition-all duration-200 group relative border border-transparent"
               [class.bg-blue-50]="selectedUser()?.uid === user.uid"
               [class.border-blue-100]="selectedUser()?.uid === user.uid"
               [class.hover:bg-slate-50]="selectedUser()?.uid !== user.uid">
            
            <div class="flex items-center gap-3">
              <div class="relative">
                <div class="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold shadow-sm transition-colors"
                     [ngClass]="selectedUser()?.uid === user.uid ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-500 group-hover:bg-slate-200'">
                  {{ (user.email || 'U').charAt(0).toUpperCase() }}
                </div>
                <div class="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-500 border-2 border-white rounded-full"></div>
              </div>

              <div class="flex-1 min-w-0">
                <div class="flex justify-between items-baseline mb-0.5">
                  <h3 class="font-bold text-slate-700 text-sm truncate pr-2"
                      [class.text-blue-700]="selectedUser()?.uid === user.uid">
                    {{ user.displayName }}
                  </h3>
                  <span class="text-[10px] text-slate-400 shrink-0 font-medium">
                    {{ formatTime(user.lastMessageTime) }}
                  </span>
                </div>
                
                <p class="text-xs truncate transition-colors"
                   [ngClass]="selectedUser()?.uid === user.uid ? 'text-blue-600/80' : 'text-slate-500 group-hover:text-slate-700'">
                   @if (user.lastMessage) {
                     {{ user.lastMessage }}
                   } @else {
                     <span class="italic opacity-70">Aucun message</span>
                   }
                </p>
              </div>
            </div>
          </div>

        } @empty {
          <div class="flex flex-col items-center justify-center h-48 text-slate-400">
            <span class="material-icons text-3xl mb-2 opacity-50">person_off</span>
            <p class="text-xs">Aucun utilisateur trouvé</p>
          </div>
        }
      }
    </div>
  </div>

  <div class="w-2/3 flex flex-col bg-slate-50 relative">
    
    @if (selectedUser()) {
      <div class="px-6 py-4 bg-white border-b border-slate-200 flex justify-between items-center shadow-sm z-10">
        <div class="flex items-center gap-4">
          <div class="w-10 h-10 rounded-full bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center text-white font-bold shadow-md">
            {{ (selectedUser()?.email || 'U').charAt(0).toUpperCase() }}
          </div>
          <div>
            <h3 class="font-black text-slate-800 text-sm">{{ selectedUser()?.displayName }}</h3>
            <p class="text-xs text-slate-500 flex items-center gap-1.5">
              <span class="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
              {{ selectedUser()?.email }}
            </p>
          </div>
        </div>
      </div>

      <div #scrollContainer class="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar bg-[url('https://www.transparenttextures.com/patterns/subtle-white-feathers.png')]">
        @for (msg of messages(); track msg.id) {
          <div class="flex w-full group" [ngClass]="msg.senderId === 'ADMIN' ? 'justify-end' : 'justify-start'">
            
            <div class="max-w-[70%] flex flex-col" [ngClass]="msg.senderId === 'ADMIN' ? 'items-end' : 'items-start'">
              
              <div class="px-5 py-3 rounded-2xl text-sm shadow-sm leading-relaxed transition-all hover:shadow-md"
                   [ngClass]="msg.senderId === 'ADMIN' 
                      ? 'bg-blue-600 text-white rounded-tr-none' 
                      : 'bg-white text-slate-700 border border-slate-200 rounded-tl-none'">
                {{ msg.text }}
              </div>
              
              <div class="flex items-center gap-1.5 mt-1.5 px-1 opacity-60 group-hover:opacity-100 transition-opacity">
                <span class="text-[10px] font-medium text-slate-400">{{ formatTime(msg.createdAt) }}</span>
                @if (msg.senderId === 'ADMIN') {
                  <span class="material-icons text-[12px]" [ngClass]="msg.read ? 'text-blue-500' : 'text-slate-300'">done_all</span>
                }
              </div>

            </div>
          </div>
        }
        @if (messages().length === 0) {
            <div class="flex flex-col items-center justify-center h-full text-slate-400">
                <span class="material-icons text-4xl mb-2 opacity-30">chat</span>
                <p class="text-sm">Démarrez la conversation avec {{ selectedUser()?.displayName }}</p>
            </div>
        }
      </div>

      <div class="p-5 bg-white border-t border-slate-200 z-10">
        <form (submit)="sendMessage()" class="flex gap-3 items-center">
          <div class="flex-1 relative">
            <input type="text" [(ngModel)]="newMessage" name="msg" 
                   placeholder="Écrivez votre message..." 
                   class="w-full pl-6 pr-4 py-3.5 bg-slate-100 rounded-full border border-transparent outline-none focus:bg-white focus:border-blue-300 focus:ring-4 focus:ring-blue-50 transition text-sm shadow-inner"
                   autocomplete="off">
          </div>
          <button type="submit" [disabled]="!newMessage.trim()" 
                  class="bg-blue-600 hover:bg-blue-700 text-white rounded-full w-12 h-12 flex items-center justify-center shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:shadow-none disabled:translate-y-0">
            <span class="material-icons text-sm transform rotate-[-45deg] translate-x-0.5 -translate-y-0.5">send</span>
          </button>
        </form>
      </div>

    } @else {
      <div class="flex-1 flex flex-col items-center justify-center text-slate-400 bg-slate-50/50">
        <div class="w-24 h-24 bg-white rounded-full flex items-center justify-center mb-6 shadow-sm border border-slate-100">
          <span class="material-icons text-5xl text-blue-100">forum</span>
        </div>
        <h3 class="text-xl font-black text-slate-700 mb-2">Messagerie Interne</h3>
        <p class="text-sm text-slate-500 max-w-xs text-center leading-relaxed">
          Sélectionnez un membre du personnel dans la liste pour consulter l'historique ou envoyer un message.
        </p>
      </div>
    }

  </div>
</div>
EOF

echo "Système de chat mis à jour : Liste complète des utilisateurs et gestion des messages lus."