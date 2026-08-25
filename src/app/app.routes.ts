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
    path: 'admin/relatorios',
    canActivate: [staffGuard, staffTabGuard('relatorios')],
    loadComponent: () => import('./admin/admin-relatorios/admin-relatorios.component').then((m) => m.AdminRelatoriosComponent),
  },
  {
    path: 'admin/lgpd',
    canActivate: [staffGuard, staffTabGuard('lgpd')],
    loadComponent: () => import('./admin/admin-lgpd/admin-lgpd.component').then((m) => m.AdminLgpdComponent),
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
  {
    path: 'admin/contas',
    canActivate: [staffGuard, staffTabGuard('contas')],
    loadComponent: () => import('./admin/admin-accounts/admin-accounts.component').then((m) => m.AdminAccountsComponent),
  },
  {
    path: 'admin/kanban',
    canActivate: [staffGuard, staffTabGuard('kanban')],
    loadComponent: () => import('./admin/admin-kanban/admin-kanban.component').then((m) => m.AdminKanbanComponent),
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
