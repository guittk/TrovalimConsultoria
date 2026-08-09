import { Injectable, inject } from '@angular/core';
import {
  DocumentData,
  Firestore,
  addDoc,
  collection,
  deleteDoc,
  doc,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore';
import { FirebaseStorage, getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { Observable, catchError, of } from 'rxjs';
import { FIRESTORE, FIREBASE_STORAGE } from './firebase.providers';
import { collectionData$ } from './firestore-rx';
import { Task, TaskAttachment, TaskPriority, TaskStatus } from './models';

export const TASK_STATUSES: { key: TaskStatus; label: string }[] = [
  { key: 'a-fazer', label: 'A Fazer' },
  { key: 'em-andamento', label: 'Em Andamento' },
  { key: 'aguardando-cliente', label: 'Aguardando Cliente' },
  { key: 'concluido', label: 'Concluído' },
];

export const TASK_PRIORITIES: { key: TaskPriority; label: string; dot: string }[] = [
  { key: 'baixa', label: 'Baixa', dot: '#16A34A' },
  { key: 'media', label: 'Média', dot: '#D4A72C' },
  { key: 'alta', label: 'Alta', dot: '#EA580C' },
  { key: 'urgente', label: 'Urgente', dot: '#DC2626' },
];

@Injectable({ providedIn: 'root' })
export class TasksService {
  private readonly db: Firestore = inject(FIRESTORE);
  private readonly storage: FirebaseStorage = inject(FIREBASE_STORAGE);

  /**
   * `collectionData$` já tenta de novo sozinho um "permission-denied"
   * transitório (corrida do token logo após o login), mas se as regras do
   * Firestore não tiverem sido implantadas (`firebase deploy --only
   * firestore:rules`) o erro é definitivo — sem este catchError, o erro
   * final se propagaria pro `toSignal()` do componente e travaria toda a
   * reatividade da tela do Kanban (não só a lista de tarefas).
   */
  listAll$(): Observable<Task[]> {
    return (
      collectionData$<DocumentData>(
        query(collection(this.db, 'tasks'), orderBy('createdAt', 'desc')),
      ) as Observable<Task[]>
    ).pipe(
      catchError((err) => {
        console.error('[tasks] falha ao carregar tarefas — as regras do Firestore foram implantadas?', err);
        return of([]);
      }),
    );
  }

  create(data: Partial<Task>): Promise<string> {
    return addDoc(collection(this.db, 'tasks'), {
      ...data,
      createdAt: serverTimestamp(),
    }).then((ref) => ref.id);
  }

  update(id: string, data: Partial<Task>): Promise<void> {
    return updateDoc(doc(this.db, 'tasks', id), data as DocumentData);
  }

  delete(id: string): Promise<void> {
    return deleteDoc(doc(this.db, 'tasks', id));
  }

  async uploadAttachment(taskId: string, file: File): Promise<TaskAttachment> {
    const path = `tasks/${taskId}/${Date.now()}_${file.name}`;
    const storageRef = ref(this.storage, path);
    const snap = await uploadBytes(storageRef, file);
    const url = await getDownloadURL(snap.ref);
    return { nome: file.name, url, tipo: file.type || '' };
  }
}
