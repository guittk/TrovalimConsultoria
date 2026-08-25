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
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import { FirebaseStorage, deleteObject, getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { Observable, map } from 'rxjs';
import { FIRESTORE, FIREBASE_STORAGE } from './firebase.providers';
import { collectionData$, docData$ } from './firestore-rx';
import { CompetencyReassessment, Mentorship, MentorshipAction, MentorshipMessage } from './models';

/**
 * O documento raiz de um PDI é indexado pelo próprio uid do mentorado —
 * nunca um id à parte —, então buscar "o PDI de fulano" é sempre um get()
 * direto, nunca uma query. Ações, notas internas e mensagens vivem em
 * subcoleções, no mesmo padrão de /projects/{id} (mensagens, internal/notes).
 */
@Injectable({ providedIn: 'root' })
export class MentorshipService {
  private readonly db: Firestore = inject(FIRESTORE);
  private readonly storage: FirebaseStorage = inject(FIREBASE_STORAGE);

  get$(uid: string): Observable<Mentorship | null> {
    return docData$<DocumentData>(doc(this.db, 'mentorships', uid)).pipe(
      map((d) => (d ? ({ uid, competencias: [], ...d } as Mentorship) : null)),
    );
  }

  /** Coleção inteira, staff-only — usado pelo relatório de indicadores (mentorados ativos). */
  listAll$(): Observable<Mentorship[]> {
    return collectionData$<DocumentData>(collection(this.db, 'mentorships')).pipe(
      map((docs) => docs.map((d) => ({ uid: d.id, competencias: [], ...d }) as Mentorship)),
    );
  }

  /** setDoc(merge) — o doc pode não existir ainda na primeira vez que a equipe monta o plano. */
  update(uid: string, data: Partial<Omit<Mentorship, 'uid'>>): Promise<void> {
    return setDoc(doc(this.db, 'mentorships', uid), { ...data, updatedAt: serverTimestamp() }, { merge: true });
  }

  /* ── AÇÕES ── */
  actions$(uid: string): Observable<MentorshipAction[]> {
    return collectionData$<DocumentData>(
      query(collection(this.db, 'mentorships', uid, 'actions'), orderBy('createdAt', 'desc')),
    ).pipe(map((docs) => docs.map((d) => ({ ...d, id: d.id }) as MentorshipAction)));
  }

  createAction(uid: string, data: Omit<MentorshipAction, 'id' | 'createdAt'>): Promise<string> {
    return addDoc(collection(this.db, 'mentorships', uid, 'actions'), { ...data, createdAt: serverTimestamp() }).then(
      (ref) => ref.id,
    );
  }

  /** Uso pela EQUIPE — pode alterar qualquer campo. O mentorado usa updateActionProgress. */
  updateAction(uid: string, actionId: string, data: Partial<MentorshipAction>): Promise<void> {
    return updateDoc(doc(this.db, 'mentorships', uid, 'actions', actionId), data as DocumentData);
  }

  /** Uso pelo MENTORADO — a regra do Firestore só libera estes três campos pra ele. */
  updateActionProgress(
    uid: string,
    actionId: string,
    data: { status: MentorshipAction['status']; evidenciaUrl?: string | null; evidenciaNome?: string | null },
  ): Promise<void> {
    return updateDoc(doc(this.db, 'mentorships', uid, 'actions', actionId), data as DocumentData);
  }

  deleteAction(uid: string, actionId: string): Promise<void> {
    return deleteDoc(doc(this.db, 'mentorships', uid, 'actions', actionId));
  }

  async uploadEvidence(uid: string, actionId: string, file: File): Promise<{ path: string; url: string }> {
    const path = `mentorships/${uid}/${actionId}/${Date.now()}_${file.name}`;
    const storageRef = ref(this.storage, path);
    const snap = await uploadBytes(storageRef, file);
    const url = await getDownloadURL(snap.ref);
    return { path, url };
  }

  removeEvidence(path: string): Promise<void> {
    return deleteObject(ref(this.storage, path)).catch(() => {});
  }

  /* ── REAVALIAÇÃO DE COMPETÊNCIAS ── */
  reassessments$(uid: string): Observable<CompetencyReassessment[]> {
    return collectionData$<DocumentData>(
      query(collection(this.db, 'mentorships', uid, 'reassessments'), orderBy('date', 'asc')),
    ).pipe(map((docs) => docs.map((d) => ({ ...d, id: d.id }) as CompetencyReassessment)));
  }

  /** Grava a fotografia — nunca sobrescreve uma reavaliação anterior, cada uma é um documento novo. */
  createReassessment(uid: string, date: string, values: Record<string, number>): Promise<unknown> {
    return addDoc(collection(this.db, 'mentorships', uid, 'reassessments'), {
      date,
      values,
      createdAt: serverTimestamp(),
    });
  }

  /* ── NOTAS INTERNAS (só a equipe lê) ── */
  internalNotes$(uid: string): Observable<string> {
    return docData$<DocumentData>(doc(this.db, 'mentorships', uid, 'internal', 'notes')).pipe(
      map((d) => (d?.['text'] as string) || ''),
    );
  }

  updateInternalNotes(uid: string, text: string): Promise<void> {
    return setDoc(doc(this.db, 'mentorships', uid, 'internal', 'notes'), { text }, { merge: true });
  }

  /* ── MENSAGENS ── */
  messages$(uid: string): Observable<MentorshipMessage[]> {
    return collectionData$<DocumentData>(
      query(collection(this.db, 'mentorships', uid, 'messages'), orderBy('date')),
    ) as Observable<MentorshipMessage[]>;
  }

  sendMessage(uid: string, author: string, authorRole: string, text: string): Promise<unknown> {
    return addDoc(collection(this.db, 'mentorships', uid, 'messages'), {
      author,
      authorRole,
      text,
      date: serverTimestamp(),
    });
  }
}
