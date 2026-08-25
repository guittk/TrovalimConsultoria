import { AsyncPipe, DatePipe } from '@angular/common';
import { Component, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { Timestamp } from 'firebase/firestore';
import { AuthService } from '../../core/auth.service';
import { CareerTrackService, CAREER_STAGES } from '../../core/career-track.service';
import { CareerTrack, ResumeVersion } from '../../core/models';
import { PnavComponent } from '../../shared/pnav/pnav.component';

@Component({
  selector: 'app-portal-carreira',
  standalone: true,
  imports: [AsyncPipe, DatePipe, FormsModule, PnavComponent],
  templateUrl: './portal-carreira.component.html',
})
export class PortalCarreiraComponent {
  private readonly auth = inject(AuthService);
  private readonly careerSvc = inject(CareerTrackService);

  readonly userData$ = this.auth.userData$;
  readonly uid = this.auth.currentUser!.uid;
  readonly stages = CAREER_STAGES;

  readonly track = toSignal(this.careerSvc.get$(this.uid), { initialValue: null as CareerTrack | null });
  readonly versions = toSignal(this.careerSvc.versions$(this.uid), { initialValue: [] as ResumeVersion[] });

  stageLabel(stage: string): string {
    return this.stages.find((s) => s.key === stage)?.label || stage;
  }

  toDate(value: unknown): Date {
    if (value instanceof Timestamp) return value.toDate();
    return new Date();
  }

  checklistPercent(t: CareerTrack): number {
    const items = t.linkedinChecklist || [];
    if (!items.length) return 0;
    return Math.round((items.filter((i) => i.done).length / items.length) * 100);
  }

  async toggleChecklistItem(t: CareerTrack, key: string): Promise<void> {
    const next = (t.linkedinChecklist || []).map((i) => (i.key === key ? { ...i, done: !i.done } : i));
    await this.careerSvc.updateChecklist(this.uid, next);
  }
}
