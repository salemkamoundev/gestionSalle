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
    combineLatest([
      this.chatService.getUsers(),
      this.chatService.getAllConversations()
    ]).pipe(
      map(([users, convs]) => {
        const convMap = new Map(convs.map(c => [c.uid, c]));

        // On prend tous les utilisateurs ET les conversations existantes
        const allUids = new Set([...users.map(u => u.uid), ...convs.map(c => c.uid)]);
        
        return Array.from(allUids).map(uid => {
            const user = users.find(u => u.uid === uid);
            const conv = convMap.get(uid);
            
            // Priorité aux infos de la collection 'users', sinon conversation
            const displayName = user?.displayName || conv?.displayName || user?.email || conv?.email || 'Utilisateur Inconnu';
            const email = user?.email || conv?.email || '';
            const role = user?.role || 'USER';

            return {
                uid,
                email,
                displayName,
                lastMessage: conv?.lastMessage || 'Aucun message',
                lastMessageTime: conv?.lastMessageTime || null,
                unreadCount: conv?.unreadCount || 0,
                role: role
            } as (ChatConversation & { role?: string });
        })
        .filter(c => c.role !== 'ADMIN') // On cache l'admin lui-même
        .sort((a, b) => {
            const timeA = this.getTime(a.lastMessageTime);
            const timeB = this.getTime(b.lastMessageTime);
            if (timeA !== timeB) return timeB - timeA;
            return (a.displayName || '').localeCompare(b.displayName || '');
        });
      })
    ).subscribe(list => {
      this.conversations.set(list);
    });
  }

  private getTime(ts: any): number {
    if (!ts) return 0;
    if (ts.toMillis) return ts.toMillis();
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
