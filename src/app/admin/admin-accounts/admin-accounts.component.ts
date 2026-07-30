import { AsyncPipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { FirebaseError } from 'firebase/app';
import { AuthService, normRole } from '../../core/auth.service';
import { AccountsService } from '../../core/accounts.service';
import { ProjectsService } from '../../core/projects.service';
import { Role, UserAccount } from '../../core/models';
import { PnavComponent, PnavTab } from '../../shared/pnav/pnav.component';
import { RoleBadgeComponent } from '../../shared/role-badge/role-badge.component';

const ADMIN_TABS: PnavTab[] = [
  { key: 'projetos', label: 'Projetos', path: '/admin' },
  { key: 'clientes', label: 'Clientes', path: '/admin/clientes' },
  { key: 'contas', label: 'Contas', path: '/admin/contas' },
  { key: 'config', label: 'Configurações', path: '/admin/config' },
];

const ROLE_ORDER: Record<string, number> = { owner: 0, manager: 1, client: 2 };

@Component({
  selector: 'app-admin-accounts',
  standalone: true,
  imports: [AsyncPipe, FormsModule, PnavComponent, RoleBadgeComponent],
  templateUrl: './admin-accounts.component.html',
})
export class AdminAccountsComponent {
  private readonly auth = inject(AuthService);
  private readonly accountsSvc = inject(AccountsService);
  private readonly projectsSvc = inject(ProjectsService);

  readonly tabs = ADMIN_TABS;
  readonly userData$ = this.auth.userData$;
  readonly currentUid = computed(() => this.auth.currentUser?.uid);

  readonly accounts = toSignal(this.accountsSvc.listAll$(), { initialValue: [] });
  readonly allProjects = toSignal(this.projectsSvc.listAll$(), { initialValue: [] });
  readonly sortedAccounts = computed(() =>
    [...this.accounts()].sort((a, b) => {
      const ra = ROLE_ORDER[normRole(a.role)] ?? 99;
      const rb = ROLE_ORDER[normRole(b.role)] ?? 99;
      if (ra !== rb) return ra - rb;
      return (a.name || a.email || '').localeCompare(b.name || b.email || '');
    }),
  );

  readonly isOwner = toSignal(this.auth.isOwner$, { initialValue: false });

  readonly pageErr = signal('');

  /* ── MODAL ── */
  readonly modalOpen = signal(false);
  readonly modalErr = signal('');
  readonly saving = signal(false);
  readonly editingUid = signal<string | null>(null);
  readonly accName = signal('');
  readonly accEmail = signal('');
  readonly accPassword = signal('');
  readonly accRole = signal<Role>('client');
  readonly restrictProjects = signal(false);
  readonly selectedProjectIds = signal<Set<string>>(new Set());

  openCreate(): void {
    this.editingUid.set(null);
    this.accName.set('');
    this.accEmail.set('');
    this.accPassword.set('');
    this.accRole.set('client');
    this.restrictProjects.set(false);
    this.selectedProjectIds.set(new Set());
    this.modalErr.set('');
    this.modalOpen.set(true);
  }

  openEdit(acc: UserAccount): void {
    this.editingUid.set(acc.uid);
    this.accName.set(acc.name || '');
    this.accEmail.set(acc.email || '');
    this.accPassword.set('');
    this.accRole.set(normRole(acc.role) === 'manager' ? 'manager' : 'client');
    this.restrictProjects.set(Array.isArray(acc.projectAccess));
    this.selectedProjectIds.set(new Set(acc.projectAccess || []));
    this.modalErr.set('');
    this.modalOpen.set(true);
  }

  closeModal(): void {
    this.modalOpen.set(false);
  }

  toggleProject(id: string, checked: boolean): void {
    this.selectedProjectIds.update((set) => {
      const copy = new Set(set);
      if (checked) copy.add(id);
      else copy.delete(id);
      return copy;
    });
  }

  async save(): Promise<void> {
    const name = this.accName().trim();
    const email = this.accEmail().trim();
    if (!name) { this.modalErr.set('O nome é obrigatório.'); return; }
    if (!email) { this.modalErr.set('O e-mail é obrigatório.'); return; }

    this.saving.set(true);
    const projectAccess =
      this.accRole() === 'manager' && this.restrictProjects() ? [...this.selectedProjectIds()] : null;
    try {
      const editingUid = this.editingUid();
      if (editingUid) {
        await this.accountsSvc.updateProfile(editingUid, { name, role: this.accRole(), projectAccess });
      } else {
        if (this.accPassword().length < 6) {
          throw new Error('WEAK_PASSWORD');
        }
        await this.accountsSvc.createAccount(name, email, this.accPassword(), this.accRole(), projectAccess);
      }
      this.modalOpen.set(false);
    } catch (e) {
      this.modalErr.set(this.accountErrMsg(e));
    } finally {
      this.saving.set(false);
    }
  }

  async deleteAccount(acc: UserAccount): Promise<void> {
    if (!confirm(`Excluir o acesso de "${acc.name || acc.email}"?\n\nIsso remove os dados da conta na plataforma, mas o login no Firebase Authentication precisa ser removido separadamente pelo Console do Firebase.`)) {
      return;
    }
    try {
      await this.accountsSvc.deleteAccount(acc.uid);
    } catch (e) {
      const err = e as { code?: string; message?: string };
      this.pageErr.set('Erro ao excluir conta: ' + (err.code || err.message));
    }
  }

  private accountErrMsg(e: unknown): string {
    if (e instanceof Error && e.message === 'WEAK_PASSWORD') return 'A senha deve ter pelo menos 6 caracteres.';
    const code = e instanceof FirebaseError ? e.code : '';
    const map: Record<string, string> = {
      'auth/email-already-in-use': 'Este e-mail já está em uso.',
      'auth/invalid-email': 'E-mail inválido.',
      'auth/weak-password': 'A senha deve ter pelo menos 6 caracteres.',
    };
    return map[code] || 'Erro ao salvar a conta.';
  }
}
