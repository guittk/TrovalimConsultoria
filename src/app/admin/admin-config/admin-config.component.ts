import { AsyncPipe } from '@angular/common';
import { Component, effect, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../core/auth.service';
import { AccountsService } from '../../core/accounts.service';
import { PlatformSettingsService, DEFAULT_PLATFORM_COLOR } from '../../core/platform-settings.service';
import { StorageSettingsService, DEFAULT_STORAGE_SETTINGS } from '../../core/storage-settings.service';
import { StorageUsageService } from '../../core/storage-usage.service';
import { FileTypeLimit, UserAccount } from '../../core/models';
import { PnavComponent, PnavTab } from '../../shared/pnav/pnav.component';

const ADMIN_TABS: PnavTab[] = [
  { key: 'projetos', label: 'Projetos', path: '/admin' },
  { key: 'clientes', label: 'Clientes', path: '/admin/clientes' },
  { key: 'contas', label: 'Contas', path: '/admin/contas' },
  { key: 'config', label: 'Configurações', path: '/admin/config' },
];

function formatMb(mb: number): string {
  return mb >= 1024 ? `${(mb / 1024).toFixed(1)} GB` : `${Math.round(mb)} MB`;
}

@Component({
  selector: 'app-admin-config',
  standalone: true,
  imports: [AsyncPipe, FormsModule, PnavComponent],
  templateUrl: './admin-config.component.html',
})
export class AdminConfigComponent {
  private readonly auth = inject(AuthService);
  private readonly settingsSvc = inject(PlatformSettingsService);
  private readonly accountsSvc = inject(AccountsService);
  private readonly storageSettingsSvc = inject(StorageSettingsService);
  private readonly storageUsageSvc = inject(StorageUsageService);

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

    effect(() => {
      const s = this.storageSettings();
      if (s && !this.storageSyncedOnce) {
        this.storageSyncedOnce = true;
        this.totalLimitMb.set(s.totalLimitMb);
        this.defaultClientLimitMb.set(s.defaultClientLimitMb);
        this.typeLimitsForm.set(s.typeLimits.map((t) => ({ ...t, extensionsText: t.extensions.join(', ') })));
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

  /* ── ARQUIVOS E ARMAZENAMENTO ── */
  readonly storageSettings = toSignal(this.storageSettingsSvc.get$(), { initialValue: DEFAULT_STORAGE_SETTINGS });
  private storageSyncedOnce = false;

  readonly totalLimitMb = signal(DEFAULT_STORAGE_SETTINGS.totalLimitMb);
  readonly defaultClientLimitMb = signal(DEFAULT_STORAGE_SETTINGS.defaultClientLimitMb);
  readonly typeLimitsForm = signal<(FileTypeLimit & { extensionsText: string })[]>([]);

  readonly storageSavingOk = signal(false);
  readonly storageSavingErr = signal('');
  readonly storageSaving = signal(false);

  readonly totalUsageBytes = toSignal(this.storageUsageSvc.totalUsage$(), { initialValue: 0 });
  readonly recalculating = signal(false);
  readonly recalculateMsg = signal('');

  readonly clients = toSignal(this.accountsSvc.listClients$(), { initialValue: [] as UserAccount[] });
  readonly pendingLimits = signal<Record<string, string>>({});
  readonly savingLimitFor = signal<string | null>(null);

  formatBytes(bytes: number): string {
    return formatMb(bytes / (1024 * 1024));
  }

  formatMb(mb: number): string {
    return formatMb(mb);
  }

  usagePct(usageBytes: number, limitMb: number): number {
    if (!limitMb) return 0;
    return Math.min(100, Math.round((usageBytes / (1024 * 1024) / limitMb) * 100));
  }

  addTypeLimit(): void {
    this.typeLimitsForm.update((rows) => [
      ...rows,
      { key: `tipo-${Date.now()}`, label: 'Novo tipo', extensions: [], maxSizeMb: 10, extensionsText: '' },
    ]);
  }

  removeTypeLimit(index: number): void {
    this.typeLimitsForm.update((rows) => rows.filter((_, i) => i !== index));
  }

  updateTypeLimit(index: number, field: 'label' | 'extensionsText' | 'maxSizeMb', value: string | number): void {
    this.typeLimitsForm.update((rows) =>
      rows.map((r, i) => (i === index ? { ...r, [field]: value } : r)),
    );
  }

  async saveStorageSettings(): Promise<void> {
    this.storageSavingOk.set(false);
    this.storageSavingErr.set('');
    this.storageSaving.set(true);
    try {
      const typeLimits: FileTypeLimit[] = this.typeLimitsForm().map((t) => ({
        key: t.key,
        label: t.label,
        extensions: t.extensionsText
          .split(',')
          .map((e) => e.trim().toLowerCase().replace(/^\./, ''))
          .filter(Boolean),
        maxSizeMb: Number(t.maxSizeMb) || 1,
      }));
      await this.storageSettingsSvc.update({
        totalLimitMb: Number(this.totalLimitMb()) || DEFAULT_STORAGE_SETTINGS.totalLimitMb,
        defaultClientLimitMb: Number(this.defaultClientLimitMb()) || DEFAULT_STORAGE_SETTINGS.defaultClientLimitMb,
        typeLimits,
      });
      this.storageSavingOk.set(true);
      setTimeout(() => this.storageSavingOk.set(false), 3000);
    } catch (e) {
      const err = e as { code?: string; message?: string };
      this.storageSavingErr.set('Erro ao salvar: ' + (err.code || err.message || 'desconhecido'));
    } finally {
      this.storageSaving.set(false);
    }
  }

  async recalculateUsage(): Promise<void> {
    this.recalculating.set(true);
    this.recalculateMsg.set('');
    try {
      await this.storageUsageSvc.recalculate();
      this.recalculateMsg.set('Uso recalculado com sucesso.');
      setTimeout(() => this.recalculateMsg.set(''), 4000);
    } catch {
      this.recalculateMsg.set('Erro ao recalcular o uso.');
    } finally {
      this.recalculating.set(false);
    }
  }

  clientLimitInput(c: UserAccount): string {
    const pending = this.pendingLimits()[c.uid];
    if (pending !== undefined) return pending;
    return c.storageLimitMb != null ? String(c.storageLimitMb) : '';
  }

  setClientLimitInput(uid: string, value: string): void {
    this.pendingLimits.update((m) => ({ ...m, [uid]: value }));
  }

  async saveClientLimit(uid: string): Promise<void> {
    const c = this.clients().find((x) => x.uid === uid);
    const raw = c ? this.clientLimitInput(c) : this.pendingLimits()[uid] || '';
    const trimmed = raw.trim();
    const value = trimmed === '' ? null : Number(trimmed);
    if (value !== null && (Number.isNaN(value) || value <= 0)) return;
    this.savingLimitFor.set(uid);
    try {
      await this.accountsSvc.updateStorageLimit(uid, value);
      this.pendingLimits.update((m) => {
        const copy = { ...m };
        delete copy[uid];
        return copy;
      });
    } finally {
      this.savingLimitFor.set(null);
    }
  }
}
