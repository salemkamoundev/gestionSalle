import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
// CORRECTION : 4 niveaux de remontée au lieu de 5
import { UiService } from '../../../../core/services/ui.service';

@Component({
  selector: 'app-ui-container',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="fixed bottom-4 right-4 z-50 flex flex-col gap-2 pointer-events-none">
      @for (toast of ui.toasts(); track $any(toast).id) {
        <div class="pointer-events-auto min-w-[300px] max-w-md bg-white border-l-4 rounded shadow-lg p-4 transition-all transform animate-slide-in"
             [ngClass]="{
               'border-green-500': $any(toast).type === 'success',
               'border-red-500': $any(toast).type === 'error',
               'border-blue-500': $any(toast).type === 'info',
               'border-orange-500': $any(toast).type === 'warning'
             }">
          <div class="flex justify-between items-start">
            <div class="flex-1">
              <h4 class="font-bold text-sm" 
                  [ngClass]="{
                    'text-green-700': $any(toast).type === 'success',
                    'text-red-700': $any(toast).type === 'error',
                    'text-blue-700': $any(toast).type === 'info',
                    'text-orange-700': $any(toast).type === 'warning'
                  }">
                {{ $any(toast).type | uppercase }}
              </h4>
              <p class="text-slate-600 text-sm mt-1">{{ $any(toast).message }}</p>
            </div>
            <button (click)="ui.removeToast($any(toast).id)" class="text-slate-400 hover:text-slate-600 ml-3">
              <span class="material-icons text-sm">close</span>
            </button>
          </div>
        </div>
      }
    </div>
  `,
  styles: [`
    @keyframes slideIn {
      from { transform: translateX(100%); opacity: 0; }
      to { transform: translateX(0); opacity: 1; }
    }
    .animate-slide-in {
      animation: slideIn 0.3s ease-out forwards;
    }
  `]
})
export class UiContainerComponent {
  ui = inject(UiService);
}
