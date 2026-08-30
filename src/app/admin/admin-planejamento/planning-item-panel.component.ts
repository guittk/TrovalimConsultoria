import { Component, EventEmitter, Input, Output, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { PlanningService } from '../../core/planning.service';
import { PlanningAttachment, PlanningItem, UserAccount } from '../../core/models';
import { ConfirmService } from '../../shared/confirm/confirm.service';
import { PlanningStatusSelectComponent } from './planning-status-select.component';
import { PlanningAssigneeSelectComponent } from './planning-assignee-select.component';
import { PlanningPriorityStarsComponent } from './planning-priority-stars.component';

/** Drawer lateral de detalhe de um item (ou sub-item) — nome, status, prioridade, prazo, descrição, responsáveis, anexos, sub-itens. */
@Component({
  selector: 'app-planning-item-panel',
  standalone: true,
  imports: [FormsModule, PlanningStatusSelectComponent, PlanningAssigneeSelectComponent, PlanningPriorityStarsComponent],
  templateUrl: './planning-item-panel.component.html',
})
export class PlanningItemPanelComponent {
  private readonly planningSvc = inject(PlanningService);
  private readonly confirmSvc = inject(ConfirmService);

  @Input({ required: true }) item!: PlanningItem;
  @Input() subitems: PlanningItem[] = [];
  @Input() staff: UserAccount[] = [];
  @Output() closed = new EventEmitter<void>();
  @Output() deleted = new EventEmitter<string>();

  readonly uploading = signal(false);
  readonly uploadErr = signal('');
  readonly newSubitemName = signal('');

  update(data: Partial<PlanningItem>): void {
    this.planningSvc.updateItem(this.item.id, data);
  }

  onNameBlur(value: string): void {
    const nome = value.trim();
    if (nome && nome !== this.item.nome) this.update({ nome });
  }

  onDescricaoBlur(value: string): void {
    if (value !== (this.item.descricao ?? '')) this.update({ descricao: value });
  }

  addSubitem(): void {
    const nome = this.newSubitemName().trim();
    if (!nome) return;
    this.planningSvc.createItem({
      projectId: this.item.projectId,
      groupId: this.item.groupId,
      parentId: this.item.id,
      nome,
      status: 'backlog',
      ordem: this.subitems.length,
    });
    this.newSubitemName.set('');
  }

  toggleSubitemDone(sub: PlanningItem): void {
    this.planningSvc.updateItem(sub.id, { status: sub.status === 'done' ? 'todo' : 'done' });
  }

  async removeSubitem(sub: PlanningItem): Promise<void> {
    const ok = await this.confirmSvc.confirm({
      title: 'Excluir sub-item',
      message: `Excluir "${sub.nome}"? Essa ação não pode ser desfeita.`,
      confirmLabel: 'Excluir',
      danger: true,
    });
    if (!ok) return;
    await this.planningSvc.deleteItem(sub.id);
  }

  async handleUpload(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    this.uploadErr.set('');
    this.uploading.set(true);
    try {
      const anexo = await this.planningSvc.uploadAttachment(this.item.id, file);
      await this.update({ anexos: [...(this.item.anexos ?? []), anexo] });
    } catch {
      this.uploadErr.set('Não foi possível enviar o arquivo.');
    } finally {
      this.uploading.set(false);
      input.value = '';
    }
  }

  removeAttachment(anexo: PlanningAttachment): void {
    this.planningSvc.deleteAttachment(this.item, anexo);
  }

  async handleDelete(): Promise<void> {
    const ok = await this.confirmSvc.confirm({
      title: this.item.parentId ? 'Excluir sub-item' : 'Excluir item',
      message: `Excluir "${this.item.nome}" permanentemente${this.subitems.length ? ' (junto com os sub-itens)' : ''}? Essa ação não pode ser desfeita.`,
      confirmLabel: 'Excluir',
      danger: true,
    });
    if (!ok) return;
    await this.planningSvc.deleteItem(this.item.id);
    this.deleted.emit(this.item.id);
    this.closed.emit();
  }

  close(): void {
    this.closed.emit();
  }
}
