import { AsyncPipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { firstValueFrom, switchMap } from 'rxjs';
import { AuthService } from '../../core/auth.service';
import { EmpresasService } from '../../core/empresas.service';
import { ProjectsService } from '../../core/projects.service';
import {
  ProjectStatusSettingsService,
  DEFAULT_PROJECT_STATUS_SETTINGS,
} from '../../core/project-status-settings.service';
import { Empresa, Project } from '../../core/models';
import { PnavComponent } from '../../shared/pnav/pnav.component';
import { SelectComponent } from '../../shared/select/select.component';
import { ADMIN_TABS } from '../admin-tabs';
import { StatusBadgeComponent } from '../../shared/status-badge/status-badge.component';

const SORT_KEYS = ['default', 'empresa', 'status', 'progresso', 'inicio'] as const;
type SortKey = (typeof SORT_KEYS)[number];
type SortDir = 'asc' | 'desc';
const SORT_STORAGE_KEY = 'trovalim.projects.sort';
const SORT_DIR_STORAGE_KEY = 'trovalim.projects.sortDir';

/** Direção "natural" no 1º clique de cada coluna: progresso/início mostram o maior/mais recente primeiro. */
const FIRST_CLICK_DIR: Record<Exclude<SortKey, 'default'>, SortDir> = {
  empresa: 'asc',
  status: 'asc',
  progresso: 'desc',
  inicio: 'desc',
};

function readStored<T extends string>(key: string, allowed: readonly string[], fallback: T): T {
  try {
    const v = localStorage.getItem(key);
    if (v && allowed.includes(v)) return v as T;
  } catch {
    /* storage bloqueado */
  }
  return fallback;
}

@Component({
  selector: 'app-admin-home',
  standalone: true,
  imports: [AsyncPipe, FormsModule, RouterLink, PnavComponent, StatusBadgeComponent, SelectComponent],
  templateUrl: './admin-home.component.html',
})
export class AdminHomeComponent {
  private readonly auth = inject(AuthService);
  private readonly empresasSvc = inject(EmpresasService);
  private readonly projectsSvc = inject(ProjectsService);
  private readonly statusSettingsSvc = inject(ProjectStatusSettingsService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  readonly statusSettings = toSignal(this.statusSettingsSvc.get$(), {
    initialValue: DEFAULT_PROJECT_STATUS_SETTINGS,
  });

  readonly tabs = ADMIN_TABS;
  readonly userData$ = this.auth.userData$;

  /*
   * Managers com projectAccess/companyAccess restrito: uma query sem where
   * na coleção inteira, filtrada só pela regra do Firestore via get() de
   * outro documento (a própria conta), retorna permission-denied — não é
   * suportado de forma confiável em list queries (confirmado no Rules
   * Playground: get() avulso permite, list nega). Por isso a query muda
   * conforme o projectAccess/companyAccess da conta logada, em vez de
   * sempre pedir a coleção inteira e confiar que a regra vai filtrar.
   */
  readonly projects = toSignal(
    this.userData$.pipe(
      switchMap((data) =>
        data?.projectAccess?.length ? this.projectsSvc.listByIds$(data.projectAccess) : this.projectsSvc.listAll$(),
      ),
    ),
    { initialValue: [] },
  );
  readonly allEmpresas = toSignal(
    this.userData$.pipe(
      switchMap((data) =>
        data?.companyAccess?.length ? this.empresasSvc.listByIds$(data.companyAccess) : this.empresasSvc.listAll$(),
      ),
    ),
    { initialValue: [] },
  );
  readonly empresasById = computed(() => new Map(this.allEmpresas().map((e) => [e.id, e])));
  readonly searchTerm = signal('');
  readonly statusFilter = signal('');

  /**
   * Ordenação da lista, controlada clicando no cabeçalho de cada coluna.
   * `default` (nenhum cabeçalho ativo) = por empresa, depois status (na ordem
   * configurada em Configurações), depois progresso. Guardada por navegador.
   */
  readonly sortKey = signal<SortKey>(readStored<SortKey>(SORT_STORAGE_KEY, SORT_KEYS, 'default'));
  readonly sortDir = signal<SortDir>(readStored<SortDir>(SORT_DIR_STORAGE_KEY, ['asc', 'desc'], 'asc'));

  /** Clique no cabeçalho: 1ª vez ativa a coluna na direção natural; de novo, inverte. */
  toggleSort(key: Exclude<SortKey, 'default'>): void {
    if (this.sortKey() === key) {
      this.sortDir.set(this.sortDir() === 'asc' ? 'desc' : 'asc');
    } else {
      this.sortKey.set(key);
      this.sortDir.set(FIRST_CLICK_DIR[key]);
    }
    try {
      localStorage.setItem(SORT_STORAGE_KEY, this.sortKey());
      localStorage.setItem(SORT_DIR_STORAGE_KEY, this.sortDir());
    } catch {
      /* modo privado / storage bloqueado — segue sem persistir */
    }
  }

  /** Setinha mostrada no cabeçalho: só na coluna ativa. */
  sortArrow(key: Exclude<SortKey, 'default'>): string {
    if (this.sortKey() !== key) return '';
    return this.sortDir() === 'asc' ? ' ↑' : ' ↓';
  }

  readonly filteredProjects = computed(() => {
    const q = this.searchTerm().trim().toLowerCase();
    const st = this.statusFilter();
    let list = this.projects();
    if (q) {
      list = list.filter(
        (p) =>
          p.name?.toLowerCase().includes(q) ||
          p.clientName?.toLowerCase().includes(q) ||
          p.description?.toLowerCase().includes(q) ||
          p.branding?.companyName?.toLowerCase().includes(q),
      );
    }
    if (st) list = list.filter((p) => p.status === st);
    return list;
  });

  private companyNameOf(p: Project): string {
    return (
      this.empresasById().get(p.ownerId || '')?.branding?.companyName ||
      p.branding?.companyName ||
      p.clientName ||
      ''
    );
  }

  /** Posição de cada status na ordem configurada — status desconhecido vai pro fim. */
  private readonly statusRank = computed(() => {
    const map = new Map<string, number>();
    this.statusSettings().statuses.forEach((s, i) => map.set(s.key, i));
    return map;
  });

  private comparator(): (a: Project, b: Project) => number {
    const rank = this.statusRank();
    // Primárias sempre ASCENDENTES; a direção é aplicada depois pelo `dir`.
    const byName = (a: Project, b: Project) => (a.name || '').localeCompare(b.name || '', 'pt-BR', { sensitivity: 'base' });
    const byEmpresa = (a: Project, b: Project) =>
      this.companyNameOf(a).localeCompare(this.companyNameOf(b), 'pt-BR', { sensitivity: 'base' });
    const byStatus = (a: Project, b: Project) =>
      (rank.get(String(a.status)) ?? 999) - (rank.get(String(b.status)) ?? 999);
    const byProgresso = (a: Project, b: Project) => (a.progress || 0) - (b.progress || 0);
    const byInicioValue = (a: Project, b: Project) => (a.startDate || '').localeCompare(b.startDate || '');

    if (this.sortKey() === 'default') {
      // por empresa › status › progresso (maior primeiro) › nome
      return (a, b) => byEmpresa(a, b) || byStatus(a, b) || -byProgresso(a, b) || byName(a, b);
    }

    const dir = this.sortDir() === 'desc' ? -1 : 1;
    const key = this.sortKey() as Exclude<SortKey, 'default'>;
    const primary: Record<Exclude<SortKey, 'default'>, (a: Project, b: Project) => number> = {
      empresa: (a, b) => dir * byEmpresa(a, b),
      status: (a, b) => dir * byStatus(a, b),
      progresso: (a, b) => dir * byProgresso(a, b),
      // Projeto sem data de início fica sempre no fim, seja asc ou desc.
      inicio: (a, b) => {
        if (!a.startDate && !b.startDate) return 0;
        if (!a.startDate) return 1;
        if (!b.startDate) return -1;
        return dir * byInicioValue(a, b);
      },
    };
    const fn = primary[key];
    return (a, b) => fn(a, b) || byEmpresa(a, b) || byName(a, b);
  }

  readonly projectsWithCompany = computed(() =>
    this.filteredProjects().filter((p) => !!p.ownerId).slice().sort(this.comparator()),
  );
  readonly projectsWithoutCompany = computed(() =>
    this.filteredProjects().filter((p) => !p.ownerId).slice().sort(this.comparator()),
  );

  /* ── MODAL ── */
  readonly modalOpen = signal(false);
  readonly modalError = signal('');
  readonly saving = signal(false);
  readonly npName = signal('');
  readonly npDesc = signal('');
  readonly npStatus = signal('em-andamento');
  readonly npClientUid = signal('');
  readonly clients = signal<Empresa[]>([]);
  readonly clientsLoading = signal(false);

  readonly selectedClient = computed(() => this.clients().find((c) => c.id === this.npClientUid()));

  constructor() {
    const empresaId = this.route.snapshot.queryParamMap.get('empresa');
    if (empresaId) {
      this.openModal(empresaId);
      this.router.navigate([], { queryParams: {} });
    }
  }

  openModal(preselectedEmpresaId?: string): void {
    this.npName.set('');
    this.npDesc.set('');
    this.npStatus.set('em-andamento');
    this.npClientUid.set(preselectedEmpresaId || '');
    this.modalError.set('');
    this.modalOpen.set(true);
    this.loadClients();
  }

  closeModal(): void {
    this.modalOpen.set(false);
  }

  private async loadClients(): Promise<void> {
    this.clientsLoading.set(true);
    const userData = await firstValueFrom(this.userData$);
    const empresas$ = userData?.companyAccess?.length
      ? this.empresasSvc.listByIds$(userData.companyAccess)
      : this.empresasSvc.listAll$();
    empresas$.subscribe({
      next: (list) => {
        this.clients.set([...list].sort((a, b) => this.companyLabel(a).localeCompare(this.companyLabel(b))));
        this.clientsLoading.set(false);
      },
      error: () => this.clientsLoading.set(false),
    });
  }

  companyLabel(e: Empresa): string {
    return e.branding?.companyName || 'Sem nome';
  }

  /** `yyyy-mm-dd` → `dd/mm/aaaa` sem passar por Date (evita deslocar um dia no fuso -03). */
  fmtDate(value?: string | null): string {
    if (!value) return '—';
    const [y, m, d] = value.split('-');
    return y && m && d ? `${d}/${m}/${y}` : value;
  }

  initials(name: string): string {
    return name.split(' ').slice(0, 2).map((w) => w[0] || '').join('').toUpperCase() || '?';
  }

  async createProject(): Promise<void> {
    const name = this.npName().trim();
    if (!name) {
      this.modalError.set('O nome do projeto é obrigatório.');
      return;
    }
    this.saving.set(true);
    const client = this.selectedClient();
    try {
      const id = await this.projectsSvc.create({
        name,
        description: this.npDesc().trim(),
        clientName: client ? this.companyLabel(client) : '',
        ownerId: client?.id || null,
        status: this.npStatus(),
        progress: 0,
        steps: [],
        branding: null,
      });
      this.modalOpen.set(false);
      await this.router.navigate(['/admin/projeto', id]);
    } catch {
      this.modalError.set('Erro ao criar projeto. Tente novamente.');
    } finally {
      this.saving.set(false);
    }
  }
}
