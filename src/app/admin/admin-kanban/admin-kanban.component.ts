import { AsyncPipe } from '@angular/common';
import { Component, inject } from '@angular/core';
import { AuthService } from '../../core/auth.service';
import { PnavComponent, PnavTab } from '../../shared/pnav/pnav.component';
import { KanbanBoardComponent } from '../../shared/kanban-board/kanban-board.component';

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
  selector: 'app-admin-kanban',
  standalone: true,
  imports: [AsyncPipe, PnavComponent, KanbanBoardComponent],
  templateUrl: './admin-kanban.component.html',
})
export class AdminKanbanComponent {
  private readonly auth = inject(AuthService);

  readonly tabs = ADMIN_TABS;
  readonly userData$ = this.auth.userData$;
}
