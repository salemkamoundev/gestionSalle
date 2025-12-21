import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AngularFireAuth } from '@angular/fire/compat/auth';
import { AngularFirestore } from '@angular/fire/compat/firestore';
import { Observable } from 'rxjs';

@Component({
  selector: 'app-admin-chat',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './chat.component.html',
  styles: [` .chat-container { height: 70vh; overflow-y: auto; } `]
})
export class AdminChatComponent implements OnInit {
  isAdmin = false;
  loadingAuth = true;
  currentUserEmail: string | null = null;
  newMessage = '';
  messages$: Observable<any[]>;

  constructor(
    private afAuth: AngularFireAuth,
    private firestore: AngularFirestore
  ) {
    this.messages$ = this.firestore.collection('admin_announcements', ref => 
      ref.orderBy('createdAt', 'asc')
    ).valueChanges({ idField: 'id' });
  }

  ngOnInit(): void {
    console.log("🚀 Initialisation du chat, attente de Firebase...");
    
    // authState est un Observable qui émet à chaque changement de session
    this.afAuth.authState.subscribe({
      next: (user) => {
        this.loadingAuth = false;
        if (user) {
          this.currentUserEmail = user.email;
          this.isAdmin = (user.email?.toLowerCase() === 'admin@gmail.com');
          console.log("✅ Utilisateur détecté :", user.email, "| Admin ?", this.isAdmin);
        } else {
          console.log("⚠️ Aucun utilisateur connecté selon Firebase");
          this.isAdmin = false;
        }
      },
      error: (err) => {
        console.error("🔥 Erreur AuthState :", err);
        this.loadingAuth = false;
      }
    });
  }

  async sendMessage() {
    if (!this.isAdmin || !this.newMessage.trim()) return;
    
    try {
      await this.firestore.collection('admin_announcements').add({
        text: this.newMessage,
        sender: 'Admin',
        createdAt: new Date().toISOString(),
        notificationSent: false 
      });
      this.newMessage = '';
    } catch (e) {
      console.error("Erreur d'envoi Firestore :", e);
    }
  }
}
