import { Component, Input } from '@angular/core';
import { normRole } from '../../core/auth.service';

interface BadgeInfo {
  label: string;
  bg: string;
  color: string;
}

const ROLE_MAP: Record<string, BadgeInfo> = {
  owner: { label: 'Proprietário', bg: '#F5EDD9', color: '#3D0B12' },
  manager: { label: 'Gerente', bg: '#DBEAFE', color: '#1D4ED8' },
  client: { label: 'Cliente', bg: '#F3F4F6', color: '#374151' },
};

@Component({
  selector: 'app-role-badge',
  standalone: true,
  template: `<span class="badge" [style.background]="info.bg" [style.color]="info.color">{{ info.label }}</span>`,
})
export class RoleBadgeComponent {
  info: BadgeInfo = { label: '—', bg: '#F3F4F6', color: '#374151' };

  @Input() set role(value: string | undefined | null) {
    const key = normRole(value);
    this.info = ROLE_MAP[key] || { label: value || '—', bg: '#F3F4F6', color: '#374151' };
  }
}
