import { AsyncPipe } from '@angular/common';
import { Component, NgZone, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth.service';
import { AccountsService } from '../../core/accounts.service';
import { EmpresasService } from '../../core/empresas.service';
import { ProjectsService } from '../../core/projects.service';
import { Project, UserAccount } from '../../core/models';
import { PnavComponent, PnavTab } from '../../shared/pnav/pnav.component';

const ADMIN_TABS: PnavTab[] = [
  { key: 'projetos', label: 'Projetos', path: '/admin' },
  { key: 'clientes', label: 'Empresas', path: '/admin/clientes' },
  { key: 'contas', label: 'Contas', path: '/admin/contas' },
  { key: 'config', label: 'Configurações', path: '/admin/config' },
];

interface StagedCollaborator {
  uid: string;
  name: string;
  email: string;
}

@Component({
  selector: 'app-admin-clients',
  standalone: true,
  imports: [AsyncPipe, FormsModule, RouterLink, PnavComponent],
  templateUrl: './admin-clients.component.html',
})
export class AdminClientsComponent {
  private readonly auth = inject(AuthService);
  private readonly accountsSvc = inject(AccountsService);
  private readonly empresasSvc = inject(EmpresasService);
  private readonly projectsSvc = inject(ProjectsService);
  private readonly router = inject(Router);
  private readonly zone = inject(NgZone);

  /**
   * input.click() num input[type=file] oculto dentro de uma modal corre
   * contra o zone.js e o diálogo nativo simplesmente não abre, sem erro
   * nenhum. showPicker() (fora da zone) é o que efetivamente funciona;
   * o fallback pra click() cobre navegadores sem showPicker() em inputs
   * de arquivo.
   */
  triggerFilePicker(input: HTMLInputElement): void {
    this.zone.runOutsideAngular(() => {
      if (typeof input.showPicker === 'function') {
        input.showPicker();
      } else {
        input.click();
      }
    });
  }

  /**
   * Mesmo problema do triggerFilePicker, mas para o input[type=color]: o
   * clique direto no swatch abre o diálogo nativo via ação padrão do
   * navegador, que também é vítima da corrida com o zone.js dentro da
   * modal. Bloqueamos a ação padrão e reabrimos o diálogo manualmente via
   * showPicker() fora da zone.
   */
  openColorPicker(event: MouseEvent): void {
    event.preventDefault();
    const input = event.currentTarget as HTMLInputElement;
    this.zone.runOutsideAngular(() => input.showPicker?.());
  }

  readonly tabs = ADMIN_TABS;
  readonly userData$ = this.auth.userData$;
  readonly isOwner = toSignal(this.auth.isOwner$, { initialValue: false });

  readonly empresas = toSignal(this.empresasSvc.listAll$(), { initialValue: [] });
  readonly projects = toSignal(this.projectsSvc.listAll$(), { initialValue: [] });
  readonly accounts = toSignal(this.accountsSvc.listAll$(), { initialValue: [] as UserAccount[] });
  readonly searchTerm = signal('');

  readonly filteredEmpresas = computed(() => {
    const q = this.searchTerm().trim().toLowerCase();
    if (!q) return this.empresas();
    return this.empresas().filter((e) => (e.branding?.companyName || '').toLowerCase().includes(q));
  });

  /* ── NOVA EMPRESA ── */
  readonly modalOpen = signal(false);
  readonly newCompanyName = signal('');
  readonly saving = signal(false);
  readonly modalErr = signal('');

  /* ── NOVA EMPRESA: identidade visual ── */
  readonly newBrandingColor = signal('#C9A96E');
  readonly newLogoPreview = signal<string | null>(null);
  private pendingLogoFile: File | null = null;

  /* ── NOVA EMPRESA: colaboradores a vincular ── */
  readonly stagedCollaborators = signal<StagedCollaborator[]>([]);
  readonly tmSelectedUid = signal('');

  private readonly unlinkedClients = toSignal(this.accountsSvc.listUnlinkedClients$(), {
    initialValue: [] as UserAccount[],
  });
  readonly availableAccounts = computed(() => {
    const stagedUids = new Set(this.stagedCollaborators().map((c) => c.uid));
    return this.unlinkedClients().filter((a) => !stagedUids.has(a.uid));
  });

  openCreate(): void {
    this.newCompanyName.set('');
    this.newBrandingColor.set('#C9A96E');
    this.newLogoPreview.set(null);
    this.pendingLogoFile = null;
    this.stagedCollaborators.set([]);
    this.tmSelectedUid.set('');
    this.modalErr.set('');
    this.modalOpen.set(true);
  }

  closeModal(): void {
    this.modalOpen.set(false);
  }

  onColorChange(value: string): void {
    this.newBrandingColor.set(value);
  }

  onLogoSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    this.pendingLogoFile = file;
    const reader = new FileReader();
    reader.onload = (ev) => this.newLogoPreview.set(ev.target?.result as string);
    reader.readAsDataURL(file);
  }

  removeLogo(): void {
    this.pendingLogoFile = null;
    this.newLogoPreview.set(null);
  }

  addStagedCollaborator(): void {
    const uid = this.tmSelectedUid();
    const account = this.availableAccounts().find((a) => a.uid === uid);
    if (!account) return;
    this.stagedCollaborators.update((list) => [
      ...list,
      { uid, name: account.name || account.email || '', email: account.email || '' },
    ]);
    this.tmSelectedUid.set('');
  }

  removeStagedCollaborator(uid: string): void {
    this.stagedCollaborators.update((list) => list.filter((c) => c.uid !== uid));
  }

  initials(name: string): string {
    return name.split(' ').slice(0, 2).map((w) => w[0] || '').join('').toUpperCase() || '?';
  }

  async createCompany(): Promise<void> {
    const name = this.newCompanyName().trim();
    if (!name) {
      this.modalErr.set('O nome da empresa é obrigatório.');
      return;
    }
    this.saving.set(true);
    this.modalErr.set('');
    try {
      const id = await this.empresasSvc.create(name);

      let logoUrl: string | null = null;
      if (this.pendingLogoFile) {
        logoUrl = await this.projectsSvc.uploadBrandingLogo(`clients/${id}/branding/logo_${Date.now()}`, this.pendingLogoFile);
      }
      await this.empresasSvc.updateBranding(id, {
        companyName: name,
        primaryColor: this.newBrandingColor(),
        logo: logoUrl,
      });

      for (const c of this.stagedCollaborators()) {
        await this.accountsSvc.linkTeamMember(c.uid, id);
      }

      this.modalOpen.set(false);
      await this.router.navigate(['/admin/clientes', id]);
    } catch {
      this.modalErr.set('Erro ao criar empresa. Tente novamente.');
    } finally {
      this.saving.set(false);
    }
  }

  projectsFor(empresaId: string): Project[] {
    return this.projects().filter((p) => p.ownerId === empresaId);
  }

  collaboratorsFor(empresaId: string): UserAccount[] {
    return this.accounts().filter((a) => a.companyId === empresaId);
  }
}
