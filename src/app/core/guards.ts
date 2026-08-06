import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { map, of, switchMap, take } from 'rxjs';
import { AuthService, isMentoradoRole, isStaffRole } from './auth.service';

/** Para onde mandar um usuário não-staff, conforme a role. */
function nonStaffHome(role: unknown): string {
  return isMentoradoRole(role) ? '/mentoria' : '/portal';
}

/** Exige usuário autenticado (qualquer papel); senão manda pro login. */
export const authGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  return auth.user$.pipe(
    take(1),
    map((user) => (user ? true : router.createUrlTree(['/login']))),
  );
};

/** Exige Owner ou Manager; senão manda pra área do usuário (portal ou mentoria). */
export const staffGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  return auth.user$.pipe(
    take(1),
    switchMap((user) => {
      if (!user) return of(router.createUrlTree(['/login']));
      return auth.userData$.pipe(
        take(1),
        map((data) => (isStaffRole(data?.role) ? true : router.createUrlTree([nonStaffHome(data?.role)]))),
      );
    }),
  );
};

/** Rotas do portal (empresas-cliente): staff vai pro admin; mentorado vai pra mentoria. */
export const portalGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  return auth.user$.pipe(
    take(1),
    switchMap((user) => {
      if (!user) return of(router.createUrlTree(['/login']));
      return auth.userData$.pipe(
        take(1),
        map((data) => {
          if (isStaffRole(data?.role)) return router.createUrlTree(['/admin']);
          if (isMentoradoRole(data?.role)) return router.createUrlTree(['/mentoria']);
          return true;
        }),
      );
    }),
  );
};

/** Rotas de mentoria: staff vai pro admin; cliente de empresa vai pro portal. */
export const mentoriaGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  return auth.user$.pipe(
    take(1),
    switchMap((user) => {
      if (!user) return of(router.createUrlTree(['/login']));
      return auth.userData$.pipe(
        take(1),
        map((data) => {
          if (isStaffRole(data?.role)) return router.createUrlTree(['/admin']);
          if (isMentoradoRole(data?.role)) return true;
          return router.createUrlTree(['/portal']);
        }),
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
        map((data) => router.createUrlTree([isStaffRole(data?.role) ? '/admin' : nonStaffHome(data?.role)])),
      );
    }),
  );
};
