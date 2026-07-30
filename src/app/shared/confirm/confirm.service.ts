import { Injectable, signal } from '@angular/core';

export interface ConfirmOptions {
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
}

interface ConfirmState extends ConfirmOptions {
  resolve: (value: boolean) => void;
}

@Injectable({ providedIn: 'root' })
export class ConfirmService {
  readonly state = signal<ConfirmState | null>(null);

  /** Substitui o `confirm()` nativo por uma modal interna. Resolve true/false conforme o clique do usuário. */
  confirm(options: ConfirmOptions): Promise<boolean> {
    return new Promise((resolve) => {
      this.state.set({ ...options, resolve });
    });
  }

  respond(value: boolean): void {
    this.state()?.resolve(value);
    this.state.set(null);
  }
}
