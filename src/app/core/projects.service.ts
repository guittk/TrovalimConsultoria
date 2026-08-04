import { Injectable, inject } from '@angular/core';
import {
  DocumentData,
  Firestore,
  Timestamp,
  addDoc,
  collection,
  deleteDoc,
  doc,
  increment,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import {
  FirebaseStorage,
  deleteObject,
  getDownloadURL,
  ref,
  uploadBytes,
} from 'firebase/storage';
import { Observable, map } from 'rxjs';
import { FIRESTORE, FIREBASE_STORAGE } from './firebase.providers';
import { collectionData$, docData$ } from './firestore-rx';
import { Project, ProjectFile, ProjectMessage, TimelineStep } from './models';

@Injectable({ providedIn: 'root' })
export class ProjectsService {
  private readonly db: Firestore = inject(FIRESTORE);
  private readonly storage: FirebaseStorage = inject(FIREBASE_STORAGE);

  listAll$(): Observable<Project[]> {
    return collectionData$<DocumentData>(
      query(collection(this.db, 'projects'), orderBy('createdAt', 'desc')),
    ) as Observable<Project[]>;
  }

  listForOwner$(ownerId: string): Observable<Project[]> {
    return collectionData$<DocumentData>(
      query(collection(this.db, 'projects'), where('ownerId', '==', ownerId)),
    ) as Observable<Project[]>;
  }

  get$(id: string): Observable<Project | null> {
    return docData$<DocumentData>(doc(this.db, 'projects', id)) as Observable<Project | null>;
  }

  create(data: Partial<Project>): Promise<string> {
    return addDoc(collection(this.db, 'projects'), {
      ...data,
      createdAt: serverTimestamp(),
    }).then((ref) => ref.id);
  }

  update(id: string, data: Partial<Project>): Promise<void> {
    return updateDoc(doc(this.db, 'projects', id), data as DocumentData);
  }

  updateSteps(id: string, steps: TimelineStep[]): Promise<void> {
    return updateDoc(doc(this.db, 'projects', id), { steps });
  }

  async uploadBrandingLogo(path: string, file: File): Promise<string> {
    const storageRef = ref(this.storage, path);
    const snap = await uploadBytes(storageRef, file);
    return getDownloadURL(snap.ref);
  }

  /**
   * Notas internas ficam em uma subcoleção separada (não no doc principal do
   * projeto) porque o doc principal é legível pelo próprio cliente dono do
   * projeto — colocar as notas ali vazaria o conteúdo "só da equipe" para
   * quem inspecionasse a leitura do Firestore, mesmo sem aparecer na UI.
   */
  internalNotes$(projectId: string): Observable<string> {
    return docData$<DocumentData>(doc(this.db, 'projects', projectId, 'internal', 'notes')).pipe(
      map((d) => (d?.['text'] as string) || ''),
    );
  }

  updateInternalNotes(projectId: string, text: string): Promise<void> {
    return setDoc(doc(this.db, 'projects', projectId, 'internal', 'notes'), { text }, { merge: true });
  }

  /* ── MENSAGENS ── */
  messages$(projectId: string): Observable<ProjectMessage[]> {
    return collectionData$<DocumentData>(
      query(collection(this.db, 'projects', projectId, 'messages'), orderBy('date')),
    ) as Observable<ProjectMessage[]>;
  }

  sendMessage(projectId: string, author: string, authorRole: string, text: string) {
    return addDoc(collection(this.db, 'projects', projectId, 'messages'), {
      author,
      authorRole,
      text,
      date: serverTimestamp(),
    });
  }

  /* ── ARQUIVOS ── */
  files$(projectId: string): Observable<ProjectFile[]> {
    return collectionData$<DocumentData>(
      query(collection(this.db, 'projects', projectId, 'files'), orderBy('uploadedAt', 'desc')),
    ) as Observable<ProjectFile[]>;
  }

  async uploadFile(
    projectId: string,
    ownerId: string | null,
    file: File,
    uploadedByRole: string,
    uploadedByName: string,
  ): Promise<void> {
    const path = `projects/${projectId}/${uploadedByRole}/${Date.now()}_${file.name}`;
    const storageRef = ref(this.storage, path);
    const snap = await uploadBytes(storageRef, file);
    const downloadUrl = await getDownloadURL(snap.ref);
    await addDoc(collection(this.db, 'projects', projectId, 'files'), {
      name: file.name,
      path,
      downloadUrl,
      sizeKb: Math.round(file.size / 1024),
      uploadedAt: serverTimestamp(),
      uploadedByRole,
      uploadedByName,
    });
    await this.bumpUsage(ownerId, file.size);
  }

  async deleteFile(
    projectId: string,
    fileId: string,
    path?: string,
    ownerId?: string | null,
    sizeBytes?: number,
  ): Promise<void> {
    await deleteDoc(doc(this.db, 'projects', projectId, 'files', fileId));
    if (path) await deleteObject(ref(this.storage, path)).catch(() => undefined);
    if (sizeBytes) await this.bumpUsage(ownerId ?? null, -sizeBytes);
  }

  /** Mantém o contador incremental de uso de armazenamento (total + por empresa). */
  private async bumpUsage(ownerId: string | null, deltaBytes: number): Promise<void> {
    const jobs: Promise<unknown>[] = [
      setDoc(doc(this.db, 'settings', 'storageUsage'), { totalUsageBytes: increment(deltaBytes) }, { merge: true }).catch(
        () => undefined,
      ),
    ];
    if (ownerId) {
      jobs.push(
        updateDoc(doc(this.db, 'empresas', ownerId), { storageUsageBytes: increment(deltaBytes) }).catch(() => undefined),
      );
    }
    await Promise.all(jobs);
  }

  toDate(value: unknown): Date {
    if (value instanceof Timestamp) return value.toDate();
    return new Date();
  }
}
