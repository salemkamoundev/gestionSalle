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

  private authService = inject(AuthService);

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
      // Appel direct au service sécurisé
      const isValid = await this.authService.verifyAdminPassword(this.password);
      
      if (isValid) {
        this.confirmed.emit();
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
