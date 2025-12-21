import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-chat',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './chat.component.html',
  styles: []
})
export class ChatComponent implements OnInit {
  newMessage: string = '';
  
  messages = [
    { sender: 'admin', text: 'Bonjour, comment puis-je vous aider avec votre planning aujourd\'hui ?', time: '10:45' },
    { sender: 'user', text: 'J\'ai un problème avec mes horaires du lundi.', time: '10:47' }
  ];

  constructor() {}

  ngOnInit(): void {
    // Scroll auto
  }

  sendMessage() {
    if (this.newMessage.trim() === '') return;

    this.messages.push({
      sender: 'user',
      text: this.newMessage,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    });

    this.newMessage = '';
    
    setTimeout(() => {
      const container = document.getElementById('messagesContainer');
      if(container) container.scrollTop = container.scrollHeight;
    }, 100);
  }
}
