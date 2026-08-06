import { AsyncPipe } from '@angular/common';
import { Component, NgZone, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { FirebaseError } from 'firebase/app';
import { AuthService, normRole } from '../../core/auth.service';
import { AccountsService } from '../../core/accounts.service';
import { ProjectsService } from '../../core/projects.service';
import { Role, UserAccount } from '../../core/models';
import { PnavComponent, PnavTab } from '../../shared/pnav/pnav.component';
import { RoleBadgeComponent } from '../../shared/role-badge/role-badge.component';
import { ConfirmService } from '../../shared/confirm/confirm.service';

const ADMIN_TABS: PnavTab[] = [
  { key: 'projetos', label: 'Projetos', path: '/admin' },
  { key: 'clientes', label: 'Empresas', path: '/admin/clientes' },
  { key: 'mentoria', label: 'Mentoria', path: '/admin/mentoria' },
  { key: 'contas', label: 'Contas', path: '/admin/contas' },
  { key: 'kanban', label: 'Kanban', path: '/admin/kanban' },
  { key: 'treinamentos', label: 'Treinamentos', path: '/admin/treinamentos' },
  { key: 'config', label: 'Configurações', path: '/admin/config' },
];

const ROLE_ORDER: Record<string, number> = { owner: 0, manager: 1, client: 2, mentorado: 3 };

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
  private readonly confirmSvc = inject(ConfirmService);
  private readonly zone = inject(NgZone);

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
  readonly editingIsSelf = computed(() => !!this.editingUid() && this.editingUid() === this.currentUid());

  readonly pageErr = signal('');

  /* ── MODAL ── */
  readonly modalOpen = signal(false);
  readonly modalErr = signal('');
  readonly saving = signal(false);
  readonly editingUid = signal<string | null>(null);
  readonly editingAccount = signal<UserAccount | null>(null);
  /** Colaborador de empresa-cliente (tem cargo/foto vinculados à empresa) — não inclui mentorado. */
  readonly isEditingClient = computed(() => {
    const a = this.editingAccount();
    return !!a && normRole(a.role) === 'client';
  });
  readonly isEditingAccount = computed(() => !!this.editingAccount());
  readonly accName = signal('');
  readonly accEmail = signal('');
  readonly accPassword = signal('');
  readonly accRole = signal<Role>('client');
  readonly restrictProjects = signal(false);
  readonly selectedProjectIds = signal<Set<string>>(new Set());
  readonly accJobTitle = signal('');
  readonly accPhotoPreview = signal<string | null>(null);
  private pendingPhotoFile: File | null = null;
  private photoRemoved = false;

  /**
   * input.click() num input[type=file] oculto dentro de uma modal corre
   * contra o zone.js e o diálogo nativo simplesmente não abre, sem erro
   * nenhum. showPicker() (fora da zone) é o que efetivamente funciona;
   * o fallback pra click() cobre navegadores sem showPicker() em inputs
   * de arquivo.
   */
  triggerFilePicker(input: HTMLInputElement): void {
    this.zone.runOutsideAngular(() => {
      if (typeof input.showPicker === 'function') {
        input.showPicker();
      } else {
        input.click();
      }
    });
  }

  openCreate(): void {
    this.editingUid.set(null);
    this.editingAccount.set(null);
    this.accName.set('');
    this.accEmail.set('');
    this.accPassword.set('');
    this.accRole.set('client');
    this.restrictProjects.set(false);
    this.selectedProjectIds.set(new Set());
    this.accJobTitle.set('');
    this.accPhotoPreview.set(null);
    this.pendingPhotoFile = null;
    this.photoRemoved = false;
    this.modalErr.set('');
    this.modalOpen.set(true);
  }

  openEdit(acc: UserAccount): void {
    this.editingUid.set(acc.uid);
    this.editingAccount.set(acc);
    this.accName.set(acc.name || '');
    this.accEmail.set(acc.email || '');
    this.accPassword.set('');
    const editingRole = normRole(acc.role);
    this.accRole.set(editingRole === 'manager' ? 'manager' : editingRole === 'mentorado' ? 'mentorado' : 'client');
    this.restrictProjects.set(Array.isArray(acc.projectAccess));
    this.selectedProjectIds.set(new Set(acc.projectAccess || []));
    this.accJobTitle.set(acc.jobTitle || '');
    this.accPhotoPreview.set(acc.photoUrl || null);
    this.pendingPhotoFile = null;
    this.photoRemoved = false;
    this.modalErr.set('');
    this.modalOpen.set(true);
  }

  onAccPhotoSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    this.pendingPhotoFile = file;
    this.photoRemoved = false;
    const reader = new FileReader();
    reader.onload = (ev) => this.accPhotoPreview.set(ev.target?.result as string);
    reader.readAsDataURL(file);
  }

  removeAccPhoto(): void {
    this.pendingPhotoFile = null;
    this.photoRemoved = true;
    this.accPhotoPreview.set(null);
  }

  closeModal(): void {
    this.modalOpen.set(false);
  }

  toggleRestrictProjects(): void {
    this.restrictProjects.update((v) => !v);
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
        // Editando a própria conta: não mexe em role/projectAccess (o
        // formulário nem oferece a opção "Owner", então salvar esses campos
        // aqui rebaixaria o próprio Owner por acidente).
        const payload = this.editingIsSelf() ? { name } : { name, role: this.accRole(), projectAccess };
        await this.accountsSvc.updateProfile(editingUid, payload);

        let photoUrl: string | null = this.photoRemoved ? null : this.editingAccount()?.photoUrl || null;
        if (this.pendingPhotoFile) {
          const path = `accounts/${editingUid}/photo_${Date.now()}`;
          photoUrl = await this.projectsSvc.uploadBrandingLogo(path, this.pendingPhotoFile);
        }
        if (this.isEditingClient()) {
          await this.accountsSvc.updateCollaboratorProfile(editingUid, this.accJobTitle().trim(), photoUrl);
        } else {
          await this.accountsSvc.updatePhoto(editingUid, photoUrl);
        }
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
    const ok = await this.confirmSvc.confirm({
      title: 'Excluir conta',
      message: `Excluir o acesso de "${acc.name || acc.email}"?\n\nIsso remove os dados da conta na plataforma e o login no Firebase Authentication.`,
      confirmLabel: 'Excluir',
      danger: true,
    });
    if (!ok) return;
    this.pageErr.set('');
    try {
      const { authDeleted } = await this.accountsSvc.deleteAccount(acc.uid);
      if (!authDeleted) {
        this.pageErr.set(
          `"${acc.name || acc.email}" foi removido da plataforma, mas o login no Firebase Authentication não pôde ser removido automaticamente (verifique se as Cloud Functions estão implantadas). Remova-o pelo Console do Firebase se necessário.`,
        );
      }
    } catch (e) {
      if (e instanceof Error && e.message === 'HAS_TEAM_MEMBERS') {
        this.pageErr.set(
          `"${acc.name || acc.email}" ainda tem colaboradores vinculados. Remova-os (ou realoque-os) na tela da empresa antes de excluir esta conta.`,
        );
        return;
      }
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
