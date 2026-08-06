import { Component, Input, inject, signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { firstValueFrom, switchMap } from 'rxjs';
import { AuthService } from '../../core/auth.service';
import { KANBAN_COLUMNS, KanbanService } from '../../core/kanban.service';
import { KanbanCard, KanbanColumnKey } from '../../core/models';
import { ConfirmService } from '../confirm/confirm.service';

@Component({
  selector: 'app-kanban-board',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './kanban-board.component.html',
})
export class KanbanBoardComponent {
  private readonly auth = inject(AuthService);
  private readonly kanbanSvc = inject(KanbanService);
  private readonly confirmSvc = inject(ConfirmService);

  /** null = quadro geral (não vinculado a nenhum projeto). */
  @Input() set projectId(value: string | null | undefined) {
    this._projectId.set(value ?? null);
  }
  private readonly _projectId = signal<string | null>(null);

  readonly columns = KANBAN_COLUMNS;

  readonly cards = toSignal(
    toObservable(this._projectId).pipe(switchMap((pid) => this.kanbanSvc.cards$(pid))),
    { initialValue: [] as KanbanCard[] },
  );


  cardsFor(columnKey: KanbanColumnKey): KanbanCard[] {
    return this.cards()
      .filter((c) => c.columnKey === columnKey)
      .sort((a, b) => a.order - b.order);
  }

  /* ── ADICIONAR CARTÃO ── */
  readonly addingColumn = signal<KanbanColumnKey | null>(null);
  readonly newCardTitle = signal('');

  startAdd(columnKey: KanbanColumnKey): void {
    this.addingColumn.set(columnKey);
    this.newCardTitle.set('');
  }

  cancelAdd(): void {
    this.addingColumn.set(null);
    this.newCardTitle.set('');
  }

  async submitAdd(columnKey: KanbanColumnKey): Promise<void> {
    const title = this.newCardTitle().trim();
    if (!title) return;
    const nextOrder = this.cardsFor(columnKey).reduce((max, c) => Math.max(max, c.order), -1) + 1;
    const data = await firstValueFrom(this.auth.userData$);
    await this.kanbanSvc.create(this._projectId(), {
      columnKey,
      title,
      description: '',
      order: nextOrder,
      createdByName: data?.name || data?.email || 'Equipe',
    });
    this.newCardTitle.set('');
    this.addingColumn.set(null);
  }

  /* ── EDITAR CARTÃO ── */
  readonly editingCardId = signal<string | null>(null);
  readonly editTitle = signal('');
  readonly editDescription = signal('');

  startEdit(card: KanbanCard): void {
    this.editingCardId.set(card.id!);
    this.editTitle.set(card.title);
    this.editDescription.set(card.description || '');
  }

  cancelEdit(): void {
    this.editingCardId.set(null);
  }

  async saveEdit(card: KanbanCard): Promise<void> {
    const title = this.editTitle().trim();
    if (!title) return;
    await this.kanbanSvc.update(this._projectId(), card.id!, {
      title,
      description: this.editDescription().trim(),
    });
    this.editingCardId.set(null);
  }

  async deleteCard(card: KanbanCard): Promise<void> {
    const ok = await this.confirmSvc.confirm({
      title: 'Excluir cartão',
      message: `Excluir "${card.title}" permanentemente?`,
      confirmLabel: 'Excluir',
      danger: true,
    });
    if (!ok) return;
    await this.kanbanSvc.delete(this._projectId(), card.id!);
  }

  /* ── MOVER ENTRE COLUNAS ── */
  columnIndex(columnKey: KanbanColumnKey): number {
    return this.columns.findIndex((c) => c.key === columnKey);
  }

  canMove(columnKey: KanbanColumnKey, dir: -1 | 1): boolean {
    const idx = this.columnIndex(columnKey) + dir;
    return idx >= 0 && idx < this.columns.length;
  }

  async moveCard(card: KanbanCard, dir: -1 | 1): Promise<void> {
    const idx = this.columnIndex(card.columnKey) + dir;
    if (idx < 0 || idx >= this.columns.length) return;
    const targetColumn = this.columns[idx].key;
    const nextOrder = this.cardsFor(targetColumn).reduce((max, c) => Math.max(max, c.order), -1) + 1;
    await this.kanbanSvc.update(this._projectId(), card.id!, { columnKey: targetColumn, order: nextOrder });
  }

  /* ── DRAG AND DROP (HTML5 nativo) ── */
  readonly draggingCardId = signal<string | null>(null);
  readonly dragOverColumn = signal<KanbanColumnKey | null>(null);

  onDragStart(card: KanbanCard): void {
    this.draggingCardId.set(card.id!);
  }

  onDragEnd(): void {
    this.draggingCardId.set(null);
    this.dragOverColumn.set(null);
  }

  onColumnDragOver(event: DragEvent, columnKey: KanbanColumnKey): void {
    event.preventDefault();
    this.dragOverColumn.set(columnKey);
  }

  async onColumnDrop(event: DragEvent, columnKey: KanbanColumnKey): Promise<void> {
    event.preventDefault();
    this.dragOverColumn.set(null);
    const cardId = this.draggingCardId();
    this.draggingCardId.set(null);
    if (!cardId) return;
    const card = this.cards().find((c) => c.id === cardId);
    if (!card || card.columnKey === columnKey) return;
    const nextOrder = this.cardsFor(columnKey).reduce((max, c) => Math.max(max, c.order), -1) + 1;
    await this.kanbanSvc.update(this._projectId(), cardId, { columnKey, order: nextOrder });
  }
}
