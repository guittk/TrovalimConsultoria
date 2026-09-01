import { bootstrapApplication, BootstrapContext } from '@angular/platform-browser';
import { App } from './app/app';
import { config } from './app/app.config.server';

/*
  Entrada usada só pelo passo de PRERENDER do build (SSG estático). Não há
  servidor Node em runtime: `outputMode: 'static'` no angular.json faz o
  build renderizar a rota `/` uma vez e gravar o HTML pronto em
  dist/trovalim/browser/index.html. Ver src/app/app.routes.server.ts.

  O `BootstrapContext` é obrigatório no bootstrap de servidor a partir do
  Angular 20 — sem ele o build falha com NG0401 ("Missing Platform").
*/
const bootstrap = (context: BootstrapContext) => bootstrapApplication(App, config, context);

export default bootstrap;
