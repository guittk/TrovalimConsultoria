import { AsyncPipe } from '@angular/common';
import { Component, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth.service';
import { AccountsService } from '../../core/accounts.service';
import { UserAccount } from '../../core/models';
import { initials } from '../../shared/initials';
import { PnavComponent, PnavTab } from '../../shared/pnav/pnav.component';

const ADMIN_TABS: PnavTab[] = [
  { key: 'projetos', label: 'Projetos', path: '/admin' },
  { key: 'clientes', label: 'Empresas', path: '/admin/clientes' },
  { key: 'mentoria', label: 'Mentoria', path: '/admin/mentoria' },
  { key: 'contas', label: 'Contas', path: '/admin/contas' },
  { key: 'kanban', label: 'Kanban', path: '/admin/kanban' },
  { key: 'treinamentos', label: 'Treinamentos', path: '/admin/treinamentos' },
  { key: 'config', label: 'Configurações', path: '/admin/config' },
];

@Component({
  selector: 'app-admin-mentoria',
  standalone: true,
  imports: [AsyncPipe, RouterLink, PnavComponent],
  templateUrl: './admin-mentoria.component.html',
})
export class AdminMentoriaComponent {
  private readonly auth = inject(AuthService);
  private readonly accountsSvc = inject(AccountsService);

  readonly tabs = ADMIN_TABS;
  readonly userData$ = this.auth.userData$;
  readonly mentorados = toSignal(this.accountsSvc.listMentorados$(), { initialValue: [] as UserAccount[] });

  initials(name: string): string {
    return initials(name);
  }
}
