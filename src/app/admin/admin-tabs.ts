import { PnavTab } from '../shared/pnav/pnav.component';

/**
 * Abas da área admin, compartilhadas por todas as telas (cada uma passa
 * `[tabs]="ADMIN_TABS"` pro `app-pnav`). Únicas — antes duplicadas
 * idênticas em cada componente, o que tornava fácil uma tela ficar pra
 * trás ao acrescentar ou renomear uma aba.
 */
export const ADMIN_TABS: PnavTab[] = [
  { key: 'painel', label: 'Painel', path: '/admin/painel' },
  { key: 'relatorios', label: 'Relatórios', path: '/admin/relatorios' },
  { key: 'projetos', label: 'Projetos', path: '/admin' },
  { key: 'calendario', label: 'Calendário', path: '/admin/calendario' },
  { key: 'prospeccao', label: 'Prospecção', path: '/admin/prospeccao' },
  { key: 'mentoria', label: 'Mentoria', path: '/admin/mentoria' },
  { key: 'carreira', label: 'Carreira', path: '/admin/carreira' },
  { key: 'clientes', label: 'Empresas', path: '/admin/clientes' },
  { key: 'contas', label: 'Contas', path: '/admin/contas' },
  { key: 'kanban', label: 'Kanban', path: '/admin/kanban' },
  { key: 'contatos', label: 'Contatos', path: '/admin/contatos' },
  { key: 'config', label: 'Configurações', path: '/admin/config' },
];
