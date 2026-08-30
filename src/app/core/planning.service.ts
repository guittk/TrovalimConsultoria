import { Injectable, inject } from '@angular/core';
import {
  DocumentData,
  Firestore,
  addDoc,
  collection,
  deleteDoc,
  deleteField,
  doc,
  getDocs,
  query,
  serverTimestamp,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { FirebaseStorage, deleteObject, getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { Observable, catchError, of } from 'rxjs';
import { FIRESTORE, FIREBASE_STORAGE } from './firebase.providers';
import { collectionData$ } from './firestore-rx';
import { PlanningAttachment, PlanningGroup, PlanningItem } from './models';

/**
 * Planejamento (quadro estilo Monday.com) — sistema separado do Kanban
 * (`TasksService`/`tasks`), sem nenhuma coleção ou campo em comum. Um
 * "quadro" não é um documento próprio: é implícito por `projectId`
 * (`null` = Quadro Global) nas coleções `planningGroups`/`planningItems`.
 */
@Injectable({ providedIn: 'root' })
export class PlanningService {
  private readonly db: Firestore = inject(FIRESTORE);
  private readonly storage: FirebaseStorage = inject(FIREBASE_STORAGE);

  private groupsCol() {
    return collection(this.db, 'planningGroups');
  }
  private itemsCol() {
    return collection(this.db, 'planningItems');
  }

  /** `catchError`+`of([])` — mesmo motivo do TasksService: não travar o toSignal() se as regras ainda não foram implantadas. */
  groups$(projectId: string | null): Observable<PlanningGroup[]> {
    return (
      collectionData$<DocumentData>(query(this.groupsCol(), where('projectId', '==', projectId))) as Observable<
        PlanningGroup[]
      >
    ).pipe(
      catchError((err) => {
        console.error('[planning] falha ao carregar grupos — as regras do Firestore foram implantadas?', err);
        return of([]);
      }),
    );
  }

  items$(projectId: string | null): Observable<PlanningItem[]> {
    return (
      collectionData$<DocumentData>(query(this.itemsCol(), where('projectId', '==', projectId))) as Observable<
        PlanningItem[]
      >
    ).pipe(
      catchError((err) => {
        console.error('[planning] falha ao carregar itens — as regras do Firestore foram implantadas?', err);
        return of([]);
      }),
    );
  }

  createGroup(projectId: string | null, nome: string, cor: string, ordem: number): Promise<string> {
    return addDoc(this.groupsCol(), {
      projectId,
      nome,
      cor,
      ordem,
      createdAt: serverTimestamp(),
    }).then((ref) => ref.id);
  }

  updateGroup(id: string, data: Partial<PlanningGroup>): Promise<void> {
    return updateDoc(doc(this.groupsCol(), id), data as DocumentData);
  }

  /** Apaga o grupo e, em lote, todos os itens (raiz + sub-itens) que pertencem a ele. */
  async deleteGroupCascade(id: string): Promise<void> {
    const itemsSnap = await getDocs(query(this.itemsCol(), where('groupId', '==', id)));
    const batch = writeBatch(this.db);
    itemsSnap.docs.forEach((d) => batch.delete(d.ref));
    batch.delete(doc(this.groupsCol(), id));
    await batch.commit();
  }

  reorderGroups(updates: { id: string; ordem: number }[]): void {
    for (const u of updates) {
      updateDoc(doc(this.groupsCol(), u.id), { ordem: u.ordem }).catch(() => undefined);
    }
  }

  createItem(data: Partial<PlanningItem>): Promise<string> {
    return addDoc(this.itemsCol(), {
      ...data,
      createdAt: serverTimestamp(),
    }).then((ref) => ref.id);
  }

  updateItem(id: string, data: Partial<PlanningItem>): Promise<void> {
    return updateDoc(doc(this.itemsCol(), id), data as DocumentData);
  }

  /** Se `id` for um item raiz, apaga também os sub-itens dele em lote. */
  async deleteItem(id: string): Promise<void> {
    const subSnap = await getDocs(query(this.itemsCol(), where('parentId', '==', id)));
    if (!subSnap.empty) {
      const batch = writeBatch(this.db);
      subSnap.docs.forEach((d) => batch.delete(d.ref));
      batch.delete(doc(this.itemsCol(), id));
      await batch.commit();
    } else {
      await deleteDoc(doc(this.itemsCol(), id));
    }
  }

  /** Promove um sub-item a item raiz — precisa de deleteField(), updateDoc rejeita `undefined`. */
  promoteToRoot(id: string): Promise<void> {
    return updateDoc(doc(this.itemsCol(), id), { parentId: deleteField() });
  }

  /**
   * Reordenação por drag — mesma técnica do Kanban (`AdminKanbanComponent.moveTask`):
   * recalcula `ordem` em memória (no componente) e dispara um `updateDoc` por
   * item afetado, sem batch (volume por drag é pequeno, atomicidade entre
   * itens não é crítica aqui).
   */
  reorderItems(updates: { id: string; ordem: number; groupId?: string; parentId?: string | null }[]): void {
    for (const u of updates) {
      const patch: DocumentData = { ordem: u.ordem };
      if (u.groupId !== undefined) patch['groupId'] = u.groupId;
      if (u.parentId !== undefined) patch['parentId'] = u.parentId === null ? deleteField() : u.parentId;
      updateDoc(doc(this.itemsCol(), u.id), patch).catch(() => undefined);
    }
  }

  async uploadAttachment(itemId: string, file: File): Promise<PlanningAttachment> {
    const path = `planning/${itemId}/${Date.now()}_${file.name}`;
    const storageRef = ref(this.storage, path);
    const snap = await uploadBytes(storageRef, file);
    const url = await getDownloadURL(snap.ref);
    return { nome: file.name, url, path };
  }

  async deleteAttachment(item: PlanningItem, attachment: PlanningAttachment): Promise<void> {
    await deleteObject(ref(this.storage, attachment.path)).catch(() => undefined);
    await updateDoc(doc(this.itemsCol(), item.id), {
      anexos: (item.anexos ?? []).filter((a) => a.path !== attachment.path),
    });
  }

  /** Ação em lote de verdade (uma escrita coordenada) — diferente do drag, usa writeBatch. */
  async bulkUpdate(ids: string[], patch: Partial<PlanningItem>): Promise<void> {
    const batch = writeBatch(this.db);
    for (const id of ids) batch.update(doc(this.itemsCol(), id), patch as DocumentData);
    await batch.commit();
  }

  async bulkMoveGroup(ids: string[], groupId: string, projectId: string | null): Promise<void> {
    const batch = writeBatch(this.db);
    for (const id of ids) batch.update(doc(this.itemsCol(), id), { groupId, projectId, parentId: deleteField() });
    await batch.commit();
  }

  /** Apaga os itens selecionados + sub-itens de qualquer id raiz incluído. */
  async bulkDelete(ids: string[]): Promise<void> {
    const batch = writeBatch(this.db);
    for (const id of ids) {
      batch.delete(doc(this.itemsCol(), id));
      const subSnap = await getDocs(query(this.itemsCol(), where('parentId', '==', id)));
      subSnap.docs.forEach((d) => batch.delete(d.ref));
    }
    await batch.commit();
  }
}
