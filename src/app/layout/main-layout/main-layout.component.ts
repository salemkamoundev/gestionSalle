import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-main-layout',
  standalone: true,
  imports: [CommonModule, RouterOutlet, RouterLink, RouterLinkActive],
  template: `
    <div class="flex h-screen bg-slate-50 overflow-hidden">
      
      <aside class="w-72 bg-slate-900 text-white flex flex-col shadow-2xl relative z-50">
        
        <div class="p-8 border-b border-slate-800 flex flex-col items-center text-center">
          <div class="w-12 h-12 rounded-full bg-gradient-to-tr from-pink-500 to-purple-600 flex items-center justify-center shadow-lg mb-3">
             <span class="material-icons text-white">apartment</span>
          </div>
          <h1 class="text-xl font-bold tracking-wider text-white">LA PRINCESSE</h1>
        </div>

        <div class="px-6 py-4 bg-slate-800/50 border-b border-slate-800 flex items-center gap-3">
          <div class="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center font-bold">
            {{ (authService.userState()?.email?.charAt(0) || 'A') | uppercase }}
          </div>
          <div class="overflow-hidden">
            <p class="text-sm font-medium truncate w-40">{{ authService.userState()?.email }}</p>
            <span class="text-[10px] bg-green-600 px-1.5 py-0.5 rounded text-white font-bold tracking-wide">
              {{ authService.userState()?.role || 'INVITÉ' }}
            </span>
          </div>
        </div>

        <nav class="flex-1 px-4 py-6 space-y-2 overflow-y-auto">
          
          <p class="px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Général</p>
          
          <a routerLink="/dashboard" routerLinkActive="bg-purple-600 text-white shadow-lg" [routerLinkActiveOptions]="{exact: true}" 
             class="flex items-center px-4 py-3 rounded-lg text-slate-300 hover:bg-slate-800 hover:text-white transition cursor-pointer">
            <span class="material-icons mr-3">dashboard</span>
            Tableau de bord
          </a>

          <a routerLink="/reservations" routerLinkActive="bg-purple-600 text-white shadow-lg" 
             class="flex items-center px-4 py-3 rounded-lg text-slate-300 hover:bg-slate-800 hover:text-white transition cursor-pointer">
            <span class="material-icons mr-3">calendar_month</span>
            Planning
          </a>

          <p class="mt-8 mb-2 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Administration</p>

          <a routerLink="/admin/clients" routerLinkActive="bg-purple-600 text-white shadow-lg" 
             class="flex items-center px-4 py-3 rounded-lg text-slate-300 hover:bg-slate-800 hover:text-white transition cursor-pointer">
            <span class="material-icons mr-3">groups</span>
            Clients
          </a>

          <a routerLink="/admin/serveurs" routerLinkActive="bg-purple-600 text-white shadow-lg" 
             class="flex items-center px-4 py-3 rounded-lg text-slate-300 hover:bg-slate-800 hover:text-white transition cursor-pointer">
            <span class="material-icons mr-3">badge</span>
            Équipe & Staff
          </a>

          <a routerLink="/admin/config" routerLinkActive="bg-purple-600 text-white shadow-lg" 
             class="flex items-center px-4 py-3 rounded-lg text-slate-300 hover:bg-slate-800 hover:text-white transition cursor-pointer">
            <span class="material-icons mr-3">settings</span>
            Configuration
          </a>

        </nav>

        <div class="p-4 border-t border-slate-800">
          <button (click)="authService.logout()" class="w-full flex items-center justify-center px-4 py-3 bg-slate-800 hover:bg-red-600 text-slate-300 hover:text-white rounded-lg transition cursor-pointer">
            <span class="material-icons text-sm mr-2">logout</span>
            Déconnexion
          </button>
        </div>
      </aside>

      <main class="flex-1 overflow-auto bg-slate-50 p-6 md:p-10 relative z-0">
        <router-outlet></router-outlet>
      </main>
    </div>
  `
})
export class MainLayoutComponent {
  authService = inject(AuthService);
}
