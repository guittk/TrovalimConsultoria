import {
  AfterViewInit,
  Component,
  ElementRef,
  EventEmitter,
  forwardRef,
  HostListener,
  inject,
  Input,
  OnDestroy,
  Output,
  signal,
  ViewChild,
} from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

interface Opt {
  value: string;
  label: string;
  disabled: boolean;
}

/**
 * Dropdown da plataforma — substitui o `<select>` nativo, cuja LISTA ABERTA
 * é desenhada pelo sistema operacional e não aceita CSS de forma
 * consistente entre navegadores (cinza no Windows, roleta no iOS). Aqui a
 * lista é desenhada na página, com os tokens de conteúdo (`--surface`,
 * `--border`, `--hover`, `--accent-soft`), então ela combina com o resto.
 *
 * Uso: troca-se `<select …>` por `<app-select …>` e mantêm-se os
 * `<option>` dentro — eles são lidos de um slot escondido. Aceita
 * `[(ngModel)]` (implementa ControlValueAccessor) ou `[value]`/`(valueChange)`.
 *
 * Popover em `position: fixed` (calculado a partir do gatilho) porque
 * containers com `overflow:auto` — toolbars, linhas de tabela — recortariam
 * um dropdown `absolute`. Mesmo motivo dos seletores do Planejamento.
 */
@Component({
  selector: 'app-select',
  standalone: true,
  providers: [{ provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => SelectComponent), multi: true }],
  template: `
    <button
      type="button"
      class="sel-trigger"
      [class.sel-open]="open()"
      [disabled]="disabled"
      [attr.aria-expanded]="open()"
      aria-haspopup="listbox"
      (click)="toggle($event)"
      (keydown)="onTriggerKeydown($event)"
    >
      <span class="sel-value" [class.sel-placeholder]="!selectedLabel()">{{ selectedLabel() || placeholder }}</span>
      <svg class="sel-caret" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
        stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>
    </button>

    <span #slot class="sel-slot" aria-hidden="true"><ng-content></ng-content></span>

    @if (open()) {
      <div class="sel-backdrop" (click)="close()"></div>
      <div
        class="sel-popover"
        role="listbox"
        [style.top.px]="pos().top"
        [style.left.px]="pos().left"
        [style.minWidth.px]="pos().width"
      >
        @for (o of options(); track o.value; let i = $index) {
          <button
            type="button"
            class="sel-option"
            role="option"
            [class.sel-active]="o.value === val()"
            [class.sel-highlight]="i === highlight()"
            [attr.aria-selected]="o.value === val()"
            [disabled]="o.disabled"
            (mouseenter)="highlight.set(i)"
            (click)="pick(o.value)"
          >{{ o.label }}</button>
        }
      </div>
    }
  `,
})
export class SelectComponent implements AfterViewInit, OnDestroy, ControlValueAccessor {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  @Input() placeholder = 'Selecione';
  @Input() disabled = false;
  /** Ancoragem do popover; 'right' alinha pela borda direita do gatilho. */
  @Input() align: 'left' | 'right' = 'left';
  /**
   * Para os "selects de ação" (escolher → dispara algo → volta pro
   * placeholder), tipo "Mover para grupo…" na barra de lote. Depois de
   * emitir, o valor volta pra vazio.
   */
  @Input() resetAfterPick = false;

  /** Valor controlado por fora (alternativa ao ngModel). */
  @Input('value') set valueInput(v: string | null | undefined) {
    this.val.set(v ?? '');
  }
  @Output() valueChange = new EventEmitter<string>();

  @ViewChild('slot') private slot?: ElementRef<HTMLElement>;

  readonly open = signal(false);
  readonly options = signal<Opt[]>([]);
  readonly highlight = signal(-1);
  readonly pos = signal({ top: 0, left: 0, width: 0 });
  readonly val = signal('');

  private mo?: MutationObserver;
  private onChange: (v: string) => void = () => {};
  private onTouched: () => void = () => {};

  selectedLabel(): string {
    return this.options().find((o) => o.value === this.val())?.label ?? '';
  }

  ngAfterViewInit(): void {
    this.readOptions();
    const el = this.slot?.nativeElement;
    if (el) {
      this.mo = new MutationObserver(() => this.readOptions());
      this.mo.observe(el, { childList: true, subtree: true, characterData: true, attributes: true });
    }
  }

  ngOnDestroy(): void {
    this.mo?.disconnect();
  }

  private readOptions(): void {
    const el = this.slot?.nativeElement;
    if (!el) return;
    const opts: Opt[] = Array.from(el.querySelectorAll('option')).map((o) => ({
      value: o.value ?? o.textContent?.trim() ?? '',
      label: (o.textContent ?? '').trim(),
      disabled: o.disabled,
    }));
    this.options.set(opts);
  }

  toggle(event: Event): void {
    event.stopPropagation();
    this.open() ? this.close() : this.openMenu();
  }

  openMenu(): void {
    if (this.disabled) return;
    this.readOptions();
    const trigger = this.host.nativeElement.querySelector('.sel-trigger') as HTMLElement;
    const r = trigger.getBoundingClientRect();
    this.pos.set({
      top: r.bottom + 4,
      left: this.align === 'right' ? r.right - r.width : r.left,
      width: r.width,
    });
    this.highlight.set(Math.max(0, this.options().findIndex((o) => o.value === this.val())));
    this.open.set(true);
  }

  close(): void {
    if (this.open()) {
      this.open.set(false);
      this.onTouched();
    }
  }

  pick(v: string): void {
    this.val.set(v);
    this.onChange(v);
    this.valueChange.emit(v);
    this.close();
    if (this.resetAfterPick) {
      this.val.set('');
      this.onChange('');
    }
  }

  onTriggerKeydown(e: KeyboardEvent): void {
    if (!this.open()) {
      if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        this.openMenu();
      }
      return;
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      this.close();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      this.move(1);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      this.move(-1);
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      const o = this.options()[this.highlight()];
      if (o && !o.disabled) this.pick(o.value);
    }
  }

  private move(dir: number): void {
    const opts = this.options();
    if (!opts.length) return;
    let i = this.highlight();
    for (let step = 0; step < opts.length; step++) {
      i = (i + dir + opts.length) % opts.length;
      if (!opts[i].disabled) break;
    }
    this.highlight.set(i);
  }

  @HostListener('document:click', ['$event'])
  onDocClick(e: MouseEvent): void {
    if (this.open() && !this.host.nativeElement.contains(e.target as Node)) this.close();
  }

  @HostListener('window:resize')
  onResize(): void {
    this.close();
  }

  // ── ControlValueAccessor ──
  writeValue(v: string): void {
    this.val.set(v ?? '');
  }
  registerOnChange(fn: (v: string) => void): void {
    this.onChange = fn;
  }
  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }
  setDisabledState(isDisabled: boolean): void {
    this.disabled = isDisabled;
  }
}
