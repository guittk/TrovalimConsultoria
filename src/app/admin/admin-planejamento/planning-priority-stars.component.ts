import { Component, EventEmitter, Input, Output } from '@angular/core';

/** 1-5 estrelas. Clicar na já marcada limpa a prioridade. */
@Component({
  selector: 'app-planning-priority-stars',
  standalone: true,
  templateUrl: './planning-priority-stars.component.html',
})
export class PlanningPriorityStarsComponent {
  @Input() value: number | null | undefined = null;
  @Input() readonly = false;
  @Output() valueChange = new EventEmitter<number | null>();

  readonly stars = [1, 2, 3, 4, 5];

  pick(n: number, event: Event): void {
    event.stopPropagation();
    if (this.readonly) return;
    this.valueChange.emit(this.value === n ? null : n);
  }
}
