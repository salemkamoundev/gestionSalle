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
  template: `
    <div class="flex flex-col h-screen bg-slate-50 p-4 gap-4">
      
      <div class="flex justify-between items-center bg-white p-4 rounded-xl shadow-sm border border-slate-200 shrink-0">
        <div class="flex items-center gap-3">
          <a routerLink="/my-planning" class="p-2 hover:bg-slate-50 rounded-full transition text-slate-500 hover:text-indigo-600">
            <span class="material-icons">arrow_back</span>
          </a>
          
          <div class="flex flex-col">
            <h1 class="text-lg font-bold text-slate-800 flex items-center gap-2">
              <span class="material-icons text-indigo-500">chat</span>
              Mes Messages
            </h1>
            <p class="text-xs text-slate-500">Discussion directe avec l'administration</p>
          </div>
        </div>

        <div class="px-3 py-1 bg-green-50 text-green-700 rounded-full text-xs font-medium border border-green-100 flex items-center gap-1">
          <span class="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
          En ligne
        </div>
      </div>

      <div class="flex flex-col flex-1 bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden min-h-0">
        
        <div #scrollContainer class="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50/30 custom-scrollbar">
          
          @if (messages().length === 0) {
            <div class="flex flex-col items-center justify-center h-full text-slate-400 gap-2">
              <span class="material-icons text-4xl opacity-20">forum</span>
              <p class="text-sm">Aucun message pour le moment.</p>
              <p class="text-xs">Écrivez un message pour contacter l'administration.</p>
            </div>
          }

          @for (msg of messages(); track msg.id) {
            <div class="flex flex-col" [class.items-end]="isMe(msg)" [class.items-start]="!isMe(msg)">
              <div class="max-w-[80%] rounded-2xl p-3 shadow-sm text-sm relative group transition-all"
                   [class.bg-indigo-600]="isMe(msg)"
                   [class.text-white]="isMe(msg)"
                   [class.rounded-br-none]="isMe(msg)"
                   [class.bg-white]="!isMe(msg)"
                   [class.text-slate-700]="!isMe(msg)"
                   [class.border]="!isMe(msg)"
                   [class.border-slate-200]="!isMe(msg)"
                   [class.rounded-bl-none]="!isMe(msg)">
                
                {{ msg.text }}

                <span class="text-[10px] block text-right mt-1 opacity-70">
                  {{ formatTime(msg.createdAt) }}
                  @if (isMe(msg)) {
                    <span class="material-icons text-[10px] align-middle ml-0.5" 
                          [class.opacity-100]="msg.read" 
                          [class.opacity-40]="!msg.read">
                      done_all
                    </span>
                  }
                </span>
              </div>
            </div>
          }
        </div>

        <div class="p-3 bg-white border-t border-slate-100 shrink-0">
          <div class="flex items-end gap-2 bg-slate-50 p-2 rounded-xl border border-slate-200 focus-within:border-indigo-300 focus-within:ring-2 focus-within:ring-indigo-100 transition-all">
            <textarea 
              [(ngModel)]="newMessage" 
              (keydown.enter)="onEnter($event)"
              placeholder="Écrivez votre message..." 
              class="flex-1 bg-transparent border-none focus:ring-0 text-sm text-slate-700 placeholder:text-slate-400 resize-none max-h-32 py-2"
              rows="1"></textarea>
            
            <button (click)="sendMessage()" 
                    [disabled]="!newMessage.trim()"
                    class="p-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition shadow-sm mb-0.5">
              <span class="material-icons text-sm">send</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  `
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
      this.chatService.getMessages(this.currentUserUid).subscribe(msgs => {
        this.messages.set(msgs);
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
    this.newMessage = ''; // Reset immédiat pour UX fluide

    await this.chatService.sendMessage(
      text,
      this.currentUserUid,
      'ADMIN',
      this.currentUserEmail
    );
  }

  // FIX: Utilisation de 'any' pour éviter l'erreur de typage strict Angular entre Event et KeyboardEvent
  onEnter(event: any) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.sendMessage();
    }
  }

  isMe(msg: ChatMessage): boolean {
    return msg.senderId === this.currentUserUid;
  }

  formatTime(ts: any): string {
    if (!ts) return '';
    const date = ts.toDate ? ts.toDate() : new Date(ts);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
}
