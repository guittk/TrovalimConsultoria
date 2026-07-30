import { AsyncPipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth.service';
import { AccountsService } from '../../core/accounts.service';
import { ProjectsService } from '../../core/projects.service';
import { Project } from '../../core/models';
import { PnavComponent, PnavTab } from '../../shared/pnav/pnav.component';

const ADMIN_TABS: PnavTab[] = [
  { key: 'projetos', label: 'Projetos', path: '/admin' },
  { key: 'clientes', label: 'Clientes', path: '/admin/clientes' },
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

  readonly tabs = ADMIN_TABS;
  readonly userData$ = this.auth.userData$;

  readonly clients = toSignal(this.accountsSvc.listClients$(), { initialValue: [] });
  readonly projects = toSignal(this.projectsSvc.listAll$(), { initialValue: [] });
  readonly searchTerm = signal('');

  readonly filteredClients = computed(() => {
    const q = this.searchTerm().trim().toLowerCase();
    if (!q) return this.clients();
    return this.clients().filter((c) => {
      const proj = this.projectsFor(c.uid);
      const company = c.branding?.companyName || proj[0]?.branding?.companyName || proj[0]?.clientName || '';
      return (
        (c.name || '').toLowerCase().includes(q) ||
        (c.email || '').toLowerCase().includes(q) ||
        company.toLowerCase().includes(q)
      );
    });
  });

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
