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
  selector: 'app-admin-carreira',
  standalone: true,
  imports: [AsyncPipe, RouterLink, PnavComponent],
  templateUrl: './admin-carreira.component.html',
})
export class AdminCarreiraComponent {
  private readonly auth = inject(AuthService);
  private readonly accountsSvc = inject(AccountsService);

  readonly tabs = ADMIN_TABS;
  readonly userData$ = this.auth.userData$;
  readonly clients = toSignal(this.accountsSvc.listClients$(), { initialValue: [] as UserAccount[] });

  initials(name: string): string {
    return initials(name);
  }
}
