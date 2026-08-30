import { Component, Input } from '@angular/core';
import { normRole } from '../../core/auth.service';

interface BadgeInfo {
  label: string;
  bg: string;
  color: string;
}

/*
 * Cores por tokens (e não literais) porque a área de conteúdo tem tema
 * claro e escuro — ver os `--role-*` em styles.css.
 */
const ROLE_MAP: Record<string, BadgeInfo> = {
  owner: { label: 'Proprietário', bg: 'var(--accent-soft)', color: 'var(--accent-text)' },
  manager: { label: 'Gerente', bg: 'var(--role-manager-bg)', color: 'var(--role-manager)' },
  client: { label: 'Cliente', bg: 'var(--surface-2)', color: 'var(--muted)' },
  mentorado: { label: 'Mentorado', bg: 'var(--role-mentorado-bg)', color: 'var(--role-mentorado)' },
};

const FALLBACK: Omit<BadgeInfo, 'label'> = { bg: 'var(--surface-2)', color: 'var(--muted)' };

@Component({
  selector: 'app-role-badge',
  standalone: true,
  template: `<span class="badge" [style.background]="info.bg" [style.color]="info.color">{{ info.label }}</span>`,
})
export class RoleBadgeComponent {
  info: BadgeInfo = { label: '—', ...FALLBACK };

  @Input() set role(value: string | undefined | null) {
    const key = normRole(value);
    this.info = ROLE_MAP[key] || { label: value || '—', ...FALLBACK };
  }
}
