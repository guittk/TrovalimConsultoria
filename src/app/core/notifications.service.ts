import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { ProjectsService } from './projects.service';
import { Project } from './models';

/**
 * Fonte única do sino de notificações do admin (ver PnavComponent) e do card
 * "Mensagens Não Lidas" do Painel — os dois listam a mesma coisa: projetos
 * com `unreadForStaff == true`, respeitando o mesmo projectAccess restrito
 * de manager usado no resto da área staff.
 */
@Injectable({ providedIn: 'root' })
export class NotificationsService {
  private readonly projectsSvc = inject(ProjectsService);

  unreadProjects$(projectAccess: string[] | null | undefined): Observable<Project[]> {
    const source$ = projectAccess?.length
      ? this.projectsSvc.listByIds$(projectAccess)
      : this.projectsSvc.listAll$();
    return source$.pipe(map((projects) => projects.filter((p) => p.unreadForStaff)));
  }
}
