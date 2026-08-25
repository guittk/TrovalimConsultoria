import { Injectable, inject } from '@angular/core';
import { DocumentData, Firestore, doc, setDoc } from 'firebase/firestore';
import { Observable, map } from 'rxjs';
import { FIRESTORE } from './firebase.providers';
import { docData$ } from './firestore-rx';
import { PricingItem, PricingSettings } from './models';

export const PRICING_UNITS: { key: PricingItem['unit']; label: string }[] = [
  { key: 'vaga', label: 'Por vaga' },
  { key: 'participante', label: 'Por participante' },
  { key: 'encontro', label: 'Por encontro' },
  { key: 'projeto', label: 'Projeto fechado' },
  { key: 'hora', label: 'Por hora' },
];

export const DEFAULT_PRICING_SETTINGS: PricingSettings = { items: [] };

@Injectable({ providedIn: 'root' })
export class PricingSettingsService {
  private readonly db: Firestore = inject(FIRESTORE);

  get$(): Observable<PricingSettings> {
    return docData$<DocumentData>(doc(this.db, 'settings', 'pricing')).pipe(map((d) => this.normalize(d)));
  }

  update(items: PricingItem[]): Promise<void> {
    return setDoc(doc(this.db, 'settings', 'pricing'), { items }, { merge: true });
  }

  private normalize(d: DocumentData | null): PricingSettings {
    if (!d || !Array.isArray(d['items'])) return DEFAULT_PRICING_SETTINGS;
    return { items: d['items'] as PricingItem[] };
  }
}
