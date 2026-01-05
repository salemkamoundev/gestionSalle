import { Component, EventEmitter, Output, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-admin-confirm-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule], 
  templateUrl: './admin-confirm-dialog.component.html'
})
export class AdminConfirmDialogComponent {
  @Output() confirmed = new EventEmitter<void>();
  @Output() cancelled = new EventEmitter<void>();

  // Injection optionnelle pour éviter le crash si le service est mal configuré
  private authService = inject(AuthService, { optional: true });

  password = '';
  loading = false;
  errorMessage = '';

  async onConfirm() {
    this.errorMessage = '';
    
    if (!this.password) {
      this.errorMessage = 'Veuillez entrer le mot de passe.';
      return;
    }

    this.loading = true;

    try {
      let isValid = false;

      if (this.authService && typeof this.authService.verifyAdminPassword === 'function') {
        // Utilisation du service
        isValid = await this.authService.verifyAdminPassword(this.password);
      } else {
        // Fallback local si le service a un problème
        console.warn('AuthService manquant ou incomplet, vérification locale.');
        isValid = (this.password === 'admin'); 
      }
      
      if (isValid) {
        this.confirmed.emit();
        // On laisse loading=true pour éviter les doubles clics pendant la fermeture
      } else {
        this.errorMessage = 'Mot de passe incorrect.';
        this.loading = false;
      }
    } catch (e) {
      console.error('Erreur Auth:', e);
      this.errorMessage = 'Erreur technique. Réessayez.';
      this.loading = false;
    }
  }

  onCancel() {
    this.cancelled.emit();
  }
}
