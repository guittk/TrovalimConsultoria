import { AsyncPipe } from '@angular/common';
import { Component, effect, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { map } from 'rxjs';
import { AuthService, normRole } from '../../core/auth.service';
import { EmpresasService } from '../../core/empresas.service';
import { StorageSettingsService, DEFAULT_STORAGE_SETTINGS } from '../../core/storage-settings.service';
import { StorageUsageService } from '../../core/storage-usage.service';
import {
  ProjectStatusSettingsService,
  DEFAULT_PROJECT_STATUS_SETTINGS,
  DEFAULT_STATUS_COLORS,
  statusColorFor,
} from '../../core/project-status-settings.service';
import { CatalogSettingsService, PRICING_UNITS, DEFAULT_CATALOG_SETTINGS } from '../../core/catalog-settings.service';
import { PushService } from '../../core/push.service';
import { ThemeService, ThemeMode } from '../../core/theme.service';
import { Functions, httpsCallable } from 'firebase/functions';
import { FIREBASE_FUNCTIONS } from '../../core/firebase.providers';
import { CatalogExtraction, CatalogItem, Empresa, FileTypeLimit, ProjectStatusOption } from '../../core/models';
import { PnavComponent } from '../../shared/pnav/pnav.component';
import { SelectComponent } from '../../shared/select/select.component';
import { ToastService } from '../../shared/toast/toast.service';
import { AdminAccountsComponent } from '../admin-accounts/admin-accounts.component';
import { PlatformGuideComponent } from './platform-guide.component';
import { ADMIN_TABS } from '../admin-tabs';

let catKeySeq = 0;
const newCatKey = () => `cat-${Date.now()}-${catKeySeq++}`;

function formatMb(mb: number): string {
  return mb >= 1024 ? `${(mb / 1024).toFixed(1)} GB` : `${Math.round(mb)} MB`;
}

// Preços aproximados do Firebase Storage no plano Blaze (us-central1, jul/2026).
// Serve só de referência — não inclui banda de download, que também é cobrada
// além dos 1 GB/dia gratuitos.
const FREE_STORAGE_GB = 5;
const PRICE_PER_GB_MONTH_USD = 0.026;

@Component({
  selector: 'app-admin-config',
  standalone: true,
  imports: [AsyncPipe, FormsModule, PnavComponent, SelectComponent, AdminAccountsComponent, PlatformGuideComponent],
  templateUrl: './admin-config.component.html',
})
export class AdminConfigComponent {
  private readonly auth = inject(AuthService);
  private readonly empresasSvc = inject(EmpresasService);
  private readonly storageSettingsSvc = inject(StorageSettingsService);
  private readonly storageUsageSvc = inject(StorageUsageService);
  private readonly statusSettingsSvc = inject(ProjectStatusSettingsService);
  private readonly catalogSvc = inject(CatalogSettingsService);
  private readonly pushSvc = inject(PushService);
  private readonly functions: Functions = inject(FIREBASE_FUNCTIONS);
  private readonly themeSvc = inject(ThemeService);
  private readonly toast = inject(ToastService);

  /** Tema da área de conteúdo — preferência deste navegador, ver ThemeService. */
  readonly theme = this.themeSvc.theme;

  setTheme(mode: ThemeMode): void {
    this.themeSvc.set(mode);
  }

  readonly tabs = ADMIN_TABS;
  readonly userData$ = this.auth.userData$;
  readonly isOwner = toSignal(this.auth.isOwner$, { initialValue: false });

  /** Abas da tela: ajustes, contas de acesso e o Guia da plataforma. */
  readonly activeTab = signal<'config' | 'contas' | 'guia'>('config');

  /** Aba "Contas" some pra um manager que teve essa aba escondida (era o
   *  papel do antigo `staffTabGuard('contas')`, que sumiu com a rota). */
  readonly canSeeContas = toSignal(
    this.auth.userData$.pipe(
      map((d) => normRole(d?.role) !== 'manager' || !(d?.hiddenTabs || []).includes('contas')),
    ),
    { initialValue: true },
  );

  constructor() {
    effect(() => {
      const s = this.storageSettings();
      if (s && !this.storageSyncedOnce) {
        this.storageSyncedOnce = true;
        this.totalLimitMb.set(s.totalLimitMb);
        this.defaultClientLimitMb.set(s.defaultClientLimitMb);
        this.typeLimitsForm.set(s.typeLimits.map((t) => ({ ...t, extensionsText: t.extensions.join(', ') })));
      }
    });

    effect(() => {
      const s = this.statusSettingsSig();
      if (s && !this.statusSyncedOnce) {
        this.statusSyncedOnce = true;
        this.statusForm.set(s.statuses.map((st) => ({ ...st })));
      }
    });

    effect(() => {
      const s = this.catalogSettingsSig();
      if (s && !this.catalogSyncedOnce) {
        this.catalogSyncedOnce = true;
        this.catalogForm.set(s.items.map((it) => ({ ...it })));
      }
    });
  }

  /* ── ARQUIVOS E ARMAZENAMENTO ── */
  readonly storageSettings = toSignal(this.storageSettingsSvc.get$(), { initialValue: DEFAULT_STORAGE_SETTINGS });
  private storageSyncedOnce = false;

  readonly totalLimitMb = signal(DEFAULT_STORAGE_SETTINGS.totalLimitMb);
  readonly defaultClientLimitMb = signal(DEFAULT_STORAGE_SETTINGS.defaultClientLimitMb);
  readonly typeLimitsForm = signal<(FileTypeLimit & { extensionsText: string })[]>([]);

  readonly storageSaving = signal(false);

  readonly totalUsageBytes = toSignal(this.storageUsageSvc.totalUsage$(), { initialValue: 0 });
  readonly recalculating = signal(false);

  readonly clients = toSignal(this.empresasSvc.listAll$(), { initialValue: [] as Empresa[] });
  readonly pendingLimits = signal<Record<string, string>>({});
  readonly savingLimitFor = signal<string | null>(null);

  formatBytes(bytes: number): string {
    return formatMb(bytes / (1024 * 1024));
  }

  formatMb(mb: number): string {
    return formatMb(mb);
  }

  /** Custo mensal estimado (só armazenamento, plano Blaze) se o limite total configurado for 100% utilizado. */
  estimatedMonthlyCostUsd(): number {
    const totalGb = this.totalLimitMb() / 1024;
    return Math.max(0, totalGb - FREE_STORAGE_GB) * PRICE_PER_GB_MONTH_USD;
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
      this.toast.success('Configuração de armazenamento salva.');
    } catch (e) {
      const err = e as { code?: string; message?: string };
      this.toast.error('Erro ao salvar: ' + (err.code || err.message || 'desconhecido'));
    } finally {
      this.storageSaving.set(false);
    }
  }

  async recalculateUsage(): Promise<void> {
    this.recalculating.set(true);
    try {
      await this.storageUsageSvc.recalculate();
      this.toast.success('Uso de armazenamento recalculado.');
    } catch {
      this.toast.error('Erro ao recalcular o uso.');
    } finally {
      this.recalculating.set(false);
    }
  }

  clientLimitInput(c: Empresa): string {
    const pending = this.pendingLimits()[c.id];
    if (pending !== undefined) return pending;
    return c.storageLimitMb != null ? String(c.storageLimitMb) : '';
  }

  setClientLimitInput(id: string, value: string): void {
    this.pendingLimits.update((m) => ({ ...m, [id]: value }));
  }

  async saveClientLimit(id: string): Promise<void> {
    const c = this.clients().find((x) => x.id === id);
    const raw = c ? this.clientLimitInput(c) : this.pendingLimits()[id] || '';
    const trimmed = raw.trim();
    const value = trimmed === '' ? null : Number(trimmed);
    if (value !== null && (Number.isNaN(value) || value <= 0)) return;
    this.savingLimitFor.set(id);
    try {
      await this.empresasSvc.updateStorageLimit(id, value);
      this.pendingLimits.update((m) => {
        const copy = { ...m };
        delete copy[id];
        return copy;
      });
    } finally {
      this.savingLimitFor.set(null);
    }
  }

  /* ── STATUS DO PROJETO ── */
  private readonly statusSettingsSig = toSignal(this.statusSettingsSvc.get$(), {
    initialValue: DEFAULT_PROJECT_STATUS_SETTINGS,
  });
  private statusSyncedOnce = false;

  readonly statusForm = signal<ProjectStatusOption[]>([]);
  readonly statusSaving = signal(false);

  addStatus(): void {
    this.statusForm.update((rows) => [
      ...rows,
      { key: `status-${Date.now()}`, label: 'Novo Status', color: statusColorFor(null, rows.length) },
    ]);
  }

  removeStatus(index: number): void {
    this.statusForm.update((rows) => rows.filter((_, i) => i !== index));
  }

  updateStatus(index: number, field: 'label' | 'color', value: string): void {
    this.statusForm.update((rows) => rows.map((r, i) => (i === index ? { ...r, [field]: value } : r)));
  }

  /** Cor efetiva mostrada no seletor (a explícita, senão a padrão da chave/paleta). */
  statusColor(row: ProjectStatusOption, index: number): string {
    return statusColorFor(row, index);
  }

  /** Volta todas as cores ao padrão da marca (por chave, ou paleta pra status personalizado). */
  resetStatusColors(): void {
    this.statusForm.update((rows) =>
      rows.map((r, i) => ({ ...r, color: DEFAULT_STATUS_COLORS[r.key] || statusColorFor({ ...r, color: undefined }, i) })),
    );
  }

  async saveStatusSettings(): Promise<void> {
    this.statusSaving.set(true);
    try {
      await this.statusSettingsSvc.update(this.statusForm());
      this.toast.success('Status do projeto salvos.');
    } catch (e) {
      const err = e as { code?: string; message?: string };
      this.toast.error('Erro ao salvar: ' + (err.code || err.message || 'desconhecido'));
    } finally {
      this.statusSaving.set(false);
    }
  }

  /* ── CATÁLOGO (Serviços + Preços num doc só) ── */
  private readonly catalogSettingsSig = toSignal(this.catalogSvc.get$(), { initialValue: DEFAULT_CATALOG_SETTINGS });
  private catalogSyncedOnce = false;

  readonly catalogUnits = PRICING_UNITS;
  readonly catalogForm = signal<CatalogItem[]>([]);
  readonly catalogSaving = signal(false);

  unitLabel(unit: string | null): string {
    if (!unit) return 'Só descrição';
    return this.catalogUnits.find((u) => u.key === unit)?.label || unit;
  }

  addCatalogItem(): void {
    this.catalogForm.update((rows) => [
      ...rows,
      { key: newCatKey(), name: '', description: '', unit: null, baseValue: null },
    ]);
  }

  removeCatalogItem(index: number): void {
    this.catalogForm.update((rows) => rows.filter((_, i) => i !== index));
  }

  updateCatalogItem<K extends keyof CatalogItem>(index: number, field: K, value: CatalogItem[K]): void {
    this.catalogForm.update((rows) => rows.map((r, i) => (i === index ? { ...r, [field]: value } : r)));
  }

  /** Alterna entre "tem preço" (unidade = projeto por padrão) e "só descrição". */
  toggleCatalogPriced(index: number, priced: boolean): void {
    this.catalogForm.update((rows) =>
      rows.map((r, i) =>
        i === index
          ? priced
            ? { ...r, unit: r.unit ?? 'projeto', baseValue: r.baseValue ?? 0 }
            : { ...r, unit: null, baseValue: null }
          : r,
      ),
    );
  }

  async saveCatalog(): Promise<void> {
    this.catalogSaving.set(true);
    try {
      await this.catalogSvc.update(this.catalogForm());
      this.toast.success('Catálogo salvo.');
    } catch (e) {
      const err = e as { code?: string; message?: string };
      this.toast.error('Erro ao salvar: ' + (err.code || err.message || 'desconhecido'));
    } finally {
      this.catalogSaving.set(false);
    }
  }

  /* ── NOTIFICAÇÕES PUSH ── */
  // A chave VAPID não é mais colada aqui: virou constante em environment.ts.
  readonly pushSupported = this.pushSvc.supported;
  readonly pushConfigured = this.pushSvc.configured;
  readonly pushStatus = this.pushSvc.status;
  readonly activatingPush = signal(false);
  readonly pushErr = signal('');

  async activatePush(): Promise<void> {
    const uid = this.auth.currentUser?.uid;
    if (!uid || !this.pushSvc.configured) return;
    this.activatingPush.set(true);
    this.pushErr.set('');
    try {
      await this.pushSvc.register(uid);
      if (this.pushSvc.status() !== 'granted') {
        this.pushErr.set('Permissão não concedida — o navegador pode ter bloqueado o pedido.');
      }
    } catch {
      this.pushErr.set('Erro ao ativar notificações. Tente novamente.');
    } finally {
      this.activatingPush.set(false);
    }
  }

  /* ── CATÁLOGO VIA IA ──
   * Cola-se um texto; a Cloud Function `fillCatalogsFromContext` devolve
   * uma PROPOSTA de catálogo. A tela mostra o antes (o que já está salvo) e
   * o depois (editável) lado a lado; só ao "Aplicar" é que `catalogForm`
   * recebe a proposta — e mesmo aí nada vai pro Firestore até "Salvar
   * Catálogo". */
  readonly aiContext = signal('');
  readonly aiRunning = signal(false);
  /** `null` = sem proposta pendente; array = proposta editável ("depois"). */
  readonly aiProposal = signal<CatalogItem[] | null>(null);

  async analyzeCatalog(): Promise<void> {
    const context = this.aiContext().trim();
    if (context.length < 20 || this.aiRunning()) return;
    this.aiRunning.set(true);
    this.aiProposal.set(null);
    try {
      const fn = httpsCallable<{ context: string }, CatalogExtraction>(this.functions, 'fillCatalogsFromContext');
      const { data } = await fn({ context });
      const items = (data.items || []).map((it) => ({
        key: newCatKey(),
        name: it.name,
        description: it.description || '',
        unit: it.unit ?? null,
        baseValue: it.unit ? it.baseValue ?? 0 : null,
      }));
      if (!items.length) {
        this.toast.error('A IA não encontrou serviços no texto. Tente detalhar mais.');
        return;
      }
      this.aiProposal.set(items);
    } catch (e) {
      const err = e as { message?: string };
      this.toast.error(err.message || 'Não consegui analisar o texto agora. Tente novamente.');
    } finally {
      this.aiRunning.set(false);
    }
  }

  updateAiItem<K extends keyof CatalogItem>(index: number, field: K, value: CatalogItem[K]): void {
    this.aiProposal.update((rows) => (rows ? rows.map((r, i) => (i === index ? { ...r, [field]: value } : r)) : rows));
  }

  toggleAiPriced(index: number, priced: boolean): void {
    this.aiProposal.update((rows) =>
      rows
        ? rows.map((r, i) =>
            i === index
              ? priced
                ? { ...r, unit: r.unit ?? 'projeto', baseValue: r.baseValue ?? 0 }
                : { ...r, unit: null, baseValue: null }
              : r,
          )
        : rows,
    );
  }

  removeAiItem(index: number): void {
    this.aiProposal.update((rows) => (rows ? rows.filter((_, i) => i !== index) : rows));
  }

  applyAiProposal(): void {
    const p = this.aiProposal();
    if (!p) return;
    this.catalogForm.set(p.map((it) => ({ ...it })));
    this.aiProposal.set(null);
    this.aiContext.set('');
    this.toast.success('Proposta aplicada ao catálogo. Revise e clique em “Salvar Catálogo”.');
  }

  cancelAiProposal(): void {
    this.aiProposal.set(null);
  }
}
