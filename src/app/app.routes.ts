import { Routes } from '@angular/router';
import { loginGuard, mentoriaGuard, portalGuard, staffGuard, staffTabGuard } from './core/guards';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./home/home.component').then((m) => m.HomeComponent),
  },
  {
    path: 'login',
    canActivate: [loginGuard],
    loadComponent: () => import('./login/login.component').then((m) => m.LoginComponent),
  },
  {
    path: 'portal',
    canActivate: [portalGuard],
    loadComponent: () => import('./portal/portal-home/portal-home.component').then((m) => m.PortalHomeComponent),
  },
  {
    path: 'portal/:id',
    canActivate: [portalGuard],
    loadComponent: () => import('./portal/portal-project/portal-project.component').then((m) => m.PortalProjectComponent),
  },
  {
    path: 'portal/carreira/minha',
    canActivate: [portalGuard],
    loadComponent: () => import('./portal/portal-carreira/portal-carreira.component').then((m) => m.PortalCarreiraComponent),
  },
  {
    path: 'proposta/:id',
    loadComponent: () => import('./proposta-publica/proposta-publica.component').then((m) => m.PropostaPublicaComponent),
  },
  {
    path: 'mentoria',
    canActivate: [mentoriaGuard],
    loadComponent: () => import('./mentoria/mentoria-home/mentoria-home.component').then((m) => m.MentoriaHomeComponent),
  },
  {
    path: 'admin/mentoria',
    canActivate: [staffGuard, staffTabGuard('mentoria')],
    loadComponent: () => import('./admin/admin-mentoria/admin-mentoria.component').then((m) => m.AdminMentoriaComponent),
  },
  {
    path: 'admin/mentoria/:uid',
    canActivate: [staffGuard, staffTabGuard('mentoria')],
    loadComponent: () => import('./admin/admin-mentoria-detail/admin-mentoria-detail.component').then((m) => m.AdminMentoriaDetailComponent),
  },
  {
    path: 'admin/carreira',
    canActivate: [staffGuard, staffTabGuard('carreira')],
    loadComponent: () => import('./admin/admin-carreira/admin-carreira.component').then((m) => m.AdminCarreiraComponent),
  },
  {
    path: 'admin/carreira/:uid',
    canActivate: [staffGuard, staffTabGuard('carreira')],
    loadComponent: () => import('./admin/admin-carreira-detail/admin-carreira-detail.component').then((m) => m.AdminCarreiraDetailComponent),
  },
  {
    path: 'admin/painel',
    canActivate: [staffGuard, staffTabGuard('painel')],
    loadComponent: () => import('./admin/admin-painel/admin-painel.component').then((m) => m.AdminPainelComponent),
  },
  {
    // "Relatórios" foi absorvida pelo Dashboard (seção "Indicadores da
    // Operação" em /admin/painel); a rota antiga redireciona pra lá.
    path: 'admin/relatorios',
    redirectTo: 'admin/painel',
    pathMatch: 'full',
  },
  {
    path: 'admin/lgpd',
    canActivate: [staffGuard, staffTabGuard('lgpd')],
    loadComponent: () => import('./admin/admin-lgpd/admin-lgpd.component').then((m) => m.AdminLgpdComponent),
  },
  {
    path: 'admin/avaliacoes',
    canActivate: [staffGuard, staffTabGuard('avaliacoes')],
    loadComponent: () => import('./admin/admin-avaliacoes/admin-avaliacoes.component').then((m) => m.AdminAvaliacoesComponent),
  },
  {
    path: 'admin',
    canActivate: [staffGuard],
    loadComponent: () => import('./admin/admin-home/admin-home.component').then((m) => m.AdminHomeComponent),
  },
  {
    path: 'admin/calendario',
    canActivate: [staffGuard, staffTabGuard('calendario')],
    loadComponent: () => import('./admin/admin-calendario/admin-calendario.component').then((m) => m.AdminCalendarioComponent),
  },
  {
    path: 'admin/prospeccao',
    canActivate: [staffGuard, staffTabGuard('prospeccao')],
    loadComponent: () => import('./admin/admin-prospeccao/admin-prospeccao.component').then((m) => m.AdminProspeccaoComponent),
  },
  {
    path: 'admin/brainstorm',
    canActivate: [staffGuard, staffTabGuard('brainstorm')],
    loadComponent: () => import('./admin/admin-brainstorm/admin-brainstorm.component').then((m) => m.AdminBrainstormComponent),
  },
  {
    path: 'admin/proposta/:id',
    canActivate: [staffGuard, staffTabGuard('prospeccao')],
    loadComponent: () => import('./admin/admin-proposta/admin-proposta.component').then((m) => m.AdminPropostaComponent),
  },
  {
    path: 'admin/projeto/:id',
    canActivate: [staffGuard],
    loadComponent: () => import('./admin/admin-project/admin-project.component').then((m) => m.AdminProjectComponent),
  },
  {
    path: 'admin/vaga/:id',
    canActivate: [staffGuard],
    loadComponent: () => import('./admin/admin-vaga/admin-vaga.component').then((m) => m.AdminVagaComponent),
  },
  {
    path: 'admin/clientes',
    canActivate: [staffGuard, staffTabGuard('clientes')],
    loadComponent: () => import('./admin/admin-clients/admin-clients.component').then((m) => m.AdminClientsComponent),
  },
  {
    path: 'admin/clientes/:id',
    canActivate: [staffGuard, staffTabGuard('clientes')],
    loadComponent: () => import('./admin/admin-client/admin-client.component').then((m) => m.AdminClientComponent),
  },
  // "Contas" virou aba de /admin/config — bookmarks antigos caem lá.
  { path: 'admin/contas', redirectTo: 'admin/config', pathMatch: 'full' },
  {
    path: 'admin/kanban',
    canActivate: [staffGuard, staffTabGuard('kanban')],
    loadComponent: () => import('./admin/admin-kanban/admin-kanban.component').then((m) => m.AdminKanbanComponent),
  },
  {
    path: 'admin/planejamento',
    canActivate: [staffGuard, staffTabGuard('planejamento')],
    loadComponent: () => import('./admin/admin-planejamento/admin-planejamento.component').then((m) => m.AdminPlanejamentoComponent),
  },
  {
    path: 'admin/contatos',
    canActivate: [staffGuard, staffTabGuard('contatos')],
    loadComponent: () => import('./admin/admin-contacts/admin-contacts.component').then((m) => m.AdminContactsComponent),
  },
  {
    path: 'admin/config',
    canActivate: [staffGuard, staffTabGuard('config')],
    loadComponent: () => import('./admin/admin-config/admin-config.component').then((m) => m.AdminConfigComponent),
  },
  {
    path: '404',
    loadComponent: () => import('./not-found/not-found.component').then((m) => m.NotFoundComponent),
  },
  { path: '**', redirectTo: '/404' },
];
