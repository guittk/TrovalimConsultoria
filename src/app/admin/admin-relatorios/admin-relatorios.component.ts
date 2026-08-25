import { AsyncPipe } from '@angular/common';
import { Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { switchMap } from 'rxjs';
import { AuthService } from '../../core/auth.service';
import { CandidatesService, CANDIDATE_STAGES } from '../../core/candidates.service';
import { CareerTrackService } from '../../core/career-track.service';
import { EmpresasService } from '../../core/empresas.service';
import { LeadsService, LEAD_STAGES } from '../../core/leads.service';
import { MentorshipService } from '../../core/mentorship.service';
import {
  ProjectStatusSettingsService,
  DEFAULT_PROJECT_STATUS_SETTINGS,
} from '../../core/project-status-settings.service';
import { ProjectsService } from '../../core/projects.service';
import { TasksService, TASK_STATUSES } from '../../core/tasks.service';
import { Candidate, Empresa, Lead, Mentorship, Project, Task } from '../../core/models';
import { PnavComponent } from '../../shared/pnav/pnav.component';
import { ADMIN_TABS } from '../admin-tabs';

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

@Component({
  selector: 'app-admin-relatorios',
  standalone: true,
  imports: [AsyncPipe, PnavComponent],
  templateUrl: './admin-relatorios.component.html',
})
export class AdminRelatoriosComponent {
  private readonly auth = inject(AuthService);
  private readonly projectsSvc = inject(ProjectsService);
  private readonly leadsSvc = inject(LeadsService);
  private readonly candidatesSvc = inject(CandidatesService);
  private readonly tasksSvc = inject(TasksService);
  private readonly empresasSvc = inject(EmpresasService);
  private readonly mentorshipSvc = inject(MentorshipService);
  private readonly careerTrackSvc = inject(CareerTrackService);
  private readonly statusSettingsSvc = inject(ProjectStatusSettingsService);

  readonly tabs = ADMIN_TABS;
  readonly userData$ = this.auth.userData$;

  readonly statusSettings = toSignal(this.statusSettingsSvc.get$(), {
    initialValue: DEFAULT_PROJECT_STATUS_SETTINGS,
  });

  /** Mesma régua de acesso das demais telas: manager restrito vê só os seus projetos. */
  readonly projects = toSignal(
    this.userData$.pipe(
      switchMap((data) =>
        data?.projectAccess?.length ? this.projectsSvc.listByIds$(data.projectAccess) : this.projectsSvc.listAll$(),
      ),
    ),
    { initialValue: [] as Project[] },
  );

  readonly leads = toSignal(this.leadsSvc.listAll$(), { initialValue: [] as Lead[] });
  readonly candidates = toSignal(this.candidatesSvc.listAll$(), { initialValue: [] as Candidate[] });
  readonly tasks = toSignal(this.tasksSvc.listAll$(), { initialValue: [] as Task[] });
  readonly empresas = toSignal(this.empresasSvc.listAll$(), { initialValue: [] as Empresa[] });
  readonly mentorships = toSignal(this.mentorshipSvc.listAll$(), { initialValue: [] as Mentorship[] });
  readonly careerTracks = toSignal(this.careerTrackSvc.listAll$(), { initialValue: [] });

  /* ── KPIs ── */
  readonly empresasCount = computed(() => this.empresas().length);
  readonly activeProjectsCount = computed(() => this.projects().filter((p) => p.status !== 'concluido').length);
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

  /* ── Barras ── */
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
}
