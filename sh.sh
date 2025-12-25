#!/bin/bash

# 1. MISE À JOUR DE LA LOGIQUE (chat.component.ts)
# On utilise combineLatest pour fusionner Users + Conversations.
# On ajoute une méthode closeChat() pour le mobile.

cat > src/app/features/admin/chat/chat.component.ts << 'EOF'
import { Component, OnInit, inject, ViewChild, ElementRef, AfterViewChecked, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { combineLatest } from 'rxjs';
import { map } from 'rxjs/operators';
import { ChatService, ChatMessage, ChatConversation } from '../../../core/services/chat.service';

@Component({
  selector: 'app-admin-chat',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './chat.component.html',
  styles: [`
    .custom-scrollbar::-webkit-scrollbar { width: 4px; }
    .custom-scrollbar::-webkit-scrollbar-track { background: #f1f5f9; }
    .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 10px; }
    .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #94a3b8; }
  `]
})
export class ChatComponent implements OnInit, AfterViewChecked {
  private chatService = inject(ChatService);
  @ViewChild('scrollContainer') private scrollContainer!: ElementRef;

  conversations = signal<ChatConversation[]>([]);
  messages = signal<ChatMessage[]>([]);
  selectedUser = signal<ChatConversation | null>(null);
  newMessage = '';

  ngOnInit() {
    // Fusionner la liste de TOUS les utilisateurs avec les conversations actives
    combineLatest([
      this.chatService.getUsers(),
      this.chatService.getAllConversations()
    ]).pipe(
      map(([users, convs]) => {
        // Créer une Map des conversations existantes pour accès rapide
        const convMap = new Map(convs.map(c => [c.uid, c]));

        // Mapper chaque utilisateur vers un objet ChatConversation
        return users
          .filter(u => u.role !== 'ADMIN') // On n'affiche pas l'admin lui-même
          .map(u => {
            const existing = convMap.get(u.uid);
            if (existing) {
              // Si une conversation existe, on la garde (avec historique, unreadCount...)
              // On s'assure juste que le displayName est à jour si besoin
              return { ...existing, displayName: existing.displayName || u.displayName || u.email };
            }
            // Sinon, on crée une "coquille vide" pour l'utilisateur sans historique
            return {
              uid: u.uid,
              email: u.email,
              displayName: u.displayName || u.email,
              lastMessage: 'Aucun message',
              lastMessageTime: null,
              unreadCount: 0
            } as ChatConversation;
          })
          .sort((a, b) => {
            // Tri : Conversations actives en premier (par date), puis par nom
            const timeA = this.getTime(a.lastMessageTime);
            const timeB = this.getTime(b.lastMessageTime);
            if (timeA !== timeB) return timeB - timeA; // Descendant
            return (a.displayName || '').localeCompare(b.displayName || '');
          });
      })
    ).subscribe(list => {
      this.conversations.set(list);
    });
  }

  // Helper pour extraire le timestamp
  private getTime(ts: any): number {
    if (!ts) return 0;
    if (ts.toMillis) return ts.toMillis(); // Firestore Timestamp
    if (ts instanceof Date) return ts.getTime();
    return 0;
  }

  ngAfterViewChecked() { this.scrollToBottom(); }

  scrollToBottom(): void {
    try { if (this.scrollContainer) this.scrollContainer.nativeElement.scrollTop = this.scrollContainer.nativeElement.scrollHeight; } catch(err) { }
  }

  selectUser(conv: ChatConversation) {
    this.selectedUser.set(conv);
    this.loadMessages(conv.uid);
    if (conv.unreadCount && conv.unreadCount > 0) {
      this.chatService.markAsRead(conv.uid, 'ADMIN');
    }
  }

  // Action pour le mobile : Fermer le chat et revenir à la liste
  closeChat() {
    this.selectedUser.set(null);
  }

  loadMessages(uid: string) {
    this.chatService.getMessages(uid).subscribe(msgs => {
      this.messages.set(msgs);
      setTimeout(() => this.scrollToBottom(), 50);
    });
  }

  async sendMessage() {
    const user = this.selectedUser();
    if (!this.newMessage.trim() || !user) return;
    const text = this.newMessage;
    this.newMessage = '';
    await this.chatService.sendMessage(text, 'ADMIN', user.uid);
  }

  // ACTIONS
  deleteMsg(msg: ChatMessage) {
    if(confirm('Supprimer ce message ?')) this.chatService.deleteMessage(msg.id!);
  }

  react(msg: ChatMessage, type: 'like' | 'dislike') {
    this.chatService.toggleReaction(msg.id!, 'ADMIN', type);
  }

  hasLiked(msg: ChatMessage): boolean { return (msg.likes || []).includes('ADMIN'); }
  hasDisliked(msg: ChatMessage): boolean { return (msg.dislikes || []).includes('ADMIN'); }

  formatTime(ts: any): string {
    if (!ts) return '';
    const date = ts.toDate ? ts.toDate() : new Date(ts);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
}
EOF

# 2. MISE À JOUR DU HTML (chat.component.html)
# Structure Responsive :
# - Sidebar : Visible par défaut. Cachée sur mobile SI un user est sélectionné.
# - Chat Area : Cachée sur mobile SI aucun user sélectionné. Visible sinon.
# - Bouton Retour : Visible uniquement sur mobile dans le header du chat.

cat > src/app/features/admin/chat/chat.component.html << 'EOF'
<div class="flex h-full bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden relative">
  
  <div class="flex flex-col border-r border-slate-200 bg-slate-50/50 w-full md:w-80 transition-all absolute md:static inset-0 z-10"
       [class.hidden]="selectedUser() && 'md:flex'" 
       [class.flex]="!selectedUser() || 'md:flex'">
       
    <div class="p-4 border-b border-slate-100 bg-white">
      <h2 class="font-bold text-slate-800 flex items-center gap-2">
        <span class="material-icons text-indigo-500">people</span> Utilisateurs
      </h2>
    </div>

    <div class="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-1">
      @if (conversations().length === 0) {
        <div class="p-4 text-center text-slate-400 text-sm">
          Aucun utilisateur trouvé.
        </div>
      }

      @for (conv of conversations(); track conv.uid) {
        <div (click)="selectUser(conv)"
             class="p-3 rounded-lg cursor-pointer transition-all hover:bg-white hover:shadow-sm border border-transparent hover:border-slate-100 relative group"
             [class.bg-white]="selectedUser()?.uid === conv.uid"
             [class.shadow-sm]="selectedUser()?.uid === conv.uid"
             [class.border-indigo-100]="selectedUser()?.uid === conv.uid">
          
          <div class="flex justify-between items-start mb-1">
            <span class="font-semibold text-sm text-slate-700 truncate max-w-[140px]"
                  [class.text-indigo-700]="selectedUser()?.uid === conv.uid">
              {{ conv.displayName || conv.email }}
            </span>
            @if(conv.lastMessageTime) {
              <span class="text-[10px] text-slate-400 whitespace-nowrap">{{ formatTime(conv.lastMessageTime) }}</span>
            }
          </div>
          
          <div class="flex justify-between items-center">
            <p class="text-xs text-slate-500 truncate max-w-[180px]" 
               [class.font-medium]="(conv.unreadCount || 0) > 0"
               [class.text-slate-800]="(conv.unreadCount || 0) > 0">
              {{ conv.lastMessage || 'Démarrer une conversation' }}
            </p>
            
            @if ((conv.unreadCount || 0) > 0) {
              <span class="min-w-[18px] h-[18px] flex items-center justify-center bg-red-500 text-white text-[10px] font-bold rounded-full px-1 shadow-sm">
                {{ conv.unreadCount }}
              </span>
            }
          </div>
        </div>
      }
    </div>
  </div>

  <div class="flex-col bg-slate-50 relative w-full h-full md:flex-1 transition-all z-20 md:z-0"
       [class.flex]="selectedUser()"
       [class.hidden]="!selectedUser() && 'md:flex'">
       
    @if (selectedUser(); as user) {
      <div class="p-4 bg-white border-b border-slate-200 flex items-center gap-3 shadow-sm z-10">
        
        <button (click)="closeChat()" class="md:hidden p-2 -ml-2 rounded-full hover:bg-slate-100 text-slate-500">
          <span class="material-icons">arrow_back</span>
        </button>

        <div class="flex-1">
          <h3 class="font-bold text-slate-800">{{ user.displayName || user.email }}</h3>
          <p class="text-xs text-slate-500 flex items-center gap-1">
            <span class="w-1.5 h-1.5 rounded-full bg-green-500"></span>
            En ligne
          </p>
        </div>
      </div>

      <div #scrollContainer class="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
        @if (messages().length === 0) {
          <div class="flex flex-col items-center justify-center h-full text-slate-400 opacity-60">
            <span class="material-icons text-4xl mb-2">waving_hand</span>
            <p class="text-sm">Envoyez un message pour démarrer.</p>
          </div>
        }

        @for (msg of messages(); track msg.id) {
          <div class="flex flex-col group relative" [class.items-end]="msg.senderId === 'ADMIN'" [class.items-start]="msg.senderId !== 'ADMIN'">
            
            <div class="max-w-[85%] md:max-w-[75%] rounded-2xl p-3 shadow-sm text-sm relative"
                 [class.bg-indigo-600]="msg.senderId === 'ADMIN'"
                 [class.text-white]="msg.senderId === 'ADMIN'"
                 [class.rounded-br-none]="msg.senderId === 'ADMIN'"
                 [class.bg-white]="msg.senderId !== 'ADMIN'"
                 [class.text-slate-700]="msg.senderId !== 'ADMIN'"
                 [class.rounded-bl-none]="msg.senderId !== 'ADMIN'">
              
              {{ msg.text }}
              
              <div class="flex justify-end items-center gap-2 mt-1 opacity-70">
                @if ((msg.likes?.length || 0) > 0) { <span class="text-[10px] flex items-center"><span class="material-icons text-[10px] mr-0.5">thumb_up</span> {{msg.likes?.length}}</span> }
                @if ((msg.dislikes?.length || 0) > 0) { <span class="text-[10px] flex items-center"><span class="material-icons text-[10px] mr-0.5">thumb_down</span> {{msg.dislikes?.length}}</span> }
                
                <span class="text-[10px]">{{ formatTime(msg.createdAt) }}</span>
              </div>
            </div>

            <div class="absolute top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1 bg-white shadow-md rounded-full px-2 py-1 z-20"
                 [class.-left-24]="msg.senderId === 'ADMIN'"
                 [class.-right-24]="msg.senderId !== 'ADMIN'">
              
              @if (msg.senderId === 'ADMIN') {
                <button (click)="deleteMsg(msg)" class="p-1 hover:text-red-500 text-slate-400 transition" title="Supprimer">
                  <span class="material-icons text-xs">delete</span>
                </button>
              }
              @if (msg.senderId !== 'ADMIN') {
                <button (click)="react(msg, 'like')" class="p-1 transition" [class.text-blue-500]="hasLiked(msg)" [class.text-slate-400]="!hasLiked(msg)">
                  <span class="material-icons text-xs">thumb_up</span>
                </button>
                <button (click)="react(msg, 'dislike')" class="p-1 transition" [class.text-orange-500]="hasDisliked(msg)" [class.text-slate-400]="!hasDisliked(msg)">
                  <span class="material-icons text-xs">thumb_down</span>
                </button>
              }
            </div>

          </div>
        }
      </div>

      <div class="p-3 bg-white border-t border-slate-200 shrink-0">
        <div class="flex items-center gap-2 bg-slate-100 p-2 rounded-xl border border-transparent focus-within:border-indigo-300 focus-within:bg-white transition-all">
          <input type="text" 
                 [(ngModel)]="newMessage"
                 (keydown.enter)="sendMessage()"
                 placeholder="Écrivez votre message..."
                 class="flex-1 bg-transparent border-none focus:ring-0 text-sm text-slate-700 placeholder:text-slate-400">
          
          <button (click)="sendMessage()" 
                  [disabled]="!newMessage.trim()"
                  class="p-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition shadow-sm">
            <span class="material-icons text-sm">send</span>
          </button>
        </div>
      </div>

    } @else {
      <div class="hidden md:flex flex-1 flex-col items-center justify-center text-slate-400">
        <span class="material-icons text-6xl opacity-20 mb-4">chat_bubble_outline</span>
        <p>Sélectionnez un utilisateur pour commencer</p>
      </div>
    }
  </div>
</div>
EOF

echo "Mise à jour terminée : Tous les utilisateurs affichés + Responsive Mobile."