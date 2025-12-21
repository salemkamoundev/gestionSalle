import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { UiService } from '../../core/services/ui.service';

@Component({
  selector: 'app-ui-container',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="fixed top-4 right-4 z-[100] flex flex-col gap-2 pointer-events-none">
      @for (toast of ui.toasts(); track toast.id) {
        <div class="pointer-events-auto min-w-[300px] max-w-sm bg-white rounded-lg shadow-xl border-l-4 p-4 transform transition-all duration-300 animate-slide-in flex items-start"
             [class.border-green-500]="toast.type === 'success'"
             [class.border-red-500]="toast.type === 'error'"
             [class.border-blue-500]="toast.type === 'info'">
          
          <div class="mr-3">
            @if(toast.type === 'success') { <span class="material-icons text-green-500">check_circle</span> }
            @if(toast.type === 'error') { <span class="material-icons text-red-500">error</span> }
            @if(toast.type === 'info') { <span class="material-icons text-blue-500">info</span> }
          </div>
          
          <div class="flex-1">
            <p class="font-medium text-slate-800 text-sm">{{ toast.message }}</p>
          </div>

          <button (click)="ui.removeToast(toast.id)" class="text-slate-400 hover:text-slate-600 ml-2">
            <span class="material-icons text-sm">close</span>
          </button>
        </div>
      }
    </div>

    
    @if (ui.promptData()) {
      <div class="fixed inset-0 z-[111] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm animate-fade-in p-4">
        <div class="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden transform scale-100">

          <div class="flex flex-col items-center pt-6 pb-2">
            <div class="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-3 border border-slate-200">
              <span class="material-icons text-slate-700 text-3xl">lock</span>
            </div>
            <h3 class="text-xl font-bold text-slate-800 text-center px-6">
              {{ ui.promptData()?.title }}
            </h3>
          </div>

          <div class="px-8 py-2 text-center">
            <p class="text-slate-500 text-sm leading-relaxed">
              {{ ui.promptData()?.message }}
            </p>
          </div>

          <div class="px-8 pb-2 pt-3">
            <label class="text-xs font-bold text-slate-500 uppercase tracking-wider">Saisie</label>
            <input
              class="mt-2 w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/30"
              [type]="ui.promptData()?.type || 'text'"
              [placeholder]="ui.promptData()?.placeholder || ''"
              (input)="ui.promptData()?.setValue($any($event.target).value)"
              (keydown.enter)="ui.promptData()?.resolve(ui.promptData()?.getValue() || null)"
              autocomplete="current-password"
            />
            <p class="mt-2 text-[11px] text-slate-400">
              Appuie sur Entrée pour valider.
            </p>
          </div>

          <div class="p-6 flex gap-3">
            <button
              (click)="ui.promptData()?.resolve(null)"
              class="flex-1 py-2.5 border border-slate-300 rounded-lg text-slate-700 font-medium hover:bg-slate-50 transition"
            >
              {{ ui.promptData()?.cancelLabel }}
            </button>

            <button
              (click)="ui.promptData()?.resolve(ui.promptData()?.getValue() || null)"
              class="flex-1 py-2.5 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 transition shadow"
            >
              {{ ui.promptData()?.confirmLabel }}
            </button>
          </div>

        </div>
      </div>
    }

@if (ui.confirmData()) {
      <div class="fixed inset-0 z-[110] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm animate-fade-in p-4">
        <div class="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden transform scale-100">
          
          <div class="flex flex-col items-center pt-6 pb-2">
            <div class="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mb-3">
              <span class="material-icons text-red-500 text-3xl">help_outline</span>
            </div>
            <h3 class="text-xl font-bold text-slate-800 text-center px-6">
              {{ ui.confirmData()?.title }}
            </h3>
          </div>

          <div class="px-8 py-2 text-center">
            <p class="text-slate-500 text-sm leading-relaxed">
              {{ ui.confirmData()?.message }}
            </p>
          </div>

          <div class="p-6 flex gap-3">
            <button (click)="ui.confirmData()?.resolve(false)" 
                    class="flex-1 py-2.5 border border-slate-300 rounded-lg text-slate-700 font-medium hover:bg-slate-50 transition">
              {{ ui.confirmData()?.cancelLabel }}
            </button>
            <button (click)="ui.confirmData()?.resolve(true)" 
                    class="flex-1 py-2.5 bg-red-600 text-white rounded-lg font-bold hover:bg-red-700 shadow-md transition">
              {{ ui.confirmData()?.confirmLabel }}
            </button>
          </div>

        </div>
      </div>
    }
  `,
  styles: [`
    @keyframes slideIn {
      from { opacity: 0; transform: translateX(20px); }
      to { opacity: 1; transform: translateX(0); }
    }
    .animate-slide-in { animation: slideIn 0.3s ease-out; }
    
    @keyframes fadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }
    .animate-fade-in { animation: fadeIn 0.2s ease-out; }
  `]
})
export class UiContainerComponent {
  ui = inject(UiService);
}
