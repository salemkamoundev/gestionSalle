import { Component, EventEmitter, Output, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
// CORRECTION ICI : 3 niveaux de remontée au lieu de 4
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-admin-confirm-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './admin-confirm-dialog.component.html',
  styles: [`
    .animate-fade-in { animation: fadeIn 0.2s ease-out forwards; }
    @keyframes fadeIn { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }
  `]
})
export class AdminConfirmDialogComponent {
  @Output() close = new EventEmitter<boolean>();
  
  private authService = inject(AuthService);
  
  password = '';
  isLoading = signal(false);
  errorMessage = signal('');

  async confirm() {
    if (!this.password) return;

    this.isLoading.set(true);
    this.errorMessage.set('');

    try {
      const isValid = await this.authService.verifyPassword(this.password);
      
      if (isValid) {
        this.close.emit(true);
      } else {
        this.errorMessage.set('Mot de passe incorrect.');
        this.isLoading.set(false);
      }
    } catch (error) {
      console.error(error);
      this.errorMessage.set('Erreur de vérification.');
      this.isLoading.set(false);
    }
  }

  cancel() {
    this.close.emit(false);
  }
}
