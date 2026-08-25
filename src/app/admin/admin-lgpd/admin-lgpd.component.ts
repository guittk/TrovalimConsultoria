import { AsyncPipe, DatePipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { Timestamp } from 'firebase/firestore';
import { firstValueFrom } from 'rxjs';
import { AuditService, AUDIT_ACTION_LABELS } from '../../core/audit.service';
import { AuthService } from '../../core/auth.service';
import { CandidatesService } from '../../core/candidates.service';
import { AuditLogEntry, Candidate } from '../../core/models';
import { ConfirmService } from '../../shared/confirm/confirm.service';
import { PnavComponent } from '../../shared/pnav/pnav.component';
import { ADMIN_TABS } from '../admin-tabs';

interface RetentionRow {
  candidate: Candidate;
  createdDate: Date;
  dueDate: Date;
  overdueDays: number;
}

function toDate(value: unknown): Date {
  return value instanceof Timestamp ? value.toDate() : new Date(0);
}

function addMonths(date: Date, months: number): Date {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d;
}

const DAY_MS = 24 * 60 * 60 * 1000;

@Component({
  selector: 'app-admin-lgpd',
  standalone: true,
  imports: [AsyncPipe, DatePipe, PnavComponent],
  templateUrl: './admin-lgpd.component.html',
})
export class AdminLgpdComponent {
  private readonly auth = inject(AuthService);
  private readonly candidatesSvc = inject(CandidatesService);
  private readonly auditSvc = inject(AuditService);
  private readonly confirmSvc = inject(ConfirmService);

  readonly tabs = ADMIN_TABS;
  readonly userData$ = this.auth.userData$;

  readonly candidates = toSignal(this.candidatesSvc.listAll$(), { initialValue: [] as Candidate[] });
  readonly auditLog = toSignal(this.auditSvc.listAll$(), { initialValue: [] as AuditLogEntry[] });

  readonly withoutConsent = computed(() => this.candidates().filter((c) => !c.consentGiven));

  /**
   * Só "reprovado" entra na régua de retenção — quem foi contratado virou
   * relação de trabalho de verdade, não é mais só um registro de processo
   * seletivo esperando ser limpo. Sem retentionMonths definido, não há
   * prazo pra vencer.
   */
  readonly overdueRetention = computed<RetentionRow[]>(() => {
    const now = new Date();
    return this.candidates()
      .filter((c) => c.stage === 'reprovado' && c.retentionMonths)
      .map((c) => {
        const createdDate = toDate(c.createdAt);
        const dueDate = addMonths(createdDate, c.retentionMonths!);
        return { candidate: c, createdDate, dueDate, overdueDays: Math.floor((now.getTime() - dueDate.getTime()) / DAY_MS) };
      })
      .filter((r) => r.overdueDays > 0)
      .sort((a, b) => b.overdueDays - a.overdueDays);
  });

  readonly monitoredCount = computed(() => this.candidates().length);

  readonly actionLabels = AUDIT_ACTION_LABELS;
  readonly deletingId = signal<string | null>(null);
  readonly extendingId = signal<string | null>(null);

  async deleteData(row: RetentionRow): Promise<void> {
    const c = row.candidate;
    const ok = await this.confirmSvc.confirm({
      title: 'Excluir dado do candidato',
      message: `Excluir permanentemente o registro de "${c.name}" (currículo, notas, contato)? A retenção está vencida há ${row.overdueDays} dia(s). Esta ação não pode ser desfeita.`,
      confirmLabel: 'Excluir dado',
      danger: true,
    });
    if (!ok) return;

    this.deletingId.set(c.id);
    try {
      const actor = await this.currentActor();
      await this.candidatesSvc.delete(c);
      await this.auditSvc.log({
        action: 'candidate.delete',
        targetType: 'candidate',
        targetId: c.id,
        targetName: c.name,
        details: `Retenção vencida há ${row.overdueDays} dia(s) (${c.retentionMonths} meses desde ${row.createdDate.toLocaleDateString('pt-BR')}).`,
        actorUid: actor.uid,
        actorName: actor.name,
      });
    } finally {
      this.deletingId.set(null);
    }
  }

  async extendRetention(row: RetentionRow): Promise<void> {
    const c = row.candidate;
    const extra = window.prompt('Estender a retenção por quantos meses a partir de hoje?', '6');
    const months = extra ? parseInt(extra, 10) : NaN;
    if (!months || months <= 0) return;

    this.extendingId.set(c.id);
    try {
      const monthsSinceCreated = Math.ceil((Date.now() - row.createdDate.getTime()) / (30 * DAY_MS)) + months;
      const actor = await this.currentActor();
      await this.candidatesSvc.update(c.id, { retentionMonths: monthsSinceCreated });
      await this.auditSvc.log({
        action: 'candidate.retention-extend',
        targetType: 'candidate',
        targetId: c.id,
        targetName: c.name,
        details: `Retenção estendida por mais ${months} mês(es) a partir de hoje.`,
        actorUid: actor.uid,
        actorName: actor.name,
      });
    } finally {
      this.extendingId.set(null);
    }
  }

  toDate(value: unknown): Date {
    return toDate(value);
  }

  private async currentActor(): Promise<{ uid: string; name: string }> {
    const uid = this.auth.currentUser?.uid || '';
    const data = await firstValueFrom(this.userData$);
    return { uid, name: data?.name || data?.email || 'Equipe' };
  }
}
