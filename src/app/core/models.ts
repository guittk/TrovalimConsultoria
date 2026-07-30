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
  branding?: Branding;
  /** Somente para managers: projetos que a conta pode ver. null/ausente = todos. */
  projectAccess?: string[] | null;
  /** Limite de armazenamento do cliente em MB. null/ausente = usa o limite padrão da plataforma. */
  storageLimitMb?: number | null;
  /** Uso atual de armazenamento do cliente em bytes, mantido por contador incremental. */
  storageUsageBytes?: number;
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
}

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
}
