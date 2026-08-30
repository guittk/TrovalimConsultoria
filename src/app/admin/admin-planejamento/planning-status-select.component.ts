import { Component, ElementRef, EventEmitter, HostListener, Input, Output, signal } from '@angular/core';
import { PLANNING_STATUSES, PlanningStatus } from '../../core/models';

/**
 * Pílula colorida + popover de seleção. Não é um <select> nativo porque a
 * cor de fundo (o "significado" do status) não é estilizável de forma
 * confiável num <select> entre navegadores — mesmo motivo documentado no
 * board original do Apice. Popover em position:fixed, calculado a partir do
 * botão-gatilho, porque o container da linha tem overflow-x:auto (corta
 * popover absolute).
 */
@Component({
  selector: 'app-planning-status-select',
  standalone: true,
  templateUrl: './planning-status-select.component.html',
})
export class PlanningStatusSelectComponent {
  @Input() value: PlanningStatus = 'backlog';
  @Output() valueChange = new EventEmitter<PlanningStatus>();

  readonly statuses = PLANNING_STATUSES;
  readonly open = signal(false);
  readonly pos = signal({ top: 0, left: 0 });

  constructor(private readonly host: ElementRef<HTMLElement>) {}

  current() {
    return this.statuses.find((s) => s.key === this.value) ?? this.statuses[0];
  }

  toggle(event: Event): void {
    event.stopPropagation();
    if (this.open()) {
      this.open.set(false);
      return;
    }
    const trigger = (event.currentTarget as HTMLElement).getBoundingClientRect();
    this.pos.set({ top: trigger.bottom + 4, left: trigger.left });
    this.open.set(true);
  }

  pick(status: PlanningStatus, event: Event): void {
    event.stopPropagation();
    this.valueChange.emit(status);
    this.open.set(false);
  }

  @HostListener('document:click', ['$event'])
  onDocClick(event: MouseEvent): void {
    if (this.open() && !this.host.nativeElement.contains(event.target as Node)) {
      this.open.set(false);
    }
  }
}
