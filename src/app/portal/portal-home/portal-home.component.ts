import { Component, inject } from '@angular/core';
import { AsyncPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { of, switchMap } from 'rxjs';
import { AuthService } from '../../core/auth.service';
import { ProjectsService } from '../../core/projects.service';
import { PnavComponent } from '../../shared/pnav/pnav.component';
import { StatusBadgeComponent } from '../../shared/status-badge/status-badge.component';

@Component({
  selector: 'app-portal-home',
  standalone: true,
  imports: [AsyncPipe, RouterLink, PnavComponent, StatusBadgeComponent],
  templateUrl: './portal-home.component.html',
})
export class PortalHomeComponent {
  private readonly auth = inject(AuthService);
  private readonly projectsSvc = inject(ProjectsService);

  readonly userData$ = this.auth.userData$;
  readonly projects$ = this.userData$.pipe(
    switchMap((data) => (data ? this.projectsSvc.listForOwner$(data.companyId || data.uid) : of([]))),
  );
}
