import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AngularFireAuth } from '@angular/fire/compat/auth';
import { AngularFirestore } from '@angular/fire/compat/firestore';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

@Component({
  selector: 'app-admin-chat',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './admin-chat.component.html',
  styles: [`
    .chat-container { height: calc(100vh - 160px); }
    .msg-admin { border-left: 4px solid #ef4444; }
  `]
})
export class AdminChatComponent implements OnInit {
  messages$: Observable<any[]>;
  newMessage: string = '';
  currentUserEmail: string | null = null;
  isAdmin: boolean = false;

  constructor(
    private afAuth: AngularFireAuth,
    private firestore: AngularFirestore
  ) {
    // Récupération des messages triés par date
    this.messages$ = this.firestore.collection('admin_announcements', ref => 
      ref.orderBy('createdAt', 'asc')
    ).valueChanges({ idField: 'id' });
  }

    // Vérifier si l'utilisateur est admin@gmail.com
 ngOnInit(): void {
    console.log("🚀 Initialisation du chat, attente de Firebase...");
    
    // authState est un Observable qui émet à chaque changement de session
    this.afAuth.authState.subscribe({
      next: (user) => {
        this.isAdmin = false;
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
        this.isAdmin = false;
      }
    });
  
  }

  async sendMessage() {
    if (!this.isAdmin || !this.newMessage.trim()) return;

    const message = {
      text: this.newMessage,
      sender: 'Admin',
      createdAt: new Date().toISOString(),
      // Ce flag 'notificationSent' sera utilisé par votre script Node.js 
      // pour envoyer le push et ne pas le renvoyer en boucle
      notificationSent: false 
    };

    try {
      await this.firestore.collection('admin_announcements').add(message);
      this.newMessage = '';
      this.scrollToBottom();
    } catch (err) {
      console.error("Erreur d'envoi :", err);
    }
  }

  private scrollToBottom() {
    setTimeout(() => {
      const objDiv = document.getElementById("chatList");
      if (objDiv) objDiv.scrollTop = objDiv.scrollHeight;
    }, 100);
  }
}
