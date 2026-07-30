import { AsyncPipe } from '@angular/common';
import { Component, effect, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { FirebaseError } from 'firebase/app';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth.service';
import { AccountsService } from '../../core/accounts.service';
import { ProjectsService } from '../../core/projects.service';
import { UserAccount } from '../../core/models';
import { PnavComponent, PnavTab } from '../../shared/pnav/pnav.component';

const ADMIN_TABS: PnavTab[] = [
  { key: 'projetos', label: 'Projetos', path: '/admin' },
  { key: 'clientes', label: 'Clientes', path: '/admin/clientes' },
  { key: 'contas', label: 'Contas', path: '/admin/contas' },
  { key: 'config', label: 'Configurações', path: '/admin/config' },
];

const STATUS_LABELS: Record<string, string> = {
  'em-andamento': 'Em Andamento',
  'aguardando-cliente': 'Aguardando Cliente',
  'em-revisao': 'Em Revisão',
  concluido: 'Concluído',
  pausado: 'Pausado',
};

@Component({
  selector: 'app-admin-client',
  standalone: true,
  imports: [AsyncPipe, FormsModule, RouterLink, PnavComponent],
  templateUrl: './admin-client.component.html',
})
export class AdminClientComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly auth = inject(AuthService);
  private readonly accountsSvc = inject(AccountsService);
  private readonly projectsSvc = inject(ProjectsService);

  readonly tabs = ADMIN_TABS;
  readonly cid = this.route.snapshot.paramMap.get('id')!;
  readonly userData$ = this.auth.userData$;
  readonly isOwner = toSignal(this.auth.isOwner$, { initialValue: false });

  readonly client = toSignal(this.accountsSvc.get$(this.cid), { initialValue: null });
  readonly projects = toSignal(this.projectsSvc.listForOwner$(this.cid), { initialValue: [] });
  readonly teamMembers = toSignal(this.accountsSvc.listTeamMembers$(this.cid), { initialValue: [] });

  /* ── DADOS ── */
  readonly name = signal('');
  readonly savingDados = signal(false);
  readonly dadosOk = signal(false);
  readonly dadosErr = signal('');

  /* ── IDENTIDADE VISUAL ── */
  readonly brandingCompany = signal('');
  readonly brandingColor = signal('#C9A96E');
  readonly brandingLogoPreview = signal<string | null>(null);
  readonly savingMarca = signal(false);
  readonly marcaOk = signal(false);
  readonly marcaErr = signal('');
  private pendingLogoFile: File | null = null;
  private logoRemoved = false;

  /* ── FOTO DO CONTATO ── */
  readonly photoPreview = signal<string | null>(null);
  readonly savingPhoto = signal(false);
  readonly photoOk = signal(false);
  readonly photoErr = signal('');
  private pendingPhotoFile: File | null = null;
  private photoRemoved = false;

  /* ── COLABORADORES ── */
  readonly tmName = signal('');
  readonly tmEmail = signal('');
  readonly tmPassword = signal('');
  readonly tmSaving = signal(false);
  readonly tmErr = signal('');

  constructor() {
    effect(() => {
      const c = this.client();
      if (!c) return;
      this.name.set(c.name || '');
      this.brandingCompany.set(c.branding?.companyName || '');
      this.brandingColor.set(c.branding?.primaryColor || '#C9A96E');
      this.brandingLogoPreview.set(c.branding?.logo || null);
      this.pendingLogoFile = null;
      this.logoRemoved = false;
      this.photoPreview.set(c.photoUrl || null);
      this.pendingPhotoFile = null;
      this.photoRemoved = false;
    });
  }

  statusLabel(status: string): string {
    return STATUS_LABELS[status] || status || '—';
  }

  async saveDados(): Promise<void> {
    this.dadosOk.set(false);
    this.dadosErr.set('');
    this.savingDados.set(true);
    try {
      await this.accountsSvc.updateProfile(this.cid, { name: this.name().trim() });
      this.dadosOk.set(true);
      setTimeout(() => this.dadosOk.set(false), 3000);
    } catch {
      this.dadosErr.set('Erro ao salvar. Tente novamente.');
    } finally {
      this.savingDados.set(false);
    }
  }

  onColorChange(value: string): void {
    this.brandingColor.set(value);
  }

  onLogoSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    this.pendingLogoFile = file;
    this.logoRemoved = false;
    const reader = new FileReader();
    reader.onload = (ev) => this.brandingLogoPreview.set(ev.target?.result as string);
    reader.readAsDataURL(file);
  }

  removeLogo(): void {
    this.pendingLogoFile = null;
    this.logoRemoved = true;
    this.brandingLogoPreview.set(null);
  }

  async saveMarca(): Promise<void> {
    this.marcaOk.set(false);
    this.marcaErr.set('');
    this.savingMarca.set(true);
    try {
      let logoUrl: string | null = this.logoRemoved ? null : this.client()?.branding?.logo || null;
      if (this.pendingLogoFile) {
        const path = `clients/${this.cid}/branding/logo_${Date.now()}`;
        logoUrl = await this.projectsSvc.uploadBrandingLogo(path, this.pendingLogoFile);
        this.pendingLogoFile = null;
      }
      await this.accountsSvc.updateBranding(this.cid, {
        companyName: this.brandingCompany().trim(),
        primaryColor: this.brandingColor(),
        logo: logoUrl,
      });
      this.marcaOk.set(true);
      setTimeout(() => this.marcaOk.set(false), 3000);
    } catch (e) {
      const err = e as { code?: string; message?: string };
      this.marcaErr.set('Erro ao salvar a identidade visual: ' + (err.code || err.message || 'desconhecido'));
    } finally {
      this.savingMarca.set(false);
    }
  }

  /* ── FOTO DO CONTATO ── */
  onPhotoSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    this.pendingPhotoFile = file;
    this.photoRemoved = false;
    const reader = new FileReader();
    reader.onload = (ev) => this.photoPreview.set(ev.target?.result as string);
    reader.readAsDataURL(file);
  }

  removePhoto(): void {
    this.pendingPhotoFile = null;
    this.photoRemoved = true;
    this.photoPreview.set(null);
  }

  async savePhoto(): Promise<void> {
    this.photoOk.set(false);
    this.photoErr.set('');
    this.savingPhoto.set(true);
    try {
      let photoUrl: string | null = this.photoRemoved ? null : this.client()?.photoUrl || null;
      if (this.pendingPhotoFile) {
        const path = `clients/${this.cid}/photo/photo_${Date.now()}`;
        photoUrl = await this.projectsSvc.uploadBrandingLogo(path, this.pendingPhotoFile);
        this.pendingPhotoFile = null;
      }
      await this.accountsSvc.updatePhoto(this.cid, photoUrl);
      this.photoOk.set(true);
      setTimeout(() => this.photoOk.set(false), 3000);
    } catch (e) {
      const err = e as { code?: string; message?: string };
      this.photoErr.set('Erro ao salvar a foto: ' + (err.code || err.message || 'desconhecido'));
    } finally {
      this.savingPhoto.set(false);
    }
  }

  /* ── COLABORADORES ── */
  async addTeamMember(): Promise<void> {
    const name = this.tmName().trim();
    const email = this.tmEmail().trim();
    const password = this.tmPassword();
    this.tmErr.set('');
    if (!name) { this.tmErr.set('O nome é obrigatório.'); return; }
    if (!email) { this.tmErr.set('O e-mail é obrigatório.'); return; }
    if (password.length < 6) { this.tmErr.set('A senha deve ter pelo menos 6 caracteres.'); return; }
    this.tmSaving.set(true);
    try {
      await this.accountsSvc.createTeamMember(this.cid, name, email, password);
      this.tmName.set('');
      this.tmEmail.set('');
      this.tmPassword.set('');
    } catch (e) {
      const code = e instanceof FirebaseError ? e.code : '';
      const map: Record<string, string> = {
        'auth/email-already-in-use': 'Este e-mail já está em uso.',
        'auth/invalid-email': 'E-mail inválido.',
        'auth/weak-password': 'A senha deve ter pelo menos 6 caracteres.',
      };
      this.tmErr.set(map[code] || 'Erro ao adicionar colaborador.');
    } finally {
      this.tmSaving.set(false);
    }
  }

  async removeTeamMember(member: UserAccount): Promise<void> {
    if (!confirm(`Remover o acesso de "${member.name || member.email}"?\n\nIsso remove os dados da conta na plataforma, mas o login no Firebase Authentication precisa ser removido separadamente pelo Console do Firebase.`)) {
      return;
    }
    await this.accountsSvc.deleteAccount(member.uid);
  }

  initials(name: string): string {
    return name.split(' ').slice(0, 2).map((w) => w[0] || '').join('').toUpperCase() || '?';
  }
}
