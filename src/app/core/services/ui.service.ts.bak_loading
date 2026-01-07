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



export interface PromptData {
  title: string;
  message: string;
  placeholder?: string;
  type?: 'text' | 'password';
  confirmLabel: string;
  cancelLabel: string;

  // Gestion de la valeur sans FormsModule (via closures)
  setValue: (val: string) => void;
  getValue: () => string;

  resolve: (val: string | null) => void;
}
@Injectable({ providedIn: 'root' })
export class UiService {
  // Gestion des Toasts
  toasts = signal<Toast[]>([]);
  private toastCounter = 0;

  // Gestion de la Modale de Confirmation
  confirmData = signal<ConfirmData | null>(null);

  // Gestion de la Modale de Saisie (Prompt)
  promptData = signal<PromptData | null>(null);

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


  // Remplace window.prompt() par une Promesse (modale custom)
  prompt(
    title: string,
    message: string,
    opts: { placeholder?: string; type?: 'text' | 'password'; confirmLabel?: string; cancelLabel?: string } = {}
  ): Promise<string | null> {
    return new Promise((resolve) => {
      let current = '';
      const setValue = (val: string) => { current = val; };
      const getValue = () => current;

      this.promptData.set({
        title,
        message,
        placeholder: opts.placeholder ?? '',
        type: opts.type ?? 'text',
        confirmLabel: opts.confirmLabel ?? 'Valider',
        cancelLabel: opts.cancelLabel ?? 'Annuler',
        setValue,
        getValue,
        resolve: (val: string | null) => {
          this.promptData.set(null); // Fermer la modale
          resolve(val);
        }
      });
    });
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
