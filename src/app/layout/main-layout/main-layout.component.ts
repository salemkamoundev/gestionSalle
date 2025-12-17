import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-main-layout',
  standalone: true,
  imports: [CommonModule, RouterOutlet, RouterLink, RouterLinkActive],
  template: `
    <div class="flex h-screen bg-gray-100">
      <aside class="w-64 bg-slate-900 text-white flex flex-col shadow-xl">
        <div class="p-6 border-b border-slate-700">
          <h1 class="text-xl font-bold tracking-wider">GAME CENTER</h1>
          <p class="text-xs text-slate-400 mt-1">{{ authService.userState()?.email }}</p>
          <span class="text-xs px-2 py-0.5 rounded bg-slate-700 mt-2 inline-block">
            {{ authService.userState()?.role }}
          </span>
        </div>
        <nav class="flex-1 p-4 space-y-2">
          <a routerLink="/dashboard" routerLinkActive="bg-blue-600" class="flex items-center px-4 py-3 rounded-lg hover:bg-slate-800 transition cursor-pointer">
            <span class="material-icons mr-3">dashboard</span> Tableau de bord
          </a>
          @if (authService.isAdmin()) {
            <div class="pt-4 pb-2 text-xs font-semibold text-slate-500 uppercase tracking-wide">Administration</div>
            <a routerLink="/admin/serveurs" routerLinkActive="bg-blue-600" class="flex items-center px-4 py-3 rounded-lg hover:bg-slate-800 transition cursor-pointer">
              <span class="material-icons mr-3">people</span> Gestion Serveurs
            </a>
            <a routerLink="/admin/config" routerLinkActive="bg-blue-600" class="flex items-center px-4 py-3 rounded-lg hover:bg-slate-800 transition cursor-pointer">
              <span class="material-icons mr-3">settings</span> Configuration
            </a>
          }
        </nav>
        <div class="p-4 border-t border-slate-700">
          <button (click)="authService.logout()" class="w-full flex items-center justify-center px-4 py-2 bg-red-600 hover:bg-red-700 rounded transition text-sm">
            Déconnexion
          </button>
        </div>
      </aside>
      <main class="flex-1 overflow-auto p-8"><router-outlet></router-outlet></main>
    </div>
  `
})
export class MainLayoutComponent {
  authService = inject(AuthService);
}
