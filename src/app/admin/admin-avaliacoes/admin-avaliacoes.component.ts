import { AsyncPipe, DatePipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { Timestamp } from 'firebase/firestore';
import { AssessmentsService } from '../../core/assessments.service';
import { AuthService } from '../../core/auth.service';
import { CandidatesService } from '../../core/candidates.service';
import { MentorshipService } from '../../core/mentorship.service';
import {
  AppliedAssessment,
  AssessmentAnswer,
  AssessmentQuestion,
  AssessmentQuestionType,
  AssessmentTargetType,
  AssessmentTemplate,
  Candidate,
  Mentorship,
} from '../../core/models';
import { ConfirmService } from '../../shared/confirm/confirm.service';
import { PnavComponent } from '../../shared/pnav/pnav.component';
import { ADMIN_TABS } from '../admin-tabs';

interface TemplateFormState {
  name: string;
  description: string;
  questions: AssessmentQuestion[];
}

function emptyTemplateForm(): TemplateFormState {
  return { name: '', description: '', questions: [] };
}

function toDate(value: unknown): Date {
  return value instanceof Timestamp ? value.toDate() : new Date(0);
}

@Component({
  selector: 'app-admin-avaliacoes',
  standalone: true,
  imports: [AsyncPipe, DatePipe, FormsModule, PnavComponent],
  templateUrl: './admin-avaliacoes.component.html',
})
export class AdminAvaliacoesComponent {
  private readonly auth = inject(AuthService);
  private readonly assessmentsSvc = inject(AssessmentsService);
  private readonly candidatesSvc = inject(CandidatesService);
  private readonly mentorshipSvc = inject(MentorshipService);
  private readonly confirmSvc = inject(ConfirmService);

  readonly tabs = ADMIN_TABS;
  readonly userData$ = this.auth.userData$;

  readonly templates = toSignal(this.assessmentsSvc.templates$(), { initialValue: [] as AssessmentTemplate[] });
  readonly applied = toSignal(this.assessmentsSvc.applied$(), { initialValue: [] as AppliedAssessment[] });
  readonly candidates = toSignal(this.candidatesSvc.listAll$(), { initialValue: [] as Candidate[] });
  readonly mentorships = toSignal(this.mentorshipSvc.listAll$(), { initialValue: [] as Mentorship[] });

  toDate = toDate;

  /* ── MODELOS (CRUD) ── */
  readonly templateModalOpen = signal(false);
  readonly editingTemplate = signal<AssessmentTemplate | null>(null);
  readonly templateForm = signal<TemplateFormState>(emptyTemplateForm());
  readonly savingTemplate = signal(false);
  readonly templateErr = signal('');

  openCreateTemplate(): void {
    this.editingTemplate.set(null);
    this.templateForm.set(emptyTemplateForm());
    this.templateErr.set('');
    this.templateModalOpen.set(true);
  }

  openEditTemplate(t: AssessmentTemplate): void {
    this.editingTemplate.set(t);
    this.templateForm.set({ name: t.name, description: t.description || '', questions: t.questions.map((q) => ({ ...q })) });
    this.templateErr.set('');
    this.templateModalOpen.set(true);
  }

  closeTemplateModal(): void {
    this.templateModalOpen.set(false);
  }

  updateTemplateName(name: string): void {
    this.templateForm.update((f) => ({ ...f, name }));
  }

  updateTemplateDescription(description: string): void {
    this.templateForm.update((f) => ({ ...f, description }));
  }

  addQuestion(type: AssessmentQuestionType): void {
    this.templateForm.update((f) => ({
      ...f,
      questions: [...f.questions, { id: crypto.randomUUID(), text: '', type }],
    }));
  }

  updateQuestionText(id: string, text: string): void {
    this.templateForm.update((f) => ({ ...f, questions: f.questions.map((q) => (q.id === id ? { ...q, text } : q)) }));
  }

  removeQuestion(id: string): void {
    this.templateForm.update((f) => ({ ...f, questions: f.questions.filter((q) => q.id !== id) }));
  }

  async saveTemplate(): Promise<void> {
    const f = this.templateForm();
    if (!f.name.trim()) {
      this.templateErr.set('O nome do modelo é obrigatório.');
      return;
    }
    if (!f.questions.length) {
      this.templateErr.set('Adicione ao menos uma pergunta.');
      return;
    }
    if (f.questions.some((q) => !q.text.trim())) {
      this.templateErr.set('Toda pergunta precisa de um texto.');
      return;
    }
    this.savingTemplate.set(true);
    this.templateErr.set('');
    try {
      const payload = { name: f.name.trim(), description: f.description.trim(), questions: f.questions };
      const editing = this.editingTemplate();
      if (editing) {
        await this.assessmentsSvc.updateTemplate(editing.id, payload);
      } else {
        await this.assessmentsSvc.createTemplate(payload);
      }
      this.templateModalOpen.set(false);
    } catch {
      this.templateErr.set('Erro ao salvar o modelo. Tente novamente.');
    } finally {
      this.savingTemplate.set(false);
    }
  }

  async deleteTemplate(t: AssessmentTemplate): Promise<void> {
    const ok = await this.confirmSvc.confirm({
      title: 'Excluir modelo de avaliação',
      message: `Excluir "${t.name}"? As avaliações já aplicadas com este modelo continuam no histórico.`,
      confirmLabel: 'Excluir',
      danger: true,
    });
    if (!ok) return;
    await this.assessmentsSvc.deleteTemplate(t.id);
  }

  /* ── APLICAR ── */
  readonly applyModalOpen = signal(false);
  readonly applyTargetType = signal<AssessmentTargetType>('candidate');
  readonly applyTargetId = signal('');
  readonly applyTemplateId = signal('');
  readonly applyAnswers = signal<Record<string, number | string>>({});
  readonly applyingAssessment = signal(false);
  readonly applyErr = signal('');

  readonly applyTargets = computed(() =>
    this.applyTargetType() === 'candidate'
      ? this.candidates().map((c) => ({ id: c.id, name: c.name }))
      : this.mentorships().map((m) => ({ id: m.uid, name: m.mentoradoName || m.uid })),
  );

  readonly applySelectedTemplate = computed(
    () => this.templates().find((t) => t.id === this.applyTemplateId()) || null,
  );

  openApplyModal(): void {
    this.applyTargetType.set('candidate');
    this.applyTargetId.set('');
    this.applyTemplateId.set('');
    this.applyAnswers.set({});
    this.applyErr.set('');
    this.applyModalOpen.set(true);
  }

  closeApplyModal(): void {
    this.applyModalOpen.set(false);
  }

  onApplyTargetTypeChange(type: AssessmentTargetType): void {
    this.applyTargetType.set(type);
    this.applyTargetId.set('');
  }

  onApplyTemplateChange(templateId: string): void {
    this.applyTemplateId.set(templateId);
    this.applyAnswers.set({});
  }

  setAnswer(questionId: string, value: number | string): void {
    this.applyAnswers.update((a) => ({ ...a, [questionId]: value }));
  }

  async submitApply(): Promise<void> {
    const template = this.applySelectedTemplate();
    const targetId = this.applyTargetId();
    if (!template || !targetId) {
      this.applyErr.set('Escolha quem vai ser avaliado e qual modelo usar.');
      return;
    }
    const answersMap = this.applyAnswers();
    const answers: AssessmentAnswer[] = template.questions.map((q) => ({
      questionId: q.id,
      questionText: q.text,
      type: q.type,
      value: q.type === 'escala' ? Number(answersMap[q.id]) || 0 : String(answersMap[q.id] || ''),
    }));
    if (answers.some((a) => a.type === 'escala' && !a.value)) {
      this.applyErr.set('Responda todas as perguntas de escala (1 a 5).');
      return;
    }
    const target = this.applyTargets().find((t) => t.id === targetId);

    this.applyingAssessment.set(true);
    this.applyErr.set('');
    try {
      const data = await firstValueFrom(this.userData$);
      await this.assessmentsSvc.applyAssessment({
        templateId: template.id,
        templateName: template.name,
        targetType: this.applyTargetType(),
        targetId,
        targetName: target?.name || targetId,
        answers,
        appliedByName: data?.name || data?.email || 'Equipe',
      });
      this.applyModalOpen.set(false);
    } catch {
      this.applyErr.set('Erro ao registrar a avaliação. Tente novamente.');
    } finally {
      this.applyingAssessment.set(false);
    }
  }

  /* ── HISTÓRICO ── */
  readonly expandedId = signal<string | null>(null);

  toggleExpand(id: string): void {
    this.expandedId.update((cur) => (cur === id ? null : id));
  }

  async deleteApplied(a: AppliedAssessment): Promise<void> {
    const ok = await this.confirmSvc.confirm({
      title: 'Excluir avaliação aplicada',
      message: `Excluir o registro de "${a.templateName}" aplicado a "${a.targetName}"? Esta ação não pode ser desfeita.`,
      confirmLabel: 'Excluir',
      danger: true,
    });
    if (!ok) return;
    await this.assessmentsSvc.deleteApplied(a.id);
  }
}
