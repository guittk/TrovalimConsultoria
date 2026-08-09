import { AsyncPipe } from '@angular/common';
import { Component, computed, effect, inject, signal } from '@angular/core';
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
import { Project, UserAccount } from '../../core/models';
import { initials } from '../../shared/initials';
import { PnavComponent, PnavTab } from '../../shared/pnav/pnav.component';
import { ConfirmService } from '../../shared/confirm/confirm.service';

const ADMIN_TABS: PnavTab[] = [
  { key: 'projetos', label: 'Projetos', path: '/admin' },
  { key: 'clientes', label: 'Empresas', path: '/admin/clientes' },
  { key: 'contas', label: 'Contas', path: '/admin/contas' },
  { key: 'contatos', label: 'Contatos', path: '/admin/contatos' },
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
  readonly allProjects = toSignal(this.projectsSvc.listAll$(), { initialValue: [] });
  readonly unlinkedProjects = computed(() => this.allProjects().filter((p) => !p.ownerId));

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
  readonly deleteModalOpen = signal(false);
  readonly deleteAccountUids = signal<Set<string>>(new Set());
  readonly deleteProjectIds = signal<Set<string>>(new Set());

  /* ── COLABORADORES: adicionar ── */
  readonly tmModalOpen = signal(false);
  readonly tmSelectedUid = signal('');
  readonly tmSaving = signal(false);
  readonly tmErr = signal('');

  /* ── PROJETOS: adicionar existente ── */
  readonly apModalOpen = signal(false);
  readonly apSelectedProjectId = signal('');
  readonly apSaving = signal(false);
  readonly apErr = signal('');

  /* ── PROJETOS: remover da empresa ── */
  readonly removingProjectId = signal('');

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

  openDeleteEmpresaModal(): void {
    this.deleteAccountUids.set(new Set());
    this.deleteProjectIds.set(new Set());
    this.deleteErr.set('');
    this.deleteModalOpen.set(true);
  }

  closeDeleteEmpresaModal(): void {
    this.deleteModalOpen.set(false);
  }

  toggleDeleteAccount(uid: string, checked: boolean): void {
    this.deleteAccountUids.update((set) => {
      const copy = new Set(set);
      if (checked) copy.add(uid);
      else copy.delete(uid);
      return copy;
    });
  }

  toggleDeleteProject(id: string, checked: boolean): void {
    this.deleteProjectIds.update((set) => {
      const copy = new Set(set);
      if (checked) copy.add(id);
      else copy.delete(id);
      return copy;
    });
  }

  /**
   * Antes de excluir a empresa, resolve cada colaborador/projeto vinculado:
   * exclui os marcados na modal, e apenas desvincula (mantém existindo) os
   * demais — para que a empresa nunca seja excluída com pendências.
   */
  async deleteEmpresa(): Promise<void> {
    const e = this.empresa();
    if (!e) return;
    this.deleteErr.set('');
    this.deletingEmpresa.set(true);
    try {
      const accountUidsToDelete = this.deleteAccountUids();
      for (const m of this.teamMembers()) {
        if (accountUidsToDelete.has(m.uid)) {
          await this.accountsSvc.deleteAccount(m.uid);
        } else {
          await this.accountsSvc.unlinkTeamMember(m.uid);
        }
      }

      const projectIdsToDelete = this.deleteProjectIds();
      for (const p of this.projects()) {
        if (projectIdsToDelete.has(p.id)) {
          await this.projectsSvc.deleteProject(p.id);
        } else {
          await this.projectsSvc.update(p.id, { ownerId: null, clientName: '', branding: null });
        }
      }

      await this.empresasSvc.delete(this.cid);
      this.deleteModalOpen.set(false);
      await this.router.navigate(['/admin/clientes']);
    } catch {
      this.deleteErr.set('Erro ao excluir empresa. Tente novamente.');
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
    return initials(name);
  }

  /* ── PROJETOS: adicionar existente ── */
  openAddProjectModal(): void {
    this.apSelectedProjectId.set('');
    this.apErr.set('');
    this.apModalOpen.set(true);
  }

  closeAddProjectModal(): void {
    this.apModalOpen.set(false);
  }

  async attachProject(): Promise<void> {
    const projectId = this.apSelectedProjectId();
    this.apErr.set('');
    if (!projectId) {
      this.apErr.set('Selecione um projeto.');
      return;
    }
    const e = this.empresa();
    this.apSaving.set(true);
    try {
      await this.projectsSvc.update(projectId, {
        ownerId: this.cid,
        clientName: e?.branding?.companyName || '',
        branding: e?.branding || null,
      });
      this.apModalOpen.set(false);
    } catch {
      this.apErr.set('Erro ao vincular projeto.');
    } finally {
      this.apSaving.set(false);
    }
  }

  async removeProjectFromCompany(project: Project): Promise<void> {
    const ok = await this.confirmSvc.confirm({
      title: 'Remover projeto da empresa',
      message: `Remover "${project.name}" desta empresa? O projeto deixa de ficar vinculado e a empresa perde o acesso a ele — ele continua existindo, sem empresa.`,
      confirmLabel: 'Remover',
      danger: true,
    });
    if (!ok) return;
    this.removingProjectId.set(project.id);
    try {
      await this.projectsSvc.update(project.id, { ownerId: null, clientName: '', branding: null });
    } finally {
      this.removingProjectId.set('');
    }
  }
}
