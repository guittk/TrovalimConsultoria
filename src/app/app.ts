import { Component, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationStart, Router, RouterOutlet } from '@angular/router';
import { ConfirmDialogComponent } from './shared/confirm/confirm-dialog.component';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, ConfirmDialogComponent],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {
  private readonly router = inject(Router);

  readonly navigating = signal(false);

  constructor() {
    // NavigationStart liga o overlay; qualquer outro evento do Router (End,
    // Cancel, Error, ou Skipped — este último dispara quando se navega pra
    // uma URL igual à atual, ex: clicar num link já ativo) desliga. Faltava
    // tratar Skipped: o overlay (z-index acima de tudo) ficava travado
    // ligado depois de uma navegação "pulada", bloqueando qualquer clique
    // na página até a próxima navegação completa de verdade.
    this.router.events.pipe(takeUntilDestroyed()).subscribe((event) => {
      this.navigating.set(event instanceof NavigationStart);
    });
  }
}
