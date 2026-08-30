import { Component, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationStart, Router, RouterOutlet } from '@angular/router';
import { ConfirmDialogComponent } from './shared/confirm/confirm-dialog.component';
import { ToasterComponent } from './shared/toast/toaster.component';
import { AuthService } from './core/auth.service';
import { ThemeService } from './core/theme.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, ConfirmDialogComponent, ToasterComponent],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {
  private readonly router = inject(Router);
  // Injetado só pra instanciar o serviço no boot — o construtor dele aplica
  // o tema guardado no <html>, reafirmando o que o script do index.html já
  // fez (e cobrindo o caso de o script não ter rodado).
  private readonly theme = inject(ThemeService);
  private readonly auth = inject(AuthService);

  readonly navigating = signal(false);

  constructor() {
    // Ao logar, o tema escolhido NA CONTA (doc /users/{uid}.themePref) vence
    // o cache do navegador — é o que faz a preferência seguir a pessoa entre
    // dispositivos. Sem sessão, `themePref` é undefined e nada muda.
    this.auth.userData$
      .pipe(takeUntilDestroyed())
      .subscribe((data) => this.theme.applyFromAccount(data?.themePref));

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
