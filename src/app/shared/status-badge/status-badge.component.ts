import { Component, Input } from '@angular/core';

interface BadgeInfo {
  label: string;
  bg: string;
  color: string;
}

const STATUS_MAP: Record<string, BadgeInfo> = {
  'em-andamento': { label: 'Em Andamento', bg: '#DBEAFE', color: '#1D4ED8' },
  'aguardando-cliente': { label: 'Aguardando Cliente', bg: '#FEF3C7', color: '#B45309' },
  'em-revisao': { label: 'Em Revisão', bg: '#EDE9FE', color: '#6D28D9' },
  concluido: { label: 'Concluído', bg: '#D1FAE5', color: '#065F46' },
  pausado: { label: 'Pausado', bg: '#F3F4F6', color: '#374151' },
};

@Component({
  selector: 'app-status-badge',
  standalone: true,
  template: `<span class="badge" [style.background]="info.bg" [style.color]="info.color">{{ info.label }}</span>`,
})
export class StatusBadgeComponent {
  info: BadgeInfo = { label: '—', bg: '#F3F4F6', color: '#374151' };

  @Input() set status(value: string | undefined | null) {
    this.info = (value && STATUS_MAP[value]) || { label: value || '—', bg: '#F3F4F6', color: '#374151' };
  }
}
