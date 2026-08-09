import { Routes } from '@angular/router';
import { loginGuard, portalGuard, staffGuard, staffTabGuard } from './core/guards';

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
    path: 'admin',
    canActivate: [staffGuard],
    loadComponent: () => import('./admin/admin-home/admin-home.component').then((m) => m.AdminHomeComponent),
  },
  {
    path: 'admin/projeto/:id',
    canActivate: [staffGuard],
    loadComponent: () => import('./admin/admin-project/admin-project.component').then((m) => m.AdminProjectComponent),
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
