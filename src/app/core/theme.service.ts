import { Injectable, inject, signal } from '@angular/core';
import { Auth } from 'firebase/auth';
import { Firestore, doc, setDoc } from 'firebase/firestore';
import { FIREBASE_AUTH, FIRESTORE } from './firebase.providers';

export type ThemeMode = 'light' | 'dark';

export const THEME_STORAGE_KEY = 'trovalim.theme';

/**
 * Tema (claro/escuro) da ÁREA DE CONTEÚDO — a navegação lateral é sempre
 * escura em ambos os modos, por decisão de identidade (ver os tokens de
 * sidebar em styles.css).
 *
 * A escolha é salva de DUAS formas:
 *  - `localStorage` (por navegador): cache lido e aplicado no <html> por um
 *    script inline no index.html, antes do Angular subir, pra não haver
 *    "flash" do tema errado no primeiro paint;
 *  - no doc `/users/{uid}` (campo `themePref`), quando há sessão ativa: é o
 *    que faz a preferência seguir a conta pra qualquer dispositivo. Ao
 *    logar, `App` chama `applyFromAccount()` com esse valor.
 */
@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly auth: Auth = inject(FIREBASE_AUTH);
  private readonly db: Firestore = inject(FIRESTORE);

  readonly theme = signal<ThemeMode>(ThemeService.read());

  constructor() {
    this.apply(this.theme());
  }

  /** Troca disparada pela pessoa (toggle nas Configurações): persiste nos dois lugares. */
  set(mode: ThemeMode): void {
    this.write(mode);
    this.persistToAccount(mode);
  }

  toggle(): void {
    this.set(this.theme() === 'dark' ? 'light' : 'dark');
  }

  /**
   * Aplica o tema que veio do doc da conta ao logar. Não reescreve no
   * Firestore (evita loop) — só alinha a sessão atual e o cache local.
   */
  applyFromAccount(mode: ThemeMode | undefined | null): void {
    if ((mode === 'light' || mode === 'dark') && mode !== this.theme()) {
      this.write(mode);
    }
  }

  private write(mode: ThemeMode): void {
    this.theme.set(mode);
    this.apply(mode);
    // Modo privado / cookies bloqueados fazem o write lançar: a troca vale
    // pra sessão atual mesmo sem conseguir persistir.
    try {
      localStorage.setItem(THEME_STORAGE_KEY, mode);
    } catch {
      /* preferência não persistida — sem impacto na sessão atual */
    }
  }

  private persistToAccount(mode: ThemeMode): void {
    const uid = this.auth.currentUser?.uid;
    if (!uid) return;
    // Best-effort: se a regra negar ou a rede cair, a preferência local já
    // valeu; não trava a UI nem mostra erro.
    void setDoc(doc(this.db, 'users', uid), { themePref: mode }, { merge: true }).catch(() => {
      /* não persistido na conta — segue valendo neste navegador */
    });
  }

  private apply(mode: ThemeMode): void {
    document.documentElement.setAttribute('data-theme', mode);
  }

  private static read(): ThemeMode {
    try {
      return localStorage.getItem(THEME_STORAGE_KEY) === 'dark' ? 'dark' : 'light';
    } catch {
      return 'light';
    }
  }
}
