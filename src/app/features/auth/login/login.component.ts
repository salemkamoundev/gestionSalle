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
    <div class="min-h-screen w-full flex items-center justify-center p-4 bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 relative overflow-hidden">
      
      <div class="absolute top-0 left-0 w-96 h-96 bg-purple-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob"></div>
      <div class="absolute top-0 right-0 w-96 h-96 bg-pink-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-2000"></div>
      <div class="absolute -bottom-32 left-20 w-96 h-96 bg-indigo-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-4000"></div>

      <div class="relative w-full max-w-md bg-white/10 backdrop-blur-xl border border-white/20 rounded-2xl shadow-2xl overflow-hidden z-10">
        
        <div class="pt-10 pb-6 text-center">
          <div class="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-tr from-pink-500 to-purple-600 shadow-lg mb-4">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-8 w-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
          </div>
          <h2 class="text-3xl font-extrabold text-white tracking-tight">La Princesse</h2>
          <p class="text-purple-200 text-sm mt-1 uppercase tracking-widest font-medium">Espace Administration</p>
        </div>

        <div class="p-8 pt-2">
          <form [formGroup]="loginForm" (ngSubmit)="onSubmit()" class="space-y-6">
            
            <div class="group">
              <label class="block text-xs font-medium text-purple-200 mb-1 ml-1 uppercase">Email Professionnel</label>
              <div class="relative">
                <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <span class="material-icons text-purple-300 text-lg">email</span>
                </div>
                <input 
                  type="email" 
                  formControlName="email"
                  class="w-full pl-10 pr-4 py-3 bg-slate-800/50 border border-slate-600 text-white rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent outline-none transition-all placeholder-slate-400 shadow-inner"
                  placeholder="admin@laprincesse.tn"
                >
              </div>
            </div>

            <div class="group">
              <label class="block text-xs font-medium text-purple-200 mb-1 ml-1 uppercase">Mot de passe</label>
              <div class="relative">
                <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <span class="material-icons text-purple-300 text-lg">lock</span>
                </div>
                <input 
                  type="password" 
                  formControlName="password"
                  class="w-full pl-10 pr-4 py-3 bg-slate-800/50 border border-slate-600 text-white rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent outline-none transition-all placeholder-slate-400 shadow-inner"
                  placeholder="••••••••"
                >
              </div>
            </div>

            @if (errorMessage()) {
              <div class="bg-red-500/20 border border-red-500/50 text-red-200 p-3 rounded-lg text-sm flex items-center backdrop-blur-sm animate-pulse">
                <span class="material-icons mr-2 text-base">error_outline</span>
                {{ errorMessage() }}
              </div>
            }

            <button 
              type="submit" 
              [disabled]="loginForm.invalid || isLoading()"
              class="w-full py-3.5 px-4 bg-gradient-to-r from-pink-600 to-purple-600 hover:from-pink-500 hover:to-purple-500 text-white font-bold rounded-lg shadow-lg transform hover:-translate-y-0.5 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none flex items-center justify-center group"
            >
              @if (isLoading()) {
                <svg class="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Connexion en cours...
              } @else {
                Accéder au Dashboard
                <span class="material-icons ml-2 text-sm group-hover:translate-x-1 transition-transform">arrow_forward</span>
              }
            </button>
          </form>
        </div>

        <div class="px-8 py-4 bg-slate-900/30 border-t border-white/10 text-center">
          <p class="text-xs text-slate-400">© 2025 Salle des Fêtes La Princesse</p>
        </div>
      </div>
    </div>
  `,
  styles: [`
    /* Animation pour les blobs d'arrière plan */
    @keyframes blob {
      0% { transform: translate(0px, 0px) scale(1); }
      33% { transform: translate(30px, -50px) scale(1.1); }
      66% { transform: translate(-20px, 20px) scale(0.9); }
      100% { transform: translate(0px, 0px) scale(1); }
    }
    .animate-blob {
      animation: blob 7s infinite;
    }
    .animation-delay-2000 {
      animation-delay: 2s;
    }
    .animation-delay-4000 {
      animation-delay: 4s;
    }
  `]
})
export class LoginComponent {
  private fb = inject(FormBuilder);
  private authService = inject(AuthService);
  private router = inject(Router);

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
      this.errorMessage.set('Identifiants incorrects.');
    } finally {
      this.isLoading.set(false);
    }
  }
}
