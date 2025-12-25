import { Component, OnInit, inject, ViewChild, ElementRef, AfterViewChecked, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { ChatService, ChatMessage } from '../core/services/chat.service';
import { AuthService } from '../core/services/auth.service';

@Component({
  selector: 'app-chat',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  styles: [`
    .custom-scrollbar::-webkit-scrollbar { width: 4px; }
    .custom-scrollbar::-webkit-scrollbar-track { background: #f1f5f9; }
    .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 10px; }
    .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #94a3b8; }
  `],
  templateUrl: './chat.component.html'
})
export class ChatComponent implements OnInit, AfterViewChecked {
  private chatService = inject(ChatService);
  private authService = inject(AuthService);
  @ViewChild('scrollContainer') private scrollContainer!: ElementRef;

  messages = signal<ChatMessage[]>([]);
  newMessage = '';
  currentUserUid = '';

  constructor() {
    const user = this.authService.userState();
    if (user) this.currentUserUid = user.uid;
  }

  ngOnInit() {
    if (this.currentUserUid) {
      this.chatService.getMessages(this.currentUserUid).subscribe(msgs => {
        this.messages.set(msgs);
        this.chatService.markAsRead(this.currentUserUid, 'USER');
      });
    }
  }

  ngAfterViewChecked() { this.scrollToBottom(); }

  scrollToBottom() { try { if(this.scrollContainer) this.scrollContainer.nativeElement.scrollTop = this.scrollContainer.nativeElement.scrollHeight; } catch(e){} }

  async sendMessage() {
    if (!this.newMessage.trim() || !this.currentUserUid) return;
    const text = this.newMessage;
    this.newMessage = '';
    await this.chatService.sendMessage(text, this.currentUserUid, 'ADMIN');
  }

  onEnter(event: any) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.sendMessage();
    }
  }

  // ACTIONS
  isMe(msg: ChatMessage): boolean { return msg.senderId === this.currentUserUid; }

  deleteMsg(msg: ChatMessage) {
    if(confirm('Supprimer ce message ?')) this.chatService.deleteMessage(msg.id!);
  }

  react(msg: ChatMessage, type: 'like' | 'dislike') {
    this.chatService.toggleReaction(msg.id!, this.currentUserUid, type);
  }

  hasLiked(msg: ChatMessage): boolean { return (msg.likes || []).includes(this.currentUserUid); }
  hasDisliked(msg: ChatMessage): boolean { return (msg.dislikes || []).includes(this.currentUserUid); }

  formatTime(ts: any): string {
    if (!ts) return '';
    const date = ts.toDate ? ts.toDate() : new Date(ts);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
}
