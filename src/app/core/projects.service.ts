import { Injectable, inject } from '@angular/core';
import {
  DocumentData,
  Firestore,
  Timestamp,
  addDoc,
  collection,
  deleteDoc,
  doc,
  orderBy,
  query,
  serverTimestamp,
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
import { Observable } from 'rxjs';
import { FIRESTORE, FIREBASE_STORAGE } from './firebase.providers';
import { collectionData$, docData$ } from './firestore-rx';
import { Branding, Project, ProjectFile, ProjectMessage, TimelineStep } from './models';

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

  updateBranding(id: string, branding: Branding): Promise<void> {
    return updateDoc(doc(this.db, 'projects', id), { branding });
  }

  async uploadBrandingLogo(path: string, file: File): Promise<string> {
    const storageRef = ref(this.storage, path);
    const snap = await uploadBytes(storageRef, file);
    return getDownloadURL(snap.ref);
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
  }

  async deleteFile(projectId: string, fileId: string, path?: string): Promise<void> {
    await deleteDoc(doc(this.db, 'projects', projectId, 'files', fileId));
    if (path) await deleteObject(ref(this.storage, path)).catch(() => undefined);
  }

  toDate(value: unknown): Date {
    if (value instanceof Timestamp) return value.toDate();
    return new Date();
  }
}
