import { AsyncPipe, DatePipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { combineLatest, firstValueFrom } from 'rxjs';
import { AuthService } from '../../core/auth.service';
import { ProjectsService } from '../../core/projects.service';
import { PnavComponent } from '../../shared/pnav/pnav.component';
import { StatusBadgeComponent } from '../../shared/status-badge/status-badge.component';

@Component({
  selector: 'app-portal-project',
  standalone: true,
  imports: [AsyncPipe, DatePipe, FormsModule, RouterLink, PnavComponent, StatusBadgeComponent],
  templateUrl: './portal-project.component.html',
})
export class PortalProjectComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly auth = inject(AuthService);
  private readonly projectsSvc = inject(ProjectsService);

  readonly pid = this.route.snapshot.paramMap.get('id')!;
  readonly userData$ = this.auth.userData$;
  readonly project$ = this.projectsSvc.get$(this.pid);
  readonly messages$ = this.projectsSvc.messages$(this.pid);
  readonly files$ = this.projectsSvc.files$(this.pid);

  readonly messageText = signal('');
  readonly uploading = signal(false);

  constructor() {
    combineLatest([this.auth.user$, this.project$])
      .pipe(takeUntilDestroyed())
      .subscribe(([user, project]) => {
        if (!user) return;
        if (!project || project.ownerId !== user.uid) {
          this.router.navigateByUrl('/portal');
        }
      });
  }

  toDate(value: unknown): Date {
    return this.projectsSvc.toDate(value);
  }

  async sendMessage(): Promise<void> {
    const text = this.messageText().trim();
    if (!text) return;
    const user = this.auth.currentUser;
    if (!user) return;
    this.messageText.set('');
    const data = await firstValueFrom(this.userData$);
    await this.projectsSvc.sendMessage(this.pid, data?.name || user.email || '', 'client', text);
  }

  async onFileSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    const user = this.auth.currentUser;
    if (!user) return;
    this.uploading.set(true);
    const data = await firstValueFrom(this.userData$);
    try {
      await this.projectsSvc.uploadFile(this.pid, file, 'client', data?.name || user.email || '');
    } finally {
      this.uploading.set(false);
      input.value = '';
    }
  }
}
