import { Routes } from '@angular/router';
import { loginGuard, portalGuard, staffGuard } from './core/guards';

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
    canActivate: [staffGuard],
    loadComponent: () => import('./admin/admin-clients/admin-clients.component').then((m) => m.AdminClientsComponent),
  },
  {
    path: 'admin/clientes/:id',
    canActivate: [staffGuard],
    loadComponent: () => import('./admin/admin-client/admin-client.component').then((m) => m.AdminClientComponent),
  },
  {
    path: 'admin/contas',
    canActivate: [staffGuard],
    loadComponent: () => import('./admin/admin-accounts/admin-accounts.component').then((m) => m.AdminAccountsComponent),
  },
  { path: '**', redirectTo: '' },
];
