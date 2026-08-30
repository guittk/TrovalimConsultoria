import { PnavTab } from '../shared/pnav/pnav.component';

/**
 * Abas da área admin, compartilhadas por todas as telas (cada uma passa
 * `[tabs]="ADMIN_TABS"` pro `app-pnav`). Únicas — antes duplicadas
 * idênticas em cada componente, o que tornava fácil uma tela ficar pra
 * trás ao acrescentar ou renomear uma aba.
 *
 * `group` agrupa as abas por categoria na sidebar (um rótulo discreto por
 * bloco). A ORDEM da lista é a ordem de exibição; abas do mesmo `group`
 * têm que ficar contíguas.
 *
 * `isNew: true` marca uma aba construída na branch `evolucao-plataforma`
 * que ainda não foi 100% refinada visualmente — ganha um ponto dourado no
 * botão (ver `PnavComponent`). Ao promover pra `main`, apagar `isNew` de tudo.
 *
 * `icon` é o desenho outline de cada aba (paths de um viewBox 24x24, mesmo
 * traço, sem preenchimento) — o Guia de Identidade Visual pede um único
 * estilo de ícone em toda a plataforma.
 */
export const ADMIN_TABS: PnavTab[] = [
  // ── Operação ──
  {
    key: 'painel',
    label: 'Dashboard',
    path: '/admin/painel',
    group: 'Operação',
    icon: ['M3 3h7v7H3z', 'M14 3h7v7h-7z', 'M14 14h7v7h-7z', 'M3 14h7v7H3z'],
  },
  {
    key: 'projetos',
    label: 'Projetos',
    path: '/admin',
    group: 'Operação',
    icon: [
      'M4 7h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2z',
      'M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16',
    ],
  },
  {
    key: 'kanban',
    label: 'Kanban',
    path: '/admin/kanban',
    group: 'Operação',
    icon: ['M6 5v11', 'M12 5v6', 'M18 5v14'],
  },
  {
    key: 'planejamento',
    label: 'Planejamento',
    path: '/admin/planejamento',
    group: 'Operação',
    icon: ['M4 3h16a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z', 'M9 3v18', 'M15 3v18'],
  },
  {
    key: 'calendario',
    label: 'Calendário',
    path: '/admin/calendario',
    group: 'Operação',
    icon: ['M8 2v4', 'M16 2v4', 'M3 10h18', 'M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z'],
  },

  // ── Comercial ──
  {
    key: 'prospeccao',
    label: 'Leads',
    path: '/admin/prospeccao',
    group: 'Comercial',
    icon: ['m3 17 6-6 4 4 8-8', 'M17 7h4v4'],
  },
  {
    key: 'brainstorm',
    label: 'Brainstorm',
    path: '/admin/brainstorm',
    group: 'Comercial',
    icon: ['M9 18h6', 'M10 22h4', 'M12 2a7 7 0 0 0-4 12.7c.6.5 1 1.3 1 2.1h6c0-.8.4-1.6 1-2.1A7 7 0 0 0 12 2z'],
  },
  {
    key: 'contatos',
    label: 'Contatos',
    path: '/admin/contatos',
    group: 'Comercial',
    icon: ['M4 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z', 'm22 7-10 6L2 7'],
  },

  // ── Pessoas ──
  {
    key: 'mentoria',
    label: 'Mentoria',
    path: '/admin/mentoria',
    group: 'Pessoas',
    isNew: true,
    icon: [
      'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2',
      'M9 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8z',
      'M22 21v-2a4 4 0 0 0-3-3.87',
      'M16 3.13a4 4 0 0 1 0 7.75',
    ],
  },
  {
    key: 'carreira',
    label: 'Carreira',
    path: '/admin/carreira',
    group: 'Pessoas',
    isNew: true,
    icon: ['M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2', 'M9 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8z', 'm16 11 2 2 4-4'],
  },
  {
    key: 'avaliacoes',
    label: 'Avaliações',
    path: '/admin/avaliacoes',
    group: 'Pessoas',
    isNew: true,
    icon: [
      'M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2',
      'M9 2h6v4H9z',
      'm9 14 2 2 4-4',
    ],
  },

  // ── Gestão ──
  {
    key: 'clientes',
    label: 'Empresas',
    path: '/admin/clientes',
    group: 'Gestão',
    icon: ['M3 21h18', 'M5 21V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16', 'M9 7h1', 'M14 7h1', 'M9 11h1', 'M14 11h1', 'M9 15h6v6H9z'],
  },
  // "Contas" saiu da sidebar — virou aba dentro de /admin/config (ver
  // AdminConfigComponent + AdminAccountsComponent[embedded]).
  // "Relatórios" saiu da sidebar — os indicadores agregados viraram a seção
  // "Indicadores da Operação" dentro do Dashboard (/admin/painel).
  {
    key: 'lgpd',
    label: 'LGPD',
    path: '/admin/lgpd',
    group: 'Gestão',
    isNew: true,
    icon: ['M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z', 'm9 12 2 2 4-4'],
  },
  {
    key: 'config',
    label: 'Configurações',
    path: '/admin/config',
    group: 'Gestão',
    icon: ['M4 21v-7', 'M4 10V3', 'M12 21v-9', 'M12 8V3', 'M20 21v-5', 'M20 12V3', 'M1 14h6', 'M9 8h6', 'M17 16h6'],
  },
];
