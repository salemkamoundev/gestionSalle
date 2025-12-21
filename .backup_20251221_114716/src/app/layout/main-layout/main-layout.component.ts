import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet, RouterLink, RouterLinkActive, Router, NavigationEnd } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { filter } from 'rxjs';
import { UiContainerComponent } from '../../shared/components/ui-container.component';

@Component({
  selector: 'app-main-layout',
  standalone: true,
  imports: [CommonModule, RouterOutlet, RouterLink, RouterLinkActive, UiContainerComponent],
  template: `
    <div class="flex h-screen bg-slate-50 overflow-hidden relative">
      <app-ui-container></app-ui-container>
      
      <aside class="w-72 bg-slate-900 text-white flex flex-col shadow-2xl">
        <div class="p-6 border-b border-slate-800 text-center">
          <h1 class="text-xl font-bold text-white">LA PRINCESSE</h1>
        </div>

        <nav class="flex-1 px-4 py-6 space-y-2 overflow-y-auto">
          <p class="px-4 text-xs font-semibold text-slate-500 uppercase mb-2">Navigation</p>
          
          <a routerLink="/dashboard" routerLinkActive="bg-purple-600 shadow-lg" class="flex items-center px-4 py-3 rounded-lg text-slate-300 hover:bg-slate-800 transition"><span class="material-icons mr-3">dashboard</span> Dashboard</a>
          <a routerLink="/reservations" routerLinkActive="bg-purple-600 shadow-lg" class="flex items-center px-4 py-3 rounded-lg text-slate-300 hover:bg-slate-800 transition"><span class="material-icons mr-3">calendar_month</span> Planning</a>

          <p class="mt-8 mb-2 px-4 text-xs font-semibold text-slate-500 uppercase">Administration</p>
          <a routerLink="/admin/serveurs" routerLinkActive="bg-purple-600 shadow-lg" class="flex items-center px-4 py-3 rounded-lg text-slate-300 hover:bg-slate-800 transition"><span class="material-icons mr-3">badge</span> Staff</a>
          <a routerLink="/admin/packs" routerLinkActive="bg-purple-600 shadow-lg" class="flex items-center px-4 py-3 rounded-lg text-slate-300 hover:bg-slate-800 transition"><span class="material-icons mr-3">local_offer</span> Packs</a>

          <a routerLink="/admin/chat" 
             routerLinkActive="bg-pink-600 text-white shadow-xl" 
             class="flex items-center px-4 py-3 rounded-lg bg-slate-800 text-pink-400 border border-pink-500/30 hover:bg-pink-900/20 transition-all duration-300 my-4">
            <span class="material-icons mr-3 animate-pulse">chat</span> 
            <span class="font-bold tracking-widest uppercase">Chat Admin</span>
          </a>

          <a routerLink="/admin/config" routerLinkActive="bg-purple-600 shadow-lg" class="flex items-center px-4 py-3 rounded-lg text-slate-300 hover:bg-slate-800 transition"><span class="material-icons mr-3">settings</span> Config</a>
        </nav>

        <div class="p-4 border-t border-slate-800">
          <button (click)="authService.logout()" class="w-full flex items-center justify-center px-4 py-3 bg-red-900/20 text-red-400 rounded-lg hover:bg-red-600 hover:text-white transition">
            <span class="material-icons text-sm mr-2">logout</span> Déconnexion
          </button>
        </div>
      </aside>

      <main class="flex-1 overflow-auto bg-slate-50 p-8">
        <router-outlet></router-outlet>
      </main>
    </div>
  `
})
export class MainLayoutComponent {
  authService = inject(AuthService);
  isMobileMenuOpen = signal(false);
  closeMobileMenu() { this.isMobileMenuOpen.set(false); }
}