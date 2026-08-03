export type Role = 'owner' | 'manager' | 'client';

export interface Branding {
  companyName: string;
  primaryColor: string;
  logo: string | null;
}

export interface UserAccount {
  uid: string;
  name?: string;
  email?: string;
  role?: Role | string;
  /** Foto de perfil da pessoa (distinta do logo de branding da empresa). */
  photoUrl?: string | null;
  /** Cargo do colaborador dentro da empresa-cliente (ex: "Gerente de RH"). */
  jobTitle?: string | null;
  /** Somente para managers: projetos que a conta pode ver. null/ausente = todos. */
  projectAccess?: string[] | null;
  /**
   * Somente para clientes: id do doc em /empresas ao qual esta conta está
   * vinculada como colaborador. Várias contas (e-mails) podem apontar para a
   * mesma empresa, permitindo múltiplos colaboradores por cliente — todas
   * herdam o branding e os limites de armazenamento da empresa.
   */
  companyId?: string | null;
  /**
   * Não persistidos no doc da conta — populados em runtime pelo
   * AuthService a partir do doc /empresas/{companyId} quando esta conta é
   * colaboradora, para as telas do portal não precisarem buscar a empresa
   * separadamente.
   */
  branding?: Branding;
  storageLimitMb?: number | null;
  storageUsageBytes?: number;
}

export interface Empresa {
  id: string;
  branding: Branding;
  /** Limite de armazenamento da empresa em MB. null/ausente = usa o limite padrão da plataforma. */
  storageLimitMb?: number | null;
  /** Uso atual de armazenamento da empresa em bytes, mantido por contador incremental. */
  storageUsageBytes?: number;
  createdAt?: unknown;
}

export interface PlatformSettings {
  primaryColor: string;
}

export interface FileTypeLimit {
  key: string;
  label: string;
  /** Extensões em minúsculas, sem o ponto. */
  extensions: string[];
  maxSizeMb: number;
}

export interface StorageSettings {
  totalLimitMb: number;
  defaultClientLimitMb: number;
  typeLimits: FileTypeLimit[];
}

export type ProjectStatus =
  | 'em-andamento'
  | 'aguardando-cliente'
  | 'em-revisao'
  | 'concluido'
  | 'pausado';

export interface ProjectStatusOption {
  key: string;
  label: string;
}

export interface ProjectStatusSettings {
  statuses: ProjectStatusOption[];
}

export interface TimelineStep {
  name: string;
  date: string;
  done: boolean;
}

export interface Project {
  id: string;
  name: string;
  description?: string;
  clientName?: string;
  clientEmail?: string;
  ownerId: string | null;
  status: ProjectStatus | string;
  progress: number;
  steps: TimelineStep[];
  branding: Branding | null;
  createdAt?: unknown;
  /** Prazo de entrega (yyyy-mm-dd), opcional. */
  deadline?: string | null;
  /** uid da conta (owner/manager) responsável por este projeto. */
  responsibleUid?: string | null;
}

export const PROJECT_FILE_CATEGORIES: { key: string; label: string }[] = [
  { key: 'contrato', label: 'Contrato' },
  { key: 'briefing', label: 'Briefing' },
  { key: 'curriculo', label: 'Currículo' },
  { key: 'relatorio', label: 'Relatório' },
  { key: 'outro', label: 'Outro' },
];

export interface ProjectMessage {
  id?: string;
  author: string;
  authorRole: 'admin' | 'client' | string;
  text: string;
  date?: unknown;
}

export interface ProjectFile {
  id?: string;
  name: string;
  path: string;
  downloadUrl: string;
  sizeKb?: number;
  uploadedAt?: unknown;
  uploadedByRole: 'admin' | 'client' | string;
  uploadedByName?: string;
  /** Categoria do arquivo (ver PROJECT_FILE_CATEGORIES). */
  category?: string;
}
