import { AsyncPipe, DatePipe } from '@angular/common';
import { Component, NgZone, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../core/auth.service';
import { AccountsService } from '../../core/accounts.service';
import { ProjectsService } from '../../core/projects.service';
import { TasksService, TASK_STATUSES, TASK_PRIORITIES } from '../../core/tasks.service';
import { Task, TaskAttachment, TaskChecklistItem, TaskPriority, TaskStatus } from '../../core/models';
import { initials } from '../../shared/initials';
import { PnavComponent, PnavTab } from '../../shared/pnav/pnav.component';
import { ConfirmService } from '../../shared/confirm/confirm.service';

const ADMIN_TABS: PnavTab[] = [
  { key: 'projetos', label: 'Projetos', path: '/admin' },
  { key: 'clientes', label: 'Empresas', path: '/admin/clientes' },
  { key: 'contas', label: 'Contas', path: '/admin/contas' },
  { key: 'kanban', label: 'Kanban', path: '/admin/kanban' },
  { key: 'contatos', label: 'Contatos', path: '/admin/contatos' },
  { key: 'config', label: 'Configurações', path: '/admin/config' },
];

interface FormState {
  titulo: string;
  descricao: string;
  projectId: string;
  assigneeIds: string[];
  status: TaskStatus;
  prioridade: TaskPriority;
  dueDate: string;
  tags: string[];
  checklist: TaskChecklistItem[];
  anexos: TaskAttachment[];
}

function emptyForm(status: TaskStatus): FormState {
  return {
    titulo: '',
    descricao: '',
    projectId: '',
    assigneeIds: [],
    status,
    prioridade: 'media',
    dueDate: '',
    tags: [],
    checklist: [],
    anexos: [],
  };
}

@Component({
  selector: 'app-admin-kanban',
  standalone: true,
  imports: [AsyncPipe, DatePipe, FormsModule, PnavComponent],
  templateUrl: './admin-kanban.component.html',
})
export class AdminKanbanComponent {
  private readonly auth = inject(AuthService);
  private readonly accountsSvc = inject(AccountsService);
  private readonly projectsSvc = inject(ProjectsService);
  private readonly tasksSvc = inject(TasksService);
  private readonly confirmSvc = inject(ConfirmService);
  private readonly zone = inject(NgZone);

  readonly tabs = ADMIN_TABS;
  readonly userData$ = this.auth.userData$;

  readonly statuses = TASK_STATUSES;
  readonly priorities = TASK_PRIORITIES;

  readonly tasks = toSignal(this.tasksSvc.listAll$(), { initialValue: null });
  readonly projects = toSignal(this.projectsSvc.listAll$(), { initialValue: [] });
  readonly staff = toSignal(this.accountsSvc.listStaff$(), { initialValue: [] });

  readonly loading = computed(() => this.tasks() === null);

  /* ── FILTROS ── */
  readonly filterQuery = signal('');
  readonly filterAssigneeId = signal('');
  readonly filterPriority = signal('');

  readonly hasActiveFilters = computed(
    () => !!(this.filterQuery().trim() || this.filterAssigneeId() || this.filterPriority()),
  );

  clearFilters(): void {
    this.filterQuery.set('');
    this.filterAssigneeId.set('');
    this.filterPriority.set('');
  }

  private matchesFilters(task: Task): boolean {
    const q = this.filterQuery().trim().toLowerCase();
    if (q && !task.titulo.toLowerCase().includes(q)) return false;
    const assignee = this.filterAssigneeId();
    if (assignee && !(task.assigneeIds ?? []).includes(assignee)) return false;
    const priority = this.filterPriority();
    if (priority && task.prioridade !== priority) return false;
    return true;
  }

  colTasks(status: string): Task[] {
    const all = this.tasks() ?? [];
    const columns = this.statuses;
    const isFirst = columns[0]?.key === status;
    return all
      .filter((t) => {
        const inColumn = t.status === status || (isFirst && !columns.some((c) => c.key === t.status));
        return inColumn && this.matchesFilters(t);
      })
      .sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0));
  }

  projectName(id: string | null | undefined): string {
    if (!id) return '';
    return this.projects().find((p) => p.id === id)?.name || '';
  }

  assigneeNames(task: Task): string[] {
    return (task.assigneeIds ?? [])
      .map((uid) => this.staff().find((u) => u.uid === uid)?.name || this.staff().find((u) => u.uid === uid)?.email)
      .filter((n): n is string => !!n);
  }

  initials(name: string): string {
    return initials(name);
  }

  priorityDot(key: string): string {
    return this.priorities.find((p) => p.key === key)?.dot || '#999';
  }

  priorityLabel(key: string): string {
    return this.priorities.find((p) => p.key === key)?.label || key;
  }

  checklistProgress(task: Task): { done: number; total: number; percent: number } | null {
    const items = task.checklist ?? [];
    if (!items.length) return null;
    const done = items.filter((i) => i.feito).length;
    return { done, total: items.length, percent: Math.round((done / items.length) * 100) };
  }

  isOverdue(task: Task): boolean {
    return !!task.dueDate && task.dueDate < new Date().toISOString().slice(0, 10) && task.status !== 'concluido';
  }

  /* ── CHECKLIST INLINE NO CARD ── */
  private readonly expandedChecklists = signal(new Set<string>());
  newChecklistText: Record<string, string | undefined> = {};

  isExpanded(taskId: string): boolean {
    return this.expandedChecklists().has(taskId);
  }

  toggleExpanded(taskId: string, event: Event): void {
    event.stopPropagation();
    this.expandedChecklists.update((set) => {
      const copy = new Set(set);
      copy.has(taskId) ? copy.delete(taskId) : copy.add(taskId);
      return copy;
    });
  }

  toggleChecklistItem(task: Task, itemId: string, event: Event): void {
    event.stopPropagation();
    const checklist = (task.checklist ?? []).map((i) => (i.id === itemId ? { ...i, feito: !i.feito } : i));
    this.tasksSvc.update(task.id, { checklist });
  }

  addChecklistItemInline(task: Task, event: Event): void {
    event.stopPropagation();
    const texto = (this.newChecklistText[task.id] ?? '').trim();
    if (!texto) return;
    const checklist = [...(task.checklist ?? []), { id: crypto.randomUUID(), texto, feito: false }];
    this.newChecklistText[task.id] = '';
    this.tasksSvc.update(task.id, { checklist });
  }

  removeChecklistItemInline(task: Task, itemId: string, event: Event): void {
    event.stopPropagation();
    const checklist = (task.checklist ?? []).filter((i) => i.id !== itemId);
    this.tasksSvc.update(task.id, { checklist });
  }

  /* ── DRAG AND DROP ── */
  readonly draggingId = signal<string | null>(null);
  readonly dragOverCol = signal<string | null>(null);
  readonly dragOverTaskId = signal<string | null>(null);

  onDragStart(event: DragEvent, task: Task): void {
    event.dataTransfer?.setData('text/plain', task.id);
    this.draggingId.set(task.id);
  }

  onDragEnd(): void {
    this.draggingId.set(null);
    this.dragOverCol.set(null);
    this.dragOverTaskId.set(null);
  }

  onColDragOver(event: DragEvent, status: string): void {
    event.preventDefault();
    this.dragOverCol.set(status);
  }

  onColDragLeave(): void {
    this.dragOverCol.set(null);
  }

  onCardDragOver(event: DragEvent, status: string, task: Task): void {
    event.preventDefault();
    event.stopPropagation();
    this.dragOverCol.set(status);
    this.dragOverTaskId.set(task.id);
  }

  /** Solto no espaço vazio da coluna: vai para o fim dela. */
  onDrop(event: DragEvent, status: string): void {
    event.preventDefault();
    const taskId = event.dataTransfer?.getData('text/plain');
    if (taskId) this.moveTask(taskId, status, null);
    this.onDragEnd();
  }

  /** Solto sobre um card específico: entra logo antes dele. */
  onDropOnCard(event: DragEvent, status: string, targetTask: Task): void {
    event.preventDefault();
    event.stopPropagation();
    const taskId = event.dataTransfer?.getData('text/plain');
    if (taskId && taskId !== targetTask.id) this.moveTask(taskId, status, targetTask.id);
    this.onDragEnd();
  }

  /** Renumera a coluna de destino inteira para o card cair exatamente onde foi solto. */
  private moveTask(taskId: string, status: string, beforeTaskId: string | null): void {
    const dragged = (this.tasks() ?? []).find((t) => t.id === taskId);
    if (!dragged) return;

    const rest = this.colTasks(status).filter((t) => t.id !== taskId);
    const insertIndex = beforeTaskId ? rest.findIndex((t) => t.id === beforeTaskId) : -1;
    rest.splice(insertIndex === -1 ? rest.length : insertIndex, 0, dragged);

    rest.forEach((t, i) => {
      const data: Partial<Task> = { ordem: i };
      if (t.id === taskId && t.status !== status) data.status = status as TaskStatus;
      this.tasksSvc.update(t.id, data);
    });
  }

  /* ── MODAL DE TAREFA ── */
  readonly modalOpen = signal(false);
  readonly editingTask = signal<Task | null>(null);
  readonly form = signal<FormState>(emptyForm('a-fazer'));
  readonly saving = signal(false);
  readonly modalErr = signal('');
  readonly tagInput = signal('');
  readonly checklistInput = signal('');
  readonly uploadingAttachment = signal(false);
  readonly uploadErr = signal('');
  readonly deleting = signal(false);

  openCreate(status: TaskStatus): void {
    this.editingTask.set(null);
    this.form.set(emptyForm(status));
    this.modalErr.set('');
    this.modalOpen.set(true);
  }

  openEdit(task: Task): void {
    this.editingTask.set(task);
    this.form.set({
      titulo: task.titulo,
      descricao: task.descricao ?? '',
      projectId: task.projectId ?? '',
      assigneeIds: task.assigneeIds ?? [],
      status: task.status,
      prioridade: task.prioridade,
      dueDate: task.dueDate ?? '',
      tags: task.tags ?? [],
      checklist: task.checklist ?? [],
      anexos: task.anexos ?? [],
    });
    this.modalErr.set('');
    this.modalOpen.set(true);
  }

  closeModal(): void {
    this.modalOpen.set(false);
  }

  /**
   * O calendário nativo de um <input type=date> dentro do modal (position:fixed
   * + overflow-y:auto) não abre ao clicar no ícone — mesma corrida com o
   * zone.js já documentada em admin-accounts.component.ts para o seletor de
   * arquivo. showPicker() fora da zone contorna o problema.
   */
  openDatePicker(input: HTMLInputElement): void {
    this.zone.runOutsideAngular(() => {
      if (typeof input.showPicker === 'function') {
        input.showPicker();
      } else {
        input.focus();
      }
    });
  }

  updateForm<K extends keyof FormState>(key: K, value: FormState[K]): void {
    this.form.update((f) => ({ ...f, [key]: value }));
  }

  isAssigned(uid: string): boolean {
    return this.form().assigneeIds.includes(uid);
  }

  toggleAssignee(uid: string): void {
    const current = this.form().assigneeIds;
    const next = current.includes(uid) ? current.filter((id) => id !== uid) : [...current, uid];
    this.updateForm('assigneeIds', next);
  }

  addTag(): void {
    const value = this.tagInput().trim();
    if (!value) return;
    this.updateForm('tags', [...this.form().tags, value]);
    this.tagInput.set('');
  }

  removeTag(tag: string): void {
    this.updateForm('tags', this.form().tags.filter((t) => t !== tag));
  }

  addChecklistItem(): void {
    const texto = this.checklistInput().trim();
    if (!texto) return;
    this.updateForm('checklist', [...this.form().checklist, { id: crypto.randomUUID(), texto, feito: false }]);
    this.checklistInput.set('');
  }

  toggleFormChecklistItem(id: string): void {
    this.updateForm(
      'checklist',
      this.form().checklist.map((c) => (c.id === id ? { ...c, feito: !c.feito } : c)),
    );
  }

  removeFormChecklistItem(id: string): void {
    this.updateForm('checklist', this.form().checklist.filter((c) => c.id !== id));
  }

  checklistDone(): number {
    return this.form().checklist.filter((c) => c.feito).length;
  }

  checklistPercent(): number {
    const total = this.form().checklist.length;
    if (!total) return 0;
    return Math.round((this.checklistDone() / total) * 100);
  }

  async handleSave(): Promise<void> {
    const f = this.form();
    if (!f.titulo.trim()) {
      this.modalErr.set('O título é obrigatório.');
      return;
    }
    this.saving.set(true);
    this.modalErr.set('');
    try {
      const payload: Partial<Task> = {
        titulo: f.titulo.trim(),
        descricao: f.descricao.trim(),
        projectId: f.projectId || null,
        assigneeIds: f.assigneeIds,
        status: f.status,
        prioridade: f.prioridade,
        dueDate: f.dueDate || null,
        tags: f.tags,
        checklist: f.checklist,
        anexos: f.anexos,
      };
      const editing = this.editingTask();
      if (editing) {
        await this.tasksSvc.update(editing.id, payload);
      } else {
        payload.ordem = this.colTasks(f.status).length;
        await this.tasksSvc.create(payload);
      }
      this.modalOpen.set(false);
    } catch {
      this.modalErr.set('Erro ao salvar a tarefa. Tente novamente.');
    } finally {
      this.saving.set(false);
    }
  }

  async handleDelete(): Promise<void> {
    const task = this.editingTask();
    if (!task) return;
    const ok = await this.confirmSvc.confirm({
      title: 'Excluir tarefa',
      message: `Excluir "${task.titulo}" permanentemente? Essa ação não pode ser desfeita.`,
      confirmLabel: 'Excluir',
      danger: true,
    });
    if (!ok) return;
    this.deleting.set(true);
    try {
      await this.tasksSvc.delete(task.id);
      this.modalOpen.set(false);
    } finally {
      this.deleting.set(false);
    }
  }

  removeAttachment(url: string): void {
    const task = this.editingTask();
    const anexos = this.form().anexos.filter((a) => a.url !== url);
    this.updateForm('anexos', anexos);
    if (task) this.tasksSvc.update(task.id, { anexos });
  }

  async handleUploadAttachment(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    const task = this.editingTask();
    if (!file || !task) return;

    this.uploadErr.set('');
    this.uploadingAttachment.set(true);
    try {
      const anexo = await this.tasksSvc.uploadAttachment(task.id, file);
      const anexos = [...this.form().anexos, anexo];
      this.updateForm('anexos', anexos);
      await this.tasksSvc.update(task.id, { anexos });
    } catch {
      this.uploadErr.set('Não foi possível enviar o arquivo.');
    } finally {
      this.uploadingAttachment.set(false);
      input.value = '';
    }
  }
}
