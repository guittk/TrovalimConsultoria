import { Component, inject } from '@angular/core';
import { ConfirmService } from './confirm.service';

@Component({
  selector: 'app-confirm-dialog',
  standalone: true,
  template: `
    @if (confirmSvc.state(); as s) {
      <div class="modal-backdrop show" (click)="$event.target === $event.currentTarget && respond(false)">
        <div class="modal" style="max-width:420px">
          <button class="modal-close" (click)="respond(false)">✕</button>
          @if (s.title) { <div class="modal-title">{{ s.title }}</div> }
          <p style="font-size:.88rem;color:var(--graphite);line-height:1.6;white-space:pre-line">{{ s.message }}</p>
          <div class="modal-footer">
            <button class="btn btn-outline" (click)="respond(false)">{{ s.cancelLabel || 'Cancelar' }}</button>
            <button [class]="s.danger ? 'btn btn-danger' : 'btn btn-primary'" (click)="respond(true)">
              {{ s.confirmLabel || 'Confirmar' }}
            </button>
          </div>
        </div>
      </div>
    }
  `,
})
export class ConfirmDialogComponent {
  readonly confirmSvc = inject(ConfirmService);

  respond(value: boolean): void {
    this.confirmSvc.respond(value);
  }
}
