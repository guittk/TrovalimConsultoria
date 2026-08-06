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
import { Observable, map } from 'rxjs';
import { FIRESTORE } from './firebase.providers';
import { collectionData$ } from './firestore-rx';
import { MentorshipActivity } from './models';

@Injectable({ providedIn: 'root' })
export class MentoriaService {
  private readonly db: Firestore = inject(FIRESTORE);

  /**
   * Sem orderBy() na query para não depender de um índice composto — a
   * ordenação por data é feita em memória depois de carregar.
   */
  activitiesFor$(mentoradoUid: string): Observable<MentorshipActivity[]> {
    return collectionData$<DocumentData>(
      query(collection(this.db, 'mentoriaAtividades'), where('mentoradoUid', '==', mentoradoUid)),
    ).pipe(
      map((docs) =>
        docs
          .map((d) => ({ ...d, id: d.id }) as MentorshipActivity)
          .sort((a, b) => this.toDate(b.createdAt).getTime() - this.toDate(a.createdAt).getTime()),
      ),
    );
  }

  create(data: Omit<MentorshipActivity, 'id' | 'createdAt'>): Promise<unknown> {
    return addDoc(collection(this.db, 'mentoriaAtividades'), { ...data, createdAt: serverTimestamp() });
  }

  update(id: string, data: Partial<MentorshipActivity>): Promise<void> {
    return updateDoc(doc(this.db, 'mentoriaAtividades', id), data as DocumentData);
  }

  delete(id: string): Promise<void> {
    return deleteDoc(doc(this.db, 'mentoriaAtividades', id));
  }

  toDate(value: unknown): Date {
    if (value instanceof Timestamp) return value.toDate();
    return new Date();
  }
}
