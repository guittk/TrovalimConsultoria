import { Injectable, inject } from '@angular/core';
import {
  Auth,
  User,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
} from 'firebase/auth';
import {
  Firestore,
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  query,
  where,
} from 'firebase/firestore';
import { Observable, map, shareReplay, switchMap } from 'rxjs';
import { FIREBASE_AUTH, FIRESTORE } from './firebase.providers';
import { UserAccount } from './models';

const STAFF_ROLES = ['owner', 'manager'];

export function normRole(role: unknown): string {
  return String(role ?? '').trim().toLowerCase();
}

export function isStaffRole(role: unknown): boolean {
  return STAFF_ROLES.includes(normRole(role));
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
   */
  private async resolveUserData(user: User): Promise<UserAccount | null> {
    const byUid = await getDoc(doc(this.db, 'users', user.uid)).catch(() => null);
    if (byUid?.exists()) return { uid: byUid.id, ...(byUid.data() as Omit<UserAccount, 'uid'>) };

    const byEmailQuery = await getDocs(
      query(collection(this.db, 'users'), where('email', '==', user.email), limit(1)),
    ).catch(() => null);
    if (byEmailQuery && !byEmailQuery.empty) {
      const d = byEmailQuery.docs[0];
      return { uid: d.id, ...(d.data() as Omit<UserAccount, 'uid'>) };
    }

    if (user.email) {
      const byEmailDoc = await getDoc(doc(this.db, 'users', user.email)).catch(() => null);
      if (byEmailDoc?.exists()) {
        return { uid: byEmailDoc.id, ...(byEmailDoc.data() as Omit<UserAccount, 'uid'>) };
      }
    }

    return null;
  }
}
