import { Component, Input, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import {
  ProjectStatusSettingsService,
  DEFAULT_PROJECT_STATUS_SETTINGS,
  statusColorFor,
} from '../../core/project-status-settings.service';

@Component({
  selector: 'app-status-badge',
  standalone: true,
  template: `<span
    class="badge badge-status"
    [style.color]="color()"
    [style.background]="color() + '1F'"
    [style.border]="'1px solid ' + color() + '55'"
    >{{ label() }}</span
  >`,
})
export class StatusBadgeComponent {
  private readonly settingsSvc = inject(ProjectStatusSettingsService);
  private readonly settings = toSignal(this.settingsSvc.get$(), { initialValue: DEFAULT_PROJECT_STATUS_SETTINGS });

  private readonly statusValue = signal<string | undefined | null>(null);

  @Input() set status(value: string | undefined | null) {
    this.statusValue.set(value);
  }

  private readonly match = computed(() => {
    const list = this.settings().statuses;
    const idx = list.findIndex((s) => s.key === this.statusValue());
    return { option: idx >= 0 ? list[idx] : null, index: idx >= 0 ? idx : 0 };
  });

  label = computed(() => this.match().option?.label || this.statusValue() || '—');
  color = computed(() => statusColorFor(this.match().option, this.match().index));
}
