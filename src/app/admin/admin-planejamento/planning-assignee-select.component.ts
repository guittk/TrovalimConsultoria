import { Component, ElementRef, EventEmitter, HostListener, Input, Output, signal } from '@angular/core';
import { UserAccount } from '../../core/models';
import { initials } from '../../shared/initials';

/** Multiselect de responsáveis (avatares com iniciais) via popover. */
@Component({
  selector: 'app-planning-assignee-select',
  standalone: true,
  templateUrl: './planning-assignee-select.component.html',
})
export class PlanningAssigneeSelectComponent {
  @Input() value: string[] = [];
  @Input() staff: UserAccount[] = [];
  @Output() valueChange = new EventEmitter<string[]>();

  readonly open = signal(false);
  readonly pos = signal({ top: 0, left: 0 });

  constructor(private readonly host: ElementRef<HTMLElement>) {}

  initials(name: string): string {
    return initials(name);
  }

  /**
   * Quantos avatares mostrar na pílula antes de parar — o resto é dito pelo
   * texto ("N responsáveis"), não por mais avatares. Muitos responsáveis
   * estouravam/cortavam a coluna; a pílula agora tem tamanho fixo e o texto
   * trunca sozinho (mesma solução do board do Ápice).
   */
  private static readonly MAX_AVATARS = 3;

  assignedStaff(): UserAccount[] {
    return this.value.map((uid) => this.staff.find((s) => s.uid === uid)).filter((s): s is UserAccount => !!s);
  }

  /** Avatares desenhados na linha (empilhados). */
  visibleStaff(): UserAccount[] {
    return this.assignedStaff().slice(0, PlanningAssigneeSelectComponent.MAX_AVATARS);
  }

  /** Rótulo ao lado dos avatares: nomes até 2, contagem daí pra cima. */
  label(): string {
    const nomes = this.assignedStaff().map((s) => (s.name || s.email || '?').split(' ')[0]);
    if (!nomes.length) return 'Sem responsável';
    if (nomes.length <= 2) return nomes.join(', ');
    return `${nomes.length} responsáveis`;
  }

  /** `title` com os nomes completos, pra não perder nada quando trunca. */
  fullNames(): string {
    const nomes = this.assignedStaff().map((s) => s.name || s.email || '?');
    return nomes.length ? nomes.join(', ') : 'Sem responsável';
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

  isAssigned(uid: string): boolean {
    return this.value.includes(uid);
  }

  toggleAssignee(uid: string, event: Event): void {
    event.stopPropagation();
    const next = this.isAssigned(uid) ? this.value.filter((id) => id !== uid) : [...this.value, uid];
    this.valueChange.emit(next);
  }

  @HostListener('document:click', ['$event'])
  onDocClick(event: MouseEvent): void {
    if (this.open() && !this.host.nativeElement.contains(event.target as Node)) {
      this.open.set(false);
    }
  }
}
