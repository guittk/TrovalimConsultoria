import { AsyncPipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth.service';
import { EmpresasService } from '../../core/empresas.service';
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
  private readonly empresasSvc = inject(EmpresasService);
  private readonly projectsSvc = inject(ProjectsService);
  private readonly router = inject(Router);

  readonly tabs = ADMIN_TABS;
  readonly userData$ = this.auth.userData$;
  readonly isOwner = toSignal(this.auth.isOwner$, { initialValue: false });

  readonly empresas = toSignal(this.empresasSvc.listAll$(), { initialValue: [] });
  readonly projects = toSignal(this.projectsSvc.listAll$(), { initialValue: [] });
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
      const id = await this.empresasSvc.create(name);
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

  initials(name: string): string {
    return name.split(' ').slice(0, 2).map((w) => w[0] || '').join('').toUpperCase() || '?';
  }
}
