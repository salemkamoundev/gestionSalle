import { Component, inject, signal, effect, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet, RouterLink, RouterLinkActive, Router, NavigationEnd } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { NotificationService } from '../../core/services/notification.service';
import { ChatService } from '../../core/services/chat.service';
import { filter } from 'rxjs';
import { UiContainerComponent } from '../../shared/components/ui-container.component';

@Component({
  selector: 'app-main-layout',
  standalone: true,
  imports: [CommonModule, RouterOutlet, RouterLink, RouterLinkActive, UiContainerComponent],
  templateUrl: './main-layout.component.html'
})
export class MainLayoutComponent {
  authService = inject(AuthService);
  notifService = inject(NotificationService);
  chatService = inject(ChatService);
  private router = inject(Router);
  
  isMobileMenuOpen = signal(false);
  
  unreadCount = signal(0);           // Notifications globales
  unreadChatAdminCount = signal(0);  // Admin: Total conversations non lues
  unreadChatClientCount = signal(0); // Client: Messages admin non lus

  isAdmin = computed(() => this.authService.isAdmin());

  constructor() {
    this.router.events.pipe(filter(event => event instanceof NavigationEnd)).subscribe(() => this.closeMobileMenu());

    effect((onCleanup) => {
       const user = this.authService.userState();
       
       if (!user) {
         this.unreadCount.set(0);
         this.unreadChatAdminCount.set(0);
         this.unreadChatClientCount.set(0);
         return;
       }

       if (user.uid) {
          const sub = this.notifService.getUnreadCount(user.uid).subscribe(c => this.unreadCount.set(c));
          onCleanup(() => sub.unsubscribe());
       }

       if (user.role === 'ADMIN') {
          const subAdmin = this.chatService.getAllConversations().subscribe(convs => {
             const total = convs.reduce((sum, c) => sum + (c.unreadCount || 0), 0);
             this.unreadChatAdminCount.set(total);
          });
          onCleanup(() => subAdmin.unsubscribe());
       } else {
          // CLIENT : On utilise la nouvelle méthode getUnreadCountForClient
          const subClient = this.chatService.getUnreadCountForClient(user.uid).subscribe(c => {
             this.unreadChatClientCount.set(c);
          });
          onCleanup(() => subClient.unsubscribe());
       }
    });
  }

  openMobileMenu() { this.isMobileMenuOpen.set(true); }
  closeMobileMenu() { this.isMobileMenuOpen.set(false); }
}
