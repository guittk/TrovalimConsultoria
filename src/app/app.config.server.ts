import { ApplicationConfig, mergeApplicationConfig } from '@angular/core';
import { provideServerRendering, withRoutes } from '@angular/ssr';
import { appConfig } from './app.config';
import { serverRoutes } from './app.routes.server';

/*
  Config do passo de prerender: os providers do browser (`provideRouter`,
  `provideFirebase()`, `provideServiceWorker`) continuam valendo — o
  `provideServiceWorker` é no-op fora do browser, e o Firebase só é
  instanciado, sem rede. As APIs de browser puras (IntersectionObserver,
  matchMedia) ficam atrás de `isPlatformBrowser` nos componentes.
*/
const serverConfig: ApplicationConfig = {
  providers: [provideServerRendering(withRoutes(serverRoutes))],
};

export const config = mergeApplicationConfig(appConfig, serverConfig);
