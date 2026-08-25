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
   * Somente para managers com projectAccess restrito: ids de /empresas
   * derivados do ownerId dos projetos em projectAccess (calculado ao salvar
   * a restrição, não editado diretamente). null/ausente = todas as empresas.
   * Usado pelas regras do Firestore para esconder empresas/contas de
   * clientes não ligados a nenhum projeto que o manager pode acessar.
   */
  companyAccess?: string[] | null;
  /** Chaves das abas do admin (ex: 'config', 'contatos') escondidas para esta conta. Ignorado para owner. */
  hiddenTabs?: string[];
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

export type PricingUnit = 'vaga' | 'participante' | 'encontro' | 'projeto' | 'hora';

export interface PricingItem {
  key: string;
  name: string;
  unit: PricingUnit;
  /** Valor base em reais, por unidade (por vaga, por participante, por encontro…). */
  baseValue: number;
}

/** Catálogo editável em Configurações — sem deploy. Usado pela calculadora dentro da Prospecção. */
export interface PricingSettings {
  items: PricingItem[];
}

export type TimelineMode = 'data' | 'ordem';

export interface TimelineStep {
  /** Identificador estável da etapa, gerado no cliente — permite arrastar/reordenar e, futuramente, vincular comentário ou aviso a uma etapa específica. Etapa antiga sem id recebe um ao ser carregada. */
  id?: string;
  name: string;
  /** Data no formato yyyy-mm-dd. Usada apenas quando o projeto está no modo "data". */
  date: string;
  done: boolean;
  /** Peso manual da etapa. Usado apenas quando o projeto está no modo "ordem". */
  weight?: number;
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
  /** Data de início do projeto (yyyy-mm-dd), opcional — base para o cálculo do peso das etapas por data. */
  startDate?: string | null;
  /** Prazo de entrega (yyyy-mm-dd), opcional. */
  deadline?: string | null;
  /** uid da conta (owner/manager) responsável por este projeto. */
  responsibleUid?: string | null;
  /** Quando true, o projeto fica invisível para a empresa-cliente no portal. */
  hidden?: boolean;
  /** Modo de ordenação da Linha do Tempo. Padrão: 'data'. */
  timelineMode?: TimelineMode;
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
  /** Ausente quando kind === 'link' (não há objeto no Storage). */
  path?: string;
  downloadUrl: string;
  sizeKb?: number;
  uploadedAt?: unknown;
  uploadedByRole: 'admin' | 'client' | string;
  uploadedByName?: string;
  /** 'link' = URL externa cadastrada (ex: pasta no SharePoint), sem upload. Ausente/'upload' = arquivo real no Storage. */
  kind?: 'upload' | 'link';
}

export type CalendarEventType = 'entrevista' | 'mentoria' | 'reuniao' | 'outro';

/**
 * Compromisso marcado no Calendário interno (entrevista, sessão, reunião).
 * Diferente de um PRAZO (etapa de projeto com data, ou tarefa do Kanban com
 * dueDate) — esses continuam vivendo só em `Project`/`Task` e entram na
 * mesma tela por leitura, nunca copiados pra cá.
 */
export interface CalendarEvent {
  id?: string;
  title: string;
  /** Data no formato yyyy-mm-dd. */
  date: string;
  /** Horário solto "HH:mm", separado da data de propósito — funde tudo num timestamp reabriria o problema de fuso. Ausente = compromisso de dia inteiro. */
  time?: string | null;
  type: CalendarEventType;
  description?: string;
  /** Projeto relacionado, opcional (ex: entrevista de um processo específico). */
  projectId?: string | null;
  createdByName?: string;
  createdAt?: unknown;
}

/** Envio do formulário de contato do site público (ainda sem tela na plataforma). */
export interface ContactSubmission {
  id?: string;
  name: string;
  email?: string;
  phone?: string;
  subject: string;
  message: string;
  createdAt?: unknown;
}

export type TaskStatus = 'a-fazer' | 'em-andamento' | 'aguardando-cliente' | 'concluido';
export type TaskPriority = 'baixa' | 'media' | 'alta' | 'urgente';

export interface TaskChecklistItem {
  id: string;
  texto: string;
  feito: boolean;
}

export interface TaskAttachment {
  nome: string;
  url: string;
  tipo?: string;
}

/** Tarefa interna da equipe (quadro Kanban) — não é visível para a empresa-cliente. */
export interface Task {
  id: string;
  titulo: string;
  descricao?: string;
  /** Projeto vinculado, opcional — tarefas internas (ex: comercial, administrativo) não precisam de projeto. */
  projectId?: string | null;
  assigneeIds?: string[];
  status: TaskStatus;
  prioridade: TaskPriority;
  /** Prazo no formato yyyy-mm-dd. */
  dueDate?: string | null;
  tags?: string[];
  checklist?: TaskChecklistItem[];
  anexos?: TaskAttachment[];
  /** Posição dentro da coluna de status — controla a ordem de exibição/arraste. */
  ordem?: number;
  createdAt?: unknown;
}

export type LeadStage = 'novo' | 'contato' | 'diagnostico' | 'proposta-enviada' | 'ganho' | 'perdido';

/**
 * Prospecção de cliente (empresa ou pessoa física). O funil é NOVO → CONTATO
 * → DIAGNÓSTICO → PROPOSTA ENVIADA, resolvido em GANHO ou PERDIDO — "perdido"
 * nunca é automático, é sempre decisão de quem está vendendo, com motivo.
 * Ao ganhar, `empresaId`/`projectId` guardam pra onde o lead virou (ver
 * `LeadsService.marcarGanho`) — os dois lados sabem de onde vieram.
 */
export interface Lead {
  id: string;
  name: string;
  contactName?: string;
  email?: string;
  phone?: string;
  stage: LeadStage;
  source?: 'site' | 'manual';
  /** Estimativa de valor do serviço, em reais — não é preço fechado (isso vem da Precificação). */
  valorEstimado?: number | null;
  /** Dor declarada / contexto da prospecção (por que ela procurou a Trovalim). */
  dor?: string;
  diagnostico?: string;
  escopo?: string;
  condicoes?: string;
  lostReason?: string;
  /** Preenchidos só quando o lead vira Empresa + Projeto (estágio "ganho"). */
  empresaId?: string | null;
  projectId?: string | null;
  createdAt?: unknown;
}
