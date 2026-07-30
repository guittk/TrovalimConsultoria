import { Injectable, inject } from '@angular/core';
import {
  DocumentData,
  Firestore,
  collection,
  deleteDoc,
  doc,
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

  /** Contas client já criadas em "Contas" mas ainda sem empresa — candidatas a colaborador. */
  listUnlinkedClients$(): Observable<UserAccount[]> {
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

  deleteAccount(uid: string): Promise<void> {
    return deleteDoc(doc(this.db, 'users', uid));
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

  /**
   * Vincula uma conta client já existente (criada em Contas) como
   * colaborador de uma empresa, com foto e cargo próprios. A conta passa a
   * herdar branding/projetos/limites de armazenamento da empresa.
   */
  linkTeamMember(uid: string, companyId: string, jobTitle: string, photoUrl: string | null): Promise<void> {
    return updateDoc(doc(this.db, 'users', uid), { companyId, jobTitle, photoUrl });
  }

  /** Desvincula um colaborador da empresa, sem excluir a conta (login continua existindo em Contas). */
  unlinkTeamMember(uid: string): Promise<void> {
    return updateDoc(doc(this.db, 'users', uid), { companyId: null, jobTitle: null, photoUrl: null });
  }

  /** Atualiza foto/cargo de um colaborador já vinculado. */
  updateCollaboratorProfile(uid: string, jobTitle: string, photoUrl: string | null): Promise<void> {
    return updateDoc(doc(this.db, 'users', uid), { jobTitle, photoUrl });
  }
}
