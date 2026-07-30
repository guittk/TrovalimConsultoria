import { AsyncPipe, DatePipe } from '@angular/common';
import { Component, computed, effect, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { AuthService } from '../../core/auth.service';
import { ProjectsService } from '../../core/projects.service';
import { ProjectFile, TimelineStep } from '../../core/models';
import { PnavComponent, PnavTab } from '../../shared/pnav/pnav.component';
import { StatusBadgeComponent } from '../../shared/status-badge/status-badge.component';

const ADMIN_TABS: PnavTab[] = [
  { key: 'projetos', label: 'Projetos', path: '/admin' },
  { key: 'clientes', label: 'Clientes', path: '/admin/clientes' },
  { key: 'contas', label: 'Contas', path: '/admin/contas' },
];

type TabKey = 'geral' | 'timeline' | 'arquivos' | 'mensagens' | 'marca';

@Component({
  selector: 'app-admin-project',
  standalone: true,
  imports: [AsyncPipe, DatePipe, FormsModule, RouterLink, PnavComponent, StatusBadgeComponent],
  templateUrl: './admin-project.component.html',
})
export class AdminProjectComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly auth = inject(AuthService);
  private readonly projectsSvc = inject(ProjectsService);

  readonly tabs = ADMIN_TABS;
  readonly pid = this.route.snapshot.paramMap.get('id')!;
  readonly userData$ = this.auth.userData$;

  readonly project = toSignal(this.projectsSvc.get$(this.pid), { initialValue: null });
  readonly messages$ = this.projectsSvc.messages$(this.pid);
  readonly files$ = this.projectsSvc.files$(this.pid);

  readonly activeTab = signal<TabKey>('geral');

  /* ── VISÃO GERAL ── */
  readonly status = signal('em-andamento');
  readonly progress = signal(0);
  readonly geralOk = signal(false);
  readonly geralErr = signal('');
  readonly savingGeral = signal(false);

  /* ── LINHA DO TEMPO ── */
  readonly stepsData = signal<TimelineStep[]>([]);
  readonly timelineOk = signal(false);
  readonly timelineErr = signal('');
  readonly savingTimeline = signal(false);

  /* ── ARQUIVOS ── */
  readonly uploading = signal(false);

  /* ── MENSAGENS ── */
  readonly messageText = signal('');

  /* ── MARCA ── */
  readonly brandingCompany = signal('');
  readonly brandingColor = signal('#C9A96E');
  readonly brandingLogoPreview = signal<string | null>(null);
  readonly marcaOk = signal(false);
  readonly marcaErr = signal('');
  readonly savingMarca = signal(false);
  private pendingLogoFile: File | null = null;
  private logoRemoved = false;

  constructor() {
    effect(() => {
      const p = this.project();
      if (!p) return;
      this.status.set(p.status);
      this.progress.set(p.progress || 0);
      this.stepsData.set((p.steps || []).map((s) => ({ ...s })));
      this.brandingCompany.set(p.branding?.companyName || '');
      this.brandingColor.set(p.branding?.primaryColor || '#C9A96E');
      this.brandingLogoPreview.set(p.branding?.logo || null);
      this.pendingLogoFile = null;
      this.logoRemoved = false;
    });
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
      await this.projectsSvc.update(this.pid, { status: this.status(), progress: this.progress() });
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
    this.uploading.set(true);
    const data = await firstValueFrom(this.userData$);
    try {
      await this.projectsSvc.uploadFile(this.pid, file, 'admin', data?.name || 'Admin');
    } finally {
      this.uploading.set(false);
      input.value = '';
    }
  }

  async deleteFile(fileId: string, path?: string): Promise<void> {
    if (!confirm('Excluir este arquivo permanentemente?')) return;
    await this.projectsSvc.deleteFile(this.pid, fileId, path);
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

  /* ── MARCA ── */
  onColorChange(value: string): void {
    this.brandingColor.set(value);
  }

  onLogoSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    this.pendingLogoFile = file;
    this.logoRemoved = false;
    const reader = new FileReader();
    reader.onload = (ev) => this.brandingLogoPreview.set(ev.target?.result as string);
    reader.readAsDataURL(file);
  }

  removeLogo(): void {
    this.pendingLogoFile = null;
    this.logoRemoved = true;
    this.brandingLogoPreview.set(null);
  }

  async saveMarca(): Promise<void> {
    this.marcaOk.set(false);
    this.marcaErr.set('');
    this.savingMarca.set(true);
    try {
      let logoUrl: string | null = this.logoRemoved ? null : this.project()?.branding?.logo || null;
      if (this.pendingLogoFile) {
        const path = `projects/${this.pid}/branding/logo_${Date.now()}`;
        logoUrl = await this.projectsSvc.uploadBrandingLogo(path, this.pendingLogoFile);
        this.pendingLogoFile = null;
      }
      await this.projectsSvc.updateBranding(this.pid, {
        companyName: this.brandingCompany().trim(),
        primaryColor: this.brandingColor(),
        logo: logoUrl,
      });
      this.marcaOk.set(true);
      setTimeout(() => this.marcaOk.set(false), 3000);
    } catch (e) {
      const err = e as { code?: string; message?: string };
      this.marcaErr.set('Erro ao salvar a identidade visual: ' + (err.code || err.message || 'desconhecido'));
    } finally {
      this.savingMarca.set(false);
    }
  }
}
