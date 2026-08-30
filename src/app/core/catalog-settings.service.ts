import { Injectable, inject } from '@angular/core';
import { DocumentData, Firestore, doc, setDoc } from 'firebase/firestore';
import { Observable, combineLatest, map } from 'rxjs';
import { FIRESTORE } from './firebase.providers';
import { docData$ } from './firestore-rx';
import { CatalogItem, CatalogSettings, PricingUnit } from './models';

export const PRICING_UNITS: { key: PricingUnit; label: string }[] = [
  { key: 'vaga', label: 'Por vaga' },
  { key: 'participante', label: 'Por participante' },
  { key: 'encontro', label: 'Por encontro' },
  { key: 'projeto', label: 'Projeto fechado' },
  { key: 'hora', label: 'Por hora' },
];

export const DEFAULT_CATALOG_SETTINGS: CatalogSettings = { items: [] };

/**
 * Catálogo ÚNICO da plataforma (`settings/catalog`). Substitui os dois docs
 * antigos (`settings/pricing` de valores + `settings/services` de
 * descrições). Cada item tem nome + descrição; `unit`/`baseValue` só quando
 * tem preço (`null` = "só descrição").
 *
 * `PricingSettingsService` e `ServiceCatalogSettingsService` viraram views
 * derivadas deste — a calculadora de proposta, o PDF e o Brainstorm
 * continuam lendo os formatos antigos sem saber da mudança.
 *
 * Migração transparente: enquanto `settings/catalog` não existir, `get$()`
 * compõe a lista a partir dos dois docs antigos (join por nome). O primeiro
 * "Salvar Catálogo" grava o doc novo e a composição para de ser usada.
 */
@Injectable({ providedIn: 'root' })
export class CatalogSettingsService {
  private readonly db: Firestore = inject(FIRESTORE);

  get$(): Observable<CatalogSettings> {
    return combineLatest([
      docData$<DocumentData>(doc(this.db, 'settings', 'catalog')),
      docData$<DocumentData>(doc(this.db, 'settings', 'pricing')),
      docData$<DocumentData>(doc(this.db, 'settings', 'services')),
    ]).pipe(map(([cat, pricing, services]) => CatalogSettingsService.compose(cat, pricing, services)));
  }

  update(items: CatalogItem[]): Promise<void> {
    const clean: CatalogItem[] = items
      .map((it) => ({
        key: it.key || `cat-${Math.random().toString(36).slice(2, 9)}`,
        name: (it.name || '').trim(),
        description: (it.description || '').trim(),
        unit: it.unit ?? null,
        baseValue: it.unit ? Number(it.baseValue) || 0 : null,
      }))
      .filter((it) => it.name);
    return setDoc(doc(this.db, 'settings', 'catalog'), { items: clean }, { merge: false });
  }

  static compose(
    cat: DocumentData | null | undefined,
    pricing: DocumentData | null | undefined,
    services: DocumentData | null | undefined,
  ): CatalogSettings {
    if (cat && Array.isArray(cat['items'])) {
      return {
        items: (cat['items'] as CatalogItem[]).map((it) => ({
          key: it.key,
          name: it.name,
          description: it.description || '',
          unit: it.unit ?? null,
          baseValue: it.baseValue ?? null,
        })),
      };
    }
    const priceItems: Record<string, unknown>[] =
      pricing && Array.isArray(pricing['items']) ? (pricing['items'] as Record<string, unknown>[]) : [];
    const svcItems: Record<string, unknown>[] =
      services && Array.isArray(services['items']) ? (services['items'] as Record<string, unknown>[]) : [];
    const byName = new Map<string, CatalogItem>();
    for (const p of priceItems) {
      const name = String(p['name'] ?? '').trim();
      if (!name) continue;
      byName.set(name.toLowerCase(), {
        key: String(p['key'] ?? `cat-${byName.size}`),
        name,
        description: '',
        unit: (p['unit'] as PricingUnit) ?? 'projeto',
        baseValue: Number(p['baseValue']) || 0,
      });
    }
    for (const s of svcItems) {
      const name = String(s['name'] ?? '').trim();
      if (!name) continue;
      const k = name.toLowerCase();
      const existing = byName.get(k);
      if (existing) existing.description = String(s['description'] ?? '');
      else
        byName.set(k, {
          key: String(s['key'] ?? `cat-${byName.size}`),
          name,
          description: String(s['description'] ?? ''),
          unit: null,
          baseValue: null,
        });
    }
    return { items: [...byName.values()] };
  }
}
