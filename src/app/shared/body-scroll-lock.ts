/**
 * Trava o scroll do body atrás de um menu/modal mobile. `overflow:hidden`
 * sozinho não é suficiente no Safari iOS — touch scroll ainda arrasta o
 * body por baixo do overlay. O truque padrão pra isso é tirar o body do
 * fluxo (position:fixed) compensando o deslocamento visual com um `top`
 * negativo igual ao scroll atual, e restaurar a posição de scroll ao
 * destravar.
 */
export function lockBodyScroll(): void {
  const scrollY = window.scrollY;
  document.body.dataset['scrollLockY'] = String(scrollY);
  document.body.style.position = 'fixed';
  document.body.style.top = `-${scrollY}px`;
  document.body.style.left = '0';
  document.body.style.right = '0';
  document.body.style.width = '100%';
  document.body.style.overflow = 'hidden';
}

export function unlockBodyScroll(): void {
  const scrollY = Number(document.body.dataset['scrollLockY'] || '0');
  document.body.style.position = '';
  document.body.style.top = '';
  document.body.style.left = '';
  document.body.style.right = '';
  document.body.style.width = '';
  document.body.style.overflow = '';
  delete document.body.dataset['scrollLockY'];
  window.scrollTo(0, scrollY);
}
