import { Component, EventEmitter, Output, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-admin-confirm-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule], // FormsModule est CRUCIAL ici
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
    // Reset de l'état
    this.errorMessage = '';
    
    if (!this.password) {
      this.errorMessage = 'Veuillez entrer le mot de passe.';
      return;
    }

    this.loading = true;

    try {
      // Tentative de connexion / vérification
      // On suppose que l'admin est admin@gmail.com comme indiqué dans votre HTML
      const isValid = await this.authService.verifyAdminPassword(this.password);
      
      if (isValid) {
        this.confirmed.emit();
        // On ne remet pas loading à false ici pour laisser la fenetre se fermer proprement
      } else {
        this.errorMessage = 'Mot de passe incorrect.';
        this.loading = false; // On débloque pour permettre de réessayer
      }
    } catch (e) {
      console.error('Erreur auth:', e);
      this.errorMessage = 'Erreur technique lors de la vérification.';
      this.loading = false; // IMPORTANT : On débloque le bouton en cas de crash
    }
  }

  onCancel() {
    this.cancelled.emit();
  }
}
