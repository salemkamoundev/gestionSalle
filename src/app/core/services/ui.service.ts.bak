import { Injectable, signal } from '@angular/core';

export interface Toast {
  id: number;
  type: 'success' | 'error' | 'info';
  message: string;
}

export interface ConfirmData {
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel: string;
  resolve: (val: boolean) => void;
}

@Injectable({ providedIn: 'root' })
export class UiService {
  // Gestion des Toasts
  toasts = signal<Toast[]>([]);
  private toastCounter = 0;

  // Gestion de la Modale de Confirmation
  confirmData = signal<ConfirmData | null>(null);

  showToast(type: 'success' | 'error' | 'info', message: string) {
    const id = this.toastCounter++;
    this.toasts.update(current => [...current, { id, type, message }]);
    
    // Auto remove après 3 secondes
    setTimeout(() => {
      this.removeToast(id);
    }, 3000);
  }

  removeToast(id: number) {
    this.toasts.update(current => current.filter(t => t.id !== id));
  }

  // Remplace window.confirm() par une Promesse
  confirm(title: string, message: string, confirmLabel = 'Confirmer', cancelLabel = 'Annuler'): Promise<boolean> {
    return new Promise((resolve) => {
      this.confirmData.set({
        title,
        message,
        confirmLabel,
        cancelLabel,
        resolve: (val: boolean) => {
          this.confirmData.set(null); // Fermer la modale
          resolve(val);
        }
      });
    });
  }
}
