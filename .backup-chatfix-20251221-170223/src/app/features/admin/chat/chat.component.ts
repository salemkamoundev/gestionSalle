import { Component, OnDestroy, OnInit } from '@angular/core';
import { Auth, authState } from '@angular/fire/auth';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { AdminChatService, AdminMessage } from './admin-chat.service';

@Component({
  selector: 'app-chat',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './chat.component.html',
  styleUrls: ['./chat.component.scss'],
})
export class ChatComponent implements OnInit, OnDestroy {
  messages: AdminMessage[] = [];
  text = '';
  sending = false;

  isAdmin = false;
  adminEmail = '';

  private sub?: Subscription;
  private authSub?: Subscription;

  constructor(private adminChat: AdminChatService, private auth: Auth) {}

  ngOnInit(): void {
    // Admin = admin@gmail.com (comme demandé) - on utilise Firebase Auth (pas localStorage)
    this.authSub = authState(this.auth).subscribe((u) => {
      this.adminEmail = (u?.email || '').trim();
      this.isAdmin = this.adminEmail.toLowerCase() === 'admin@gmail.com';
    });

    this.sub = this.adminChat.watchLatest$(200).subscribe((list) => {
      this.messages = [...list].reverse(); // affichage chrono
    });
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
    this.authSub?.unsubscribe();
  }

  async send(): Promise<void> {
    if (!this.isAdmin) return;
    const msg = this.text.trim();
    if (!msg) return;

    this.sending = true;
    try {
      await this.adminChat.sendMessage(msg, this.adminEmail || 'admin@gmail.com');
      this.text = '';
    } finally {
      this.sending = false;
    }
  }
}
