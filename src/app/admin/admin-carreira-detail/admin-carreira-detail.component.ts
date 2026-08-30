import { AsyncPipe, DatePipe } from '@angular/common';
import { Component, effect, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Timestamp } from 'firebase/firestore';
import { firstValueFrom } from 'rxjs';
import { AuthService } from '../../core/auth.service';
import { AccountsService } from '../../core/accounts.service';
import {
  CareerTrackService,
  CAREER_STAGES,
  CAREER_LINKEDIN_ITEMS,
  defaultLinkedinChecklist,
} from '../../core/career-track.service';
import { CareerTrack, CareerTrackStage, ResumeVersion, UserAccount } from '../../core/models';
import { initials } from '../../shared/initials';
import { PnavComponent } from '../../shared/pnav/pnav.component';
import { SelectComponent } from '../../shared/select/select.component';
import { ADMIN_TABS } from '../admin-tabs';
import { ConfirmService } from '../../shared/confirm/confirm.service';

@Component({
  selector: 'app-admin-carreira-detail',
  standalone: true,
  imports: [AsyncPipe, DatePipe, FormsModule, RouterLink, PnavComponent, SelectComponent],
  templateUrl: './admin-carreira-detail.component.html',
})
export class AdminCarreiraDetailComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly auth = inject(AuthService);
  private readonly accountsSvc = inject(AccountsService);
  private readonly careerSvc = inject(CareerTrackService);
  private readonly confirmSvc = inject(ConfirmService);

  readonly tabs = ADMIN_TABS;
  readonly userData$ = this.auth.userData$;
  readonly uid = this.route.snapshot.paramMap.get('uid')!;

  readonly client = toSignal(this.accountsSvc.get$(this.uid), { initialValue: null as UserAccount | null });
  readonly track = toSignal(this.careerSvc.get$(this.uid), { initialValue: null as CareerTrack | null });
  readonly versions = toSignal(this.careerSvc.versions$(this.uid), { initialValue: [] as ResumeVersion[] });

  readonly stages = CAREER_STAGES;
  readonly linkedinItems = CAREER_LINKEDIN_ITEMS;

  initials(name: string): string {
    return initials(name);
  }

  toDate(value: unknown): Date {
    if (value instanceof Timestamp) return value.toDate();
    return new Date();
  }

  /* ── PLANO ── */
  readonly stage = signal<CareerTrackStage>('diagnostico');
  readonly objetivo = signal('');
  readonly checklist = signal(defaultLinkedinChecklist());
  readonly savingPlano = signal(false);
  readonly planoOk = signal(false);
  private planoSeeded = false;

  constructor() {
    effect(() => {
      const t = this.track();
      if (t && !this.planoSeeded) {
        this.planoSeeded = true;
        this.stage.set(t.stage);
        this.objetivo.set(t.objetivo || '');
        this.checklist.set(t.linkedinChecklist?.length ? t.linkedinChecklist.map((i) => ({ ...i })) : defaultLinkedinChecklist());
      }
    });
  }

  toggleChecklistItem(key: string): void {
    this.checklist.update((items) => items.map((i) => (i.key === key ? { ...i, done: !i.done } : i)));
  }

  checklistPercent(): number {
    const items = this.checklist();
    if (!items.length) return 0;
    return Math.round((items.filter((i) => i.done).length / items.length) * 100);
  }

  async savePlano(): Promise<void> {
    this.savingPlano.set(true);
    try {
      await this.careerSvc.update(this.uid, {
        stage: this.stage(),
        objetivo: this.objetivo().trim(),
        linkedinChecklist: this.checklist(),
        clientName: this.client()?.name || this.client()?.email || '',
      });
      this.planoOk.set(true);
      setTimeout(() => this.planoOk.set(false), 3000);
    } finally {
      this.savingPlano.set(false);
    }
  }

  /* ── VERSÕES DO CURRÍCULO ── */
  readonly uploadComment = signal('');
  readonly uploading = signal(false);
  readonly uploadErr = signal('');

  async uploadVersion(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    this.uploadErr.set('');
    this.uploading.set(true);
    try {
      const nextVersion = (this.versions()[0]?.versionNumber || 0) + 1;
      const staffData = await firstValueFrom(this.userData$);
      await this.careerSvc.uploadVersion(
        this.uid,
        nextVersion,
        file,
        this.uploadComment().trim(),
        staffData?.name || staffData?.email || 'Equipe',
      );
      this.uploadComment.set('');
    } catch {
      this.uploadErr.set('Erro ao enviar o arquivo. Tente novamente.');
    } finally {
      this.uploading.set(false);
      input.value = '';
    }
  }

  async deleteVersion(v: ResumeVersion): Promise<void> {
    const ok = await this.confirmSvc.confirm({
      title: 'Excluir versão',
      message: `Excluir a versão ${v.versionNumber} permanentemente?`,
      confirmLabel: 'Excluir',
      danger: true,
    });
    if (!ok) return;
    await this.careerSvc.deleteVersion(this.uid, v);
  }
}
