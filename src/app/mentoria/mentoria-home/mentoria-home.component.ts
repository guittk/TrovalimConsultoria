import { AsyncPipe, DatePipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { of, switchMap } from 'rxjs';
import { AuthService } from '../../core/auth.service';
import { MentoriaService } from '../../core/mentoria.service';
import { MentorshipActivity } from '../../core/models';
import { PnavComponent } from '../../shared/pnav/pnav.component';

@Component({
  selector: 'app-mentoria-home',
  standalone: true,
  imports: [AsyncPipe, DatePipe, FormsModule, PnavComponent],
  templateUrl: './mentoria-home.component.html',
})
export class MentoriaHomeComponent {
  private readonly auth = inject(AuthService);
  private readonly mentoriaSvc = inject(MentoriaService);

  readonly userData$ = this.auth.userData$;
  readonly activities = toSignal(
    this.userData$.pipe(switchMap((data) => (data?.uid ? this.mentoriaSvc.activitiesFor$(data.uid) : of([])))),
    { initialValue: [] as MentorshipActivity[] },
  );

  readonly editingId = signal<string | null>(null);
  readonly responseText = signal('');
  readonly saving = signal(false);

  startRespond(a: MentorshipActivity): void {
    this.editingId.set(a.id!);
    this.responseText.set(a.response || '');
  }

  cancelRespond(): void {
    this.editingId.set(null);
  }

  async submitResponse(a: MentorshipActivity): Promise<void> {
    const response = this.responseText().trim();
    if (!response) return;
    this.saving.set(true);
    try {
      await this.mentoriaSvc.update(a.id!, { response, status: 'enviado' });
      this.editingId.set(null);
    } finally {
      this.saving.set(false);
    }
  }

  toDate(value: unknown): Date {
    return this.mentoriaSvc.toDate(value);
  }
}
