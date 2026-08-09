import { Component, inject, Input, OnDestroy, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth.service';

export interface PnavTab {
  key: string;
  label: string;
  path: string;
}

@Component({
  selector: 'app-pnav',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './pnav.component.html',
})
export class PnavComponent implements OnDestroy {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  /** Rota do logo (ex: '/admin' na área admin, '/portal' no portal do cliente). */
  @Input() logoLink = '/';
  /** Abas de navegação (Projetos/Clientes/Contas). Vazio = mostra sectionLabel no lugar. */
  @Input() tabs: PnavTab[] = [];
  /** Chaves de abas escondidas para a conta atual (ver UserAccount.hiddenTabs). */
  @Input() hiddenTabs: string[] = [];
  /** Chave da aba ativa (comparada com PnavTab.key). */
  @Input() activeSection = '';
  /** Rótulo estático exibido quando não há abas (ex: "Portal do Cliente"). */
  @Input() sectionLabel = '';
  @Input() userName = '';
  /** Rota após sair (ex: '/' no portal, '/login' no admin). */
  @Input() logoutRedirect = '/login';

  readonly mobileMenuOpen = signal(false);

  get visibleTabs(): PnavTab[] {
    return this.hiddenTabs.length ? this.tabs.filter((t) => !this.hiddenTabs.includes(t.key)) : this.tabs;
  }

  // Trava o scroll da página atrás do menu enquanto ele está aberto.
  toggleMobileMenu(): void {
    this.mobileMenuOpen() ? this.closeMobileMenu() : this.openMobileMenu();
  }

  openMobileMenu(): void {
    this.mobileMenuOpen.set(true);
    document.body.style.overflow = 'hidden';
  }

  closeMobileMenu(): void {
    this.mobileMenuOpen.set(false);
    document.body.style.overflow = '';
  }

  async logout(): Promise<void> {
    this.closeMobileMenu();
    await this.auth.logout();
    await this.router.navigateByUrl(this.logoutRedirect);
  }

  ngOnDestroy(): void {
    if (this.mobileMenuOpen()) document.body.style.overflow = '';
  }
}
