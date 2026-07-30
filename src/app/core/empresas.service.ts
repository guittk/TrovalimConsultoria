import { Injectable, inject } from '@angular/core';
import {
  DocumentData,
  Firestore,
  collection,
  deleteDoc,
  doc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import { Observable, map } from 'rxjs';
import { FIRESTORE } from './firebase.providers';
import { collectionData$, docData$ } from './firestore-rx';
import { Empresa } from './models';

const DEFAULT_BRANDING_COLOR = '#C9A96E';

@Injectable({ providedIn: 'root' })
export class EmpresasService {
  private readonly db: Firestore = inject(FIRESTORE);

  listAll$(): Observable<Empresa[]> {
    return collectionData$<DocumentData>(collection(this.db, 'empresas')).pipe(
      map((docs) => docs.map((d) => ({ ...d, id: d.id }) as Empresa)),
    );
  }

  get$(id: string): Observable<Empresa | null> {
    return docData$<DocumentData>(doc(this.db, 'empresas', id)).pipe(
      map((d) => (d ? ({ ...d, id: d.id } as Empresa) : null)),
    );
  }

  async create(companyName: string): Promise<string> {
    const ref = doc(collection(this.db, 'empresas'));
    await setDoc(ref, {
      branding: { companyName, primaryColor: DEFAULT_BRANDING_COLOR, logo: null },
      createdAt: serverTimestamp(),
    });
    return ref.id;
  }

  updateBranding(id: string, branding: Empresa['branding']): Promise<void> {
    return updateDoc(doc(this.db, 'empresas', id), { branding });
  }

  updateStorageLimit(id: string, storageLimitMb: number | null): Promise<void> {
    return updateDoc(doc(this.db, 'empresas', id), { storageLimitMb });
  }

  /**
   * Impede excluir uma empresa enquanto ela ainda tiver colaboradores
   * vinculados (companyId em /users) — eles perderiam acesso aos projetos e
   * à identidade visual sem aviso. Remova/realoque os colaboradores primeiro.
   */
  async delete(id: string): Promise<void> {
    const teamSnap = await getDocs(query(collection(this.db, 'users'), where('companyId', '==', id)));
    if (!teamSnap.empty) {
      throw new Error('HAS_TEAM_MEMBERS');
    }
    await deleteDoc(doc(this.db, 'empresas', id));
  }
}
