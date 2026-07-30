import { AsyncPipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth.service';
import { AccountsService } from '../../core/accounts.service';
import { ProjectsService } from '../../core/projects.service';
import { UserAccount } from '../../core/models';
import { PnavComponent, PnavTab } from '../../shared/pnav/pnav.component';
import { StatusBadgeComponent } from '../../shared/status-badge/status-badge.component';

const ADMIN_TABS: PnavTab[] = [
  { key: 'projetos', label: 'Projetos', path: '/admin' },
  { key: 'clientes', label: 'Clientes', path: '/admin/clientes' },
  { key: 'contas', label: 'Contas', path: '/admin/contas' },
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
  private readonly accountsSvc = inject(AccountsService);
  private readonly projectsSvc = inject(ProjectsService);
  private readonly router = inject(Router);

  readonly tabs = ADMIN_TABS;
  readonly userData$ = this.auth.userData$;

  readonly projects = toSignal(this.projectsSvc.listAll$(), { initialValue: [] });
  readonly allAccounts = toSignal(this.accountsSvc.listAll$(), { initialValue: [] });
  readonly accountsByUid = computed(() => new Map(this.allAccounts().map((a) => [a.uid, a])));
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

  /* ── MODAL ── */
  readonly modalOpen = signal(false);
  readonly modalError = signal('');
  readonly saving = signal(false);
  readonly npName = signal('');
  readonly npDesc = signal('');
  readonly npStatus = signal('em-andamento');
  readonly npClientUid = signal('');
  readonly clients = signal<UserAccount[]>([]);
  readonly clientsLoading = signal(false);

  readonly selectedClient = computed(() => this.clients().find((c) => c.uid === this.npClientUid()));

  openModal(): void {
    this.npName.set('');
    this.npDesc.set('');
    this.npStatus.set('em-andamento');
    this.npClientUid.set('');
    this.modalError.set('');
    this.modalOpen.set(true);
    this.loadClients();
  }

  closeModal(): void {
    this.modalOpen.set(false);
  }

  private loadClients(): void {
    this.clientsLoading.set(true);
    this.accountsSvc.listCompanies$().subscribe({
      next: (list) => {
        this.clients.set([...list].sort((a, b) => (a.name || a.email || '').localeCompare(b.name || b.email || '')));
        this.clientsLoading.set(false);
      },
      error: () => this.clientsLoading.set(false),
    });
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
        clientName: client?.name || client?.email || '',
        clientEmail: client?.email || '',
        ownerId: client?.uid || null,
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
