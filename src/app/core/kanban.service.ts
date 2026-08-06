import { Injectable, inject } from '@angular/core';
import {
  CollectionReference,
  DocumentData,
  Firestore,
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore';
import { Observable, map } from 'rxjs';
import { FIRESTORE } from './firebase.providers';
import { collectionData$ } from './firestore-rx';
import { KanbanCard, KanbanColumnKey } from './models';

export const KANBAN_COLUMNS: { key: KanbanColumnKey; label: string }[] = [
  { key: 'todo', label: 'A Fazer' },
  { key: 'doing', label: 'Em Andamento' },
  { key: 'done', label: 'Concluído' },
];

@Injectable({ providedIn: 'root' })
export class KanbanService {
  private readonly db: Firestore = inject(FIRESTORE);

  /** projectId null = quadro geral (não vinculado a nenhum projeto). */
  private collectionRef(projectId: string | null): CollectionReference<DocumentData> {
    return projectId
      ? collection(this.db, 'projects', projectId, 'kanbanCards')
      : collection(this.db, 'kanbanGeneral');
  }

  cards$(projectId: string | null): Observable<KanbanCard[]> {
    return collectionData$<DocumentData>(query(this.collectionRef(projectId), orderBy('order'))).pipe(
      map((docs) => docs.map((d) => ({ ...d, id: d.id }) as KanbanCard)),
    );
  }

  create(projectId: string | null, data: Omit<KanbanCard, 'id' | 'createdAt'>): Promise<unknown> {
    return addDoc(this.collectionRef(projectId), { ...data, createdAt: serverTimestamp() });
  }

  update(projectId: string | null, id: string, data: Partial<KanbanCard>): Promise<void> {
    return updateDoc(doc(this.collectionRef(projectId), id), data as DocumentData);
  }

  delete(projectId: string | null, id: string): Promise<void> {
    return deleteDoc(doc(this.collectionRef(projectId), id));
  }

  /** Usado ao excluir um projeto por completo, para apagar os cartões junto. */
  async deleteAllForProject(projectId: string): Promise<void> {
    const snap = await getDocs(this.collectionRef(projectId));
    await Promise.all(snap.docs.map((d) => deleteDoc(d.ref)));
  }
}
