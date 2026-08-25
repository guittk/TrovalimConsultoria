import { AsyncPipe } from '@angular/common';
import { Component, NgZone, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth.service';
import { CalendarEventsService, CALENDAR_EVENT_TYPES } from '../../core/calendar-events.service';
import { ProjectsService } from '../../core/projects.service';
import { TasksService } from '../../core/tasks.service';
import { CalendarEvent, CalendarEventType, Project, Task } from '../../core/models';
import { PnavComponent } from '../../shared/pnav/pnav.component';
import { ADMIN_TABS } from '../admin-tabs';
import { ConfirmService } from '../../shared/confirm/confirm.service';

interface DayCell {
  date: string;
  day: number;
  inMonth: boolean;
  isToday: boolean;
}

interface DueMark {
  kind: 'tarefa' | 'projeto';
  title: string;
  link: string[];
}

interface FormState {
  title: string;
  date: string;
  time: string;
  type: CalendarEventType;
  description: string;
  projectId: string;
}

const WEEKDAY_LABELS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const SHOW_DEADLINES_KEY = 'calendario.mostrarPrazos';

function todayYmd(): string {
  return new Date().toISOString().slice(0, 10);
}

function emptyForm(date: string): FormState {
  return { title: '', date, time: '', type: 'reuniao', description: '', projectId: '' };
}

@Component({
  selector: 'app-admin-calendario',
  standalone: true,
  imports: [AsyncPipe, FormsModule, RouterLink, PnavComponent],
  templateUrl: './admin-calendario.component.html',
})
export class AdminCalendarioComponent {
  private readonly auth = inject(AuthService);
  private readonly eventsSvc = inject(CalendarEventsService);
  private readonly projectsSvc = inject(ProjectsService);
  private readonly tasksSvc = inject(TasksService);
  private readonly confirmSvc = inject(ConfirmService);
  private readonly zone = inject(NgZone);

  readonly tabs = ADMIN_TABS;
  readonly userData$ = this.auth.userData$;
  readonly eventTypes = CALENDAR_EVENT_TYPES;
  readonly today = todayYmd();

  readonly events = toSignal(this.eventsSvc.listAll$(), { initialValue: [] as CalendarEvent[] });
  readonly projects = toSignal(this.projectsSvc.listAll$(), { initialValue: [] as Project[] });
  readonly tasks = toSignal(this.tasksSvc.listAll$(), { initialValue: [] as Task[] });

  readonly showDeadlines = signal(this.readShowDeadlines());

  private readonly now = new Date();
  readonly viewYear = signal(this.now.getFullYear());
  readonly viewMonth = signal(this.now.getMonth()); // 0-11

  readonly monthLabel = computed(() =>
    new Date(this.viewYear(), this.viewMonth(), 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }),
  );
  readonly weekdayLabels = WEEKDAY_LABELS;

  private readShowDeadlines(): boolean {
    try {
      return localStorage.getItem(SHOW_DEADLINES_KEY) !== '0';
    } catch {
      return true;
    }
  }

  toggleDeadlines(): void {
    const next = !this.showDeadlines();
    this.showDeadlines.set(next);
    try {
      localStorage.setItem(SHOW_DEADLINES_KEY, next ? '1' : '0');
    } catch {
      /* localStorage indisponível (modo privado) — a preferência só não persiste entre sessões. */
    }
  }

  goToday(): void {
    this.viewYear.set(this.now.getFullYear());
    this.viewMonth.set(this.now.getMonth());
  }

  prevMonth(): void {
    const m = this.viewMonth() - 1;
    if (m < 0) {
      this.viewMonth.set(11);
      this.viewYear.update((y) => y - 1);
    } else {
      this.viewMonth.set(m);
    }
  }

  nextMonth(): void {
    const m = this.viewMonth() + 1;
    if (m > 11) {
      this.viewMonth.set(0);
      this.viewYear.update((y) => y + 1);
    } else {
      this.viewMonth.set(m);
    }
  }

  /** Grade de semanas (domingo-sábado) cobrindo o mês, com dias do mês vizinho preenchendo as pontas. */
  readonly weeks = computed<DayCell[][]>(() => {
    const year = this.viewYear();
    const month = this.viewMonth();
    const firstOfMonth = new Date(year, month, 1);
    const start = new Date(year, month, 1 - firstOfMonth.getDay());
    const cells: DayCell[] = [];
    for (let i = 0; i < 42; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      const ymd = d.toISOString().slice(0, 10);
      cells.push({ date: ymd, day: d.getDate(), inMonth: d.getMonth() === month, isToday: ymd === this.today });
    }
    const weeks: DayCell[][] = [];
    for (let i = 0; i < 42; i += 7) weeks.push(cells.slice(i, i + 7));
    return weeks;
  });

  readonly eventsByDate = computed(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const e of this.events()) {
      if (!map.has(e.date)) map.set(e.date, []);
      map.get(e.date)!.push(e);
    }
    return map;
  });

  /** Prazos são leitura de Project/Task, nunca copiados pra `calendarEvents` — evita duas verdades divergindo. */
  readonly deadlinesByDate = computed(() => {
    const map = new Map<string, DueMark[]>();
    const push = (date: string | null | undefined, mark: DueMark) => {
      if (!date) return;
      if (!map.has(date)) map.set(date, []);
      map.get(date)!.push(mark);
    };
    for (const t of this.tasks()) {
      if (t.status === 'concluido') continue;
      push(t.dueDate, { kind: 'tarefa', title: t.titulo, link: ['/admin/kanban'] });
    }
    for (const p of this.projects()) {
      if (p.status === 'concluido') continue;
      push(p.deadline, { kind: 'projeto', title: p.name, link: ['/admin/projeto', p.id] });
    }
    return map;
  });

  eventsFor(date: string): CalendarEvent[] {
    return this.eventsByDate().get(date) || [];
  }

  deadlinesFor(date: string): DueMark[] {
    return this.showDeadlines() ? this.deadlinesByDate().get(date) || [] : [];
  }

  typeColor(type: CalendarEventType): string {
    return this.eventTypes.find((t) => t.key === type)?.color || '#6B6B6B';
  }
  typeLabel(type: CalendarEventType): string {
    return this.eventTypes.find((t) => t.key === type)?.label || type;
  }

  /* ── PAINEL DO DIA ── */
  readonly selectedDate = signal<string | null>(null);

  openDay(date: string): void {
    this.selectedDate.set(date);
  }
  closeDay(): void {
    this.selectedDate.set(null);
  }

  /**
   * `toLocaleDateString` nativo, não o `DatePipe` do Angular — o pipe com
   * nome de mês/dia exige `registerLocaleData` (não configurado neste app;
   * daria NG0701 em runtime), enquanto a API nativa do navegador já sabe
   * formatar em pt-BR sem registro nenhum.
   */
  dayPanelTitle(date: string): string {
    return new Date(`${date}T00:00:00`).toLocaleDateString('pt-BR', {
      weekday: 'long',
      day: '2-digit',
      month: 'long',
    });
  }

  /* ── MODAL DE COMPROMISSO ── */
  readonly modalOpen = signal(false);
  readonly editingEvent = signal<CalendarEvent | null>(null);
  readonly form = signal<FormState>(emptyForm(this.today));
  readonly saving = signal(false);
  readonly deleting = signal(false);
  readonly modalErr = signal('');

  openCreate(date: string): void {
    this.editingEvent.set(null);
    this.form.set(emptyForm(date));
    this.modalErr.set('');
    this.modalOpen.set(true);
  }

  openEdit(event: CalendarEvent): void {
    this.editingEvent.set(event);
    this.form.set({
      title: event.title,
      date: event.date,
      time: event.time || '',
      type: event.type,
      description: event.description || '',
      projectId: event.projectId || '',
    });
    this.modalErr.set('');
    this.modalOpen.set(true);
  }

  closeModal(): void {
    this.modalOpen.set(false);
  }

  updateForm<K extends keyof FormState>(key: K, value: FormState[K]): void {
    this.form.update((f) => ({ ...f, [key]: value }));
  }

  /** Mesma corrida documentada em admin-kanban.component.ts: showPicker() dentro de um modal position:fixed não abre via zone.js. */
  openDatePicker(input: HTMLInputElement): void {
    this.zone.runOutsideAngular(() => {
      if (typeof input.showPicker === 'function') input.showPicker();
      else input.focus();
    });
  }

  async handleSave(): Promise<void> {
    const f = this.form();
    if (!f.title.trim() || !f.date) {
      this.modalErr.set('Título e data são obrigatórios.');
      return;
    }
    this.saving.set(true);
    this.modalErr.set('');
    try {
      const auth = this.auth.currentUser;
      const payload: Omit<CalendarEvent, 'id' | 'createdAt'> = {
        title: f.title.trim(),
        date: f.date,
        time: f.time || null,
        type: f.type,
        description: f.description.trim(),
        projectId: f.projectId || null,
        createdByName: auth?.displayName || auth?.email || 'Equipe',
      };
      const editing = this.editingEvent();
      if (editing) {
        await this.eventsSvc.update(editing.id!, payload);
      } else {
        await this.eventsSvc.create(payload);
      }
      this.modalOpen.set(false);
    } catch {
      this.modalErr.set('Erro ao salvar o compromisso. Tente novamente.');
    } finally {
      this.saving.set(false);
    }
  }

  async handleDelete(): Promise<void> {
    const event = this.editingEvent();
    if (!event) return;
    const ok = await this.confirmSvc.confirm({
      title: 'Excluir compromisso',
      message: `Excluir "${event.title}" permanentemente?`,
      confirmLabel: 'Excluir',
      danger: true,
    });
    if (!ok) return;
    this.deleting.set(true);
    try {
      await this.eventsSvc.delete(event.id!);
      this.modalOpen.set(false);
    } finally {
      this.deleting.set(false);
    }
  }
}
