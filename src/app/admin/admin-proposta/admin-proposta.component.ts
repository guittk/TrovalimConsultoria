import { AsyncPipe, DatePipe } from '@angular/common';
import { Component, computed, effect, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Timestamp } from 'firebase/firestore';
import { AuthService } from '../../core/auth.service';
import { PropostasService } from '../../core/propostas.service';
import { PricingSettingsService, PRICING_UNITS, DEFAULT_PRICING_SETTINGS } from '../../core/pricing-settings.service';
import { PnavComponent } from '../../shared/pnav/pnav.component';
import { ADMIN_TABS } from '../admin-tabs';
import { downloadPropostaPdf } from '../../shared/proposta-pdf';

@Component({
  selector: 'app-admin-proposta',
  standalone: true,
  imports: [AsyncPipe, DatePipe, FormsModule, PnavComponent],
  templateUrl: './admin-proposta.component.html',
})
export class AdminPropostaComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly auth = inject(AuthService);
  private readonly propostasSvc = inject(PropostasService);
  private readonly pricingSettingsSvc = inject(PricingSettingsService);

  readonly tabs = ADMIN_TABS;
  readonly userData$ = this.auth.userData$;
  readonly pid = this.route.snapshot.paramMap.get('id')!;
  readonly pricingUnits = PRICING_UNITS;
  readonly pricingSettings = toSignal(this.pricingSettingsSvc.get$(), { initialValue: DEFAULT_PRICING_SETTINGS });

  readonly proposta = toSignal(this.propostasSvc.get$(this.pid), { initialValue: null });
  readonly isDraft = computed(() => this.proposta()?.status === 'rascunho');

  readonly clientName = signal('');
  readonly contactName = signal('');
  readonly email = signal('');
  readonly escopo = signal('');
  readonly condicoes = signal('');
  readonly qty = signal<Record<string, number>>({});

  readonly saving = signal(false);
  readonly sending = signal(false);
  readonly savedOk = signal(false);

  readonly publicUrl = computed(() => `${location.origin}/proposta/${this.pid}`);
  readonly linkCopied = signal(false);

  readonly total = computed(() =>
    this.pricingSettings().items.reduce((sum, item) => sum + item.baseValue * (this.qty()[item.key] || 0), 0),
  );

  constructor() {
    let seeded = false;
    effect(() => {
      const p = this.proposta();
      if (!p || seeded) return;
      seeded = true;
      this.clientName.set(p.clientName || '');
      this.contactName.set(p.contactName || '');
      this.email.set(p.email || '');
      this.escopo.set(p.escopo || '');
      this.condicoes.set(p.condicoes || '');
      const map: Record<string, number> = {};
      for (const it of p.items) map[it.key] = it.qty;
      this.qty.set(map);
    });
  }

  qtyFor(key: string): number {
    return this.qty()[key] || 0;
  }

  setQty(key: string, value: number): void {
    this.qty.update((m) => ({ ...m, [key]: Math.max(0, value) }));
  }

  async saveDraft(): Promise<void> {
    this.saving.set(true);
    this.savedOk.set(false);
    try {
      const items = this.pricingSettings()
        .items.filter((it) => this.qtyFor(it.key) > 0)
        .map((it) => ({ key: it.key, name: it.name, unit: it.unit, baseValue: it.baseValue, qty: this.qtyFor(it.key) }));
      await this.propostasSvc.updateDraft(this.pid, {
        clientName: this.clientName().trim(),
        contactName: this.contactName().trim(),
        email: this.email().trim(),
        escopo: this.escopo().trim(),
        condicoes: this.condicoes().trim(),
        items,
      });
      this.savedOk.set(true);
      setTimeout(() => this.savedOk.set(false), 3000);
    } finally {
      this.saving.set(false);
    }
  }

  async sendProposta(): Promise<void> {
    this.sending.set(true);
    try {
      await this.saveDraft();
      await this.propostasSvc.markSent(this.pid);
    } finally {
      this.sending.set(false);
    }
  }

  async copyLink(): Promise<void> {
    await navigator.clipboard.writeText(this.publicUrl());
    this.linkCopied.set(true);
    setTimeout(() => this.linkCopied.set(false), 2000);
  }

  downloadPdf(): void {
    const p = this.proposta();
    if (p) downloadPropostaPdf(p);
  }

  toDate(value: unknown): Date {
    return value instanceof Timestamp ? value.toDate() : new Date();
  }

  formatCurrency(value: number | null | undefined): string {
    return (value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }

  backToLead(): void {
    const leadId = this.proposta()?.leadId;
    this.router.navigate(['/admin/prospeccao'], leadId ? { queryParams: { lead: leadId } } : {});
  }
}
