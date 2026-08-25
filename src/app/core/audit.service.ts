import { Injectable, inject } from '@angular/core';
import { DocumentData, Firestore, addDoc, collection, orderBy, query, serverTimestamp } from 'firebase/firestore';
import { Observable, map } from 'rxjs';
import { FIRESTORE } from './firebase.providers';
import { collectionData$ } from './firestore-rx';
import { AuditAction, AuditLogEntry } from './models';

/**
 * Log append-only de ação sensível sobre dado pessoal (LGPD) — a regra do
 * Firestore não libera update/delete pra ninguém, então este serviço só
 * tem `log()` e `listAll$()`, de propósito: não existe "corrigir" ou
 * "apagar" um registro de auditoria.
 */
@Injectable({ providedIn: 'root' })
export class AuditService {
  private readonly db: Firestore = inject(FIRESTORE);

  log(entry: Omit<AuditLogEntry, 'id' | 'createdAt'>): Promise<unknown> {
    return addDoc(collection(this.db, 'auditLogs'), { ...entry, createdAt: serverTimestamp() });
  }

  listAll$(): Observable<AuditLogEntry[]> {
    return collectionData$<DocumentData>(
      query(collection(this.db, 'auditLogs'), orderBy('createdAt', 'desc')),
    ).pipe(map((docs) => docs.map((d) => ({ ...d, id: d.id }) as AuditLogEntry)));
  }
}

export const AUDIT_ACTION_LABELS: Record<AuditAction, string> = {
  'candidate.delete': 'Excluiu dado de candidato',
  'candidate.retention-extend': 'Estendeu retenção de candidato',
  'candidate.consent-update': 'Atualizou consentimento de candidato',
};
