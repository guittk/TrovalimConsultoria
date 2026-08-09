import { AsyncPipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth.service';
import { EmpresasService } from '../../core/empresas.service';
import { ProjectsService } from '../../core/projects.service';
import {
  ProjectStatusSettingsService,
  DEFAULT_PROJECT_STATUS_SETTINGS,
} from '../../core/project-status-settings.service';
import { Empresa } from '../../core/models';
import { PnavComponent, PnavTab } from '../../shared/pnav/pnav.component';
import { StatusBadgeComponent } from '../../shared/status-badge/status-badge.component';

const ADMIN_TABS: PnavTab[] = [
  { key: 'projetos', label: 'Projetos', path: '/admin' },
  { key: 'clientes', label: 'Empresas', path: '/admin/clientes' },
  { key: 'contas', label: 'Contas', path: '/admin/contas' },
  { key: 'contatos', label: 'Contatos', path: '/admin/contatos' },
  { key: 'config', label: 'Configurações', path: '/admin/config' },
];

@Component({
  selector: 'app-admin-home',
  standalone: true,
  imports: [AsyncPipe, FormsModule, RouterLink, PnavComponent, StatusBadgeComponent],
  templateUrl: './admin-home.component.html',
})
export class AdminHomeComponent {
  private readonly auth = inject(AuthService);
  private readonly empresasSvc = inject(EmpresasService);
  private readonly projectsSvc = inject(ProjectsService);
  private readonly statusSettingsSvc = inject(ProjectStatusSettingsService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  readonly statusSettings = toSignal(this.statusSettingsSvc.get$(), {
    initialValue: DEFAULT_PROJECT_STATUS_SETTINGS,
  });

  readonly tabs = ADMIN_TABS;
  readonly userData$ = this.auth.userData$;

  readonly projects = toSignal(this.projectsSvc.listAll$(), { initialValue: [] });
  readonly allEmpresas = toSignal(this.empresasSvc.listAll$(), { initialValue: [] });
  readonly empresasById = computed(() => new Map(this.allEmpresas().map((e) => [e.id, e])));
  readonly searchTerm = signal('');
  readonly statusFilter = signal('');

  readonly filteredProjects = computed(() => {
    const q = this.searchTerm().trim().toLowerCase();
    const st = this.statusFilter();
    let list = this.projects();
    if (q) {
      list = list.filter(
        (p) =>
          p.name?.toLowerCase().includes(q) ||
          p.clientName?.toLowerCase().includes(q) ||
          p.description?.toLowerCase().includes(q) ||
          p.branding?.companyName?.toLowerCase().includes(q),
      );
    }
    if (st) list = list.filter((p) => p.status === st);
    return list;
  });

  readonly projectsWithCompany = computed(() => this.filteredProjects().filter((p) => !!p.ownerId));
  readonly projectsWithoutCompany = computed(() => this.filteredProjects().filter((p) => !p.ownerId));

  /* ── MODAL ── */
  readonly modalOpen = signal(false);
  readonly modalError = signal('');
  readonly saving = signal(false);
  readonly npName = signal('');
  readonly npDesc = signal('');
  readonly npStatus = signal('em-andamento');
  readonly npClientUid = signal('');
  readonly clients = signal<Empresa[]>([]);
  readonly clientsLoading = signal(false);

  readonly selectedClient = computed(() => this.clients().find((c) => c.id === this.npClientUid()));

  constructor() {
    const empresaId = this.route.snapshot.queryParamMap.get('empresa');
    if (empresaId) {
      this.openModal(empresaId);
      this.router.navigate([], { queryParams: {} });
    }
  }

  openModal(preselectedEmpresaId?: string): void {
    this.npName.set('');
    this.npDesc.set('');
    this.npStatus.set('em-andamento');
    this.npClientUid.set(preselectedEmpresaId || '');
    this.modalError.set('');
    this.modalOpen.set(true);
    this.loadClients();
  }

  closeModal(): void {
    this.modalOpen.set(false);
  }

  private loadClients(): void {
    this.clientsLoading.set(true);
    this.empresasSvc.listAll$().subscribe({
      next: (list) => {
        this.clients.set([...list].sort((a, b) => this.companyLabel(a).localeCompare(this.companyLabel(b))));
        this.clientsLoading.set(false);
      },
      error: () => this.clientsLoading.set(false),
    });
  }

  companyLabel(e: Empresa): string {
    return e.branding?.companyName || 'Sem nome';
  }

  initials(name: string): string {
    return name.split(' ').slice(0, 2).map((w) => w[0] || '').join('').toUpperCase() || '?';
  }

  async createProject(): Promise<void> {
    const name = this.npName().trim();
    if (!name) {
      this.modalError.set('O nome do projeto é obrigatório.');
      return;
    }
    this.saving.set(true);
    const client = this.selectedClient();
    try {
      const id = await this.projectsSvc.create({
        name,
        description: this.npDesc().trim(),
        clientName: client ? this.companyLabel(client) : '',
        ownerId: client?.id || null,
        status: this.npStatus(),
        progress: 0,
        steps: [],
        branding: null,
      });
      this.modalOpen.set(false);
      await this.router.navigate(['/admin/projeto', id]);
    } catch {
      this.modalError.set('Erro ao criar projeto. Tente novamente.');
    } finally {
      this.saving.set(false);
    }
  }
}
