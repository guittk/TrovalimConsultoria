import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { map, of, switchMap, take } from 'rxjs';
import { AuthService, isMentoradoRole, isStaffRole, normRole } from './auth.service';

/** Para onde mandar uma conta não-staff, conforme o papel. */
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

/** Exige Owner ou Manager; senão manda pra área da própria conta (portal ou mentoria). */
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

/**
 * Exige Owner ou Manager, e bloqueia o acesso direto por URL a uma aba que
 * o Owner escondeu para este manager (UserAccount.hiddenTabs) — a aba já
 * fica fora do menu (ver PnavComponent), isto cobre quem digita a URL.
 * Owner nunca é afetado por hiddenTabs.
 */
export function staffTabGuard(tabKey: string): CanActivateFn {
  return () => {
    const auth = inject(AuthService);
    const router = inject(Router);
    return auth.user$.pipe(
      take(1),
      switchMap((user) => {
        if (!user) return of(router.createUrlTree(['/login']));
        return auth.userData$.pipe(
          take(1),
          map((data) => {
            if (!isStaffRole(data?.role)) return router.createUrlTree([nonStaffHome(data?.role)]);
            const isManager = normRole(data?.role) === 'manager';
            if (isManager && (data?.hiddenTabs || []).includes(tabKey)) {
              return router.createUrlTree(['/admin']);
            }
            return true;
          }),
        );
      }),
    );
  };
}

/** Rotas do portal (empresas-cliente): staff vai pro admin, mentorado vai pra mentoria. */
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

/** Rotas de Mentoria: staff vai pro admin, empresa-cliente vai pro portal. */
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
