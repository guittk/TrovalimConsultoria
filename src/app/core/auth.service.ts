import { Injectable, inject } from '@angular/core';
import {
  Auth,
  User,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
} from 'firebase/auth';
import {
  DocumentData,
  Firestore,
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  query,
  where,
} from 'firebase/firestore';
import { Observable, map, of, shareReplay, switchMap } from 'rxjs';
import { FIREBASE_AUTH, FIRESTORE } from './firebase.providers';
import { docData$, retryPromiseOnPermissionDenied } from './firestore-rx';
import { UserAccount } from './models';

const STAFF_ROLES = ['owner', 'manager'];

export function normRole(role: unknown): string {
  return String(role ?? '').trim().toLowerCase();
}

export function isStaffRole(role: unknown): boolean {
  return STAFF_ROLES.includes(normRole(role));
}

export function isMentoradoRole(role: unknown): boolean {
  return normRole(role) === 'mentorado';
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly auth: Auth = inject(FIREBASE_AUTH);
  private readonly db: Firestore = inject(FIRESTORE);

  readonly user$: Observable<User | null> = new Observable<User | null>((subscriber) =>
    onAuthStateChanged(this.auth, (user) => subscriber.next(user)),
  ).pipe(shareReplay(1));

  readonly userData$: Observable<UserAccount | null> = this.user$.pipe(
    switchMap((user) => (user ? this.resolveUserData(user) : Promise.resolve(null))),
    switchMap((data) => (data?.companyId ? this.withCompanyData$(data) : of(data))),
    shareReplay(1),
  );

  readonly isStaff$ = this.userData$.pipe(map((data) => isStaffRole(data?.role)));
  readonly isOwner$ = this.userData$.pipe(map((data) => normRole(data?.role) === 'owner'));

  login(email: string, password: string) {
    return signInWithEmailAndPassword(this.auth, email, password);
  }

  logout() {
    return signOut(this.auth);
  }

  get currentUser(): User | null {
    return this.auth.currentUser;
  }

  /**
   * Alguns documentos em `users` foram criados manualmente com o ID errado
   * (email em vez do UID do Firebase Auth). Este fallback em 3 passos evita
   * que a conta fique sem papel reconhecido: 1) doc com ID = UID (correto),
   * 2) query pelo campo email, 3) doc com ID = email (erro comum).
   *
   * Logo após restaurar a sessão, a primeira leitura às vezes esbarra numa
   * corrida do token de auth e volta "permission-denied" mesmo com as
   * regras corretas (validado ao vivo) — por isso o retry, e por isso
   * nunca deixamos um erro vazar daqui: o pior caso é retornar null.
   */
  async resolveUserData(user: User): Promise<UserAccount | null> {
    try {
      return await retryPromiseOnPermissionDenied(() => this.resolveUserDataOnce(user));
    } catch {
      return null;
    }
  }

  private async resolveUserDataOnce(user: User): Promise<UserAccount | null> {
    const byUid = await getDoc(doc(this.db, 'users', user.uid));
    if (byUid.exists()) return { uid: byUid.id, ...(byUid.data() as Omit<UserAccount, 'uid'>) };

    const byEmailQuery = await getDocs(
      query(collection(this.db, 'users'), where('email', '==', user.email), limit(1)),
    );
    if (!byEmailQuery.empty) {
      const d = byEmailQuery.docs[0];
      return { uid: d.id, ...(d.data() as Omit<UserAccount, 'uid'>) };
    }

    if (user.email) {
      const byEmailDoc = await getDoc(doc(this.db, 'users', user.email));
      if (byEmailDoc.exists()) {
        return { uid: byEmailDoc.id, ...(byEmailDoc.data() as Omit<UserAccount, 'uid'>) };
      }
    }

    return null;
  }

  /**
   * Colaboradores (contas com companyId) herdam o branding e os limites de
   * armazenamento da conta "empresa" em tempo real — mantendo seus próprios
   * nome/e-mail/foto.
   */
  private withCompanyData$(data: UserAccount): Observable<UserAccount> {
    return docData$<DocumentData>(doc(this.db, 'empresas', data.companyId!)).pipe(
      map((company) =>
        company
          ? {
              ...data,
              branding: company['branding'] as UserAccount['branding'],
              storageLimitMb: company['storageLimitMb'] as UserAccount['storageLimitMb'],
              storageUsageBytes: company['storageUsageBytes'] as UserAccount['storageUsageBytes'],
            }
          : data,
      ),
    );
  }
}
