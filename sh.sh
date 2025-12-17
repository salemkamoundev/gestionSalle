#!/bin/bash

# ==============================================================================
# TITRE : Script d'Authentification (Login Only + Rôles) - VERSION CLEAN INSTALL
# DESCRIPTION : Supprime les anciens fichiers conflictuels et régénère tout
# VERSION : 2.0 (Force Delete & Regenerate)
# ==============================================================================

set -euo pipefail

# Variables
COLOR_RESET='\033[0m'
COLOR_INFO='\033[0;36m'
COLOR_SUCCESS='\033[0;32m'
COLOR_WARN='\033[0;33m'

log_info() { echo -e "${COLOR_INFO}[INFO] $1${COLOR_RESET}"; }
log_success() { echo -e "${COLOR_SUCCESS}[OK] $1${COLOR_RESET}"; }
log_warn() { echo -e "${COLOR_WARN}[WARN] $1${COLOR_RESET}"; }

# Vérification du dossier racine
if [ ! -d "src" ]; then
    echo "Erreur : Ce script doit être exécuté à la racine du projet Angular."
    exit 1
fi

# ==============================================================================
# ÉTAPE 1 : NETTOYAGE & GÉNÉRATION (CLEAN SLATE)
# ==============================================================================
log_info "Nettoyage des anciens fichiers conflictuels..."

# Suppression préventive pour éviter les conflits de merge Angular CLI
rm -rf src/app/features/auth/login
rm -rf src/app/layout/main-layout
rm -rf src/app/features/dashboard
rm -f src/app/core/services/auth.service.ts
rm -f src/app/core/services/auth.service.spec.ts

log_info "Génération propre des composants..."

# Génération via CLI (sans tests pour aller vite)
ng g service core/services/auth --skip-tests
ng g c features/auth/login --standalone --skip-tests
ng g c layout/main-layout --standalone --skip-tests
ng g c features/dashboard --standalone --skip-tests

# ==============================================================================
# ÉTAPE 2 : IMPLÉMENTATION AUTH SERVICE
# ==============================================================================
log_info "Écriture de AuthService (Signals + Firestore)..."

cat <<'EOF' > src/app/core/services/auth.service.ts
import { Injectable, inject, signal, computed } from '@angular/core';
import { Auth, signInWithEmailAndPassword, signOut, user } from '@angular/fire/auth';
import { Firestore, doc, getDoc } from '@angular/fire/firestore';
import { Router } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { switchMap } from 'rxjs';

export type UserRole = 'ADMIN' | 'SERVER' | null;

export interface AppUser {
  uid: string;
  email: string | null;
  role: UserRole;
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private auth = inject(Auth);
  private firestore = inject(Firestore);
  private router = inject(Router);

  // Observable de l'état Auth Firebase brut
  private user$ = user(this.auth);

  // Signal dérivé qui récupère le rôle dans Firestore
  userState = toSignal(
    this.user$.pipe(
      switchMap(async (u) => {
        if (!u) return null;
        
        // Récupération du rôle dans Firestore
        const userDocRef = doc(this.firestore, `users/${u.uid}`);
        const userSnap = await getDoc(userDocRef);
        const userData = userSnap.data();
        
        return {
          uid: u.uid,
          email: u.email,
          role: (userData?.['role'] as UserRole) || 'SERVER' // Default role
        } as AppUser;
      })
    ),
    { initialValue: undefined } // undefined = loading
  );

  // Helpers
  isAdmin = computed(() => this.userState()?.role === 'ADMIN');
  isServer = computed(() => this.userState()?.role === 'SERVER');

  constructor() {}

  async login(email: string, pass: string): Promise<void> {
    try {
      await signInWithEmailAndPassword(this.auth, email, pass);
      this.router.navigate(['/']); 
    } catch (error) {
      console.error('Erreur login:', error);
      throw error;
    }
  }

  async logout() {
    await signOut(this.auth);
    this.router.navigate(['/login']);
  }

  hasRole(role: UserRole): boolean {
    return this.userState()?.role === role;
  }
}
EOF

# ==============================================================================
# ÉTAPE 3 : CRÉATION DES GUARDS
# ==============================================================================
log_info "Création des Guards..."

mkdir -p src/app/core/guards

# Auth Guard
cat <<'EOF' > src/app/core/guards/auth.guard.ts
import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { toObservable } from '@angular/core/rxjs-interop';
import { filter, map, take } from 'rxjs';

export const authGuard: CanActivateFn = (route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  return toObservable(authService.userState).pipe(
    filter(user => user !== undefined), 
    take(1),
    map(user => {
      if (user) return true;
      return router.createUrlTree(['/login']);
    })
  );
};
EOF

# Admin Guard
cat <<'EOF' > src/app/core/guards/admin.guard.ts
import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { toObservable } from '@angular/core/rxjs-interop';
import { filter, map, take } from 'rxjs';

export const adminGuard: CanActivateFn = (route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  return toObservable(authService.userState).pipe(
    filter(user => user !== undefined),
    take(1),
    map(user => {
      if (user && user.role === 'ADMIN') return true;
      return router.createUrlTree(['/']); 
    })
  );
};
EOF

# ==============================================================================
# ÉTAPE 4 : LOGIN COMPONENT
# ==============================================================================
log_info "Écriture du Login Component..."

cat <<'EOF' > src/app/features/auth/login/login.component.ts
import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { AuthService } from '../../../core/services/auth.service';
import { Router } from '@angular/router';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  template: `
    <div class="min-h-screen bg-slate-100 flex items-center justify-center p-4">
      <div class="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden">
        <div class="bg-blue-600 p-8 text-center">
          <h2 class="text-3xl font-bold text-white">Connexion</h2>
          <p class="text-blue-100 mt-2">Gestion Salle de Jeux</p>
        </div>
        <div class="p-8">
          <form [formGroup]="loginForm" (ngSubmit)="onSubmit()" class="space-y-6">
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input type="email" formControlName="email" class="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition" placeholder="admin@example.com">
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Mot de passe</label>
              <input type="password" formControlName="password" class="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition" placeholder="••••••••">
            </div>
            @if (errorMessage()) {
              <div class="bg-red-50 text-red-600 p-3 rounded-lg text-sm border border-red-200">
                {{ errorMessage() }}
              </div>
            }
            <button type="submit" [disabled]="loginForm.invalid || isLoading()" class="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-lg transition duration-200 disabled:opacity-50 flex justify-center">
              @if (isLoading()) {
                <span class="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full mr-2"></span>
              }
              {{ isLoading() ? 'Connexion...' : 'Se connecter' }}
            </button>
          </form>
        </div>
      </div>
    </div>
  `
})
export class LoginComponent {
  private fb = inject(FormBuilder);
  private authService = inject(AuthService);
  
  isLoading = signal(false);
  errorMessage = signal<string | null>(null);

  loginForm = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(6)]]
  });

  async onSubmit() {
    if (this.loginForm.invalid) return;
    this.isLoading.set(true);
    this.errorMessage.set(null);
    try {
      await this.authService.login(this.loginForm.value.email!, this.loginForm.value.password!);
    } catch (err: any) {
      this.errorMessage.set('Email ou mot de passe incorrect.');
    } finally {
      this.isLoading.set(false);
    }
  }
}
EOF

# ==============================================================================
# ÉTAPE 5 : MAIN LAYOUT
# ==============================================================================
log_info "Écriture du Main Layout..."

cat <<'EOF' > src/app/layout/main-layout/main-layout.component.ts
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
EOF

# ==============================================================================
# ÉTAPE 6 : ROUTING
# ==============================================================================
log_info "Configuration des routes..."

cat <<'EOF' > src/app/app.routes.ts
import { Routes } from '@angular/router';
import { LoginComponent } from './features/auth/login/login.component';
import { MainLayoutComponent } from './layout/main-layout/main-layout.component';
import { DashboardComponent } from './features/dashboard/dashboard.component';
import { authGuard } from './core/guards/auth.guard';
import { adminGuard } from './core/guards/admin.guard';

export const routes: Routes = [
  { path: 'login', component: LoginComponent },
  {
    path: '',
    component: MainLayoutComponent,
    canActivate: [authGuard],
    children: [
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
      { path: 'dashboard', component: DashboardComponent },
      { 
        path: 'admin/serveurs', 
        loadComponent: () => import('./features/dashboard/dashboard.component').then(m => m.DashboardComponent),
        canActivate: [adminGuard] 
      },
      { 
        path: 'admin/config', 
        loadComponent: () => import('./features/dashboard/dashboard.component').then(m => m.DashboardComponent),
        canActivate: [adminGuard] 
      }
    ]
  },
  { path: '**', redirectTo: '' }
];
EOF

log_success "Script terminé avec succès (Installation propre)."