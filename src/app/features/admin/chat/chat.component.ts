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
  styles: [`
    .custom-scrollbar::-webkit-scrollbar { width: 5px; }
    .custom-scrollbar::-webkit-scrollbar-track { background: #f8fafc; }
    .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 10px; }
    .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #94a3b8; }
  `]
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
