import { Injectable, inject } from '@angular/core';
import {
  DocumentData,
  Firestore,
  collection,
  collectionGroup,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import { Observable, map } from 'rxjs';
import { FIRESTORE } from './firebase.providers';
import { docData$ } from './firestore-rx';

@Injectable({ providedIn: 'root' })
export class StorageUsageService {
  private readonly db: Firestore = inject(FIRESTORE);

  async totalUsageBytes(): Promise<number> {
    const snap = await getDoc(doc(this.db, 'settings', 'storageUsage'));
    return (snap.data()?.['totalUsageBytes'] as number) || 0;
  }

  totalUsage$(): Observable<number> {
    return docData$<DocumentData>(doc(this.db, 'settings', 'storageUsage')).pipe(
      map((d) => (d?.['totalUsageBytes'] as number) || 0),
    );
  }

  /**
   * Recalcula do zero os contadores de uso (total da plataforma e por
   * cliente) a partir dos arquivos reais no Firestore — usado para corrigir
   * qualquer drift do contador incremental. Requer permissão de owner.
   */
  async recalculate(): Promise<{ totalBytes: number; byOwner: Record<string, number> }> {
    const [projectsSnap, filesSnap, usersSnap] = await Promise.all([
      getDocs(collection(this.db, 'projects')),
      getDocs(collectionGroup(this.db, 'files')),
      getDocs(collection(this.db, 'users')),
    ]);

    const ownerByProject: Record<string, string> = {};
    projectsSnap.forEach((p) => {
      const ownerId = p.data()['ownerId'];
      if (ownerId) ownerByProject[p.id] = ownerId;
    });

    const byOwner: Record<string, number> = {};
    let totalBytes = 0;
    filesSnap.forEach((f) => {
      const projectId = f.ref.parent.parent?.id;
      const sizeBytes = ((f.data()['sizeKb'] as number) || 0) * 1024;
      totalBytes += sizeBytes;
      const ownerId = projectId ? ownerByProject[projectId] : undefined;
      if (ownerId) byOwner[ownerId] = (byOwner[ownerId] || 0) + sizeBytes;
    });

    await Promise.all([
      setDoc(doc(this.db, 'settings', 'storageUsage'), { totalUsageBytes: totalBytes }, { merge: true }),
      ...usersSnap.docs.map((u) =>
        updateDoc(doc(this.db, 'users', u.id), { storageUsageBytes: byOwner[u.id] || 0 }).catch(() => undefined),
      ),
    ]);

    return { totalBytes, byOwner };
  }
}
