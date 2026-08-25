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
import { Observable, catchError, of } from 'rxjs';
import { FIRESTORE } from './firebase.providers';
import { collectionData$ } from './firestore-rx';
import { Lead, LeadStage } from './models';

export const LEAD_STAGES: { key: LeadStage; label: string }[] = [
  { key: 'novo', label: 'Novo' },
  { key: 'contato', label: 'Contato Feito' },
  { key: 'diagnostico', label: 'Diagnóstico' },
  { key: 'proposta-enviada', label: 'Proposta Enviada' },
  { key: 'ganho', label: 'Ganho' },
  { key: 'perdido', label: 'Perdido' },
];

/** Ordem em que um estágio automático avança — nunca pula, nunca anda pra trás sozinho. */
const STAGE_ORDER: LeadStage[] = ['novo', 'contato', 'diagnostico', 'proposta-enviada', 'ganho'];

@Injectable({ providedIn: 'root' })
export class LeadsService {
  private readonly db: Firestore = inject(FIRESTORE);

  listAll$(): Observable<Lead[]> {
    return (
      collectionData$<DocumentData>(
        query(collection(this.db, 'leads'), orderBy('createdAt', 'desc')),
      ) as Observable<Lead[]>
    ).pipe(
      catchError((err) => {
        console.error('[leads] falha ao carregar — as regras do Firestore foram implantadas?', err);
        return of([]);
      }),
    );
  }

  create(data: Partial<Lead>): Promise<string> {
    return addDoc(collection(this.db, 'leads'), {
      stage: 'novo' as LeadStage,
      ...data,
      createdAt: serverTimestamp(),
    }).then((ref) => ref.id);
  }

  update(id: string, data: Partial<Lead>): Promise<void> {
    return updateDoc(doc(this.db, 'leads', id), data as DocumentData);
  }

  delete(id: string): Promise<void> {
    return deleteDoc(doc(this.db, 'leads', id));
  }

  setStage(id: string, stage: LeadStage): Promise<void> {
    return updateDoc(doc(this.db, 'leads', id), { stage });
  }

  /** "Perdido" nunca é automático — sempre motivo explícito, nunca fica sem explicação por quê. */
  markLost(id: string, lostReason: string): Promise<void> {
    return updateDoc(doc(this.db, 'leads', id), { stage: 'perdido' as LeadStage, lostReason });
  }

  nextStage(current: LeadStage): LeadStage | null {
    const idx = STAGE_ORDER.indexOf(current);
    if (idx === -1 || idx === STAGE_ORDER.length - 1) return null;
    return STAGE_ORDER[idx + 1];
  }
}
