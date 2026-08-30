export type Role = 'owner' | 'manager' | 'client' | 'mentorado';

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
   * Tema (claro/escuro) da área de conteúdo escolhido nesta conta. Ao logar,
   * o app aplica este valor (ver App + ThemeService). O localStorage do
   * navegador ainda é usado como cache pré-login (evita flash no 1º paint).
   */
  themePref?: 'light' | 'dark';
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
  /** Cor da etiqueta do status (hex `#RRGGBB`). Ausente = usa a cor padrão
      da chave (ver DEFAULT_STATUS_COLORS) ou a paleta por índice. */
  color?: string;
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

/**
 * Catálogo de Serviços — separado do de Precificação de propósito: este
 * descreve O QUE cada serviço resolve/pra quem é indicado, o de
 * Precificação continua sendo só valor. O Brainstorm usa os dois juntos
 * (ver `suggestProspectApproach` em functions/index.js) pra casar a dor
 * declarada de um lead com a solução certa.
 */
export interface ServiceCatalogItem {
  key: string;
  name: string;
  description: string;
}

export interface ServiceCatalogSettings {
  items: ServiceCatalogItem[];
}

/**
 * Catálogo ÚNICO (`settings/catalog`) — junta o que antes eram dois docs
 * (`settings/pricing` + `settings/services`). Cada item tem sempre nome e
 * descrição; `unit`/`baseValue` só quando ele tem preço (`null` = "só
 * descrição"). `PricingSettingsService`/`ServiceCatalogSettingsService`
 * viraram views derivadas deste doc, então a calculadora de proposta, o
 * PDF e o Brainstorm continuam lendo o formato antigo sem mudança.
 */
export interface CatalogItem {
  key: string;
  name: string;
  description: string;
  unit: PricingUnit | null;
  baseValue: number | null;
}

export interface CatalogSettings {
  items: CatalogItem[];
}

/** Linha de uma proposta: cópia CONGELADA de um PricingItem no momento da geração — nunca aponta de volta pro catálogo. */
export interface PropostaItem {
  key: string;
  name: string;
  unit: PricingUnit;
  baseValue: number;
  qty: number;
}

export type PropostaStatus = 'rascunho' | 'enviada' | 'aceita' | 'recusada';

/**
 * Proposta comercial: nasce da calculadora dentro de uma Prospecção,
 * congela os itens/valores escolhidos (edição só permitida em 'rascunho' —
 * depois de enviada, o valor não muda mais sozinho mesmo que o catálogo
 * mude). Documento público por id (link de aceite), então NUNCA guarda nada
 * que não possa ser visto por quem tiver o link.
 */
export interface Proposta {
  id: string;
  leadId?: string | null;
  clientName: string;
  contactName?: string;
  email?: string;
  items: PropostaItem[];
  total: number;
  escopo?: string;
  condicoes?: string;
  status: PropostaStatus;
  createdAt?: unknown;
  sentAt?: unknown;
  respondedAt?: unknown;
  acceptedByName?: string;
  acceptedByEmail?: string;
  declineReason?: string;
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
  /** Timestamp da última mensagem (de qualquer lado) — evita ler a subcoleção messages só pra ordenar/badge. */
  lastMessageAt?: unknown;
  /** true quando a última mensagem foi do cliente e a equipe ainda não abriu a aba Mensagens do projeto. */
  unreadForStaff?: boolean;
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
  /** Rascunho de mensagem pra abordar o lead — sugerido pelo brainstorm de IA, editável antes de usar de verdade. */
  mensagemAbordagem?: string;
  lostReason?: string;
  /** Preenchidos só quando o lead vira Empresa + Projeto (estágio "ganho"). */
  empresaId?: string | null;
  projectId?: string | null;
  /** Id da proposta gerada a partir da calculadora deste lead (ver PropostasService.create). */
  propostaId?: string | null;
  createdAt?: unknown;
}

export type VagaStatus = 'aberta' | 'fechada';

/** Vaga de um projeto de Recrutamento e Seleção. */
export interface Vaga {
  id: string;
  projectId: string;
  title: string;
  description?: string;
  status: VagaStatus;
  createdAt?: unknown;
}

export type CandidateStage =
  | 'triagem'
  | 'entrevista-rh'
  | 'avaliacao'
  | 'entrevista-cliente'
  | 'proposta'
  | 'contratado'
  | 'reprovado';

/**
 * Candidato — coleção própria (banco de talentos), não subcoleção da vaga:
 * o reprovado de hoje é o contratado de outro cliente amanhã. Currículo e
 * parecer são dado pessoal de TERCEIRO (LGPD) — `consentGiven` registra que
 * a pessoa autorizou a Trovalim a guardar isso, e `retentionMonths` é por
 * quanto tempo depois de reprovado o registro deveria ser mantido antes de
 * ser revisado/excluído (sem automação ainda — é um número pra guiar
 * limpeza manual, não uma exclusão programada).
 */
export interface Candidate {
  id: string;
  vagaId: string | null;
  /**
   * Denormalizado da vaga no momento da criação — é o que a regra do
   * Firestore usa pra decidir se a empresa-cliente pode ver este
   * candidato, num hop só (candidato→projeto) em vez de dois
   * (candidato→vaga→projeto). Ausente/null = candidato sem vaga (banco
   * de talentos avulso), nunca visível pra cliente nenhum.
   */
  projectId?: string | null;
  name: string;
  email?: string;
  phone?: string;
  linkedinUrl?: string;
  /** Ausente = nenhum currículo enviado ainda. */
  resumePath?: string;
  resumeUrl?: string;
  stage: CandidateStage;
  notes?: string;
  consentGiven: boolean;
  consentDate?: string | null;
  retentionMonths?: number | null;
  /** Liberado pra empresa-cliente ver no portal do projeto. */
  clientVisible?: boolean;
  /** Parecer da empresa-cliente sobre o candidato — só ela escreve, a equipe só lê. */
  clientFeedback?: string;
  createdAt?: unknown;
}

/**
 * Registro de aparelho pra Push (FCM). O id do documento é o próprio token
 * — grava com setDoc(merge) em vez de addDoc, então registrar de novo o
 * mesmo aparelho nunca duplica linha.
 */
export interface PushToken {
  uid: string;
  token: string;
  createdAt?: unknown;
}

/**
 * Catálogo extraído de um texto livre pela Cloud Function
 * `fillCatalogsFromContext` — retorno só, nada é gravado: a tela de
 * Configurações mostra o antes/depois, a pessoa ajusta e confirma.
 */
export interface CatalogExtraction {
  items: { name: string; description: string; unit: PricingUnit | null; baseValue: number | null }[];
}

export interface ProspectSuggestion {
  perguntasDiagnostico: string[];
  servicosRecomendados: string[];
  mensagemAbordagem: string;
}

export interface MentorshipCompetency {
  id: string;
  nome: string;
  /** 1 a 5. */
  atual: number;
  desejado: number;
}

/**
 * O Plano de Desenvolvimento Individual — id do documento É o uid do
 * mentorado (nunca um id à parte), então não existe query pra achar "o
 * PDI de fulano", é sempre um get() direto. `empresaId` é opcional: sem
 * ele o mentorado contratou por conta própria (carreira); com ele, uma
 * empresa contratou o desenvolvimento de um colaborador — mas a empresa
 * NUNCA lê este documento (nem no modelo, nem na regra): o que a empresa
 * eventualmente vier a acompanhar é outra tela, não este PDI.
 */
export interface Mentorship {
  uid: string;
  mentoradoName?: string;
  empresaId?: string | null;
  objetivo?: string;
  competencias: MentorshipCompetency[];
  updatedAt?: unknown;
}

/**
 * Fotografia dos valores "atual" de cada competência num momento —
 * subcoleção, nunca sobrescrita, pra existir histórico de verdade. A régua
 * "atual" no documento raiz do PDI é sempre o valor mais recente; reavaliar
 * grava um snapshot ANTES de atualizar esse valor, então nada se perde.
 */
export interface CompetencyReassessment {
  id: string;
  /** yyyy-mm-dd. */
  date: string;
  /** competenciaId → valor (1 a 5) no momento desta reavaliação. */
  values: Record<string, number>;
  createdAt?: unknown;
}

export type MentorshipActionCategory = '70' | '20' | '10';
export type MentorshipActionStatus = 'pendente' | 'concluida';

/**
 * Ação do PDI (subcoleção). Campos de conteúdo (título, como fazer, prazo,
 * evidência esperada, categoria) só a equipe escreve; o mentorado só marca
 * status e anexa a evidência — a régua exata está na regra do Firestore,
 * não só na tela.
 */
export interface MentorshipAction {
  id: string;
  titulo: string;
  comoFazer?: string;
  prazo?: string | null;
  evidenciaEsperada?: string;
  /** 70 = experiência, 20 = exposição, 10 = educação formal. Opcional — nem todo PDI classifica assim. */
  categoria?: MentorshipActionCategory | null;
  status: MentorshipActionStatus;
  evidenciaUrl?: string | null;
  evidenciaNome?: string | null;
  createdAt?: unknown;
}

/** Mensagem entre a equipe e o mentorado — mesmo formato de ProjectMessage, de propósito. */
export interface MentorshipMessage {
  id?: string;
  author: string;
  authorRole: 'admin' | 'mentorado' | string;
  text: string;
  date?: unknown;
}

export type CareerTrackStage = 'diagnostico' | 'versao1' | 'revisao' | 'versao-final' | 'linkedin-otimizado';

export interface LinkedinChecklistItem {
  key: string;
  label: string;
  done: boolean;
}

/**
 * Consultoria de currículo/LinkedIn — o "lado pessoa" (carreira
 * individual), diferente do pipeline de candidato de R&S. Indexado pelo
 * uid da conta client, igual ao PDI de mentoria. `linkedinChecklist` é o
 * único campo que a PRÓPRIA pessoa pode escrever — é uma ferramenta de
 * autoacompanhamento, os itens são fixos (ver CAREER_LINKEDIN_ITEMS), não
 * autorados pela equipe como as ações do PDI.
 */
export interface CareerTrack {
  uid: string;
  clientName?: string;
  stage: CareerTrackStage;
  objetivo?: string;
  linkedinChecklist: LinkedinChecklistItem[];
  updatedAt?: unknown;
}

export type AssessmentQuestionType = 'escala' | 'texto';

export interface AssessmentQuestion {
  id: string;
  text: string;
  /** 'escala' = 1 a 5, soma na pontuação. 'texto' = resposta livre, não pontua. */
  type: AssessmentQuestionType;
}

/** Modelo reutilizável de avaliação (ex: "Perfil Comportamental", "Teste Técnico Júnior") — a equipe monta uma vez, aplica quantas vezes quiser. */
export interface AssessmentTemplate {
  id: string;
  name: string;
  description?: string;
  questions: AssessmentQuestion[];
  createdAt?: unknown;
}

export type AssessmentTargetType = 'candidate' | 'mentorado';

export interface AssessmentAnswer {
  questionId: string;
  questionText: string;
  type: AssessmentQuestionType;
  /** number para 'escala' (1-5), string para 'texto'. */
  value: number | string;
}

/**
 * Uma aplicação de um AssessmentTemplate a uma pessoa específica — nunca
 * editado depois de criado (corrigir = aplicar de novo), pra manter o
 * histórico fiel ao que foi respondido naquele momento.
 */
export interface AppliedAssessment {
  id: string;
  templateId: string;
  templateName: string;
  targetType: AssessmentTargetType;
  targetId: string;
  targetName: string;
  answers: AssessmentAnswer[];
  /** Soma das respostas 'escala' (1-5 cada). */
  totalScore: number;
  /** questions do tipo 'escala' × 5 — teto possível daquele modelo. */
  maxScore: number;
  appliedByName: string;
  createdAt?: unknown;
}

export type AuditAction =
  | 'candidate.delete'
  | 'candidate.retention-extend'
  | 'candidate.consent-update';

/**
 * Registro de ação sensível (LGPD) — append-only: a regra do Firestore não
 * libera update nem delete pra ninguém, nem pro owner, porque um log que
 * pode ser editado ou apagado deixa de servir como prova de auditoria.
 */
export interface AuditLogEntry {
  id?: string;
  action: AuditAction;
  targetType: 'candidate';
  targetId: string;
  targetName?: string;
  details?: string;
  actorUid: string;
  actorName: string;
  createdAt?: unknown;
}

/** Versão do currículo (subcoleção) — a equipe sobe o arquivo, a pessoa só lê. */
export interface ResumeVersion {
  id: string;
  versionNumber: number;
  fileUrl: string;
  filePath: string;
  /** O que mudou nesta versão em relação à anterior. */
  comment?: string;
  createdAt?: unknown;
  createdByName?: string;
}

/**
 * Planejamento — quadro estilo Monday.com (grupos coloridos, itens e
 * sub-itens). Sistema próprio, sem nenhum campo ou coleção em comum com o
 * Kanban (`Task`) — os dois convivem lado a lado, cada um com seu
 * vocabulário: Kanban é execução de tarefa simples (staff-only, colunas
 * fixas por status), Planejamento é um quadro por contexto (Global ou por
 * projeto) com grupos/sub-itens/colunas configuráveis.
 */
export type PlanningStatus = 'backlog' | 'todo' | 'doing' | 'blocked' | 'review' | 'done' | 'canceled';

export interface PlanningAttachment {
  nome: string;
  url: string;
  /** Salvo (diferente do padrão simplificado usado em TaskAttachment) — permite apagar o blob do Storage ao remover o anexo. */
  path: string;
}

/** Seção colorida dentro de um quadro — o quadro em si não é um documento, é implícito por `projectId` (null = Quadro Global). */
export interface PlanningGroup {
  id: string;
  projectId: string | null;
  nome: string;
  cor: string;
  ordem: number;
  colapsado?: boolean;
  createdAt?: unknown;
}

export interface PlanningItem {
  id: string;
  /** Denormalizado do grupo — permite indexar/filtrar itens por quadro direto, sem join. */
  projectId: string | null;
  groupId: string;
  /** Presente = é sub-item, aponta pro item-pai. Só 1 nível (sub-item não tem filhos). */
  parentId?: string | null;
  nome: string;
  descricao?: string;
  assigneeIds?: string[];
  status: PlanningStatus;
  /** 1 a 5 (estrelas). Ausente = sem prioridade definida. */
  prioridade?: number | null;
  /** yyyy-mm-dd. */
  dueDate?: string | null;
  anexos?: PlanningAttachment[];
  /**
   * 3 estados: ausente = automático (esconde campos assim que o item ganha
   * o 1º sub-item, porque quem carrega status/prazo real vira os filhos);
   * true/false = escolha explícita da pessoa (ícone "olho" na linha), que
   * vence pra sempre a partir daí mesmo que a quantidade de sub-itens mude.
   */
  mostrarCampos?: boolean | null;
  ordem: number;
  createdAt?: unknown;
}

export const PLANNING_STATUSES: { key: PlanningStatus; label: string; cor: string }[] = [
  { key: 'backlog', label: 'Backlog', cor: '#707588' },
  { key: 'todo', label: 'A Fazer', cor: '#79AFFD' },
  { key: 'doing', label: 'Fazendo', cor: '#FDBC64' },
  { key: 'blocked', label: 'Bloqueado', cor: '#E8697D' },
  { key: 'review', label: 'Revisão', cor: '#339ECD' },
  { key: 'done', label: 'Concluído', cor: '#33D391' },
  { key: 'canceled', label: 'Cancelado', cor: '#5C5C5C' },
];
