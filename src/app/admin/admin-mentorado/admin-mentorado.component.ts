import { AsyncPipe, DatePipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { AuthService } from '../../core/auth.service';
import { AccountsService } from '../../core/accounts.service';
import { MentoriaService } from '../../core/mentoria.service';
import { MentorshipActivity, MentorshipActivityStatus } from '../../core/models';
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

@Component({
  selector: 'app-admin-mentorado',
  standalone: true,
  imports: [AsyncPipe, DatePipe, FormsModule, RouterLink, PnavComponent],
  templateUrl: './admin-mentorado.component.html',
})
export class AdminMentoradoComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly auth = inject(AuthService);
  private readonly accountsSvc = inject(AccountsService);
  private readonly mentoriaSvc = inject(MentoriaService);
  private readonly confirmSvc = inject(ConfirmService);

  readonly tabs = ADMIN_TABS;
  readonly userData$ = this.auth.userData$;
  readonly muid = this.route.snapshot.paramMap.get('uid')!;

  readonly mentorado = toSignal(this.accountsSvc.get$(this.muid), { initialValue: null });
  readonly activities = toSignal(this.mentoriaSvc.activitiesFor$(this.muid), {
    initialValue: [] as MentorshipActivity[],
  });

  /* ── FORMULÁRIO (criar/editar) ── */
  readonly formOpen = signal(false);
  readonly editingId = signal<string | null>(null);
  readonly title = signal('');
  readonly description = signal('');
  readonly dueDate = signal('');
  readonly formErr = signal('');
  readonly saving = signal(false);

  openCreate(): void {
    this.editingId.set(null);
    this.title.set('');
    this.description.set('');
    this.dueDate.set('');
    this.formErr.set('');
    this.formOpen.set(true);
  }

  openEdit(a: MentorshipActivity): void {
    this.editingId.set(a.id!);
    this.title.set(a.title || '');
    this.description.set(a.description || '');
    this.dueDate.set(a.dueDate || '');
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
    this.formErr.set('');
    this.saving.set(true);
    try {
      const editingId = this.editingId();
      if (editingId) {
        await this.mentoriaSvc.update(editingId, {
          title,
          description: this.description().trim(),
          dueDate: this.dueDate() || null,
        });
      } else {
        const data = await firstValueFrom(this.userData$);
        await this.mentoriaSvc.create({
          mentoradoUid: this.muid,
          title,
          description: this.description().trim(),
          dueDate: this.dueDate() || null,
          status: 'pendente',
          createdByName: data?.name || data?.email || 'Equipe',
        });
      }
      this.formOpen.set(false);
    } catch {
      this.formErr.set('Erro ao salvar. Tente novamente.');
    } finally {
      this.saving.set(false);
    }
  }

  async setStatus(a: MentorshipActivity, status: MentorshipActivityStatus): Promise<void> {
    await this.mentoriaSvc.update(a.id!, { status });
  }

  async deleteActivity(a: MentorshipActivity): Promise<void> {
    const ok = await this.confirmSvc.confirm({
      title: 'Excluir atividade',
      message: `Excluir "${a.title}" permanentemente?`,
      confirmLabel: 'Excluir',
      danger: true,
    });
    if (!ok) return;
    await this.mentoriaSvc.delete(a.id!);
  }

  toDate(value: unknown): Date {
    return this.mentoriaSvc.toDate(value);
  }
}
