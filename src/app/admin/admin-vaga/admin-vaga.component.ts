import { AsyncPipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth.service';
import { VagasService } from '../../core/vagas.service';
import { CandidatesService, CANDIDATE_STAGES } from '../../core/candidates.service';
import { Candidate, CandidateStage, Vaga } from '../../core/models';
import { PnavComponent } from '../../shared/pnav/pnav.component';
import { ADMIN_TABS } from '../admin-tabs';
import { ConfirmService } from '../../shared/confirm/confirm.service';

interface FormState {
  name: string;
  email: string;
  phone: string;
  linkedinUrl: string;
  notes: string;
  stage: CandidateStage;
  consentGiven: boolean;
  retentionMonths: string;
  clientVisible: boolean;
}

function emptyForm(): FormState {
  return {
    name: '',
    email: '',
    phone: '',
    linkedinUrl: '',
    notes: '',
    stage: 'triagem',
    consentGiven: false,
    retentionMonths: '12',
    clientVisible: false,
  };
}

@Component({
  selector: 'app-admin-vaga',
  standalone: true,
  imports: [AsyncPipe, FormsModule, RouterLink, PnavComponent],
  templateUrl: './admin-vaga.component.html',
})
export class AdminVagaComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly auth = inject(AuthService);
  private readonly vagasSvc = inject(VagasService);
  private readonly candidatesSvc = inject(CandidatesService);
  private readonly confirmSvc = inject(ConfirmService);

  readonly tabs = ADMIN_TABS;
  readonly userData$ = this.auth.userData$;
  readonly stages = CANDIDATE_STAGES;

  readonly vid = this.route.snapshot.paramMap.get('id')!;
  readonly vaga = toSignal(this.vagasSvc.get$(this.vid), { initialValue: null as Vaga | null });
  readonly candidates = toSignal(this.candidatesSvc.listForVaga$(this.vid), { initialValue: [] as Candidate[] });

  candidatesFor(stage: CandidateStage): Candidate[] {
    return this.candidates().filter((c) => c.stage === stage);
  }

  /* ── ARRASTAR-E-SOLTAR ENTRE ESTÁGIOS ── */
  readonly draggingId = signal<string | null>(null);
  readonly dragOverStage = signal<CandidateStage | null>(null);

  onDragStart(c: Candidate): void {
    this.draggingId.set(c.id);
  }
  onDragEnd(): void {
    this.draggingId.set(null);
    this.dragOverStage.set(null);
  }
  onColumnDragOver(event: DragEvent, stage: CandidateStage): void {
    event.preventDefault();
    this.dragOverStage.set(stage);
  }
  onColumnDragLeave(stage: CandidateStage): void {
    if (this.dragOverStage() === stage) this.dragOverStage.set(null);
  }
  async onColumnDrop(event: DragEvent, stage: CandidateStage): Promise<void> {
    event.preventDefault();
    this.dragOverStage.set(null);
    const id = this.draggingId();
    this.draggingId.set(null);
    if (!id) return;
    const c = this.candidates().find((x) => x.id === id);
    if (!c || c.stage === stage) return;
    await this.candidatesSvc.update(id, { stage });
  }

  /* ── MODAL DE CANDIDATO ── */
  readonly modalOpen = signal(false);
  readonly editingCandidate = signal<Candidate | null>(null);
  readonly form = signal<FormState>(emptyForm());
  readonly saving = signal(false);
  readonly deleting = signal(false);
  readonly modalErr = signal('');
  readonly uploadingResume = signal(false);
  readonly uploadErr = signal('');

  openCreate(): void {
    this.editingCandidate.set(null);
    this.form.set(emptyForm());
    this.modalErr.set('');
    this.uploadErr.set('');
    this.modalOpen.set(true);
  }

  openEdit(c: Candidate): void {
    this.editingCandidate.set(c);
    this.form.set({
      name: c.name,
      email: c.email || '',
      phone: c.phone || '',
      linkedinUrl: c.linkedinUrl || '',
      notes: c.notes || '',
      stage: c.stage,
      consentGiven: c.consentGiven,
      retentionMonths: c.retentionMonths != null ? String(c.retentionMonths) : '12',
      clientVisible: !!c.clientVisible,
    });
    this.modalErr.set('');
    this.uploadErr.set('');
    this.modalOpen.set(true);
  }

  closeModal(): void {
    this.modalOpen.set(false);
  }

  updateForm<K extends keyof FormState>(key: K, value: FormState[K]): void {
    this.form.update((f) => ({ ...f, [key]: value }));
  }

  async handleSave(): Promise<void> {
    const f = this.form();
    if (!f.name.trim()) {
      this.modalErr.set('O nome é obrigatório.');
      return;
    }
    if (!f.consentGiven) {
      this.modalErr.set('É preciso registrar o consentimento antes de guardar dado deste candidato.');
      return;
    }
    this.saving.set(true);
    this.modalErr.set('');
    try {
      const editing = this.editingCandidate();
      const payload: Partial<Candidate> = {
        name: f.name.trim(),
        email: f.email.trim(),
        phone: f.phone.trim(),
        linkedinUrl: f.linkedinUrl.trim(),
        notes: f.notes.trim(),
        stage: f.stage,
        consentGiven: f.consentGiven,
        consentDate: f.consentGiven ? (editing?.consentDate ?? new Date().toISOString().slice(0, 10)) : null,
        retentionMonths: f.retentionMonths ? Number(f.retentionMonths) : null,
        clientVisible: f.clientVisible,
      };
      if (editing) {
        await this.candidatesSvc.update(editing.id, payload);
      } else {
        await this.candidatesSvc.create({
          ...payload,
          vagaId: this.vid,
          projectId: this.vaga()?.projectId ?? null,
        } as Omit<Candidate, 'id' | 'createdAt'>);
      }
      this.modalOpen.set(false);
    } catch {
      this.modalErr.set('Erro ao salvar o candidato. Tente novamente.');
    } finally {
      this.saving.set(false);
    }
  }

  async handleDelete(): Promise<void> {
    const c = this.editingCandidate();
    if (!c) return;
    const ok = await this.confirmSvc.confirm({
      title: 'Excluir candidato',
      message: `Excluir "${c.name}" e o currículo enviado permanentemente?`,
      confirmLabel: 'Excluir',
      danger: true,
    });
    if (!ok) return;
    this.deleting.set(true);
    try {
      await this.candidatesSvc.delete(c);
      this.modalOpen.set(false);
    } finally {
      this.deleting.set(false);
    }
  }

  async handleUploadResume(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    const editing = this.editingCandidate();
    if (!file || !editing) return;
    this.uploadErr.set('');
    this.uploadingResume.set(true);
    try {
      const { path, url } = await this.candidatesSvc.uploadResume(editing.id, file);
      await this.candidatesSvc.update(editing.id, { resumePath: path, resumeUrl: url });
      this.editingCandidate.set({ ...editing, resumePath: path, resumeUrl: url });
    } catch {
      this.uploadErr.set('Erro ao enviar o currículo. Tente novamente.');
    } finally {
      this.uploadingResume.set(false);
      input.value = '';
    }
  }
}
