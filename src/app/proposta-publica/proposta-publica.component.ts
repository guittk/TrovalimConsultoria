import { DatePipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { Timestamp } from 'firebase/firestore';
import { PropostasService } from '../core/propostas.service';
import { downloadPropostaPdf } from '../shared/proposta-pdf';

/**
 * Página pública (sem login) de uma proposta — o link é o próprio id do
 * documento (ver PropostasService/regra do Firestore: leitura pública só
 * quando status != 'rascunho', e a única escrita permitida é aceitar ou
 * recusar). Layout intencionalmente sem app-pnav: não é uma tela de
 * navegação, e o visitante nunca está autenticado.
 */
@Component({
  selector: 'app-proposta-publica',
  standalone: true,
  imports: [DatePipe, FormsModule],
  templateUrl: './proposta-publica.component.html',
})
export class PropostaPublicaComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly propostasSvc = inject(PropostasService);

  readonly pid = this.route.snapshot.paramMap.get('id')!;
  readonly proposta = toSignal(this.propostasSvc.get$(this.pid), { initialValue: null });

  readonly showAccept = signal(false);
  readonly showDecline = signal(false);
  readonly acceptName = signal('');
  readonly acceptEmail = signal('');
  readonly declineReason = signal('');
  readonly submitting = signal(false);
  readonly err = signal('');

  readonly total = computed(() => this.proposta()?.total || 0);

  toDate(value: unknown): Date {
    return value instanceof Timestamp ? value.toDate() : new Date();
  }

  formatCurrency(value: number | null | undefined): string {
    return (value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }

  downloadPdf(): void {
    const p = this.proposta();
    if (p) downloadPropostaPdf(p);
  }

  async confirmAccept(): Promise<void> {
    if (!this.acceptName().trim()) {
      this.err.set('Informe seu nome pra confirmar.');
      return;
    }
    this.submitting.set(true);
    this.err.set('');
    try {
      await this.propostasSvc.accept(this.pid, this.acceptName().trim(), this.acceptEmail().trim());
      this.showAccept.set(false);
    } catch {
      this.err.set('Erro ao registrar aceite. Tente novamente.');
    } finally {
      this.submitting.set(false);
    }
  }

  async confirmDecline(): Promise<void> {
    this.submitting.set(true);
    this.err.set('');
    try {
      await this.propostasSvc.decline(this.pid, this.declineReason().trim());
      this.showDecline.set(false);
    } catch {
      this.err.set('Erro ao registrar resposta. Tente novamente.');
    } finally {
      this.submitting.set(false);
    }
  }
}
