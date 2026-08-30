import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { PricingItem, PricingSettings, PricingUnit } from './models';
import { CatalogSettingsService, PRICING_UNITS } from './catalog-settings.service';

// Reexport pra não quebrar quem importava PRICING_UNITS daqui.
export { PRICING_UNITS };
export const DEFAULT_PRICING_SETTINGS: PricingSettings = { items: [] };

/**
 * View derivada do catálogo único (`CatalogSettingsService`): expõe só os
 * itens que têm preço, no formato antigo `{ key, name, unit, baseValue }`.
 * A calculadora de investimento da Prospecção e a geração de proposta
 * continuam consumindo isto sem mudança.
 */
@Injectable({ providedIn: 'root' })
export class PricingSettingsService {
  private readonly catalog = inject(CatalogSettingsService);

  get$(): Observable<PricingSettings> {
    return this.catalog.get$().pipe(
      map((c) => ({
        items: c.items
          .filter((it) => it.unit && it.baseValue != null)
          .map((it) => ({
            key: it.key,
            name: it.name,
            unit: it.unit as PricingUnit,
            baseValue: it.baseValue as number,
          })) as PricingItem[],
      })),
    );
  }
}
