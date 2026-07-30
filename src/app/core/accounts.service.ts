import { Injectable, inject } from '@angular/core';
import {
  DocumentData,
  Firestore,
  collection,
  deleteDoc,
  doc,
  getDocs,
  query,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import { deleteApp, initializeApp } from 'firebase/app';
import { createUserWithEmailAndPassword, getAuth, signOut } from 'firebase/auth';
import { Observable, map } from 'rxjs';
import { environment } from '../../environments/environment';
import { FIRESTORE } from './firebase.providers';
import { collectionData$, docData$ } from './firestore-rx';
import { Role, UserAccount } from './models';
import { isStaffRole } from './auth.service';

@Injectable({ providedIn: 'root' })
export class AccountsService {
  private readonly db: Firestore = inject(FIRESTORE);

  listAll$(): Observable<UserAccount[]> {
    return collectionData$<DocumentData>(collection(this.db, 'users')).pipe(
      map((docs) => docs.map((d) => ({ ...d, uid: d.id }) as UserAccount)),
    );
  }

  get$(uid: string): Observable<UserAccount | null> {
    return docData$<DocumentData>(doc(this.db, 'users', uid)).pipe(
      map((d) => (d ? ({ ...d, uid: d.id } as UserAccount) : null)),
    );
  }

  listClients$(): Observable<UserAccount[]> {
    return this.listAll$().pipe(map((users) => users.filter((u) => !isStaffRole(u.role))));
  }

  /** Clientes "empresa" — exclui colaboradores (contas com companyId), que não são donos de projeto. */
  listCompanies$(): Observable<UserAccount[]> {
    return this.listClients$().pipe(map((users) => users.filter((u) => !u.companyId)));
  }

  listTeamMembers$(companyId: string): Observable<UserAccount[]> {
    return collectionData$<DocumentData>(
      query(collection(this.db, 'users'), where('companyId', '==', companyId)),
    ).pipe(map((docs) => docs.map((d) => ({ ...d, uid: d.id }) as UserAccount)));
  }

  updateProfile(
    uid: string,
    data: { name?: string; role?: Role; projectAccess?: string[] | null },
  ): Promise<void> {
    return updateDoc(doc(this.db, 'users', uid), data as DocumentData);
  }

  updateBranding(uid: string, branding: UserAccount['branding']): Promise<void> {
    return updateDoc(doc(this.db, 'users', uid), { branding });
  }

  updateStorageLimit(uid: string, storageLimitMb: number | null): Promise<void> {
    return updateDoc(doc(this.db, 'users', uid), { storageLimitMb });
  }

  updatePhoto(uid: string, photoUrl: string | null): Promise<void> {
    return updateDoc(doc(this.db, 'users', uid), { photoUrl });
  }

  /**
   * Impede excluir uma conta "empresa" enquanto ela ainda tiver colaboradores
   * vinculados (companyId) — eles ficariam órfãos, sem branding/projeto,
   * sem serem avisados. O chamador deve remover os colaboradores primeiro
   * (ou os promover/realocar) antes de excluir a empresa.
   */
  async deleteAccount(uid: string): Promise<void> {
    const teamSnap = await getDocs(query(collection(this.db, 'users'), where('companyId', '==', uid)));
    if (!teamSnap.empty) {
      throw new Error('HAS_TEAM_MEMBERS');
    }
    await deleteDoc(doc(this.db, 'users', uid));
  }

  /**
   * Cria a conta em um app Firebase secundário para não substituir a sessão
   * do admin logado — createUserWithEmailAndPassword loga automaticamente
   * como o novo usuário no app em que é chamado.
   */
  async createAccount(
    name: string,
    email: string,
    password: string,
    role: Role,
    projectAccess: string[] | null = null,
  ): Promise<void> {
    const secondaryApp = initializeApp(environment.firebase, `Secondary-${Date.now()}`);
    try {
      const secondaryAuth = getAuth(secondaryApp);
      const cred = await createUserWithEmailAndPassword(secondaryAuth, email, password);
      await setDoc(doc(this.db, 'users', cred.user.uid), { name, email, role, projectAccess });
      await signOut(secondaryAuth);
    } finally {
      await deleteApp(secondaryApp);
    }
  }

  /** Cria um colaborador (role client) vinculado a uma empresa-cliente existente. */
  async createTeamMember(companyId: string, name: string, email: string, password: string): Promise<void> {
    const secondaryApp = initializeApp(environment.firebase, `Secondary-${Date.now()}`);
    try {
      const secondaryAuth = getAuth(secondaryApp);
      const cred = await createUserWithEmailAndPassword(secondaryAuth, email, password);
      await setDoc(doc(this.db, 'users', cred.user.uid), {
        name,
        email,
        role: 'client',
        companyId,
        projectAccess: null,
      });
      await signOut(secondaryAuth);
    } finally {
      await deleteApp(secondaryApp);
    }
  }
}
