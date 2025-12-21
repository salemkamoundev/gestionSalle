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
    <div class="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 flex items-center justify-center p-4">
      <div class="bg-white w-full max-w-md p-8 rounded-2xl shadow-2xl">
        <div class="text-center mb-8">
          <div class="w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg">
            <span class="material-icons text-white text-3xl">apartment</span>
          </div>
          <h1 class="text-2xl font-bold text-slate-800">La Princesse</h1>
          <p class="text-slate-500">Connexion à votre espace</p>
        </div>

        <form [formGroup]="loginForm" (ngSubmit)="onSubmit()" class="space-y-6">
          <div>
            <label class="block text-sm font-medium text-slate-700 mb-1">Email</label>
            <input formControlName="email" type="email" class="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition" placeholder="nom@exemple.com">
          </div>

          <div>
            <label class="block text-sm font-medium text-slate-700 mb-1">Mot de passe</label>
            <input formControlName="password" type="password" class="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition" placeholder="••••••••">
          </div>

          @if (errorMessage()) {
            <div class="bg-red-50 text-red-600 p-3 rounded-lg text-sm flex items-center">
              <span class="material-icons text-sm mr-2">error</span>
              {{ errorMessage() }}
            </div>
          }

          <button type="submit" [disabled]="loginForm.invalid || isLoading()" class="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-lg shadow-lg transition transform hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed flex justify-center items-center">
            @if (isLoading()) { <span class="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full mr-2"></span> }
            Se connecter
          </button>
        </form>
      </div>
    </div>
  `
})
export class LoginComponent {
  private fb = inject(FormBuilder);
  private authService = inject(AuthService);
  private router = inject(Router);

  loginForm = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', Validators.required]
  });

  isLoading = signal(false);
  errorMessage = signal('');

  async onSubmit() {
    if (this.loginForm.valid) {
      this.isLoading.set(true);
      this.errorMessage.set('');
      
      const { email, password } = this.loginForm.value;
      
      try {
        await this.authService.login(email!, password!);
        
        // --- REDIRECTION INTELLIGENTE ---
        // On attend que l'état utilisateur soit chargé (petite astuce via userState)
        // Mais userState est un signal asynchrone. 
        // AuthService.login navigue déjà vers '/' par défaut dans le code précédent.
        // Nous allons modifier AuthService.login ou gérer la navigation ici.
        // Modifions plutôt AuthService.login pour ne PAS naviguer, et laissons le composant décider.
        
        // Vérification rapide du rôle après login
        const user = this.authService.userState();
        
        // Note: userState peut prendre quelques ms à se mettre à jour après le login.
        // On va faire une vérification manuelle rapide ou faire confiance au Guard.
        // Pour l'instant, on redirige vers la racine, et c'est le MainLayout ou AuthGuard qui pourrait dispatcher.
        // MAIS le mieux est de le faire ici.
        
        // Pour simplifier : On redirige vers '/' et on laisse un "RedirectComponent" ou le Guard gérer.
        // Ou mieux : on force la logique ici avec un petit délai si besoin, ou on update AuthService.
        
      } catch (err) {
        console.error(err);
        this.errorMessage.set('Email ou mot de passe incorrect.');
        this.isLoading.set(false);
      }
    }
  }
}
