import { RenderMode, ServerRoute } from '@angular/ssr';

/*
  Tabela de render por rota, lida no build.

  - `''` (landing page pública) é PRE-RENDERIZADA: o build gera o HTML
    completo em dist/trovalim/browser/index.html — é o que o crawler e o
    primeiro paint recebem.
  - Todo o resto (`login`, `portal`, `admin`, `proposta`, `mentoria`) fica
    CLIENT-SIDE: são telas atrás de guard, dependem do Firebase e não devem
    ser indexadas. O build emite dist/trovalim/browser/index.csr.html (shell
    vazio), que o rewrite do Firebase serve para essas rotas.

  `RenderMode.Server` não é permitido aqui — com `outputMode: 'static'` ele
  quebra o build.
*/
export const serverRoutes: ServerRoute[] = [
  { path: '', renderMode: RenderMode.Prerender },
  { path: '**', renderMode: RenderMode.Client },
];
