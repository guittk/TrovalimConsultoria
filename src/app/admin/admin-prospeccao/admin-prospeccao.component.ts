import { AsyncPipe } from '@angular/common';
import { Component, computed, effect, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '../../core/auth.service';
import { EmpresasService } from '../../core/empresas.service';
import { ProjectsService } from '../../core/projects.service';
import { LeadsService, LEAD_STAGES } from '../../core/leads.service';
import { PricingSettingsService, PRICING_UNITS, DEFAULT_PRICING_SETTINGS } from '../../core/pricing-settings.service';
import { Lead, LeadStage } from '../../core/models';
import { PnavComponent } from '../../shared/pnav/pnav.component';
import { ADMIN_TABS } from '../admin-tabs';
import { ConfirmService } from '../../shared/confirm/confirm.service';

interface FormState {
  name: string;
  contactName: string;
  email: string;
  phone: string;
  valorEstimado: string;
  dor: string;
  diagnostico: string;
  escopo: string;
  condicoes: string;
  stage: LeadStage;
  lostReason: string;
}

function emptyForm(): FormState {
  return {
    name: '',
    contactName: '',
    email: '',
    phone: '',
    valorEstimado: '',
    dor: '',
    diagnostico: '',
    escopo: '',
    condicoes: '',
    stage: 'novo',
    lostReason: '',
  };
}

@Component({
  selector: 'app-admin-prospeccao',
  standalone: true,
  imports: [AsyncPipe, FormsModule, PnavComponent],
  templateUrl: './admin-prospeccao.component.html',
})
export class AdminProspeccaoComponent {
  private readonly auth = inject(AuthService);
  private readonly leadsSvc = inject(LeadsService);
  private readonly pricingSettingsSvc = inject(PricingSettingsService);
  private readonly empresasSvc = inject(EmpresasService);
  private readonly projectsSvc = inject(ProjectsService);
  private readonly confirmSvc = inject(ConfirmService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  readonly tabs = ADMIN_TABS;
  readonly userData$ = this.auth.userData$;
  readonly stages = LEAD_STAGES;

  readonly leads = toSignal(this.leadsSvc.listAll$(), { initialValue: [] as Lead[] });

  /**
   * `?lead=<id>` abre direto a prospecção criada a partir de um contato do
   * site (ver `admin-contacts.component.ts`). `seededFor` trava o efeito
   * numa única abertura por id — sem isso, qualquer atualização de `leads()`
   * reabriria o modal por cima de quem já estava editando.
   */
  private seededFor: string | null = null;
  constructor() {
    effect(() => {
      const id = this.route.snapshot.queryParamMap.get('lead');
      if (!id || id === this.seededFor) return;
      const lead = this.leads().find((l) => l.id === id);
      if (!lead) return;
      this.seededFor = id;
      this.openEdit(lead);
    });
  }

  leadsFor(stage: LeadStage): Lead[] {
    return this.leads().filter((l) => l.stage === stage);
  }

  totalFor(stage: LeadStage): number {
    return this.leadsFor(stage).reduce((sum, l) => sum + (l.valorEstimado || 0), 0);
  }

  formatCurrency(value: number | null | undefined): string {
    return (value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
  }

  /* ── ARRASTAR-E-SOLTAR ENTRE ESTÁGIOS ── */
  readonly draggingId = signal<string | null>(null);
  readonly dragOverStage = signal<LeadStage | null>(null);

  onDragStart(lead: Lead): void {
    this.draggingId.set(lead.id);
  }
  onDragEnd(): void {
    this.draggingId.set(null);
    this.dragOverStage.set(null);
  }
  onColumnDragOver(event: DragEvent, stage: LeadStage): void {
    event.preventDefault();
    this.dragOverStage.set(stage);
  }
  onColumnDragLeave(stage: LeadStage): void {
    if (this.dragOverStage() === stage) this.dragOverStage.set(null);
  }

  async onColumnDrop(event: DragEvent, stage: LeadStage): Promise<void> {
    event.preventDefault();
    this.dragOverStage.set(null);
    const id = this.draggingId();
    this.draggingId.set(null);
    if (!id) return;
    const lead = this.leads().find((l) => l.id === id);
    if (!lead || lead.stage === stage) return;
    if (stage === 'perdido') {
      // "Perdido" nunca é silencioso — abre o modal já nesse estágio, pedindo o motivo antes de gravar.
      this.openEdit(lead);
      this.updateForm('stage', 'perdido');
      return;
    }
    await this.leadsSvc.setStage(id, stage);
  }

  /* ── MODAL DE PROSPECÇÃO ── */
  readonly modalOpen = signal(false);
  readonly editingLead = signal<Lead | null>(null);
  readonly form = signal<FormState>(emptyForm());
  readonly saving = signal(false);
  readonly deleting = signal(false);
  readonly modalErr = signal('');
  readonly wonResult = signal<{ empresaId: string; projectId: string } | null>(null);

  /* ── CALCULADORA DE INVESTIMENTO ── */
  readonly pricingUnits = PRICING_UNITS;
  readonly pricingSettings = toSignal(this.pricingSettingsSvc.get$(), { initialValue: DEFAULT_PRICING_SETTINGS });
  readonly showCalc = signal(false);
  /** key do item de catálogo → quantidade escolhida (0 = fora da conta). */
  readonly calcQty = signal<Record<string, number>>({});

  calcQtyFor(key: string): number {
    return this.calcQty()[key] || 0;
  }

  setCalcQty(key: string, qty: number): void {
    this.calcQty.update((m) => ({ ...m, [key]: Math.max(0, qty) }));
  }

  readonly calcTotal = computed(() =>
    this.pricingSettings().items.reduce((sum, item) => sum + item.baseValue * this.calcQtyFor(item.key), 0),
  );

  toggleCalc(): void {
    this.showCalc.update((v) => !v);
  }

  useCalcTotal(): void {
    this.updateForm('valorEstimado', String(this.calcTotal()));
    this.showCalc.set(false);
  }

  openCreate(): void {
    this.editingLead.set(null);
    this.form.set(emptyForm());
    this.modalErr.set('');
    this.wonResult.set(null);
    this.showCalc.set(false);
    this.calcQty.set({});
    this.modalOpen.set(true);
  }

  openEdit(lead: Lead): void {
    this.editingLead.set(lead);
    this.form.set({
      name: lead.name,
      contactName: lead.contactName || '',
      email: lead.email || '',
      phone: lead.phone || '',
      valorEstimado: lead.valorEstimado ? String(lead.valorEstimado) : '',
      dor: lead.dor || '',
      diagnostico: lead.diagnostico || '',
      escopo: lead.escopo || '',
      condicoes: lead.condicoes || '',
      stage: lead.stage,
      lostReason: lead.lostReason || '',
    });
    this.modalErr.set('');
    this.wonResult.set(lead.empresaId && lead.projectId ? { empresaId: lead.empresaId, projectId: lead.projectId } : null);
    this.showCalc.set(false);
    this.calcQty.set({});
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
    if (f.stage === 'perdido' && !f.lostReason.trim()) {
      this.modalErr.set('Descreva o motivo — "perdido" sem motivo não ajuda ninguém a aprender.');
      return;
    }
    this.saving.set(true);
    this.modalErr.set('');
    try {
      const payload: Partial<Lead> = {
        name: f.name.trim(),
        contactName: f.contactName.trim(),
        email: f.email.trim(),
        phone: f.phone.trim(),
        valorEstimado: f.valorEstimado ? Number(f.valorEstimado) : null,
        dor: f.dor.trim(),
        diagnostico: f.diagnostico.trim(),
        escopo: f.escopo.trim(),
        condicoes: f.condicoes.trim(),
        stage: f.stage,
        lostReason: f.stage === 'perdido' ? f.lostReason.trim() : '',
      };
      const editing = this.editingLead();
      if (editing) {
        await this.leadsSvc.update(editing.id, payload);
      } else {
        await this.leadsSvc.create({ ...payload, source: 'manual' });
      }
      this.modalOpen.set(false);
    } catch {
      this.modalErr.set('Erro ao salvar a prospecção. Tente novamente.');
    } finally {
      this.saving.set(false);
    }
  }

  async handleDelete(): Promise<void> {
    const lead = this.editingLead();
    if (!lead) return;
    const ok = await this.confirmSvc.confirm({
      title: 'Excluir prospecção',
      message: `Excluir "${lead.name}" permanentemente?`,
      confirmLabel: 'Excluir',
      danger: true,
    });
    if (!ok) return;
    this.deleting.set(true);
    try {
      await this.leadsSvc.delete(lead.id);
      this.modalOpen.set(false);
    } finally {
      this.deleting.set(false);
    }
  }

  /**
   * Cria a Empresa + o Projeto já com o que a prospecção acumulou (escopo,
   * contato) e marca o lead como ganho, guardando os dois ids — a
   * prospecção precisa saber que já virou projeto, e ninguém precisa
   * redigitar o que já foi levantado aqui.
   */
  async markWon(): Promise<void> {
    const lead = this.editingLead();
    if (!lead) return;
    this.saving.set(true);
    this.modalErr.set('');
    try {
      const empresaId = await this.empresasSvc.create(lead.name);
      const projectId = await this.projectsSvc.create({
        name: lead.name,
        description: lead.escopo || lead.dor || '',
        clientName: lead.contactName || lead.name,
        clientEmail: lead.email || '',
        ownerId: empresaId,
        status: 'em-andamento',
        progress: 0,
        steps: [],
        branding: null,
      });
      await this.leadsSvc.update(lead.id, { stage: 'ganho', empresaId, projectId });
      this.wonResult.set({ empresaId, projectId });
      this.updateForm('stage', 'ganho');
    } catch {
      this.modalErr.set('Erro ao criar empresa e projeto. Tente novamente.');
    } finally {
      this.saving.set(false);
    }
  }

  goToProject(id: string): void {
    this.modalOpen.set(false);
    this.router.navigate(['/admin/projeto', id]);
  }
}
