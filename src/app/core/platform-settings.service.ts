import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { PlatformSettings } from './models';

/**
 * Cor de marca da plataforma (o burgundy do Guia de Identidade Visual,
 * = `--wine` em `src/styles.css`). Era editável em Configurações → "Cor da
 * Plataforma", mas nunca precisou mudar de verdade — a tela foi removida e
 * o valor virou esta constante. Se um dia voltar a ser configurável, é
 * reintroduzir a leitura de `settings/platform.primaryColor` aqui.
 */
export const DEFAULT_PLATFORM_COLOR = '#5B0F16';

@Injectable({ providedIn: 'root' })
export class PlatformSettingsService {
  get$(): Observable<PlatformSettings> {
    return of({ primaryColor: DEFAULT_PLATFORM_COLOR });
  }
}
