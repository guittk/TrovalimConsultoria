import { AsyncPipe, DatePipe } from '@angular/common';
import { Component, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { Timestamp } from 'firebase/firestore';
import { AuthService } from '../../core/auth.service';
import { ContactSubmissionsService } from '../../core/contact-submissions.service';
import { ContactSubmission } from '../../core/models';
import { PnavComponent, PnavTab } from '../../shared/pnav/pnav.component';
import { ConfirmService } from '../../shared/confirm/confirm.service';

const ADMIN_TABS: PnavTab[] = [
  { key: 'projetos', label: 'Projetos', path: '/admin' },
  { key: 'clientes', label: 'Empresas', path: '/admin/clientes' },
  { key: 'contas', label: 'Contas', path: '/admin/contas' },
  { key: 'kanban', label: 'Kanban', path: '/admin/kanban' },
  { key: 'contatos', label: 'Contatos', path: '/admin/contatos' },
  { key: 'config', label: 'Configurações', path: '/admin/config' },
];

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
  private readonly confirmSvc = inject(ConfirmService);

  readonly tabs = ADMIN_TABS;
  readonly userData$ = this.auth.userData$;

  readonly submissions = toSignal(this.contactsSvc.listAll$(), { initialValue: [] as ContactSubmission[] });

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
