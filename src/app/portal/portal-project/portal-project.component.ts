import { AsyncPipe, DatePipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { combineLatest, firstValueFrom } from 'rxjs';
import { AuthService } from '../../core/auth.service';
import { ProjectsService } from '../../core/projects.service';
import { PlatformSettingsService, DEFAULT_PLATFORM_COLOR } from '../../core/platform-settings.service';
import { StorageSettingsService, DEFAULT_STORAGE_SETTINGS } from '../../core/storage-settings.service';
import { StorageUsageService } from '../../core/storage-usage.service';
import { ProjectFile } from '../../core/models';
import { initials } from '../../shared/initials';
import { PnavComponent } from '../../shared/pnav/pnav.component';
import { StatusBadgeComponent } from '../../shared/status-badge/status-badge.component';
import { FileIconComponent } from '../../shared/file-icon/file-icon.component';
import { ConfirmService } from '../../shared/confirm/confirm.service';

@Component({
  selector: 'app-portal-project',
  standalone: true,
  imports: [AsyncPipe, DatePipe, FormsModule, RouterLink, PnavComponent, StatusBadgeComponent, FileIconComponent],
  templateUrl: './portal-project.component.html',
})
export class PortalProjectComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly auth = inject(AuthService);
  private readonly projectsSvc = inject(ProjectsService);
  private readonly platformSettingsSvc = inject(PlatformSettingsService);
  private readonly storageSettingsSvc = inject(StorageSettingsService);
  private readonly storageUsageSvc = inject(StorageUsageService);
  private readonly confirmSvc = inject(ConfirmService);

  readonly pid = this.route.snapshot.paramMap.get('id')!;
  readonly userData$ = this.auth.userData$;
  readonly project$ = this.projectsSvc.get$(this.pid);
  readonly messages$ = this.projectsSvc.messages$(this.pid);
  readonly files$ = this.projectsSvc.files$(this.pid);
  readonly platformColor = toSignal(this.platformSettingsSvc.get$(), {
    initialValue: { primaryColor: DEFAULT_PLATFORM_COLOR },
  });
  readonly storageSettings = toSignal(this.storageSettingsSvc.get$(), {
    initialValue: DEFAULT_STORAGE_SETTINGS,
  });

  readonly messageText = signal('');
  readonly uploading = signal(false);
  readonly uploadErr = signal('');
  readonly dragOver = signal(false);

  constructor() {
    combineLatest([this.auth.user$, this.userData$, this.project$])
      .pipe(takeUntilDestroyed())
      .subscribe(([user, data, project]) => {
        if (!user) return;
        const ownerId = data?.companyId ?? null;
        if (!project || !ownerId || project.ownerId !== ownerId || project.hidden) {
          this.router.navigateByUrl('/portal');
        }
      });
  }

  toDate(value: unknown): Date {
    return this.projectsSvc.toDate(value);
  }

  initials(name: string): string {
    return initials(name);
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

  async onDropFile(event: DragEvent): Promise<void> {
    event.preventDefault();
    this.dragOver.set(false);
    const file = event.dataTransfer?.files?.[0];
    if (!file) return;
    await this.handleUpload(file);
  }

  async onFileSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    await this.handleUpload(file);
    input.value = '';
  }

  private async handleUpload(file: File): Promise<void> {
    const user = this.auth.currentUser;
    if (!user) return;
    this.uploadErr.set('');
    const data = await firstValueFrom(this.userData$);
    const totalUsageBytes = await this.storageUsageSvc.totalUsageBytes();
    const err = this.storageSettingsSvc.checkUpload(
      file,
      this.storageSettings(),
      data?.storageUsageBytes || 0,
      data?.storageLimitMb,
      totalUsageBytes,
    );
    if (err) {
      this.uploadErr.set(err);
      return;
    }
    this.uploading.set(true);
    try {
      const project = await firstValueFrom(this.project$);
      const ownerId = project?.ownerId ?? (data?.companyId || user.uid);
      await this.projectsSvc.uploadFile(this.pid, ownerId, file, 'client', data?.name || user.email || '');
    } finally {
      this.uploading.set(false);
    }
  }

  async deleteFile(f: ProjectFile): Promise<void> {
    const ok = await this.confirmSvc.confirm({
      title: 'Excluir arquivo',
      message: 'Excluir este arquivo que você enviou? Isso não pode ser desfeito.',
      confirmLabel: 'Excluir',
      danger: true,
    });
    if (!ok) return;
    const project = await firstValueFrom(this.project$);
    const sizeBytes = (f.sizeKb || 0) * 1024;
    await this.projectsSvc.deleteFile(this.pid, f.id!, f.path, project?.ownerId ?? null, sizeBytes);
  }
}
