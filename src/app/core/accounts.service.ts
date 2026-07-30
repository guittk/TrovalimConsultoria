import { Injectable, inject } from '@angular/core';
import {
  DocumentData,
  Firestore,
  collection,
  deleteDoc,
  doc,
  setDoc,
  updateDoc,
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

  updateProfile(uid: string, data: { name?: string; role?: Role }): Promise<void> {
    return updateDoc(doc(this.db, 'users', uid), data);
  }

  updateBranding(uid: string, branding: UserAccount['branding']): Promise<void> {
    return updateDoc(doc(this.db, 'users', uid), { branding });
  }

  deleteAccount(uid: string): Promise<void> {
    return deleteDoc(doc(this.db, 'users', uid));
  }

  /**
   * Cria a conta em um app Firebase secundário para não substituir a sessão
   * do admin logado — createUserWithEmailAndPassword loga automaticamente
   * como o novo usuário no app em que é chamado.
   */
  async createAccount(name: string, email: string, password: string, role: Role): Promise<void> {
    const secondaryApp = initializeApp(environment.firebase, `Secondary-${Date.now()}`);
    try {
      const secondaryAuth = getAuth(secondaryApp);
      const cred = await createUserWithEmailAndPassword(secondaryAuth, email, password);
      await setDoc(doc(this.db, 'users', cred.user.uid), { name, email, role });
      await signOut(secondaryAuth);
    } finally {
      await deleteApp(secondaryApp);
    }
  }
}
