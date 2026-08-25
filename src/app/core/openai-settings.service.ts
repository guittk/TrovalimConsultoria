import { Injectable, inject } from '@angular/core';
import { DocumentData, Firestore, doc, setDoc } from 'firebase/firestore';
import { Observable, map } from 'rxjs';
import { FIRESTORE } from './firebase.providers';
import { docData$ } from './firestore-rx';
import { OpenAiSettings } from './models';

export const DEFAULT_OPENAI_SETTINGS: OpenAiSettings = { apiKey: '' };

/**
 * Owner-only na leitura (regra do Firestore) — a chave é segredo, não
 * configuração pública como a VAPID. Mesmo assim, ela nunca deveria ir
 * pra fora desta tela de Configurações: quem de fato USA a chave é a
 * Cloud Function, via Admin SDK, que ignora a regra do Firestore.
 */
@Injectable({ providedIn: 'root' })
export class OpenAiSettingsService {
  private readonly db: Firestore = inject(FIRESTORE);

  get$(): Observable<OpenAiSettings> {
    return docData$<DocumentData>(doc(this.db, 'settings', 'openai')).pipe(
      map((d) => (d && typeof d['apiKey'] === 'string' ? { apiKey: d['apiKey'] as string } : DEFAULT_OPENAI_SETTINGS)),
    );
  }

  update(apiKey: string): Promise<void> {
    return setDoc(doc(this.db, 'settings', 'openai'), { apiKey }, { merge: true });
  }
}
