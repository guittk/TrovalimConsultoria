import { Injectable, inject } from '@angular/core';
import {
  DocumentData,
  Firestore,
  addDoc,
  collection,
  deleteDoc,
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
import { Candidate, CandidateStage } from './models';

export const CANDIDATE_STAGES: { key: CandidateStage; label: string }[] = [
  { key: 'triagem', label: 'Triagem' },
  { key: 'entrevista-rh', label: 'Entrevista de RH' },
  { key: 'avaliacao', label: 'Avaliação / Teste' },
  { key: 'entrevista-cliente', label: 'Entrevista com o Cliente' },
  { key: 'proposta', label: 'Proposta' },
  { key: 'contratado', label: 'Contratado' },
  { key: 'reprovado', label: 'Reprovado' },
];

@Injectable({ providedIn: 'root' })
export class CandidatesService {
  private readonly db: Firestore = inject(FIRESTORE);
  private readonly storage: FirebaseStorage = inject(FIREBASE_STORAGE);

  /** Sem orderBy(): mesma razão de vagas.service.ts — evita exigir índice composto. */
  listForVaga$(vagaId: string): Observable<Candidate[]> {
    return (
      collectionData$<DocumentData>(
        query(collection(this.db, 'candidates'), where('vagaId', '==', vagaId)),
      ) as Observable<Candidate[]>
    ).pipe(
      catchError((err) => {
        console.error('[candidates] falha ao carregar — as regras do Firestore foram implantadas?', err);
        return of([]);
      }),
    );
  }

  create(data: Omit<Candidate, 'id' | 'createdAt'>): Promise<string> {
    return addDoc(collection(this.db, 'candidates'), { ...data, createdAt: serverTimestamp() }).then(
      (ref) => ref.id,
    );
  }

  update(id: string, data: Partial<Candidate>): Promise<void> {
    return updateDoc(doc(this.db, 'candidates', id), data as DocumentData);
  }

  async delete(candidate: Candidate): Promise<void> {
    if (candidate.resumePath) {
      await deleteObject(ref(this.storage, candidate.resumePath)).catch(() => {
        /* arquivo já pode ter sido removido — a exclusão do registro não pode travar por isso */
      });
    }
    await deleteDoc(doc(this.db, 'candidates', candidate.id));
  }

  /**
   * Ao excluir uma vaga, os candidatos NÃO são apagados — só perdem o
   * vínculo (banco de talentos: quem foi reprovado numa vaga pode servir
   * pra outra). Uma exclusão em cascata destruiria histórico de candidato
   * por causa de uma vaga fechada por engano.
   */
  async unlinkFromVaga(vagaId: string): Promise<void> {
    const snap = await getDocs(query(collection(this.db, 'candidates'), where('vagaId', '==', vagaId)));
    if (snap.empty) return;
    const batch = writeBatch(this.db);
    snap.docs.forEach((d) => batch.update(d.ref, { vagaId: null }));
    await batch.commit();
  }

  async uploadResume(candidateId: string, file: File): Promise<{ path: string; url: string }> {
    const path = `candidates/${candidateId}/${Date.now()}_${file.name}`;
    const storageRef = ref(this.storage, path);
    const snap = await uploadBytes(storageRef, file);
    const url = await getDownloadURL(snap.ref);
    return { path, url };
  }
}
