import { AsyncPipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth.service';
import { AccountsService } from '../../core/accounts.service';
import { ProjectsService } from '../../core/projects.service';
import { Project } from '../../core/models';
import { PnavComponent, PnavTab } from '../../shared/pnav/pnav.component';

const ADMIN_TABS: PnavTab[] = [
  { key: 'projetos', label: 'Projetos', path: '/admin' },
  { key: 'clientes', label: 'Empresas', path: '/admin/clientes' },
  { key: 'contas', label: 'Contas', path: '/admin/contas' },
  { key: 'config', label: 'Configurações', path: '/admin/config' },
];

@Component({
  selector: 'app-admin-clients',
  standalone: true,
  imports: [AsyncPipe, FormsModule, RouterLink, PnavComponent],
  templateUrl: './admin-clients.component.html',
})
export class AdminClientsComponent {
  private readonly auth = inject(AuthService);
  private readonly accountsSvc = inject(AccountsService);
  private readonly projectsSvc = inject(ProjectsService);
  private readonly router = inject(Router);

  readonly tabs = ADMIN_TABS;
  readonly userData$ = this.auth.userData$;
  readonly isOwner = toSignal(this.auth.isOwner$, { initialValue: false });

  readonly clients = toSignal(this.accountsSvc.listCompanies$(), { initialValue: [] });
  readonly projects = toSignal(this.projectsSvc.listAll$(), { initialValue: [] });
  readonly searchTerm = signal('');

  readonly filteredClients = computed(() => {
    const q = this.searchTerm().trim().toLowerCase();
    if (!q) return this.clients();
    return this.clients().filter((c) => {
      const company = this.companyFor(c.uid, c.branding) || c.name || c.email || '';
      return company.toLowerCase().includes(q);
    });
  });

  /* ── NOVA EMPRESA ── */
  readonly modalOpen = signal(false);
  readonly newCompanyName = signal('');
  readonly saving = signal(false);
  readonly modalErr = signal('');

  openCreate(): void {
    this.newCompanyName.set('');
    this.modalErr.set('');
    this.modalOpen.set(true);
  }

  closeModal(): void {
    this.modalOpen.set(false);
  }

  async createCompany(): Promise<void> {
    const name = this.newCompanyName().trim();
    if (!name) {
      this.modalErr.set('O nome da empresa é obrigatório.');
      return;
    }
    this.saving.set(true);
    try {
      const id = await this.accountsSvc.createCompany(name);
      this.modalOpen.set(false);
      await this.router.navigate(['/admin/clientes', id]);
    } catch {
      this.modalErr.set('Erro ao criar empresa. Tente novamente.');
    } finally {
      this.saving.set(false);
    }
  }

  projectsFor(uid: string): Project[] {
    return this.projects().filter((p) => p.ownerId === uid);
  }

  companyFor(uid: string, branding?: { companyName: string }): string {
    const proj = this.projectsFor(uid);
    return branding?.companyName || proj[0]?.branding?.companyName || proj[0]?.clientName || '';
  }

  logoFor(uid: string, branding?: { logo: string | null }): string | null {
    return branding?.logo || this.projectsFor(uid)[0]?.branding?.logo || null;
  }

  initials(name: string): string {
    return name.split(' ').slice(0, 2).map((w) => w[0] || '').join('').toUpperCase() || '?';
  }
}
