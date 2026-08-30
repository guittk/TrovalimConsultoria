import { AsyncPipe, DatePipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { switchMap } from 'rxjs';
import { AuthService } from '../../core/auth.service';
import { CandidatesService, CANDIDATE_STAGES } from '../../core/candidates.service';
import { CareerTrackService } from '../../core/career-track.service';
import { ContactSubmissionsService } from '../../core/contact-submissions.service';
import { EmpresasService } from '../../core/empresas.service';
import { LeadsService, LEAD_STAGES } from '../../core/leads.service';
import { MentorshipService } from '../../core/mentorship.service';
import { ProjectsService } from '../../core/projects.service';
import {
  ProjectStatusSettingsService,
  DEFAULT_PROJECT_STATUS_SETTINGS,
} from '../../core/project-status-settings.service';
import { TasksService, TASK_STATUSES } from '../../core/tasks.service';
import { Candidate, ContactSubmission, Empresa, Lead, Mentorship, Project, Task } from '../../core/models';
import { PnavComponent } from '../../shared/pnav/pnav.component';
import { ADMIN_TABS } from '../admin-tabs';

interface DueItem {
  kind: 'tarefa' | 'projeto';
  id: string;
  title: string;
  date: string;
  link: string[];
  overdue: boolean;
  task?: Task;
}

interface BarRow {
  key: string;
  label: string;
  count: number;
  pct: number;
}

/** Distribui uma lista em contagem por chave e escala cada barra pelo maior valor do grupo — nunca por 100, senão a barra líder nunca preencheria. */
function toBars<T>(
  items: T[],
  stages: { key: string; label: string }[],
  keyOf: (item: T) => string,
): BarRow[] {
  const counts = stages.map((s) => ({ ...s, count: items.filter((i) => keyOf(i) === s.key).length }));
  const max = Math.max(1, ...counts.map((c) => c.count));
  return counts.map((c) => ({ ...c, pct: Math.round((c.count / max) * 100) }));
}

const TODAY = new Date().toISOString().slice(0, 10);

function parseYmd(value: string | null | undefined): Date | null {
  if (!value) return null;
  const d = new Date(`${value}T00:00:00`);
  return isNaN(d.getTime()) ? null : d;
}

function addDaysYmd(value: string, days: number): string {
  const base = parseYmd(value) || new Date(`${TODAY}T00:00:00`);
  base.setDate(base.getDate() + days);
  return base.toISOString().slice(0, 10);
}

@Component({
  selector: 'app-admin-painel',
  standalone: true,
  imports: [AsyncPipe, DatePipe, RouterLink, PnavComponent],
  templateUrl: './admin-painel.component.html',
})
export class AdminPainelComponent {
  private readonly auth = inject(AuthService);
  private readonly projectsSvc = inject(ProjectsService);
  private readonly tasksSvc = inject(TasksService);
  private readonly empresasSvc = inject(EmpresasService);
  private readonly contactSvc = inject(ContactSubmissionsService);
  private readonly statusSettingsSvc = inject(ProjectStatusSettingsService);
  private readonly leadsSvc = inject(LeadsService);
  private readonly candidatesSvc = inject(CandidatesService);
  private readonly mentorshipSvc = inject(MentorshipService);
  private readonly careerTrackSvc = inject(CareerTrackService);

  readonly tabs = ADMIN_TABS;
  readonly userData$ = this.auth.userData$;

  readonly statusSettings = toSignal(this.statusSettingsSvc.get$(), {
    initialValue: DEFAULT_PROJECT_STATUS_SETTINGS,
  });

  /** Mesma régua de acesso do Painel de Projetos: manager restrito vê só os seus. */
  readonly projects = toSignal(
    this.userData$.pipe(
      switchMap((data) =>
        data?.projectAccess?.length ? this.projectsSvc.listByIds$(data.projectAccess) : this.projectsSvc.listAll$(),
      ),
    ),
    { initialValue: [] as Project[] },
  );

  /** Tarefas do Kanban não têm restrição por manager — mesma regra da própria tela de Kanban. */
  readonly tasks = toSignal(this.tasksSvc.listAll$(), { initialValue: [] as Task[] });
  readonly empresas = toSignal(this.empresasSvc.listAll$(), { initialValue: [] as Empresa[] });
  readonly empresasCount = computed(() => this.empresas().length);
  readonly contacts = toSignal(this.contactSvc.listAll$(), { initialValue: [] as ContactSubmission[] });

  readonly recentContacts = computed(() => this.contacts().slice(0, 5));

  readonly activeProjectsCount = computed(
    () => this.projects().filter((p) => p.status !== 'concluido').length,
  );
  readonly openTasksCount = computed(() => this.tasks().filter((t) => t.status !== 'concluido').length);

  readonly statusCounts = computed(() => {
    const projects = this.projects();
    return this.statusSettings().statuses.map((s) => ({
      key: s.key,
      label: s.label,
      count: projects.filter((p) => p.status === s.key).length,
    }));
  });

  /**
   * Só entra o que TEM prazo — item sem data não é trabalho de hoje. Junta
   * tarefas do Kanban (dueDate) e prazos de entrega de projeto (deadline),
   * ordenado por data; vencido primeiro, dentro de cada grupo por data.
   */
  readonly dueItems = computed<DueItem[]>(() => {
    const items: DueItem[] = [];
    for (const t of this.tasks()) {
      if (!t.dueDate || t.status === 'concluido') continue;
      items.push({
        kind: 'tarefa',
        id: t.id,
        title: t.titulo,
        date: t.dueDate,
        link: ['/admin/kanban'],
        overdue: t.dueDate < TODAY,
        task: t,
      });
    }
    for (const p of this.projects()) {
      if (!p.deadline || p.status === 'concluido') continue;
      items.push({
        kind: 'projeto',
        id: p.id,
        title: p.name,
        date: p.deadline,
        link: ['/admin/projeto', p.id],
        overdue: p.deadline < TODAY,
      });
    }
    return items.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  });

  readonly overdueItems = computed(() => this.dueItems().filter((i) => i.overdue));
  readonly upcomingItems = computed(() => this.dueItems().filter((i) => !i.overdue).slice(0, 8));

  readonly unreadProjects = computed(() => this.projects().filter((p) => p.unreadForStaff));

  /* ── Indicadores da operação (ex-tela "Relatórios") ── */
  readonly leads = toSignal(this.leadsSvc.listAll$(), { initialValue: [] as Lead[] });
  readonly candidates = toSignal(this.candidatesSvc.listAll$(), { initialValue: [] as Candidate[] });
  readonly mentorships = toSignal(this.mentorshipSvc.listAll$(), { initialValue: [] as Mentorship[] });
  readonly careerTracks = toSignal(this.careerTrackSvc.listAll$(), { initialValue: [] });

  readonly overdueProjectsCount = computed(
    () => this.projects().filter((p) => p.deadline && p.deadline < TODAY && p.status !== 'concluido').length,
  );

  readonly leadConversionRate = computed(() => {
    const ganhos = this.leads().filter((l) => l.stage === 'ganho').length;
    const perdidos = this.leads().filter((l) => l.stage === 'perdido').length;
    const total = ganhos + perdidos;
    return total ? Math.round((ganhos / total) * 100) : null;
  });

  readonly leadsEmAberto = computed(
    () => this.leads().filter((l) => l.stage !== 'ganho' && l.stage !== 'perdido').length,
  );

  readonly valorEstimadoEmAberto = computed(() =>
    this.leads()
      .filter((l) => l.stage !== 'ganho' && l.stage !== 'perdido')
      .reduce((sum, l) => sum + (l.valorEstimado || 0), 0),
  );

  readonly hiringRate = computed(() => {
    const contratados = this.candidates().filter((c) => c.stage === 'contratado').length;
    const reprovados = this.candidates().filter((c) => c.stage === 'reprovado').length;
    const total = contratados + reprovados;
    return total ? Math.round((contratados / total) * 100) : null;
  });

  readonly candidatesEmProcesso = computed(
    () => this.candidates().filter((c) => c.stage !== 'contratado' && c.stage !== 'reprovado').length,
  );

  readonly mentoradosAtivos = computed(() => this.mentorships().length);
  readonly carreirasAtivas = computed(() => this.careerTracks().length);

  readonly leadBars = computed(() => toBars(this.leads(), LEAD_STAGES, (l) => l.stage));
  readonly candidateBars = computed(() => toBars(this.candidates(), CANDIDATE_STAGES, (c) => c.stage));
  readonly taskBars = computed(() => toBars(this.tasks(), TASK_STATUSES, (t) => t.status));
  readonly projectBars = computed(() =>
    toBars(
      this.projects(),
      this.statusSettings().statuses.map((s) => ({ key: s.key, label: s.label })),
      (p) => p.status,
    ),
  );

  formatBrl(value: number): string {
    return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
  }

  async completeTask(task: Task): Promise<void> {
    await this.tasksSvc.update(task.id, { status: 'concluido' });
  }

  /** Rebaseia em HOJE quando a tarefa já venceu, senão continuaria vermelha depois do clique. */
  async postponeTask(task: Task): Promise<void> {
    const base = task.dueDate && task.dueDate >= TODAY ? task.dueDate : TODAY;
    await this.tasksSvc.update(task.id, { dueDate: addDaysYmd(base, 1) });
  }
}
