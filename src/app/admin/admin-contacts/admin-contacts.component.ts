import { AsyncPipe, DatePipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { Timestamp } from 'firebase/firestore';
import { Router } from '@angular/router';
import { AuthService } from '../../core/auth.service';
import { ContactSubmissionsService } from '../../core/contact-submissions.service';
import { LeadsService } from '../../core/leads.service';
import { ContactSubmission } from '../../core/models';
import { PnavComponent } from '../../shared/pnav/pnav.component';
import { ADMIN_TABS } from '../admin-tabs';
import { ConfirmService } from '../../shared/confirm/confirm.service';

const SUBJECT_LABELS: Record<string, string> = {
  empresa: 'Empresa — recrutamento e consultoria de RH',
  carreira: 'Profissional — currículo, LinkedIn ou carreira',
  outro: 'Outro assunto',
};

@Component({
  selector: 'app-admin-contacts',
  standalone: true,
  imports: [AsyncPipe, DatePipe, PnavComponent],
  templateUrl: './admin-contacts.component.html',
})
export class AdminContactsComponent {
  private readonly auth = inject(AuthService);
  private readonly contactsSvc = inject(ContactSubmissionsService);
  private readonly leadsSvc = inject(LeadsService);
  private readonly confirmSvc = inject(ConfirmService);
  private readonly router = inject(Router);

  readonly tabs = ADMIN_TABS;
  readonly userData$ = this.auth.userData$;

  readonly submissions = toSignal(this.contactsSvc.listAll$(), { initialValue: [] as ContactSubmission[] });
  readonly creatingLeadFor = signal<string | null>(null);

  subjectLabel(subject: string): string {
    return SUBJECT_LABELS[subject] || subject || '—';
  }

  waLink(phone: string): string {
    return `https://wa.me/${phone.replace(/\D/g, '')}`;
  }

  toDate(value: unknown): Date {
    if (value instanceof Timestamp) return value.toDate();
    return new Date();
  }

  /** Cria uma prospecção a partir do contato — a mensagem crua continua existindo aqui, intocada, como registro. */
  async createLead(s: ContactSubmission): Promise<void> {
    this.creatingLeadFor.set(s.id!);
    try {
      const id = await this.leadsSvc.create({
        name: s.name,
        contactName: s.name,
        email: s.email || '',
        phone: s.phone || '',
        dor: s.message,
        source: 'site',
      });
      await this.router.navigate(['/admin/prospeccao'], { queryParams: { lead: id } });
    } finally {
      this.creatingLeadFor.set(null);
    }
  }

  async deleteSubmission(s: ContactSubmission): Promise<void> {
    const ok = await this.confirmSvc.confirm({
      title: 'Excluir contato',
      message: `Excluir o contato de "${s.name}" permanentemente?`,
      confirmLabel: 'Excluir',
      danger: true,
    });
    if (!ok) return;
    await this.contactsSvc.delete(s.id!);
  }
}
