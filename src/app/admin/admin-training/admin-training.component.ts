import { AsyncPipe, DatePipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { Timestamp } from 'firebase/firestore';
import { firstValueFrom } from 'rxjs';
import { AuthService } from '../../core/auth.service';
import { TrainingMaterialsService } from '../../core/training-materials.service';
import { TrainingMaterial } from '../../core/models';
import { PnavComponent, PnavTab } from '../../shared/pnav/pnav.component';
import { ConfirmService } from '../../shared/confirm/confirm.service';

const ADMIN_TABS: PnavTab[] = [
  { key: 'projetos', label: 'Projetos', path: '/admin' },
  { key: 'clientes', label: 'Empresas', path: '/admin/clientes' },
  { key: 'mentoria', label: 'Mentoria', path: '/admin/mentoria' },
  { key: 'contas', label: 'Contas', path: '/admin/contas' },
  { key: 'kanban', label: 'Kanban', path: '/admin/kanban' },
  { key: 'treinamentos', label: 'Treinamentos', path: '/admin/treinamentos' },
  { key: 'config', label: 'Configurações', path: '/admin/config' },
];

type MaterialType = 'text' | 'video';

@Component({
  selector: 'app-admin-training',
  standalone: true,
  imports: [AsyncPipe, DatePipe, FormsModule, PnavComponent],
  templateUrl: './admin-training.component.html',
})
export class AdminTrainingComponent {
  private readonly auth = inject(AuthService);
  private readonly trainingSvc = inject(TrainingMaterialsService);
  private readonly confirmSvc = inject(ConfirmService);

  readonly tabs = ADMIN_TABS;
  readonly userData$ = this.auth.userData$;

  readonly materials = toSignal(this.trainingSvc.listAll$(), { initialValue: [] as TrainingMaterial[] });

  /* ── FORMULÁRIO (criar/editar) ── */
  readonly formOpen = signal(false);
  readonly editingId = signal<string | null>(null);
  readonly title = signal('');
  readonly description = signal('');
  readonly type = signal<MaterialType>('text');
  readonly content = signal('');
  readonly videoUrl = signal('');
  readonly formErr = signal('');
  readonly saving = signal(false);

  openCreate(): void {
    this.editingId.set(null);
    this.title.set('');
    this.description.set('');
    this.type.set('text');
    this.content.set('');
    this.videoUrl.set('');
    this.formErr.set('');
    this.formOpen.set(true);
  }

  openEdit(m: TrainingMaterial): void {
    this.editingId.set(m.id!);
    this.title.set(m.title || '');
    this.description.set(m.description || '');
    this.type.set(m.type === 'video' ? 'video' : 'text');
    this.content.set(m.content || '');
    this.videoUrl.set(m.videoUrl || '');
    this.formErr.set('');
    this.formOpen.set(true);
  }

  closeForm(): void {
    this.formOpen.set(false);
  }

  async save(): Promise<void> {
    const title = this.title().trim();
    if (!title) {
      this.formErr.set('O título é obrigatório.');
      return;
    }
    if (this.type() === 'video' && !this.videoUrl().trim()) {
      this.formErr.set('Informe a URL do vídeo.');
      return;
    }
    this.formErr.set('');
    this.saving.set(true);
    try {
      const data: Omit<TrainingMaterial, 'id' | 'createdAt'> = {
        title,
        description: this.description().trim(),
        type: this.type(),
        content: this.type() === 'text' ? this.content().trim() : '',
        videoUrl: this.type() === 'video' ? this.videoUrl().trim() : '',
      };
      const editingId = this.editingId();
      if (editingId) {
        await this.trainingSvc.update(editingId, data);
      } else {
        const data2 = await firstValueFrom(this.userData$);
        await this.trainingSvc.create({ ...data, createdByName: data2?.name || data2?.email || 'Equipe' });
      }
      this.formOpen.set(false);
    } catch {
      this.formErr.set('Erro ao salvar. Tente novamente.');
    } finally {
      this.saving.set(false);
    }
  }

  async deleteMaterial(m: TrainingMaterial): Promise<void> {
    const ok = await this.confirmSvc.confirm({
      title: 'Excluir material',
      message: `Excluir "${m.title}" permanentemente?`,
      confirmLabel: 'Excluir',
      danger: true,
    });
    if (!ok) return;
    await this.trainingSvc.delete(m.id!);
  }

  toDate(value: unknown): Date {
    if (value instanceof Timestamp) return value.toDate();
    return new Date();
  }
}
