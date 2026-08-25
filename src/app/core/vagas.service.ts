import { Injectable, inject } from '@angular/core';
import {
  DocumentData,
  Firestore,
  Timestamp,
  addDoc,
  collection,
  deleteDoc,
  doc,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from 'firebase/firestore';
import { Observable, catchError, map, of } from 'rxjs';
import { FIRESTORE } from './firebase.providers';
import { collectionData$, docData$ } from './firestore-rx';
import { Vaga } from './models';

function toMillis(value: unknown): number {
  return value instanceof Timestamp ? value.toMillis() : 0;
}

export const VAGA_STATUSES: { key: Vaga['status']; label: string }[] = [
  { key: 'aberta', label: 'Aberta' },
  { key: 'fechada', label: 'Fechada' },
];

@Injectable({ providedIn: 'root' })
export class VagasService {
  private readonly db: Firestore = inject(FIRESTORE);

  /**
   * Sem orderBy() na query, de propósito — combinar where(equal) com
   * orderBy() de outro campo exige índice composto, que este repo não
   * declara (mesmo padrão de mentoria.service.ts). Ordena em memória.
   */
  listForProject$(projectId: string): Observable<Vaga[]> {
    return (
      collectionData$<DocumentData>(
        query(collection(this.db, 'vagas'), where('projectId', '==', projectId)),
      ) as Observable<Vaga[]>
    ).pipe(
      map((vagas) => vagas.sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt))),
      catchError((err) => {
        console.error('[vagas] falha ao carregar — as regras do Firestore foram implantadas?', err);
        return of([]);
      }),
    );
  }

  get$(id: string): Observable<Vaga | null> {
    return docData$<DocumentData>(doc(this.db, 'vagas', id)) as Observable<Vaga | null>;
  }

  create(data: Omit<Vaga, 'id' | 'createdAt'>): Promise<string> {
    return addDoc(collection(this.db, 'vagas'), { ...data, createdAt: serverTimestamp() }).then((ref) => ref.id);
  }

  update(id: string, data: Partial<Vaga>): Promise<void> {
    return updateDoc(doc(this.db, 'vagas', id), data as DocumentData);
  }

  delete(id: string): Promise<void> {
    return deleteDoc(doc(this.db, 'vagas', id));
  }
}
