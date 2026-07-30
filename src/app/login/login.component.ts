import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { FirebaseError } from 'firebase/app';
import { AuthService, isStaffRole } from '../core/auth.service';
import { firstValueFrom } from 'rxjs';

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
      await this.auth.login(this.email().trim(), this.password());
      const data = await firstValueFrom(this.auth.userData$);
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
