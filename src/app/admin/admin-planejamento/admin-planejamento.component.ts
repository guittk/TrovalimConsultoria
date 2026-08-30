import { AsyncPipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { switchMap } from 'rxjs';
import { AuthService } from '../../core/auth.service';
import { AccountsService } from '../../core/accounts.service';
import { ProjectsService } from '../../core/projects.service';
import { PlanningService } from '../../core/planning.service';
import { PLANNING_STATUSES, PlanningGroup, PlanningItem, PlanningStatus, Project } from '../../core/models';
import { initials } from '../../shared/initials';
import { PnavComponent } from '../../shared/pnav/pnav.component';
import { SelectComponent } from '../../shared/select/select.component';
import { ADMIN_TABS } from '../admin-tabs';
import { ConfirmService } from '../../shared/confirm/confirm.service';
import { PlanningStatusSelectComponent } from './planning-status-select.component';
import { PlanningAssigneeSelectComponent } from './planning-assignee-select.component';
import { PlanningPriorityStarsComponent } from './planning-priority-stars.component';
import { PlanningItemPanelComponent } from './planning-item-panel.component';

const GROUP_COLORS = ['#3D0B12', '#C9A96E', '#339ECD', '#33D391', '#FDBC64', '#8b5cf6', '#E8697D'];

@Component({
  selector: 'app-admin-planejamento',
  standalone: true,
  imports: [
    AsyncPipe,
    FormsModule,
    PnavComponent,
    PlanningStatusSelectComponent,
    PlanningAssigneeSelectComponent,
    PlanningPriorityStarsComponent,
    PlanningItemPanelComponent,
    SelectComponent,
  ],
  templateUrl: './admin-planejamento.component.html',
})
export class AdminPlanejamentoComponent {
  private readonly auth = inject(AuthService);
  private readonly accountsSvc = inject(AccountsService);
  private readonly projectsSvc = inject(ProjectsService);
  private readonly planningSvc = inject(PlanningService);
  private readonly confirmSvc = inject(ConfirmService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  readonly tabs = ADMIN_TABS;
  readonly userData$ = this.auth.userData$;
  readonly statuses = PLANNING_STATUSES;

  readonly staff = toSignal(this.accountsSvc.listStaff$(), { initialValue: [] });

  /** Mesma régua de acesso das demais telas: manager restrito vê só os seus projetos. */
  readonly projects = toSignal(
    this.userData$.pipe(
      switchMap((data) =>
        data?.projectAccess?.length ? this.projectsSvc.listByIds$(data.projectAccess) : this.projectsSvc.listAll$(),
      ),
    ),
    { initialValue: [] as Project[] },
  );

  /* ── QUADRO SELECIONADO ── */
  readonly selectedBoard = signal<string | null>(this.boardFromQueryParam());
  readonly boardValue = computed(() => this.selectedBoard() ?? 'global');

  private boardFromQueryParam(): string | null {
    const v = this.route.snapshot.queryParamMap.get('board');
    return v && v !== 'global' ? v : null;
  }

  readonly groups = toSignal<PlanningGroup[] | null>(
    toObservable(this.selectedBoard).pipe(switchMap((id) => this.planningSvc.groups$(id))),
    { initialValue: null },
  );
  readonly items = toSignal<PlanningItem[] | null>(
    toObservable(this.selectedBoard).pipe(switchMap((id) => this.planningSvc.items$(id))),
    { initialValue: null },
  );
  readonly loading = computed(() => this.groups() === null || this.items() === null);
  readonly sortedGroups = computed(() => (this.groups() ?? []).slice().sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0)));

  onBoardChange(value: string): void {
    const projectId = value === 'global' ? null : value;
    this.selectedBoard.set(projectId);
    this.openItemId.set(null);
    this.selectedIds.set(new Set());
    this.router.navigate([], { queryParams: { board: value, item: null }, queryParamsHandling: 'merge' });
  }

  /* ── FILTROS ── */
  readonly filterQuery = signal('');
  readonly filterAssigneeId = signal('');
  readonly filterStatus = signal('');
  readonly filterPriority = signal('');

  readonly hasActiveFilters = computed(
    () => !!(this.filterQuery().trim() || this.filterAssigneeId() || this.filterStatus() || this.filterPriority()),
  );

  clearFilters(): void {
    this.filterQuery.set('');
    this.filterAssigneeId.set('');
    this.filterStatus.set('');
    this.filterPriority.set('');
  }

  private matchesFilters(item: PlanningItem): boolean {
    const q = this.filterQuery().trim().toLowerCase();
    if (q && !item.nome.toLowerCase().includes(q)) return false;
    const assignee = this.filterAssigneeId();
    if (assignee && !(item.assigneeIds ?? []).includes(assignee)) return false;
    const status = this.filterStatus();
    if (status && item.status !== status) return false;
    const priority = this.filterPriority();
    if (priority && item.prioridade !== Number(priority)) return false;
    return true;
  }

  rootItemsOf(groupId: string): PlanningItem[] {
    return (this.items() ?? [])
      .filter((i) => i.groupId === groupId && !i.parentId && this.matchesFilters(i))
      .sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0));
  }

  subitemsOf(parentId: string): PlanningItem[] {
    return (this.items() ?? [])
      .filter((i) => i.parentId === parentId && this.matchesFilters(i))
      .sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0));
  }

  private allRootCountOf(groupId: string): number {
    return (this.items() ?? []).filter((i) => i.groupId === groupId && !i.parentId).length;
  }

  camposVisiveis(item: PlanningItem): boolean {
    return item.mostrarCampos ?? this.subitemsOf(item.id).length === 0;
  }

  toggleMostrarCampos(item: PlanningItem, event: Event): void {
    event.stopPropagation();
    this.planningSvc.updateItem(item.id, { mostrarCampos: !this.camposVisiveis(item) });
  }

  initials(name: string): string {
    return initials(name);
  }

  isOverdue(item: PlanningItem): boolean {
    return !!item.dueDate && item.dueDate < new Date().toISOString().slice(0, 10) && item.status !== 'done';
  }

  /* ── GRUPOS ── */
  async addGroup(): Promise<void> {
    const ordem = this.sortedGroups().length;
    const cor = GROUP_COLORS[ordem % GROUP_COLORS.length];
    await this.planningSvc.createGroup(this.selectedBoard(), `Novo grupo ${ordem + 1}`, cor, ordem);
  }

  renameGroup(group: PlanningGroup, value: string): void {
    const nome = value.trim();
    if (nome && nome !== group.nome) this.planningSvc.updateGroup(group.id, { nome });
  }

  setGroupColor(group: PlanningGroup, value: string): void {
    this.planningSvc.updateGroup(group.id, { cor: value });
  }

  toggleCollapse(group: PlanningGroup): void {
    this.planningSvc.updateGroup(group.id, { colapsado: !group.colapsado });
  }

  async removeGroup(group: PlanningGroup): Promise<void> {
    const count = this.allRootCountOf(group.id);
    const ok = await this.confirmSvc.confirm({
      title: 'Excluir grupo',
      message: `Excluir "${group.nome}"${count ? ` e os ${count} item(ns) dentro dele` : ''}? Essa ação não pode ser desfeita.`,
      confirmLabel: 'Excluir',
      danger: true,
    });
    if (!ok) return;
    await this.planningSvc.deleteGroupCascade(group.id);
  }

  /* ── ITENS ── */
  newItemDraft: Record<string, string> = {};

  async addRootItem(group: PlanningGroup): Promise<void> {
    const nome = (this.newItemDraft[group.id] ?? '').trim();
    if (!nome) return;
    await this.planningSvc.createItem({
      projectId: this.selectedBoard(),
      groupId: group.id,
      nome,
      status: 'backlog',
      ordem: this.allRootCountOf(group.id),
    });
    this.newItemDraft[group.id] = '';
  }

  renameItem(item: PlanningItem, value: string): void {
    const nome = value.trim();
    if (nome && nome !== item.nome) this.planningSvc.updateItem(item.id, { nome });
  }

  updateItem(id: string, patch: Partial<PlanningItem>): void {
    this.planningSvc.updateItem(id, patch);
  }

  async addSubitem(parent: PlanningItem): Promise<void> {
    const nome = (this.newItemDraft[parent.id] ?? '').trim();
    if (!nome) return;
    await this.planningSvc.createItem({
      projectId: this.selectedBoard(),
      groupId: parent.groupId,
      parentId: parent.id,
      nome,
      status: 'backlog',
      ordem: this.subitemsOf(parent.id).length,
    });
    this.newItemDraft[parent.id] = '';
  }

  async removeItem(item: PlanningItem): Promise<void> {
    const subCount = item.parentId ? 0 : this.subitemsOf(item.id).length;
    const ok = await this.confirmSvc.confirm({
      title: item.parentId ? 'Excluir sub-item' : 'Excluir item',
      message: `Excluir "${item.nome}"${subCount ? ` (com ${subCount} sub-item(ns))` : ''}? Essa ação não pode ser desfeita.`,
      confirmLabel: 'Excluir',
      danger: true,
    });
    if (!ok) return;
    await this.planningSvc.deleteItem(item.id);
    if (this.openItemId() === item.id) this.closeItemPanel();
  }

  /* ── DISCLOSURE DE SUB-ITENS (estado local, não persistido) ── */
  readonly expandedItems = signal(new Set<string>());

  isExpanded(id: string): boolean {
    return this.expandedItems().has(id);
  }

  toggleExpand(id: string, event: Event): void {
    event.stopPropagation();
    this.expandedItems.update((set) => {
      const copy = new Set(set);
      copy.has(id) ? copy.delete(id) : copy.add(id);
      return copy;
    });
  }

  /* ── PAINEL DE DETALHE ── */
  readonly openItemId = signal<string | null>(this.route.snapshot.queryParamMap.get('item'));
  readonly currentOpenItem = computed(() => this.items()?.find((i) => i.id === this.openItemId()) ?? null);
  readonly currentOpenSubitems = computed(() =>
    this.openItemId() ? this.subitemsOf(this.openItemId()!) : [],
  );

  openItemPanel(id: string): void {
    this.openItemId.set(id);
    this.router.navigate([], { queryParams: { item: id }, queryParamsHandling: 'merge' });
  }

  closeItemPanel(): void {
    this.openItemId.set(null);
    this.router.navigate([], { queryParams: { item: null }, queryParamsHandling: 'merge' });
  }

  /* ── SELEÇÃO EM MASSA ── */
  readonly selectedIds = signal(new Set<string>());

  isSelected(id: string): boolean {
    return this.selectedIds().has(id);
  }

  toggleSelect(id: string, event: Event): void {
    event.stopPropagation();
    this.selectedIds.update((set) => {
      const copy = new Set(set);
      copy.has(id) ? copy.delete(id) : copy.add(id);
      return copy;
    });
  }

  clearSelection(): void {
    this.selectedIds.set(new Set());
  }

  async bulkSetStatus(status: PlanningStatus): Promise<void> {
    if (!status) return;
    await this.planningSvc.bulkUpdate([...this.selectedIds()], { status });
  }

  async bulkMoveToGroup(groupId: string): Promise<void> {
    if (!groupId) return;
    await this.planningSvc.bulkMoveGroup([...this.selectedIds()], groupId, this.selectedBoard());
    this.clearSelection();
  }

  async bulkDeleteSelected(): Promise<void> {
    const n = this.selectedIds().size;
    const ok = await this.confirmSvc.confirm({
      title: 'Excluir itens selecionados',
      message: `Excluir ${n} item(ns) selecionado(s) permanentemente? Essa ação não pode ser desfeita.`,
      confirmLabel: 'Excluir',
      danger: true,
    });
    if (!ok) return;
    await this.planningSvc.bulkDelete([...this.selectedIds()]);
    this.clearSelection();
  }

  /* ── DRAG AND DROP: GRUPOS ── */
  readonly draggingGroupId = signal<string | null>(null);
  readonly dragOverGroupHeaderId = signal<string | null>(null);

  onGroupDragStart(event: DragEvent, group: PlanningGroup): void {
    event.dataTransfer?.setData('application/x-plan-group', group.id);
    this.draggingGroupId.set(group.id);
  }

  onGroupDragOver(event: DragEvent, group: PlanningGroup): void {
    event.preventDefault();
    if (this.draggingGroupId()) this.dragOverGroupHeaderId.set(group.id);
  }

  onGroupDragEnd(): void {
    this.draggingGroupId.set(null);
    this.dragOverGroupHeaderId.set(null);
  }

  onGroupDrop(event: DragEvent, targetGroup: PlanningGroup): void {
    event.preventDefault();
    const draggedId = event.dataTransfer?.getData('application/x-plan-group');
    if (draggedId && draggedId !== targetGroup.id) this.moveGroup(draggedId, targetGroup.id);
    this.onGroupDragEnd();
  }

  private moveGroup(draggedId: string, beforeId: string | null): void {
    const dragged = this.sortedGroups().find((g) => g.id === draggedId);
    if (!dragged) return;
    const rest = this.sortedGroups().filter((g) => g.id !== draggedId);
    const idx = beforeId ? rest.findIndex((g) => g.id === beforeId) : -1;
    rest.splice(idx === -1 ? rest.length : idx, 0, dragged);
    this.planningSvc.reorderGroups(rest.map((g, i) => ({ id: g.id, ordem: i })));
  }

  /* ── DRAG AND DROP: ITENS (raiz e sub-itens) ── */
  readonly draggingItemId = signal<string | null>(null);
  readonly dragOverItemId = signal<string | null>(null);

  onRowDragStart(event: DragEvent, item: PlanningItem): void {
    event.dataTransfer?.setData('application/x-plan-item', item.id);
    this.draggingItemId.set(item.id);
  }

  onRowDragOver(event: DragEvent, item: PlanningItem): void {
    event.preventDefault();
    event.stopPropagation();
    if (this.draggingItemId() && this.draggingItemId() !== item.id) this.dragOverItemId.set(item.id);
  }

  onGroupBodyDragOver(event: DragEvent): void {
    event.preventDefault();
  }

  onRowDragEnd(): void {
    this.draggingItemId.set(null);
    this.dragOverItemId.set(null);
  }

  /**
   * Regras (mesma lógica do quadro original): soltar item raiz sobre item
   * raiz reordena; soltar sub-item sobre item raiz aninha como filho dele;
   * soltar sobre um sub-item vira irmão dele (mesmo grupo/pai do alvo).
   */
  onRowDrop(event: DragEvent, targetItem: PlanningItem): void {
    event.preventDefault();
    event.stopPropagation();
    const draggedId = event.dataTransfer?.getData('application/x-plan-item');
    if (draggedId && draggedId !== targetItem.id) {
      const dragged = (this.items() ?? []).find((i) => i.id === draggedId);
      if (dragged) {
        if (!targetItem.parentId) {
          if (!dragged.parentId) {
            this.moveItem(draggedId, targetItem.groupId, null, targetItem.id);
          } else {
            this.moveItem(draggedId, targetItem.groupId, targetItem.id, null);
          }
        } else {
          this.moveItem(draggedId, targetItem.groupId, targetItem.parentId, targetItem.id);
        }
      }
    }
    this.onRowDragEnd();
  }

  /** Soltar na área vazia do grupo (fora de qualquer linha): vira item raiz no fim dele. */
  onGroupBodyDrop(event: DragEvent, groupId: string): void {
    event.preventDefault();
    const draggedId = event.dataTransfer?.getData('application/x-plan-item');
    if (draggedId) this.moveItem(draggedId, groupId, null, null);
    this.onRowDragEnd();
  }

  private moveItem(draggedId: string, groupId: string, parentId: string | null, beforeId: string | null): void {
    const dragged = (this.items() ?? []).find((i) => i.id === draggedId);
    if (!dragged) return;
    const bucket = (this.items() ?? [])
      .filter((i) => i.groupId === groupId && (i.parentId ?? null) === parentId && i.id !== draggedId)
      .sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0));
    const insertIndex = beforeId ? bucket.findIndex((i) => i.id === beforeId) : -1;
    bucket.splice(insertIndex === -1 ? bucket.length : insertIndex, 0, dragged);
    const updates = bucket.map((i, idx) => ({
      id: i.id,
      ordem: idx,
      ...(i.id === draggedId ? { groupId, parentId } : {}),
    }));
    this.planningSvc.reorderItems(updates);
  }
}
