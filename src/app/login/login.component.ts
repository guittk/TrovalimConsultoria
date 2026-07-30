import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { FirebaseError } from 'firebase/app';
import { AuthService, isStaffRole } from '../core/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [FormsModule, RouterLink],
  templateUrl: './login.component.html',
  styleUrl: './login.component.css',
})
export class LoginComponent {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  readonly email = signal('');
  readonly password = signal('');
  readonly loading = signal(false);
  readonly error = signal('');

  async submit(): Promise<void> {
    this.error.set('');
    this.loading.set(true);
    try {
      const cred = await this.auth.login(this.email().trim(), this.password());
      // Resolve o papel direto a partir do usuário recém-logado, sem passar
      // pelo userData$ compartilhado: signInWithEmailAndPassword resolve
      // antes do onAuthStateChanged notificar os observables da app, e como
      // user$/userData$ usam shareReplay(1), um redirecionamento imediato a
      // partir deles corria o risco de ler o valor antigo em cache (usuário
      // deslogado) e mandar todo mundo pro /portal — só corrigia com F5.
      const data = await this.auth.resolveUserData(cred.user);
      await this.router.navigateByUrl(isStaffRole(data?.role) ? '/admin' : '/portal');
    } catch (e) {
      this.error.set(this.errMsg(e));
      this.loading.set(false);
    }
  }

  private errMsg(e: unknown): string {
    const code = e instanceof FirebaseError ? e.code : '';
    const map: Record<string, string> = {
      'auth/user-not-found': 'Usuário não encontrado.',
      'auth/wrong-password': 'Senha incorreta.',
      'auth/invalid-email': 'E-mail inválido.',
      'auth/invalid-credential': 'E-mail ou senha incorretos.',
      'auth/too-many-requests': 'Muitas tentativas. Tente novamente mais tarde.',
    };
    return map[code] || 'Erro ao entrar. Tente novamente.';
  }
}
