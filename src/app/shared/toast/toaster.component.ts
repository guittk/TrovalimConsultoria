import { Component, inject } from '@angular/core';
import { ToastService } from './toast.service';

@Component({
  selector: 'app-toaster',
  standalone: true,
  template: `
    <div class="toaster" aria-live="polite" aria-atomic="false">
      @for (t of toast.toasts(); track t.id) {
        <div class="toast" [class.toast-error]="t.kind === 'error'" [class.toast-success]="t.kind === 'success'" role="status">
          <svg class="toast-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            @if (t.kind === 'error') {
              <circle cx="12" cy="12" r="10" /><path d="M12 8v4" /><path d="M12 16h.01" />
            } @else {
              <path d="M20 6 9 17l-5-5" />
            }
          </svg>
          <span class="toast-msg">{{ t.message }}</span>
          <button type="button" class="toast-close" (click)="toast.dismiss(t.id)" aria-label="Fechar aviso">✕</button>
        </div>
      }
    </div>
  `,
})
export class ToasterComponent {
  readonly toast = inject(ToastService);
}
