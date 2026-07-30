import { AsyncPipe } from '@angular/common';
import { Component, effect, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth.service';
import { AccountsService } from '../../core/accounts.service';
import { ProjectsService } from '../../core/projects.service';
import { PnavComponent, PnavTab } from '../../shared/pnav/pnav.component';

const ADMIN_TABS: PnavTab[] = [
  { key: 'projetos', label: 'Projetos', path: '/admin' },
  { key: 'clientes', label: 'Clientes', path: '/admin/clientes' },
  { key: 'contas', label: 'Contas', path: '/admin/contas' },
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

  readonly client = toSignal(this.accountsSvc.get$(this.cid), { initialValue: null });
  readonly projects = toSignal(this.projectsSvc.listForOwner$(this.cid), { initialValue: [] });

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
}
