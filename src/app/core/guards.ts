import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { map, of, switchMap, take } from 'rxjs';
import { AuthService, isStaffRole } from './auth.service';

/** Exige usuário autenticado (qualquer papel); senão manda pro login. */
export const authGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  return auth.user$.pipe(
    take(1),
    map((user) => (user ? true : router.createUrlTree(['/login']))),
  );
};

/** Exige Owner ou Manager; senão manda pro portal do cliente. */
export const staffGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  return auth.user$.pipe(
    take(1),
    switchMap((user) => {
      if (!user) return of(router.createUrlTree(['/login']));
      return auth.userData$.pipe(
        take(1),
        map((data) => (isStaffRole(data?.role) ? true : router.createUrlTree(['/portal']))),
      );
    }),
  );
};

/** Rotas do portal: exige login e redireciona staff pra área admin. */
export const portalGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  return auth.user$.pipe(
    take(1),
    switchMap((user) => {
      if (!user) return of(router.createUrlTree(['/login']));
      return auth.userData$.pipe(
        take(1),
        map((data) => (isStaffRole(data?.role) ? router.createUrlTree(['/admin']) : true)),
      );
    }),
  );
};

/** Rota de login: se já estiver logado, manda direto pra área certa. */
export const loginGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  return auth.user$.pipe(
    take(1),
    switchMap((user) => {
      if (!user) return of(true);
      return auth.userData$.pipe(
        take(1),
        map((data) => router.createUrlTree([isStaffRole(data?.role) ? '/admin' : '/portal'])),
      );
    }),
  );
};
