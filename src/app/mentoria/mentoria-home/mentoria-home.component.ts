import { AsyncPipe, DatePipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { Timestamp } from 'firebase/firestore';
import { firstValueFrom } from 'rxjs';
import { AuthService } from '../../core/auth.service';
import { MentorshipService } from '../../core/mentorship.service';
import { CompetencyReassessment, Mentorship, MentorshipAction } from '../../core/models';
import { PnavComponent } from '../../shared/pnav/pnav.component';

@Component({
  selector: 'app-mentoria-home',
  standalone: true,
  imports: [AsyncPipe, DatePipe, FormsModule, PnavComponent],
  templateUrl: './mentoria-home.component.html',
})
export class MentoriaHomeComponent {
  private readonly auth = inject(AuthService);
  private readonly mentorshipSvc = inject(MentorshipService);

  readonly userData$ = this.auth.userData$;
  readonly uid = this.auth.currentUser!.uid;

  readonly mentorship = toSignal(this.mentorshipSvc.get$(this.uid), { initialValue: null as Mentorship | null });
  readonly actions = toSignal(this.mentorshipSvc.actions$(this.uid), { initialValue: [] as MentorshipAction[] });
  readonly reassessments = toSignal(this.mentorshipSvc.reassessments$(this.uid), { initialValue: [] as CompetencyReassessment[] });
  readonly messages$ = this.mentorshipSvc.messages$(this.uid);

  readonly pendingActions = () => this.actions().filter((a) => a.status !== 'concluida');
  readonly doneActions = () => this.actions().filter((a) => a.status === 'concluida');

  pct(value: number): number {
    return Math.round((Math.max(0, Math.min(5, value)) / 5) * 100);
  }

  toDate(value: unknown): Date {
    if (value instanceof Timestamp) return value.toDate();
    return new Date();
  }

  /* ── AÇÕES ── */
  readonly uploadingFor = signal<string | null>(null);
  readonly actionErr = signal('');

  async markDone(action: MentorshipAction): Promise<void> {
    await this.mentorshipSvc.updateActionProgress(this.uid, action.id, {
      status: 'concluida',
      evidenciaUrl: action.evidenciaUrl ?? null,
      evidenciaNome: action.evidenciaNome ?? null,
    });
  }

  async markPending(action: MentorshipAction): Promise<void> {
    await this.mentorshipSvc.updateActionProgress(this.uid, action.id, {
      status: 'pendente',
      evidenciaUrl: action.evidenciaUrl ?? null,
      evidenciaNome: action.evidenciaNome ?? null,
    });
  }

  async uploadEvidence(action: MentorshipAction, event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    this.actionErr.set('');
    this.uploadingFor.set(action.id);
    try {
      const { url } = await this.mentorshipSvc.uploadEvidence(this.uid, action.id, file);
      await this.mentorshipSvc.updateActionProgress(this.uid, action.id, {
        status: action.status,
        evidenciaUrl: url,
        evidenciaNome: file.name,
      });
    } catch {
      this.actionErr.set('Erro ao enviar o arquivo. Tente novamente.');
    } finally {
      this.uploadingFor.set(null);
      input.value = '';
    }
  }

  /* ── MENSAGENS ── */
  readonly messageText = signal('');

  async sendMessage(): Promise<void> {
    const text = this.messageText().trim();
    if (!text) return;
    this.messageText.set('');
    const data = await firstValueFrom(this.userData$);
    await this.mentorshipSvc.sendMessage(this.uid, data?.name || data?.email || 'Mentorado', 'mentorado', text);
  }
}
