import { Component, Input, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import {
  ProjectStatusSettingsService,
  DEFAULT_PROJECT_STATUS_SETTINGS,
} from '../../core/project-status-settings.service';

@Component({
  selector: 'app-status-badge',
  standalone: true,
  template: `<span class="badge" [style.background]="info().bg" [style.color]="info().color">{{ info().label }}</span>`,
})
export class StatusBadgeComponent {
  private readonly settingsSvc = inject(ProjectStatusSettingsService);
  private readonly settings = toSignal(this.settingsSvc.get$(), { initialValue: DEFAULT_PROJECT_STATUS_SETTINGS });

  private statusValue: string | undefined | null;

  @Input() set status(value: string | undefined | null) {
    this.statusValue = value;
  }

  info() {
    const found = this.settings().statuses.find((s) => s.key === this.statusValue);
    return found || { label: this.statusValue || '—', bg: '#F3F4F6', color: '#374151' };
  }
}
