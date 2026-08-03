import { Injectable, inject } from '@angular/core';
import { DocumentData, Firestore, doc, setDoc } from 'firebase/firestore';
import { Observable, map } from 'rxjs';
import { FIRESTORE } from './firebase.providers';
import { docData$ } from './firestore-rx';
import { ProjectStatusOption, ProjectStatusSettings } from './models';

export const DEFAULT_PROJECT_STATUSES: ProjectStatusOption[] = [
  { key: 'em-andamento', label: 'Em Andamento', bg: '#DBEAFE', color: '#1D4ED8' },
  { key: 'aguardando-cliente', label: 'Aguardando Empresa', bg: '#FEF3C7', color: '#B45309' },
  { key: 'em-revisao', label: 'Em Revisão', bg: '#EDE9FE', color: '#6D28D9' },
  { key: 'concluido', label: 'Concluído', bg: '#D1FAE5', color: '#065F46' },
  { key: 'pausado', label: 'Pausado', bg: '#F3F4F6', color: '#374151' },
];

export const DEFAULT_PROJECT_STATUS_SETTINGS: ProjectStatusSettings = {
  statuses: DEFAULT_PROJECT_STATUSES,
};

@Injectable({ providedIn: 'root' })
export class ProjectStatusSettingsService {
  private readonly db: Firestore = inject(FIRESTORE);

  get$(): Observable<ProjectStatusSettings> {
    return docData$<DocumentData>(doc(this.db, 'settings', 'projectStatuses')).pipe(
      map((d) => this.normalize(d)),
    );
  }

  update(statuses: ProjectStatusOption[]): Promise<void> {
    return setDoc(doc(this.db, 'settings', 'projectStatuses'), { statuses }, { merge: true });
  }

  private normalize(d: DocumentData | null): ProjectStatusSettings {
    if (!d || !Array.isArray(d['statuses']) || !d['statuses'].length) return DEFAULT_PROJECT_STATUS_SETTINGS;
    return { statuses: d['statuses'] as ProjectStatusOption[] };
  }
}
