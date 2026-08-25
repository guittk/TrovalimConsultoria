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
import { CareerTrack, CareerTrackStage, LinkedinChecklistItem, ResumeVersion } from './models';

export const CAREER_STAGES: { key: CareerTrackStage; label: string }[] = [
  { key: 'diagnostico', label: 'Diagnóstico' },
  { key: 'versao1', label: 'Versão 1' },
  { key: 'revisao', label: 'Revisão' },
  { key: 'versao-final', label: 'Versão Final' },
  { key: 'linkedin-otimizado', label: 'LinkedIn Otimizado' },
];

export const CAREER_LINKEDIN_ITEMS: { key: string; label: string }[] = [
  { key: 'headline', label: 'Headline' },
  { key: 'sobre', label: 'Seção "Sobre"' },
  { key: 'experiencias', label: 'Experiências profissionais' },
  { key: 'competencias', label: 'Competências' },
  { key: 'foto', label: 'Foto de perfil' },
  { key: 'banner', label: 'Banner' },
  { key: 'recomendacoes', label: 'Recomendações' },
];

export function defaultLinkedinChecklist(): LinkedinChecklistItem[] {
  return CAREER_LINKEDIN_ITEMS.map((i) => ({ key: i.key, label: i.label, done: false }));
}

/**
 * O documento raiz é indexado pelo uid do cliente — mesmo padrão do PDI de
 * mentoria (mentorship.service.ts): sem query pra achar "a trilha de
 * fulano", é sempre um get() direto.
 */
@Injectable({ providedIn: 'root' })
export class CareerTrackService {
  private readonly db: Firestore = inject(FIRESTORE);
  private readonly storage: FirebaseStorage = inject(FIREBASE_STORAGE);

  get$(uid: string): Observable<CareerTrack | null> {
    return docData$<DocumentData>(doc(this.db, 'careerTracks', uid)).pipe(
      map((d) => (d ? ({ ...d, uid, linkedinChecklist: d['linkedinChecklist'] || [] } as unknown as CareerTrack) : null)),
    );
  }

  /** Coleção inteira, staff-only — usado pelo relatório de indicadores (trilhas de carreira ativas). */
  listAll$(): Observable<CareerTrack[]> {
    return collectionData$<DocumentData>(collection(this.db, 'careerTracks')).pipe(
      map((docs) => docs.map((d) => ({ ...d, uid: d.id, linkedinChecklist: d['linkedinChecklist'] || [] }) as unknown as CareerTrack)),
    );
  }

  /** Uso da EQUIPE — objetivo, estágio, nome. setDoc(merge) porque o doc pode não existir ainda. */
  update(uid: string, data: Partial<Omit<CareerTrack, 'uid'>>): Promise<void> {
    return setDoc(doc(this.db, 'careerTracks', uid), { ...data, updatedAt: serverTimestamp() }, { merge: true });
  }

  /**
   * Uso da PRÓPRIA pessoa — a regra do Firestore só libera o campo
   * `linkedinChecklist` pra ela (hasOnly), então updateDoc() aqui NÃO
   * pode incluir `updatedAt` nem nenhum outro campo, senão a regra nega
   * a escrita inteira.
   */
  updateChecklist(uid: string, linkedinChecklist: LinkedinChecklistItem[]): Promise<void> {
    return updateDoc(doc(this.db, 'careerTracks', uid), { linkedinChecklist } as DocumentData);
  }

  /* ── VERSÕES DO CURRÍCULO ── */
  versions$(uid: string): Observable<ResumeVersion[]> {
    return collectionData$<DocumentData>(
      query(collection(this.db, 'careerTracks', uid, 'versions'), orderBy('versionNumber', 'desc')),
    ).pipe(map((docs) => docs.map((d) => ({ ...d, id: d.id }) as ResumeVersion)));
  }

  async uploadVersion(uid: string, versionNumber: number, file: File, comment: string, createdByName: string): Promise<void> {
    const path = `careerTracks/${uid}/${Date.now()}_${file.name}`;
    const storageRef = ref(this.storage, path);
    const snap = await uploadBytes(storageRef, file);
    const fileUrl = await getDownloadURL(snap.ref);
    await addDoc(collection(this.db, 'careerTracks', uid, 'versions'), {
      versionNumber,
      fileUrl,
      filePath: path,
      comment,
      createdByName,
      createdAt: serverTimestamp(),
    });
  }

  async deleteVersion(uid: string, version: ResumeVersion): Promise<void> {
    await deleteObject(ref(this.storage, version.filePath)).catch(() => {
      /* arquivo já pode ter sido removido — a exclusão do registro não pode travar por isso */
    });
    await deleteDoc(doc(this.db, 'careerTracks', uid, 'versions', version.id));
  }
}
