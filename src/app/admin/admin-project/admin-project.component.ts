import { AsyncPipe, DatePipe } from '@angular/common';
import { Component, computed, effect, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { firstValueFrom, of, switchMap } from 'rxjs';
import { AuthService } from '../../core/auth.service';
import { AccountsService } from '../../core/accounts.service';
import { EmpresasService } from '../../core/empresas.service';
import { ProjectsService } from '../../core/projects.service';
import { PlatformSettingsService, DEFAULT_PLATFORM_COLOR } from '../../core/platform-settings.service';
import { StorageSettingsService, DEFAULT_STORAGE_SETTINGS } from '../../core/storage-settings.service';
import { StorageUsageService } from '../../core/storage-usage.service';
import {
  ProjectStatusSettingsService,
  DEFAULT_PROJECT_STATUS_SETTINGS,
} from '../../core/project-status-settings.service';
import { PROJECT_FILE_CATEGORIES, ProjectFile, TimelineStep } from '../../core/models';
import { PnavComponent, PnavTab } from '../../shared/pnav/pnav.component';
import { StatusBadgeComponent } from '../../shared/status-badge/status-badge.component';
import { FileIconComponent } from '../../shared/file-icon/file-icon.component';
import { ConfirmService } from '../../shared/confirm/confirm.service';

const ADMIN_TABS: PnavTab[] = [
  { key: 'projetos', label: 'Projetos', path: '/admin' },
  { key: 'clientes', label: 'Empresas', path: '/admin/clientes' },
  { key: 'contas', label: 'Contas', path: '/admin/contas' },
  { key: 'config', label: 'Configurações', path: '/admin/config' },
];

type TabKey = 'geral' | 'timeline' | 'arquivos' | 'mensagens';

@Component({
  selector: 'app-admin-project',
  standalone: true,
  imports: [AsyncPipe, DatePipe, FormsModule, RouterLink, PnavComponent, StatusBadgeComponent, FileIconComponent],
  templateUrl: './admin-project.component.html',
})
export class AdminProjectComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly auth = inject(AuthService);
  private readonly accountsSvc = inject(AccountsService);
  private readonly projectsSvc = inject(ProjectsService);
  private readonly empresasSvc = inject(EmpresasService);
  private readonly platformSettingsSvc = inject(PlatformSettingsService);
  private readonly storageSettingsSvc = inject(StorageSettingsService);
  private readonly storageUsageSvc = inject(StorageUsageService);
  private readonly statusSettingsSvc = inject(ProjectStatusSettingsService);
  private readonly confirmSvc = inject(ConfirmService);

  readonly tabs = ADMIN_TABS;
  readonly pid = this.route.snapshot.paramMap.get('id')!;
  readonly userData$ = this.auth.userData$;

  readonly project$ = this.projectsSvc.get$(this.pid);
  readonly project = toSignal(this.project$, { initialValue: null });
  readonly ownerAccount = toSignal(
    this.project$.pipe(switchMap((p) => (p?.ownerId ? this.empresasSvc.get$(p.ownerId) : of(null)))),
    { initialValue: null },
  );
  readonly messages$ = this.projectsSvc.messages$(this.pid);
  readonly files$ = this.projectsSvc.files$(this.pid);
  readonly platformColor = toSignal(this.platformSettingsSvc.get$(), {
    initialValue: { primaryColor: DEFAULT_PLATFORM_COLOR },
  });
  readonly storageSettings = toSignal(this.storageSettingsSvc.get$(), {
    initialValue: DEFAULT_STORAGE_SETTINGS,
  });
  readonly statusSettings = toSignal(this.statusSettingsSvc.get$(), {
    initialValue: DEFAULT_PROJECT_STATUS_SETTINGS,
  });
  readonly staffAccounts = toSignal(this.accountsSvc.listStaff$(), { initialValue: [] });
  readonly internalNotesSaved = toSignal(this.projectsSvc.internalNotes$(this.pid), { initialValue: '' });
  readonly fileCategories = PROJECT_FILE_CATEGORIES;

  readonly activeTab = signal<TabKey>('geral');

  /* ── VISÃO GERAL ── */
  readonly status = signal('em-andamento');
  readonly progress = signal(0);
  readonly description = signal('');
  readonly deadline = signal('');
  readonly internalNotes = signal('');
  readonly responsibleUid = signal('');
  readonly geralOk = signal(false);
  readonly geralErr = signal('');
  readonly savingGeral = signal(false);

  readonly isOverdue = computed(() => {
    const d = this.deadline();
    if (!d || this.status() === 'concluido') return false;
    return d < new Date().toISOString().slice(0, 10);
  });

  /* ── LINHA DO TEMPO ── */
  readonly stepsData = signal<TimelineStep[]>([]);
  readonly timelineOk = signal(false);
  readonly timelineErr = signal('');
  readonly savingTimeline = signal(false);

  /* ── ARQUIVOS ── */
  readonly uploading = signal(false);
  readonly uploadErr = signal('');
  readonly uploadCategory = signal('outro');
  readonly fileCategoryFilter = signal('');

  /* ── MENSAGENS ── */
  readonly messageText = signal('');

  constructor() {
    effect(() => {
      const p = this.project();
      if (!p) return;
      this.status.set(p.status);
      this.progress.set(p.progress || 0);
      this.description.set(p.description || '');
      this.deadline.set(p.deadline || '');
      this.responsibleUid.set(p.responsibleUid || '');
      this.stepsData.set((p.steps || []).map((s) => ({ ...s })));
    });
    effect(() => this.internalNotes.set(this.internalNotesSaved()));
  }

  toDate(value: unknown): Date {
    return this.projectsSvc.toDate(value);
  }

  /* ── VISÃO GERAL ── */
  async saveGeral(): Promise<void> {
    this.geralOk.set(false);
    this.geralErr.set('');
    this.savingGeral.set(true);
    try {
      await Promise.all([
        this.projectsSvc.update(this.pid, {
          status: this.status(),
          progress: this.progress(),
          description: this.description().trim(),
          deadline: this.deadline() || null,
          responsibleUid: this.responsibleUid() || null,
        }),
        this.projectsSvc.updateInternalNotes(this.pid, this.internalNotes()),
      ]);
      this.geralOk.set(true);
      setTimeout(() => this.geralOk.set(false), 3000);
    } catch {
      this.geralErr.set('Erro ao salvar. Tente novamente.');
    } finally {
      this.savingGeral.set(false);
    }
  }

  /* ── LINHA DO TEMPO ── */
  addStep(): void {
    this.stepsData.update((steps) => [...steps, { name: '', date: '', done: false }]);
  }
  updateStep(i: number, field: keyof TimelineStep, value: string | boolean): void {
    this.stepsData.update((steps) => steps.map((s, idx) => (idx === i ? { ...s, [field]: value } : s)));
  }
  moveStep(i: number, dir: number): void {
    const j = i + dir;
    this.stepsData.update((steps) => {
      if (j < 0 || j >= steps.length) return steps;
      const copy = [...steps];
      [copy[i], copy[j]] = [copy[j], copy[i]];
      return copy;
    });
  }
  removeStep(i: number): void {
    this.stepsData.update((steps) => steps.filter((_, idx) => idx !== i));
  }

  async saveTimeline(): Promise<void> {
    this.timelineOk.set(false);
    this.timelineErr.set('');
    this.savingTimeline.set(true);
    try {
      await this.projectsSvc.updateSteps(this.pid, this.stepsData());
      this.timelineOk.set(true);
      setTimeout(() => this.timelineOk.set(false), 3000);
    } catch {
      this.timelineErr.set('Erro ao salvar etapas.');
    } finally {
      this.savingTimeline.set(false);
    }
  }

  /* ── ARQUIVOS ── */
  async onFileSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    this.uploadErr.set('');
    const ownerId = this.project()?.ownerId ?? null;
    const owner = this.ownerAccount();
    const totalUsageBytes = await this.storageUsageSvc.totalUsageBytes();
    const err = this.storageSettingsSvc.checkUpload(
      file,
      this.storageSettings(),
      owner?.storageUsageBytes || 0,
      owner?.storageLimitMb,
      totalUsageBytes,
    );
    if (err) {
      this.uploadErr.set(err);
      input.value = '';
      return;
    }
    this.uploading.set(true);
    const data = await firstValueFrom(this.userData$);
    try {
      await this.projectsSvc.uploadFile(this.pid, ownerId, file, 'admin', data?.name || 'Admin', this.uploadCategory());
    } finally {
      this.uploading.set(false);
      input.value = '';
    }
  }

  categoryLabel(key: string | undefined): string {
    return this.fileCategories.find((c) => c.key === key)?.label || 'Outro';
  }

  filesFiltered(files: ProjectFile[]): ProjectFile[] {
    const cat = this.fileCategoryFilter();
    return cat ? files.filter((f) => (f.category || 'outro') === cat) : files;
  }

  async deleteFile(f: ProjectFile): Promise<void> {
    const ok = await this.confirmSvc.confirm({
      title: 'Excluir arquivo',
      message: 'Excluir este arquivo permanentemente?',
      confirmLabel: 'Excluir',
      danger: true,
    });
    if (!ok) return;
    const ownerId = this.project()?.ownerId ?? null;
    const sizeBytes = (f.sizeKb || 0) * 1024;
    await this.projectsSvc.deleteFile(this.pid, f.id!, f.path, ownerId, sizeBytes);
  }

  adminFiles(files: ProjectFile[]): ProjectFile[] {
    return this.filesFiltered(files).filter((f) => f.uploadedByRole === 'admin');
  }

  clientFiles(files: ProjectFile[]): ProjectFile[] {
    return this.filesFiltered(files).filter((f) => f.uploadedByRole === 'client');
  }

  /* ── MENSAGENS ── */
  async sendMessage(): Promise<void> {
    const text = this.messageText().trim();
    if (!text) return;
    this.messageText.set('');
    const data = await firstValueFrom(this.userData$);
    await this.projectsSvc.sendMessage(this.pid, data?.name || data?.email || 'Admin', 'admin', text);
  }
}
