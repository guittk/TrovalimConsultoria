import { AsyncPipe, DatePipe } from '@angular/common';
import { Component, effect, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Timestamp } from 'firebase/firestore';
import { firstValueFrom } from 'rxjs';
import { AuthService } from '../../core/auth.service';
import { AccountsService } from '../../core/accounts.service';
import { MentorshipService } from '../../core/mentorship.service';
import {
  CompetencyReassessment,
  MentorshipAction,
  MentorshipActionCategory,
  MentorshipCompetency,
  UserAccount,
} from '../../core/models';
import { initials } from '../../shared/initials';
import { PnavComponent } from '../../shared/pnav/pnav.component';
import { ADMIN_TABS } from '../admin-tabs';
import { ConfirmService } from '../../shared/confirm/confirm.service';

type TabKey = 'plano' | 'acoes' | 'notas' | 'mensagens';

interface ActionFormState {
  titulo: string;
  comoFazer: string;
  prazo: string;
  evidenciaEsperada: string;
  categoria: MentorshipActionCategory | '';
}

function emptyActionForm(): ActionFormState {
  return { titulo: '', comoFazer: '', prazo: '', evidenciaEsperada: '', categoria: '' };
}

@Component({
  selector: 'app-admin-mentoria-detail',
  standalone: true,
  imports: [AsyncPipe, DatePipe, FormsModule, RouterLink, PnavComponent],
  templateUrl: './admin-mentoria-detail.component.html',
})
export class AdminMentoriaDetailComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly auth = inject(AuthService);
  private readonly accountsSvc = inject(AccountsService);
  private readonly mentorshipSvc = inject(MentorshipService);
  private readonly confirmSvc = inject(ConfirmService);

  readonly tabs = ADMIN_TABS;
  readonly userData$ = this.auth.userData$;
  readonly uid = this.route.snapshot.paramMap.get('uid')!;
  readonly activeTab = signal<TabKey>('plano');

  readonly mentee = toSignal(this.accountsSvc.get$(this.uid), { initialValue: null as UserAccount | null });
  readonly mentorship = toSignal(this.mentorshipSvc.get$(this.uid), { initialValue: null });
  readonly actions = toSignal(this.mentorshipSvc.actions$(this.uid), { initialValue: [] as MentorshipAction[] });
  readonly reassessments = toSignal(this.mentorshipSvc.reassessments$(this.uid), { initialValue: [] as CompetencyReassessment[] });
  readonly internalNotesSaved = toSignal(this.mentorshipSvc.internalNotes$(this.uid), { initialValue: '' });
  readonly messages$ = this.mentorshipSvc.messages$(this.uid);

  initials(name: string): string {
    return initials(name);
  }

  /* ── PLANO (objetivo + competências) ── */
  readonly objetivo = signal('');
  readonly competencias = signal<MentorshipCompetency[]>([]);
  readonly savingPlano = signal(false);
  readonly planoOk = signal(false);
  private planoSeeded = false;

  constructor() {
    effect(() => {
      const m = this.mentorship();
      if (m && !this.planoSeeded) {
        this.planoSeeded = true;
        this.objetivo.set(m.objetivo || '');
        this.competencias.set((m.competencias || []).map((c) => ({ ...c })));
      }
    });
    effect(() => this.internalNotes.set(this.internalNotesSaved()));
  }

  addCompetencia(): void {
    this.competencias.update((rows) => [...rows, { id: crypto.randomUUID(), nome: '', atual: 1, desejado: 3 }]);
  }

  removeCompetencia(id: string): void {
    this.competencias.update((rows) => rows.filter((r) => r.id !== id));
  }

  updateCompetencia<K extends keyof MentorshipCompetency>(id: string, field: K, value: MentorshipCompetency[K]): void {
    this.competencias.update((rows) => rows.map((r) => (r.id === id ? { ...r, [field]: value } : r)));
  }

  pct(value: number): number {
    return Math.round((Math.max(0, Math.min(5, value)) / 5) * 100);
  }

  async savePlano(): Promise<void> {
    this.savingPlano.set(true);
    try {
      await this.mentorshipSvc.update(this.uid, {
        objetivo: this.objetivo().trim(),
        competencias: this.competencias(),
        mentoradoName: this.mentee()?.name || this.mentee()?.email || '',
      });
      this.planoOk.set(true);
      setTimeout(() => this.planoOk.set(false), 3000);
    } finally {
      this.savingPlano.set(false);
    }
  }

  /**
   * Fotografa o "atual" de cada competência de hoje num documento novo —
   * nunca sobrescreve uma reavaliação anterior — e SÓ DEPOIS abre os
   * campos "atual" pra edição, prontos pra registrar onde a pessoa está
   * agora. Sem o snapshot antes, editar o valor perderia o histórico.
   */
  readonly reassessing = signal(false);

  async reassessNow(): Promise<void> {
    const comps = this.competencias();
    if (!comps.length) return;
    this.reassessing.set(true);
    try {
      const values: Record<string, number> = {};
      for (const c of comps) values[c.id] = c.atual;
      await this.mentorshipSvc.createReassessment(this.uid, new Date().toISOString().slice(0, 10), values);
    } finally {
      this.reassessing.set(false);
    }
  }

  /* ── AÇÕES ── */
  readonly modalOpen = signal(false);
  readonly editingAction = signal<MentorshipAction | null>(null);
  readonly form = signal<ActionFormState>(emptyActionForm());
  readonly saving = signal(false);
  readonly deleting = signal(false);
  readonly modalErr = signal('');

  openCreateAction(): void {
    this.editingAction.set(null);
    this.form.set(emptyActionForm());
    this.modalErr.set('');
    this.modalOpen.set(true);
  }

  openEditAction(a: MentorshipAction): void {
    this.editingAction.set(a);
    this.form.set({
      titulo: a.titulo,
      comoFazer: a.comoFazer || '',
      prazo: a.prazo || '',
      evidenciaEsperada: a.evidenciaEsperada || '',
      categoria: a.categoria || '',
    });
    this.modalErr.set('');
    this.modalOpen.set(true);
  }

  closeModal(): void {
    this.modalOpen.set(false);
  }

  updateForm<K extends keyof ActionFormState>(key: K, value: ActionFormState[K]): void {
    this.form.update((f) => ({ ...f, [key]: value }));
  }

  async handleSaveAction(): Promise<void> {
    const f = this.form();
    if (!f.titulo.trim()) {
      this.modalErr.set('O título é obrigatório.');
      return;
    }
    this.saving.set(true);
    this.modalErr.set('');
    try {
      const payload = {
        titulo: f.titulo.trim(),
        comoFazer: f.comoFazer.trim(),
        prazo: f.prazo || null,
        evidenciaEsperada: f.evidenciaEsperada.trim(),
        categoria: f.categoria || null,
      };
      const editing = this.editingAction();
      if (editing) {
        await this.mentorshipSvc.updateAction(this.uid, editing.id, payload);
      } else {
        await this.mentorshipSvc.createAction(this.uid, { ...payload, status: 'pendente' });
      }
      this.modalOpen.set(false);
    } catch {
      this.modalErr.set('Erro ao salvar a ação. Tente novamente.');
    } finally {
      this.saving.set(false);
    }
  }

  async handleDeleteAction(): Promise<void> {
    const a = this.editingAction();
    if (!a) return;
    const ok = await this.confirmSvc.confirm({
      title: 'Excluir ação',
      message: `Excluir "${a.titulo}" permanentemente?`,
      confirmLabel: 'Excluir',
      danger: true,
    });
    if (!ok) return;
    this.deleting.set(true);
    try {
      await this.mentorshipSvc.deleteAction(this.uid, a.id);
      this.modalOpen.set(false);
    } finally {
      this.deleting.set(false);
    }
  }

  /* ── NOTAS INTERNAS ── */
  readonly internalNotes = signal('');
  readonly savingNotes = signal(false);
  readonly notesOk = signal(false);

  async saveNotes(): Promise<void> {
    this.savingNotes.set(true);
    try {
      await this.mentorshipSvc.updateInternalNotes(this.uid, this.internalNotes());
      this.notesOk.set(true);
      setTimeout(() => this.notesOk.set(false), 3000);
    } finally {
      this.savingNotes.set(false);
    }
  }

  /* ── MENSAGENS ── */
  readonly messageText = signal('');

  async sendMessage(): Promise<void> {
    const text = this.messageText().trim();
    if (!text) return;
    this.messageText.set('');
    const data = await firstValueFrom(this.userData$);
    await this.mentorshipSvc.sendMessage(this.uid, data?.name || data?.email || 'Equipe', 'admin', text);
  }

  toDate(value: unknown): Date {
    if (value instanceof Timestamp) return value.toDate();
    return new Date();
  }
}
