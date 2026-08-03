import { AsyncPipe } from '@angular/common';
import { Component, effect, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth.service';
import { AccountsService } from '../../core/accounts.service';
import { EmpresasService } from '../../core/empresas.service';
import { ProjectsService } from '../../core/projects.service';
import {
  ProjectStatusSettingsService,
  DEFAULT_PROJECT_STATUS_SETTINGS,
} from '../../core/project-status-settings.service';
import { UserAccount } from '../../core/models';
import { PnavComponent, PnavTab } from '../../shared/pnav/pnav.component';
import { ConfirmService } from '../../shared/confirm/confirm.service';

const ADMIN_TABS: PnavTab[] = [
  { key: 'projetos', label: 'Projetos', path: '/admin' },
  { key: 'clientes', label: 'Empresas', path: '/admin/clientes' },
  { key: 'contas', label: 'Contas', path: '/admin/contas' },
  { key: 'config', label: 'Configurações', path: '/admin/config' },
];

@Component({
  selector: 'app-admin-client',
  standalone: true,
  imports: [AsyncPipe, FormsModule, RouterLink, PnavComponent],
  templateUrl: './admin-client.component.html',
})
export class AdminClientComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly auth = inject(AuthService);
  private readonly accountsSvc = inject(AccountsService);
  private readonly empresasSvc = inject(EmpresasService);
  private readonly projectsSvc = inject(ProjectsService);
  private readonly confirmSvc = inject(ConfirmService);
  private readonly statusSettingsSvc = inject(ProjectStatusSettingsService);

  readonly statusSettings = toSignal(this.statusSettingsSvc.get$(), {
    initialValue: DEFAULT_PROJECT_STATUS_SETTINGS,
  });

  readonly tabs = ADMIN_TABS;
  readonly cid = this.route.snapshot.paramMap.get('id')!;
  readonly userData$ = this.auth.userData$;
  readonly isOwner = toSignal(this.auth.isOwner$, { initialValue: false });

  readonly empresa = toSignal(this.empresasSvc.get$(this.cid), { initialValue: null });
  readonly projects = toSignal(this.projectsSvc.listForOwner$(this.cid), { initialValue: [] });
  readonly teamMembers = toSignal(this.accountsSvc.listTeamMembers$(this.cid), { initialValue: [] });

  /** Contas client já criadas em "Contas" mas ainda sem empresa — candidatas a colaborador. */
  readonly availableAccounts = toSignal(this.accountsSvc.listUnlinkedClients$(), { initialValue: [] as UserAccount[] });

  /* ── IDENTIDADE VISUAL ── */
  readonly brandingCompany = signal('');
  readonly brandingColor = signal('#C9A96E');
  readonly brandingLogoPreview = signal<string | null>(null);
  readonly savingMarca = signal(false);
  readonly marcaOk = signal(false);
  readonly marcaErr = signal('');
  private pendingLogoFile: File | null = null;
  private logoRemoved = false;

  /* ── EXCLUIR EMPRESA ── */
  readonly deletingEmpresa = signal(false);
  readonly deleteErr = signal('');

  /* ── COLABORADORES: adicionar ── */
  readonly tmModalOpen = signal(false);
  readonly tmSelectedUid = signal('');
  readonly tmSaving = signal(false);
  readonly tmErr = signal('');

  constructor() {
    effect(() => {
      const e = this.empresa();
      if (!e) return;
      this.brandingCompany.set(e.branding?.companyName || '');
      this.brandingColor.set(e.branding?.primaryColor || '#C9A96E');
      this.brandingLogoPreview.set(e.branding?.logo || null);
      this.pendingLogoFile = null;
      this.logoRemoved = false;
    });
  }

  statusLabel(status: string): string {
    return this.statusSettings().statuses.find((s) => s.key === status)?.label || status || '—';
  }

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
      let logoUrl: string | null = this.logoRemoved ? null : this.empresa()?.branding?.logo || null;
      if (this.pendingLogoFile) {
        const path = `clients/${this.cid}/branding/logo_${Date.now()}`;
        logoUrl = await this.projectsSvc.uploadBrandingLogo(path, this.pendingLogoFile);
        this.pendingLogoFile = null;
      }
      await this.empresasSvc.updateBranding(this.cid, {
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

  async deleteEmpresa(): Promise<void> {
    const e = this.empresa();
    if (!e) return;
    const ok = await this.confirmSvc.confirm({
      title: 'Excluir empresa',
      message: `Excluir "${e.branding?.companyName || 'esta empresa'}" permanentemente?\n\nIsso não pode ser desfeito. Todos os projetos e arquivos associados continuam existindo, mas ficam sem empresa vinculada.`,
      confirmLabel: 'Excluir',
      danger: true,
    });
    if (!ok) return;
    this.deleteErr.set('');
    this.deletingEmpresa.set(true);
    try {
      await this.empresasSvc.delete(this.cid);
      await this.router.navigate(['/admin/clientes']);
    } catch (err) {
      if (err instanceof Error && err.message === 'HAS_TEAM_MEMBERS') {
        this.deleteErr.set('Remova (ou realoque) todos os colaboradores vinculados antes de excluir esta empresa.');
      } else {
        this.deleteErr.set('Erro ao excluir empresa.');
      }
    } finally {
      this.deletingEmpresa.set(false);
    }
  }

  /* ── COLABORADORES: adicionar ── */
  openAddMemberModal(): void {
    this.tmSelectedUid.set('');
    this.tmErr.set('');
    this.tmModalOpen.set(true);
  }

  closeAddMemberModal(): void {
    this.tmModalOpen.set(false);
  }

  async addTeamMember(): Promise<void> {
    const uid = this.tmSelectedUid();
    this.tmErr.set('');
    if (!uid) { this.tmErr.set('Selecione uma conta cadastrada em Contas.'); return; }
    this.tmSaving.set(true);
    try {
      await this.accountsSvc.linkTeamMember(uid, this.cid);
      this.tmSelectedUid.set('');
      this.tmModalOpen.set(false);
    } catch {
      this.tmErr.set('Erro ao adicionar colaborador.');
    } finally {
      this.tmSaving.set(false);
    }
  }

  async unlinkTeamMember(member: UserAccount): Promise<void> {
    const ok = await this.confirmSvc.confirm({
      title: 'Remover colaborador',
      message: `Remover "${member.name || member.email}" desta empresa?\n\nA conta continua existindo em Contas — ela só deixa de estar vinculada a esta empresa.`,
      confirmLabel: 'Remover',
      danger: true,
    });
    if (!ok) return;
    await this.accountsSvc.unlinkTeamMember(member.uid);
  }

  initials(name: string): string {
    return name.split(' ').slice(0, 2).map((w) => w[0] || '').join('').toUpperCase() || '?';
  }
}
