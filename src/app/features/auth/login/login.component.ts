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
