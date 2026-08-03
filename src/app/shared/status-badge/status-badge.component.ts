import { Component, Input, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import {
  ProjectStatusSettingsService,
  DEFAULT_PROJECT_STATUS_SETTINGS,
} from '../../core/project-status-settings.service';

@Component({
  selector: 'app-status-badge',
  standalone: true,
  template: `<span class="badge">{{ label() }}</span>`,
})
export class StatusBadgeComponent {
  private readonly settingsSvc = inject(ProjectStatusSettingsService);
  private readonly settings = toSignal(this.settingsSvc.get$(), { initialValue: DEFAULT_PROJECT_STATUS_SETTINGS });

  private statusValue: string | undefined | null;

  @Input() set status(value: string | undefined | null) {
    this.statusValue = value;
  }

  label(): string {
    return this.settings().statuses.find((s) => s.key === this.statusValue)?.label || this.statusValue || '—';
  }
}
