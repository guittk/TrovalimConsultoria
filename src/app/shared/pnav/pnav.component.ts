import { AfterViewInit, Component, ElementRef, HostBinding, inject, Input, OnDestroy, OnInit, signal, ViewChild } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { Subscription, switchMap } from 'rxjs';
import { AuthService, normRole } from '../../core/auth.service';
import { NotificationsService } from '../../core/notifications.service';
import { Project } from '../../core/models';
import { lockBodyScroll, unlockBodyScroll } from '../body-scroll-lock';

export interface PnavTab {
  key: string;
  label: string;
  path: string;
  /** Categoria pra agrupar as abas na sidebar (rótulo discreto por bloco). */
  group?: string;
  /** Marca uma tela ainda não 100% refinada visualmente — ganha um indicador na sidebar. */
  isNew?: boolean;
  /**
   * Ícone da aba como lista de `d` de `<path>`, desenhados num viewBox 24x24
   * com traço de 1.8px (estilo outline/Lucide — ver Guia de Identidade
   * Visual, seção Ícones). Guardado como dado puro em vez de um componente
   * por ícone pra ADMIN_TABS continuar sendo uma única lista declarativa.
   */
  icon?: string[];
}

@Component({
  selector: 'app-pnav',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './pnav.component.html',
})
export class PnavComponent implements OnInit, AfterViewInit, OnDestroy {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly notificationsSvc = inject(NotificationsService);
  private readonly hostEl = inject<ElementRef<HTMLElement>>(ElementRef);

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
  /**
   * Liga o sino de notificações — só true nas páginas do admin. No portal
   * fica false porque a conta cliente não tem permissão de ler /projects
   * inteiro (regra do Firestore), então nem tenta assinar a query.
   */
  @Input() showBell = false;

  readonly mobileMenuOpen = signal(false);
  readonly bellOpen = signal(false);
  readonly unreadProjects = signal<Project[]>([]);
  /**
   * Papel da conta logada, exibido sob o nome no card de perfil da sidebar.
   * Lido aqui do próprio AuthService (e não como @Input) pra não obrigar
   * cada uma das telas admin a passar mais um atributo pro `app-pnav`.
   */
  readonly userRole = signal('');
  private unreadSub?: Subscription;
  private roleSub?: Subscription;

  /**
   * Cada tela admin renderiza o seu próprio `<app-pnav>`, então navegar
   * destrói e recria a sidebar — e a lista de abas (`.pnav-tabs`, que rola
   * sozinha) voltava pro topo a cada clique. Guardar o `scrollTop` em
   * sessionStorage e restaurar no `ngAfterViewInit` mantém a rolagem no
   * lugar de uma tela pra outra.
   */
  @ViewChild('tabsScroll') private tabsScroll?: ElementRef<HTMLElement>;
  private static readonly SCROLL_KEY = 'trovalim.pnav.scroll';
  private static readonly COLLAPSED_KEY = 'trovalim.pnav.collapsed';

  /**
   * Sidebar minimizada (só ícones). Preferência por navegador — mesma
   * ideia do tema. O `margin-left` do conteúdo à direita reage via o
   * seletor de irmão `app-pnav.pnav-sidebar-collapsed ~ .page` (ver
   * styles.css); daí precisar do HostBinding abaixo.
   */
  readonly collapsed = signal(this.readCollapsed());

  private readCollapsed(): boolean {
    try {
      return localStorage.getItem(PnavComponent.COLLAPSED_KEY) === '1';
    } catch {
      return false;
    }
  }

  toggleCollapsed(): void {
    const next = !this.collapsed();
    this.collapsed.set(next);
    try {
      localStorage.setItem(PnavComponent.COLLAPSED_KEY, next ? '1' : '0');
    } catch {
      /* localStorage indisponível — sem persistência, sem erro. */
    }
  }

  @HostBinding('class.pnav-sidebar-collapsed') get isCollapsedHost(): boolean {
    return this.isSidebarHost && this.collapsed();
  }

  /** Abas visíveis agrupadas por `group`, preservando a ordem de `ADMIN_TABS`. */
  get groupedVisibleTabs(): { label: string; tabs: PnavTab[] }[] {
    const groups: { label: string; tabs: PnavTab[] }[] = [];
    for (const tab of this.visibleTabs) {
      const label = tab.group ?? '';
      const last = groups[groups.length - 1];
      if (last && last.label === label) last.tabs.push(tab);
      else groups.push({ label, tabs: [tab] });
    }
    return groups;
  }

  /**
   * Rola só a lista de abas quando o mouse está sobre a sidebar — sem
   * "vazar" o scroll pra página atrás (scroll chaining). Vale pra sidebar
   * inteira, inclusive sobre a marca e o card de perfil, que não rolam.
   */
  private onSidebarWheel = (e: WheelEvent): void => {
    if (!this.isSidebarHost) return;
    const list = this.tabsScroll?.nativeElement;
    if (!list) return;
    list.scrollTop += e.deltaY;
    e.preventDefault();
  };

  /** Mesmos rótulos do `app-role-badge`, pra conta não aparecer com dois nomes diferentes na mesma tela. */
  private static readonly ROLE_LABELS: Record<string, string> = {
    owner: 'Proprietário',
    manager: 'Gerente',
    client: 'Cliente',
    mentorado: 'Mentorado',
  };

  /** Iniciais do nome (ou do e-mail, quando a conta não tem nome) pro avatar. */
  get userInitials(): string {
    const parts = this.userName.trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return '?';
    const first = parts[0][0] ?? '';
    const last = parts.length > 1 ? (parts[parts.length - 1][0] ?? '') : '';
    return (first + last).toUpperCase();
  }

  get visibleTabs(): PnavTab[] {
    return this.hiddenTabs.length ? this.tabs.filter((t) => !this.hiddenTabs.includes(t.key)) : this.tabs;
  }

  /**
   * Marca o próprio `<app-pnav>` (não só o `<nav>` interno) pra dar pro CSS
   * um seletor de irmão (`app-pnav.pnav-sidebar-host ~ .page`) que empurra o
   * conteúdo da página pra direita da sidebar — sem precisar tocar em cada
   * template admin pra adicionar um wrapper. Só entra em modo sidebar quando
   * há abas (admin); o portal continua com a barra no topo.
   */
  @HostBinding('class.pnav-sidebar-host') get isSidebarHost(): boolean {
    return this.visibleTabs.length > 0;
  }

  ngOnInit(): void {
    this.roleSub = this.auth.userData$.subscribe((data) => {
      const key = normRole(data?.role);
      this.userRole.set(PnavComponent.ROLE_LABELS[key] ?? '');
    });
    if (!this.showBell) return;
    this.unreadSub = this.auth.userData$
      .pipe(switchMap((data) => this.notificationsSvc.unreadProjects$(data?.projectAccess ?? null)))
      .subscribe((list) => this.unreadProjects.set(list));
  }

  ngAfterViewInit(): void {
    // Isola o scroll da sidebar (não deixa vazar pra página). `passive: false`
    // porque o handler chama preventDefault — o default de listener de wheel
    // no Angular/DOM moderno é passivo.
    if (this.isSidebarHost) {
      this.hostEl.nativeElement.addEventListener('wheel', this.onSidebarWheel, { passive: false });
    }

    const el = this.tabsScroll?.nativeElement;
    if (!el) return;
    try {
      const saved = sessionStorage.getItem(PnavComponent.SCROLL_KEY);
      if (saved) el.scrollTop = +saved || 0;
    } catch {
      /* sessionStorage indisponível (aba privada etc.) — sem persistência, sem erro. */
    }
  }

  onTabsScroll(): void {
    const el = this.tabsScroll?.nativeElement;
    if (!el) return;
    try {
      sessionStorage.setItem(PnavComponent.SCROLL_KEY, String(el.scrollTop));
    } catch {
      /* idem */
    }
  }

  toggleBell(): void {
    this.bellOpen.update((v) => !v);
  }

  closeBell(): void {
    this.bellOpen.set(false);
  }

  // Trava o scroll da página atrás do menu enquanto ele está aberto.
  toggleMobileMenu(): void {
    this.mobileMenuOpen() ? this.closeMobileMenu() : this.openMobileMenu();
  }

  openMobileMenu(): void {
    this.mobileMenuOpen.set(true);
    lockBodyScroll();
  }

  closeMobileMenu(): void {
    this.mobileMenuOpen.set(false);
    unlockBodyScroll();
  }

  async logout(): Promise<void> {
    this.closeMobileMenu();
    await this.auth.logout();
    await this.router.navigateByUrl(this.logoutRedirect);
  }

  ngOnDestroy(): void {
    if (this.mobileMenuOpen()) unlockBodyScroll();
    this.hostEl.nativeElement.removeEventListener('wheel', this.onSidebarWheel);
    this.unreadSub?.unsubscribe();
    this.roleSub?.unsubscribe();
  }
}
