import { Injectable, inject } from '@angular/core';
import {
  DocumentData,
  Firestore,
  addDoc,
  collection,
  doc,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore';
import { Observable } from 'rxjs';
import { FIRESTORE } from './firebase.providers';
import { collectionData$, docData$ } from './firestore-rx';
import { Proposta, PropostaItem } from './models';

@Injectable({ providedIn: 'root' })
export class PropostasService {
  private readonly db: Firestore = inject(FIRESTORE);

  listAll$(): Observable<Proposta[]> {
    return collectionData$<DocumentData>(
      query(collection(this.db, 'propostas'), orderBy('createdAt', 'desc')),
    ) as Observable<Proposta[]>;
  }

  /** Usado tanto pela tela de admin quanto pela página pública (`/proposta/:id`) — a regra do Firestore decide o que cada um pode ler. */
  get$(id: string): Observable<Proposta | null> {
    return docData$<DocumentData>(doc(this.db, 'propostas', id)) as Observable<Proposta | null>;
  }

  create(data: {
    leadId?: string | null;
    clientName: string;
    contactName?: string;
    email?: string;
    items: PropostaItem[];
    escopo?: string;
    condicoes?: string;
  }): Promise<string> {
    const total = data.items.reduce((sum, i) => sum + i.baseValue * i.qty, 0);
    return addDoc(collection(this.db, 'propostas'), {
      ...data,
      total,
      status: 'rascunho',
      createdAt: serverTimestamp(),
    }).then((ref) => ref.id);
  }

  /** Só permitido em 'rascunho' — depois de enviada, os itens ficam congelados (ver regra do Firestore). */
  updateDraft(
    id: string,
    data: Partial<Pick<Proposta, 'clientName' | 'contactName' | 'email' | 'items' | 'escopo' | 'condicoes'>>,
  ): Promise<void> {
    const patch: DocumentData = { ...data };
    if (data.items) patch['total'] = data.items.reduce((sum, i) => sum + i.baseValue * i.qty, 0);
    return updateDoc(doc(this.db, 'propostas', id), patch);
  }

  markSent(id: string): Promise<void> {
    return updateDoc(doc(this.db, 'propostas', id), { status: 'enviada', sentAt: serverTimestamp() });
  }

  /** Chamada pela página pública, sem autenticação — a regra do Firestore restringe os campos e exige status 'enviada'. */
  accept(id: string, acceptedByName: string, acceptedByEmail: string): Promise<void> {
    return updateDoc(doc(this.db, 'propostas', id), {
      status: 'aceita',
      acceptedByName,
      acceptedByEmail,
      respondedAt: serverTimestamp(),
    });
  }

  decline(id: string, declineReason: string): Promise<void> {
    return updateDoc(doc(this.db, 'propostas', id), {
      status: 'recusada',
      declineReason,
      respondedAt: serverTimestamp(),
    });
  }
}
