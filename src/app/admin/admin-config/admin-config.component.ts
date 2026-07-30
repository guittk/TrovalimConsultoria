import { AsyncPipe } from '@angular/common';
import { Component, effect, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../core/auth.service';
import { PlatformSettingsService, DEFAULT_PLATFORM_COLOR } from '../../core/platform-settings.service';
import { PnavComponent, PnavTab } from '../../shared/pnav/pnav.component';

const ADMIN_TABS: PnavTab[] = [
  { key: 'projetos', label: 'Projetos', path: '/admin' },
  { key: 'clientes', label: 'Clientes', path: '/admin/clientes' },
  { key: 'contas', label: 'Contas', path: '/admin/contas' },
  { key: 'config', label: 'Configurações', path: '/admin/config' },
];

@Component({
  selector: 'app-admin-config',
  standalone: true,
  imports: [AsyncPipe, FormsModule, PnavComponent],
  templateUrl: './admin-config.component.html',
})
export class AdminConfigComponent {
  private readonly auth = inject(AuthService);
  private readonly settingsSvc = inject(PlatformSettingsService);

  readonly tabs = ADMIN_TABS;
  readonly userData$ = this.auth.userData$;
  readonly isOwner = toSignal(this.auth.isOwner$, { initialValue: false });

  readonly settings = toSignal(this.settingsSvc.get$(), {
    initialValue: null,
  });

  readonly color = signal(DEFAULT_PLATFORM_COLOR);
  private syncedOnce = false;

  readonly savingOk = signal(false);
  readonly savingErr = signal('');
  readonly saving = signal(false);

  constructor() {
    // Sincroniza o color picker com o valor salvo assim que ele chega do
    // Firestore, mas só uma vez — depois disso o usuário controla o valor.
    effect(() => {
      const s = this.settings();
      if (s && !this.syncedOnce) {
        this.syncedOnce = true;
        this.color.set(s.primaryColor);
      }
    });
  }

  onColorChange(value: string): void {
    this.color.set(value);
  }

  async save(): Promise<void> {
    this.savingOk.set(false);
    this.savingErr.set('');
    this.saving.set(true);
    try {
      await this.settingsSvc.updateColor(this.color());
      this.savingOk.set(true);
      setTimeout(() => this.savingOk.set(false), 3000);
    } catch (e) {
      const err = e as { code?: string; message?: string };
      this.savingErr.set('Erro ao salvar: ' + (err.code || err.message || 'desconhecido'));
    } finally {
      this.saving.set(false);
    }
  }
}
