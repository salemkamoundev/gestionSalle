#!/bin/bash

# fix_chat_horizontal_scroll.sh
# 1. Ajoute 'overflow-x-hidden' sur les conteneurs scrollables.
# 2. Ajoute 'break-words' sur les bulles de messages pour éviter l'élargissement forcé.

# --- 1. CHAT ADMIN ---
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

    <div class="flex-1 overflow-y-auto overflow-x-hidden custom-scrollbar p-2 space-y-1">
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
      <div class="p-4 bg-white border-b border-slate-200 flex items-center gap-3 shadow-sm z-10 shrink-0">
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

      <div #scrollContainer class="flex-1 overflow-y-auto overflow-x-hidden p-4 space-y-4 custom-scrollbar">
        @if (messages().length === 0) {
          <div class="flex flex-col items-center justify-center h-full text-slate-400 opacity-60">
            <span class="material-icons text-4xl mb-2">waving_hand</span>
            <p class="text-sm">Envoyez un message pour démarrer.</p>
          </div>
        }

        @for (msg of messages(); track msg.id) {
          <div class="flex flex-col group relative" [class.items-end]="msg.senderId === 'ADMIN'" [class.items-start]="msg.senderId !== 'ADMIN'">
            
            <div class="max-w-[85%] md:max-w-[75%] rounded-2xl p-3 shadow-sm text-sm relative break-words"
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

# --- 2. CHAT USER/STAFF ---
cat > src/app/chat/chat.component.html << 'EOF'
<div class="flex flex-col h-screen bg-slate-50 p-4 gap-4">
  <div class="flex justify-between items-center bg-white p-4 rounded-xl shadow-sm border border-slate-200 shrink-0">
    <div class="flex items-center gap-3">
      <a routerLink="/my-planning" class="p-2 hover:bg-slate-50 rounded-full transition text-slate-500 hover:text-indigo-600">
        <span class="material-icons">arrow_back</span>
      </a>
      <div class="flex flex-col">
        <h1 class="text-lg font-bold text-slate-800 flex items-center gap-2">
          <span class="material-icons text-indigo-500">chat</span> Mes Messages
        </h1>
        <p class="text-xs text-slate-500">Discussion avec l'administration</p>
      </div>
    </div>
    <div class="px-3 py-1 bg-green-50 text-green-700 rounded-full text-xs font-medium border border-green-100 flex items-center gap-1">
      <span class="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span> En ligne
    </div>
  </div>

  <div class="flex flex-col flex-1 bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden min-h-0">
    <div #scrollContainer class="flex-1 overflow-y-auto overflow-x-hidden p-4 space-y-4 bg-slate-50/30 custom-scrollbar">
      
      @if (messages().length === 0) {
        <div class="flex flex-col items-center justify-center h-full text-slate-400 gap-2">
          <span class="material-icons text-4xl opacity-20">forum</span>
          <p class="text-sm">Aucun message.</p>
        </div>
      }

      @for (msg of messages(); track msg.id) {
        <div class="flex flex-col group relative" [class.items-end]="isMe(msg)" [class.items-start]="!isMe(msg)">
          
          <div class="max-w-[80%] rounded-2xl p-3 shadow-sm text-sm relative transition-all break-words"
               [class.bg-indigo-600]="isMe(msg)" [class.text-white]="isMe(msg)" [class.rounded-br-none]="isMe(msg)"
               [class.bg-white]="!isMe(msg)" [class.text-slate-700]="!isMe(msg)" [class.border]="!isMe(msg)" [class.border-slate-200]="!isMe(msg)" [class.rounded-bl-none]="!isMe(msg)">
            
            {{ msg.text }}
            
            <div class="flex justify-end items-center gap-2 mt-1 opacity-70">
              @if ((msg.likes?.length || 0) > 0) { <span class="text-[10px] flex items-center"><span class="material-icons text-[10px] mr-0.5">thumb_up</span> {{msg.likes?.length}}</span> }
              @if ((msg.dislikes?.length || 0) > 0) { <span class="text-[10px] flex items-center"><span class="material-icons text-[10px] mr-0.5">thumb_down</span> {{msg.dislikes?.length}}</span> }
              <span class="text-[10px]">{{ formatTime(msg.createdAt) }}</span>
              @if (isMe(msg)) { <span class="material-icons text-[10px] ml-0.5" [class.opacity-100]="msg.read" [class.opacity-40]="!msg.read">done_all</span> }
            </div>
          </div>

          <div class="absolute top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1 bg-white shadow-md rounded-full px-2 py-1 z-20"
               [class.-left-24]="isMe(msg)" [class.-right-24]="!isMe(msg)">
            
            @if (isMe(msg)) {
              <button (click)="deleteMsg(msg)" class="p-1 hover:text-red-500 text-slate-400 transition"><span class="material-icons text-xs">delete</span></button>
            }
            @if (!isMe(msg)) {
              <button (click)="react(msg, 'like')" class="p-1 transition" [class.text-blue-500]="hasLiked(msg)" [class.text-slate-400]="!hasLiked(msg)"><span class="material-icons text-xs">thumb_up</span></button>
              <button (click)="react(msg, 'dislike')" class="p-1 transition" [class.text-orange-500]="hasDisliked(msg)" [class.text-slate-400]="!hasDisliked(msg)"><span class="material-icons text-xs">thumb_down</span></button>
            }
          </div>

        </div>
      }
    </div>

    <div class="p-3 bg-white border-t border-slate-100 shrink-0">
      <div class="flex items-end gap-2 bg-slate-50 p-2 rounded-xl border border-slate-200 focus-within:border-indigo-300 transition-all">
        <textarea [(ngModel)]="newMessage" (keydown.enter)="onEnter($event)" placeholder="Écrivez votre message..." class="flex-1 bg-transparent border-none focus:ring-0 text-sm text-slate-700 resize-none max-h-32 py-2" rows="1"></textarea>
        <button (click)="sendMessage()" [disabled]="!newMessage.trim()" class="p-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition"><span class="material-icons text-sm">send</span></button>
      </div>
    </div>
  </div>
</div>
EOF