import { AsyncPipe, DatePipe, DecimalPipe } from '@angular/common';
import { Component, computed, effect, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
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
import { ProjectFile, TimelineMode, TimelineStep } from '../../core/models';
import { initials } from '../../shared/initials';
import { PnavComponent, PnavTab } from '../../shared/pnav/pnav.component';
import { StatusBadgeComponent } from '../../shared/status-badge/status-badge.component';
import { FileIconComponent } from '../../shared/file-icon/file-icon.component';
import { ConfirmService } from '../../shared/confirm/confirm.service';

const ADMIN_TABS: PnavTab[] = [
  { key: 'projetos', label: 'Projetos', path: '/admin' },
  { key: 'clientes', label: 'Empresas', path: '/admin/clientes' },
  { key: 'contas', label: 'Contas', path: '/admin/contas' },
  { key: 'contatos', label: 'Contatos', path: '/admin/contatos' },
  { key: 'config', label: 'Configurações', path: '/admin/config' },
];

type TabKey = 'geral' | 'timeline' | 'arquivos' | 'mensagens';

@Component({
  selector: 'app-admin-project',
  standalone: true,
  imports: [
    AsyncPipe,
    DatePipe,
    DecimalPipe,
    FormsModule,
    RouterLink,
    PnavComponent,
    StatusBadgeComponent,
    FileIconComponent,
  ],
  templateUrl: './admin-project.component.html',
})
export class AdminProjectComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
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

  readonly activeTab = signal<TabKey>('geral');

  /* ── VISÃO GERAL ── */
  readonly name = signal('');
  readonly status = signal('em-andamento');
  readonly description = signal('');
  readonly startDate = signal('');
  readonly deadline = signal('');
  readonly internalNotes = signal('');
  readonly responsibleUid = signal('');
  readonly hidden = signal(false);
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
  readonly timelineMode = signal<TimelineMode>('data');
  readonly timelineOk = signal(false);
  readonly timelineErr = signal('');
  readonly savingTimeline = signal(false);

  private parseStepDate(value: string | undefined | null): Date | null {
    if (!value) return null;
    const d = new Date(`${value}T00:00:00`);
    return isNaN(d.getTime()) ? null : d;
  }

  private projectCreatedDate(): Date | null {
    const p = this.project();
    return p?.createdAt ? this.projectsSvc.toDate(p.createdAt) : null;
  }

  /**
   * Etapas com o índice original (posição em stepsData), na ordem de
   * exibição conforme o modo:
   * - "ordem": mesma ordem de stepsData (controlada pelos botões subir/descer).
   * - "data": ordenadas cronologicamente pela data; etapas sem data vão para
   *   o final, mantendo a ordem original entre elas.
   */
  readonly displaySteps = computed(() => {
    const items = this.stepsData().map((s, originalIndex) => ({ s, originalIndex }));
    if (this.timelineMode() === 'ordem') return items;
    const withDate = items.filter((x) => this.parseStepDate(x.s.date));
    const withoutDate = items.filter((x) => !this.parseStepDate(x.s.date));
    withDate.sort((a, b) => {
      if (a.s.date !== b.s.date) return a.s.date < b.s.date ? -1 : 1;
      return a.originalIndex - b.originalIndex;
    });
    return [...withDate, ...withoutDate];
  });

  /**
   * Peso de cada etapa exibida (mesmo índice de displaySteps()).
   * Modo "data": dias entre a data da etapa e a data anterior (a primeira
   * conta a partir da Data de Início do projeto, ou da criação do projeto
   * se a Data de Início não estiver definida). Etapas com a mesma data
   * dividem igualmente o intervalo entre si, para terem o mesmo peso —
   * afinal são concluídas no mesmo dia. Etapas sem data contam 0.
   * Modo "ordem": peso definido manualmente pelo usuário.
   */
  readonly displayWeights = computed(() => {
    const items = this.displaySteps();
    if (this.timelineMode() === 'ordem') {
      return items.map((x) => Number(x.s.weight) || 0);
    }
    const weights = new Array(items.length).fill(0);
    let prevDate = this.parseStepDate(this.startDate()) || this.projectCreatedDate();
    let i = 0;
    while (i < items.length) {
      const date = this.parseStepDate(items[i].s.date);
      if (!date) break;
      let j = i;
      while (j < items.length && items[j].s.date === items[i].s.date) j++;
      const groupSize = j - i;
      let interval = 0;
      if (prevDate) {
        const diffDays = Math.round((date.getTime() - prevDate.getTime()) / 86400000);
        interval = diffDays > 0 ? diffDays : 0;
      }
      const perStep = interval / groupSize;
      for (let k = i; k < j; k++) weights[k] = perStep;
      prevDate = date;
      i = j;
    }
    return weights;
  });

  readonly totalWeight = computed(() => this.displayWeights().reduce((sum, w) => sum + w, 0));

  /** Progresso derivado do peso das etapas concluídas na Linha do Tempo. */
  readonly progress = computed(() => {
    const items = this.displaySteps();
    const weights = this.displayWeights();
    const total = weights.reduce((sum, w) => sum + w, 0);
    if (total <= 0) return 0;
    const done = items.reduce((sum, x, idx) => sum + (x.s.done ? weights[idx] : 0), 0);
    return Math.round((done / total) * 100);
  });

  /* ── ARQUIVOS ── */
  readonly uploading = signal(false);
  readonly uploadErr = signal('');
  readonly dragOver = signal(false);
  readonly showLinkForm = signal(false);
  readonly linkName = signal('');
  readonly linkUrl = signal('');
  readonly linkErr = signal('');
  readonly savingLink = signal(false);

  /* ── MENSAGENS ── */
  readonly messageText = signal('');

  constructor() {
    effect(() => {
      const p = this.project();
      if (!p) return;
      this.name.set(p.name || '');
      this.status.set(p.status);
      this.description.set(p.description || '');
      this.startDate.set(p.startDate || '');
      this.deadline.set(p.deadline || '');
      this.responsibleUid.set(p.responsibleUid || '');
      this.hidden.set(!!p.hidden);
      this.timelineMode.set(p.timelineMode === 'ordem' ? 'ordem' : 'data');
      this.stepsData.set((p.steps || []).map((s) => ({ ...s })));
    });
    effect(() => this.internalNotes.set(this.internalNotesSaved()));
  }

  toDate(value: unknown): Date {
    return this.projectsSvc.toDate(value);
  }

  initials(name: string): string {
    return initials(name);
  }

  /* ── VISÃO GERAL ── */
  async saveGeral(): Promise<void> {
    this.geralOk.set(false);
    this.geralErr.set('');
    const name = this.name().trim();
    if (!name) {
      this.geralErr.set('O nome do projeto é obrigatório.');
      return;
    }
    this.savingGeral.set(true);
    try {
      await Promise.all([
        this.projectsSvc.update(this.pid, {
          name,
          status: this.status(),
          description: this.description().trim(),
          startDate: this.startDate() || null,
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

  /* ── CABEÇALHO: visibilidade ── */
  readonly togglingHidden = signal(false);
  async toggleHidden(): Promise<void> {
    const next = !this.hidden();
    this.togglingHidden.set(true);
    try {
      await this.projectsSvc.update(this.pid, { hidden: next });
      this.hidden.set(next);
    } finally {
      this.togglingHidden.set(false);
    }
  }

  /* ── CABEÇALHO: excluir projeto ── */
  readonly deletingProject = signal(false);
  readonly deleteProjectErr = signal('');
  async deleteProject(): Promise<void> {
    const p = this.project();
    if (!p) return;
    const ok = await this.confirmSvc.confirm({
      title: 'Excluir projeto',
      message: `Excluir "${p.name}" permanentemente?\n\nIsso não pode ser desfeito — arquivos, mensagens e notas internas deste projeto também são excluídos.`,
      confirmLabel: 'Excluir',
      danger: true,
    });
    if (!ok) return;
    this.deleteProjectErr.set('');
    this.deletingProject.set(true);
    try {
      await this.projectsSvc.deleteProject(this.pid);
      await this.router.navigate(['/admin']);
    } catch {
      this.deleteProjectErr.set('Erro ao excluir projeto. Tente novamente.');
    } finally {
      this.deletingProject.set(false);
    }
  }

  /* ── LINHA DO TEMPO ── */
  setTimelineMode(mode: TimelineMode): void {
    this.timelineMode.set(mode);
    if (mode === 'ordem') {
      this.stepsData.update((steps) => steps.map((s) => (s.weight ? s : { ...s, weight: 1 })));
    }
  }
  addStep(): void {
    this.stepsData.update((steps) => [
      ...steps,
      { name: '', date: '', done: false, ...(this.timelineMode() === 'ordem' ? { weight: 1 } : {}) },
    ]);
  }
  updateStep(i: number, field: keyof TimelineStep, value: string | boolean | number): void {
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
      const mode = this.timelineMode();
      const steps: TimelineStep[] =
        mode === 'ordem'
          ? this.stepsData().map((s) => ({ name: s.name, date: '', done: s.done, weight: Number(s.weight) || 0 }))
          : this.displaySteps().map((x) => ({ name: x.s.name, date: x.s.date, done: x.s.done }));
      this.stepsData.set(steps.map((s) => ({ ...s })));
      await Promise.all([
        this.projectsSvc.updateSteps(this.pid, steps),
        this.projectsSvc.update(this.pid, { progress: this.progress(), timelineMode: mode }),
      ]);
      this.timelineOk.set(true);
      setTimeout(() => this.timelineOk.set(false), 3000);
    } catch {
      this.timelineErr.set('Erro ao salvar etapas.');
    } finally {
      this.savingTimeline.set(false);
    }
  }

  /* ── ARQUIVOS ── */
  async onDropFile(event: DragEvent): Promise<void> {
    event.preventDefault();
    this.dragOver.set(false);
    const file = event.dataTransfer?.files?.[0];
    if (!file) return;
    await this.handleUpload(file);
  }

  async onFileSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    await this.handleUpload(file);
    input.value = '';
  }

  private async handleUpload(file: File): Promise<void> {
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
      return;
    }
    this.uploading.set(true);
    const data = await firstValueFrom(this.userData$);
    try {
      await this.projectsSvc.uploadFile(this.pid, ownerId, file, 'admin', data?.name || 'Admin');
    } finally {
      this.uploading.set(false);
    }
  }

  async addLink(): Promise<void> {
    this.linkErr.set('');
    const name = this.linkName().trim();
    let url = this.linkUrl().trim();
    if (!name || !url) {
      this.linkErr.set('Preencha o nome e o link.');
      return;
    }
    if (!/^https?:\/\//i.test(url)) url = `https://${url}`;
    this.savingLink.set(true);
    try {
      const data = await firstValueFrom(this.userData$);
      await this.projectsSvc.addFileLink(this.pid, url, name, 'admin', data?.name || 'Admin');
      this.linkName.set('');
      this.linkUrl.set('');
      this.showLinkForm.set(false);
    } catch {
      this.linkErr.set('Erro ao adicionar link.');
    } finally {
      this.savingLink.set(false);
    }
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
    return files.filter((f) => f.uploadedByRole === 'admin');
  }

  clientFiles(files: ProjectFile[]): ProjectFile[] {
    return files.filter((f) => f.uploadedByRole === 'client');
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
