import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet, RouterLink, RouterLinkActive, Router, NavigationEnd } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { filter } from 'rxjs';

@Component({
  selector: 'app-main-layout',
  standalone: true,
  imports: [CommonModule, RouterOutlet, RouterLink, RouterLinkActive],
  template: `
    <div class="flex h-screen bg-slate-50 overflow-hidden relative">
      
      <div *ngIf="isMobileMenuOpen()" 
           class="fixed inset-0 bg-slate-900/50 z-40 md:hidden backdrop-blur-sm transition-opacity"
           (click)="closeMobileMenu()">
      </div>

      <aside class="fixed inset-y-0 left-0 z-50 w-72 bg-slate-900 text-white flex flex-col shadow-2xl transition-transform duration-300 ease-in-out md:relative md:translate-x-0"
             [class.-translate-x-full]="!isMobileMenuOpen()"
             [class.translate-x-0]="isMobileMenuOpen()">
        
        <div class="p-6 border-b border-slate-800 flex flex-col items-center text-center relative">
          <button (click)="closeMobileMenu()" class="absolute top-4 right-4 text-slate-400 hover:text-white md:hidden">
            <span class="material-icons">close</span>
          </button>

          <div class="w-12 h-12 rounded-full bg-gradient-to-tr from-pink-500 to-purple-600 flex items-center justify-center shadow-lg mb-3 mt-2 md:mt-0">
             <span class="material-icons text-white">apartment</span>
          </div>
          <h1 class="text-xl font-bold tracking-wider text-white">LA PRINCESSE</h1>
        </div>

        <div class="px-6 py-4 bg-slate-800/50 border-b border-slate-800 flex items-center gap-3">
          <div class="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center font-bold shrink-0">
            {{ (authService.userState()?.email?.charAt(0) || 'A') | uppercase }}
          </div>
          <div class="overflow-hidden">
            <p class="text-sm font-medium truncate w-40">{{ authService.userState()?.email }}</p>
            <span class="text-[10px] bg-green-600 px-1.5 py-0.5 rounded text-white font-bold tracking-wide">
              {{ authService.userState()?.role || 'INVITÉ' }}
            </span>
          </div>
        </div>

        <nav class="flex-1 px-4 py-6 space-y-2 overflow-y-auto custom-scrollbar">
          
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

      <div class="flex-1 flex flex-col h-full overflow-hidden w-full">
        
        <header class="bg-white border-b border-slate-200 p-4 flex items-center justify-between md:hidden shadow-sm z-30 shrink-0">
          <div class="flex items-center">
            <button (click)="openMobileMenu()" class="p-2 -ml-2 mr-2 text-slate-600 hover:bg-slate-100 rounded-lg">
              <span class="material-icons text-2xl">menu</span>
            </button>
            <span class="font-bold text-slate-800 text-lg">La Princesse</span>
          </div>
          <div class="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center text-white font-bold text-xs">
            {{ (authService.userState()?.email?.charAt(0) || 'A') | uppercase }}
          </div>
        </header>

        <main class="flex-1 overflow-auto bg-slate-50 p-4 md:p-8 w-full">
          <router-outlet></router-outlet>
        </main>
      </div>

    </div>
  `
})
export class MainLayoutComponent {
  authService = inject(AuthService);
  private router = inject(Router);

  // État du menu mobile
  isMobileMenuOpen = signal(false);

  constructor() {
    // Fermer le menu automatiquement quand on change de page
    this.router.events.pipe(
      filter(event => event instanceof NavigationEnd)
    ).subscribe(() => {
      this.closeMobileMenu();
    });
  }

  openMobileMenu() {
    this.isMobileMenuOpen.set(true);
  }

  closeMobileMenu() {
    this.isMobileMenuOpen.set(false);
  }
}
