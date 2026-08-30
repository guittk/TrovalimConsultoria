import { Injectable, inject } from '@angular/core';
import { DocumentData, Firestore, doc, setDoc } from 'firebase/firestore';
import { Observable, map } from 'rxjs';
import { FIRESTORE } from './firebase.providers';
import { docData$ } from './firestore-rx';
import { ProjectStatusOption, ProjectStatusSettings } from './models';

/**
 * Cor padrão de cada status conhecido — tons profundos e discretos, no
 * espírito editorial da marca (mesma licença dos `--role-*`: sair um pouco
 * da paleta burgundy/dourada só pra distinguir de relance).
 */
export const DEFAULT_STATUS_COLORS: Record<string, string> = {
  'em-andamento': '#8A6D3B', // bronze — trabalho em curso
  'aguardando-cliente': '#3E5C76', // azul-ardósia — esperando a empresa
  'em-revisao': '#7A1B22', // wine-mid — na nossa revisão
  concluido: '#17703F', // verde — entregue
  pausado: '#6B6560', // grafite — parado
};

/** Cores usadas em ordem pra status personalizados (sem entrada em DEFAULT_STATUS_COLORS). */
export const STATUS_COLOR_PALETTE = [
  '#8A6D3B',
  '#3E5C76',
  '#7A1B22',
  '#17703F',
  '#6B6560',
  '#9C5A2E',
  '#4E4076',
];

/** Cor efetiva de um status: a explícita da opção, senão a padrão da chave, senão a paleta por índice. */
export function statusColorFor(option: ProjectStatusOption | null | undefined, index = 0): string {
  return (
    option?.color ||
    (option ? DEFAULT_STATUS_COLORS[option.key] : undefined) ||
    STATUS_COLOR_PALETTE[index % STATUS_COLOR_PALETTE.length]
  );
}

export const DEFAULT_PROJECT_STATUSES: ProjectStatusOption[] = [
  { key: 'em-andamento', label: 'Em Andamento', color: DEFAULT_STATUS_COLORS['em-andamento'] },
  { key: 'aguardando-cliente', label: 'Aguardando Empresa', color: DEFAULT_STATUS_COLORS['aguardando-cliente'] },
  { key: 'em-revisao', label: 'Em Revisão', color: DEFAULT_STATUS_COLORS['em-revisao'] },
  { key: 'concluido', label: 'Concluído', color: DEFAULT_STATUS_COLORS['concluido'] },
  { key: 'pausado', label: 'Pausado', color: DEFAULT_STATUS_COLORS['pausado'] },
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
