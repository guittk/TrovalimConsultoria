import { AsyncPipe } from '@angular/common';
import { Component, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth.service';
import { AccountsService } from '../../core/accounts.service';
import { UserAccount } from '../../core/models';
import { initials } from '../../shared/initials';
import { PnavComponent } from '../../shared/pnav/pnav.component';
import { ADMIN_TABS } from '../admin-tabs';

@Component({
  selector: 'app-admin-mentoria',
  standalone: true,
  imports: [AsyncPipe, RouterLink, PnavComponent],
  templateUrl: './admin-mentoria.component.html',
})
export class AdminMentoriaComponent {
  private readonly auth = inject(AuthService);
  private readonly accountsSvc = inject(AccountsService);

  readonly tabs = ADMIN_TABS;
  readonly userData$ = this.auth.userData$;
  readonly mentorados = toSignal(this.accountsSvc.listMentorados$(), { initialValue: [] as UserAccount[] });

  initials(name: string): string {
    return initials(name);
  }
}
