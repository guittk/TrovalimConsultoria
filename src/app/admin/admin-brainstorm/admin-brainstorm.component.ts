import { AsyncPipe } from '@angular/common';
import { Component, computed, effect, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Functions, httpsCallable } from 'firebase/functions';
import { AuthService } from '../../core/auth.service';
import { LeadsService } from '../../core/leads.service';
import { FIREBASE_FUNCTIONS } from '../../core/firebase.providers';
import { Lead, ProspectSuggestion } from '../../core/models';
import { PnavComponent } from '../../shared/pnav/pnav.component';
import { SelectComponent } from '../../shared/select/select.component';
import { ADMIN_TABS } from '../admin-tabs';

/**
 * Brainstorm de prospecção — antes era um card embutido no modal de
 * Nova/Editar Prospecção; agora é uma tela própria, usável avulsa (sem
 * lead nenhum, só pra explorar) ou vinculada a uma Prospecção específica
 * via `?lead=<id>` na URL (mesmo link que `admin-prospeccao.component.ts`
 * já usa pra abrir um lead direto, ver `route.snapshot.queryParamMap`).
 */
@Component({
  selector: 'app-admin-brainstorm',
  standalone: true,
  imports: [AsyncPipe, FormsModule, PnavComponent, SelectComponent],
  templateUrl: './admin-brainstorm.component.html',
})
export class AdminBrainstormComponent {
  private readonly auth = inject(AuthService);
  private readonly leadsSvc = inject(LeadsService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly functions: Functions = inject(FIREBASE_FUNCTIONS);

  readonly tabs = ADMIN_TABS;
  readonly userData$ = this.auth.userData$;

  readonly leads = toSignal(this.leadsSvc.listAll$(), { initialValue: [] as Lead[] });
  readonly linkableLeads = computed(() => this.leads().filter((l) => l.stage !== 'ganho' && l.stage !== 'perdido'));

  readonly linkedLeadId = signal<string>(this.route.snapshot.queryParamMap.get('lead') || '');
  readonly linkedLead = computed(() => this.leads().find((l) => l.id === this.linkedLeadId()) || null);

  readonly name = signal('');
  readonly dor = signal('');

  /** Pré-preenche nome/dor a partir do lead vinculado — só uma vez por id, pra não sobrescrever o que a pessoa já digitou aqui. */
  private prefilledFor: string | null = null;
  constructor() {
    effect(() => {
      const lead = this.linkedLead();
      if (!lead || this.prefilledFor === lead.id) return;
      this.prefilledFor = lead.id;
      this.name.set(lead.name);
      this.dor.set(lead.dor || '');
    });
  }

  onLinkedLeadChange(id: string): void {
    this.linkedLeadId.set(id);
    this.router.navigate([], { queryParams: { lead: id || null }, queryParamsHandling: 'merge' });
  }

  /* ── GERAR SUGESTÃO ── */
  readonly suggesting = signal(false);
  readonly suggestErr = signal('');
  readonly suggestion = signal<ProspectSuggestion | null>(null);

  async generateSuggestion(): Promise<void> {
    if (!this.dor().trim()) {
      this.suggestErr.set('Preencha a Dor Declarada / Contexto antes de pedir sugestão.');
      return;
    }
    this.suggesting.set(true);
    this.suggestErr.set('');
    this.suggestion.set(null);
    try {
      const suggestProspectApproach = httpsCallable<{ name: string; dor: string }, ProspectSuggestion>(
        this.functions,
        'suggestProspectApproach',
      );
      const result = await suggestProspectApproach({ name: this.name().trim() || 'este lead', dor: this.dor().trim() });
      this.suggestion.set(result.data);
    } catch (e) {
      const err = e as { message?: string };
      this.suggestErr.set(err.message || 'Erro ao pedir sugestão. Tente novamente.');
    } finally {
      this.suggesting.set(false);
    }
  }

  /* ── APLICAR NO LEAD VINCULADO (nunca sobrescreve o que já está preenchido) ── */
  async useInDiagnostico(): Promise<void> {
    const s = this.suggestion();
    const lead = this.linkedLead();
    if (!s || !lead || lead.diagnostico?.trim()) return;
    await this.leadsSvc.update(lead.id, { diagnostico: s.perguntasDiagnostico.map((p) => `• ${p}`).join('\n') });
  }

  async useInEscopo(): Promise<void> {
    const s = this.suggestion();
    const lead = this.linkedLead();
    if (!s || !lead || lead.escopo?.trim()) return;
    await this.leadsSvc.update(lead.id, { escopo: s.servicosRecomendados.join(', ') });
  }

  async useInMensagem(): Promise<void> {
    const s = this.suggestion();
    const lead = this.linkedLead();
    if (!s || !lead || lead.mensagemAbordagem?.trim()) return;
    await this.leadsSvc.update(lead.id, { mensagemAbordagem: s.mensagemAbordagem });
  }

  /* ── COPIAR (modo avulso, sem lead vinculado) ── */
  readonly copiedKey = signal<string | null>(null);

  async copy(key: string, text: string): Promise<void> {
    await navigator.clipboard.writeText(text);
    this.copiedKey.set(key);
    setTimeout(() => this.copiedKey.update((k) => (k === key ? null : k)), 1500);
  }
}
