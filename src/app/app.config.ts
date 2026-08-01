import { ApplicationConfig, provideBrowserGlobalErrorListeners, provideZoneChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';

import { routes } from './app.routes';
import { provideFirebase } from './core/firebase.providers';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    // eventCoalescing desligado: com ele ligado, o Angular pode adiar a
    // execução do handler de clique pra depois do navegador já ter perdido
    // o "gesto do usuário" daquele clique — e diálogos nativos (escolher
    // arquivo, seletor de cor) exigem um gesto fresco pra abrir. Sem erro
    // nenhum no console, o clique era registrado mas o diálogo nunca abria.
    provideZoneChangeDetection({ eventCoalescing: false }),
    provideRouter(routes),
    ...provideFirebase(),
  ]
};
