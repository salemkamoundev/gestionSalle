import { Component, OnInit, inject, ViewChild, ElementRef, AfterViewChecked, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ChatService, ChatMessage } from '../core/services/chat.service';
import { AuthService } from '../core/services/auth.service';

@Component({
  selector: 'app-chat',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './chat.component.html',
  styles: [`
    .custom-scrollbar::-webkit-scrollbar { width: 4px; }
    .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 10px; }
  `]
})
export class ChatComponent implements OnInit, AfterViewChecked {
  private chatService = inject(ChatService);
  private authService = inject(AuthService);

  @ViewChild('scrollContainer') private scrollContainer!: ElementRef;

  messages = signal<ChatMessage[]>([]);
  newMessage = '';
  currentUserUid = '';
  currentUserEmail = '';

  constructor() {
    const user = this.authService.userState();
    if (user) {
      this.currentUserUid = user.uid;
      this.currentUserEmail = user.email || '';
    }
  }

  ngOnInit(): void {
    if (this.currentUserUid) {
      // Charger les messages du user courant
      this.chatService.getMessages(this.currentUserUid).subscribe(msgs => {
        this.messages.set(msgs);
        // Marquer comme lus ceux de l'admin
        this.chatService.markAsRead(this.currentUserUid, 'USER');
      });
    }
  }

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

  async sendMessage() {
    if (!this.newMessage.trim() || !this.currentUserUid) return;

    const text = this.newMessage;
    this.newMessage = '';

    // User envoie à 'ADMIN'
    await this.chatService.sendMessage(
      text,
      this.currentUserUid,
      'ADMIN',
      this.currentUserEmail
    );
  }

  formatTime(ts: any): string {
    if (!ts) return '';
    const date = ts.toDate ? ts.toDate() : new Date(ts);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
}
