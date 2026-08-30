import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

interface ScreenGuide {
  title: string;
  path: string;
  summary: string;
  details: string[];
}

/**
 * Guia de uso da própria plataforma — o que cada tela do admin faz.
 * Antes era uma tela solta ("Treinamentos") na sidebar; virou uma aba
 * dentro de Configurações pra não confundir com os treinamentos que a
 * consultoria presta aos clientes. Componente puro de conteúdo, sem
 * navegação própria — vive embutido em `admin-config`.
 */
const SCREENS: ScreenGuide[] = [
  {
    title: 'Dashboard',
    path: '/admin/painel',
    summary: 'Tela inicial do admin: o que precisa de atenção agora + os indicadores agregados da operação.',
    details: [
      'Card de "Mensagens Não Lidas" lista projetos com mensagem nova do cliente ainda não aberta pela equipe — o mesmo contador aparece no sino da barra de navegação.',
      'A seção "Indicadores da Operação" (antiga tela "Relatórios") reúne funil de prospecção, carteira de projetos por status, pipeline de candidatos, tarefas internas e contagem de mentorados/trilhas ativas — tudo calculado na hora, a partir dos dados atuais (não é um histórico).',
      '👤 100% interno — não existe um "painel" equivalente pro cliente/mentorado; ele cai direto na própria home (Portal ou Mentoria).',
    ],
  },
  {
    title: 'Projetos',
    path: '/admin',
    summary: 'Lista de todos os projetos em andamento, cada um vinculado a uma empresa-cliente.',
    details: [
      'Abrir um projeto dá acesso à Linha do Tempo (etapas com data ou peso manual), Mensagens (chat com o cliente), Arquivos e — em projetos de Recrutamento & Seleção — as Vagas com seus candidatos.',
      '👤 Tela equivalente do cliente: em "/portal" ele vê a lista dos próprios projetos (nome, status, % concluído) com a marca da empresa dele (logo/cor); em "/portal/:id" abre um projeto e vê a Linha do Tempo (só leitura), o chat de Mensagens (pode escrever), Arquivos (baixa os da equipe, sobe os seus e exclui só os que ele mesmo enviou) e, se o projeto for de R&S, a lista de Candidatos com um campo de "parecer" por candidato.',
      'O cliente nunca vê as notas internas da equipe nem as etapas antes de publicadas na Linha do Tempo.',
    ],
  },
  {
    title: 'Empresas',
    path: '/admin/clientes',
    summary: 'Cadastro das empresas-cliente: branding (nome, cor, logo), limite de armazenamento e os projetos/contas vinculados.',
    details: [
      'Uma empresa pode ter vários colaboradores (contas) e vários projetos.',
      'Excluir uma empresa é destrutivo e em cascata — a tela deixa escolher, projeto a projeto, se apaga ou só desvincula antes de remover.',
      '👤 Não existe tela equivalente pro cliente — ele só enxerga o resultado (o logo/cor de marca aplicados no Portal).',
    ],
  },
  {
    title: 'Kanban',
    path: '/admin/kanban',
    summary: 'Quadro de tarefas internas da equipe (a fazer / em andamento / aguardando cliente / concluído).',
    details: [
      'Tarefa pode ou não estar ligada a um projeto — tarefas administrativas/comerciais ficam soltas.',
      'Suporta responsáveis, prioridade, prazo, tags e checklist dentro do card.',
      '👤 100% interno — o cliente/mentorado nunca vê este quadro.',
    ],
  },
  {
    title: 'Planejamento',
    path: '/admin/planejamento',
    summary: 'Quadro estilo Monday.com: grupos coloridos, itens e sub-itens, com colunas de status, prioridade, responsáveis e prazo. Sistema separado do Kanban — nenhum dado em comum.',
    details: [
      'Um seletor no topo troca entre o Quadro Global (equipe inteira) e um quadro por projeto — cada um é um espaço isolado.',
      'Arraste pra reordenar grupos e itens; soltar um sub-item sobre um item raiz o transforma em filho dele.',
      'Seleção em massa (checkbox por linha) libera uma barra de ações em lote: mudar status, mover de grupo ou excluir vários de uma vez.',
      '👤 100% interno — mesmo o quadro "por projeto" fica só do lado da equipe.',
    ],
  },
  {
    title: 'Leads',
    path: '/admin/prospeccao',
    summary: 'Funil de vendas em Kanban: Novo → Contato → Diagnóstico → Proposta Enviada, resolvido em Ganho ou Perdido.',
    details: [
      'Dentro de um lead, a calculadora gera uma Proposta com os valores do catálogo (Configurações) — a partir daí os valores ficam congelados, mesmo que o catálogo mude.',
      'A proposta abre numa tela própria (Admin › Proposta) com "Marcar como Enviada e Gerar Link" — esse link é público, sem login, e é o que o cliente usa pra aceitar ou recusar.',
      'Ao marcar um lead como Ganho, ele vira Empresa + Projeto automaticamente.',
      '👤 O funil é interno. O lead só vê a página pública "/proposta/:id": escopo, itens com valores, condições, "Baixar PDF" e, enquanto o status for "Enviada", "Aceitar" ou "Recusar".',
    ],
  },
  {
    title: 'Brainstorm',
    path: '/admin/brainstorm',
    summary: 'Descreva a dor de um cliente e a IA cruza com os catálogos de Serviços e Precificação pra sugerir perguntas de diagnóstico, serviços recomendados e um rascunho de mensagem de abordagem.',
    details: [
      'Pode ser usado avulso ou vinculado a uma Prospecção — o botão "Abrir Brainstorm" dentro de um lead já traz o nome/dor pré-preenchidos.',
      'Vinculado a um lead, cada sugestão vira um botão "Usar" que grava naquela prospecção sem sobrescrever campo com conteúdo. Avulso, os botões viram "Copiar".',
      'A IA nunca inventa serviço: a resposta é filtrada contra os nomes reais dos dois catálogos.',
      '👤 100% interno — ferramenta de preparação da equipe.',
    ],
  },
  {
    title: 'Contatos',
    path: '/admin/contatos',
    summary: 'Envios do formulário de contato do site público — só leitura, sem fluxo de resposta dentro da plataforma ainda.',
    details: [
      '👤 Quem preenche é um visitante anônimo do site (sem login) — depois de enviar não tem mais visão nenhuma dentro da plataforma; a equipe responde por fora.',
    ],
  },
  {
    title: 'Calendário',
    path: '/admin/calendario',
    summary: 'Compromissos internos (entrevista, mentoria, reunião) num calendário mensal.',
    details: [
      'Mostra também, por leitura, os prazos que já existem em Projetos e Tarefas — sem duplicar esses dados aqui.',
      '👤 100% interno — o cliente/mentorado não tem um calendário próprio na plataforma.',
    ],
  },
  {
    title: 'Mentoria',
    path: '/admin/mentoria',
    summary: 'Lista de mentorados e, em cada um, o PDI — Plano de Desenvolvimento Individual (competências atual/desejado + ações no modelo 70/20/10).',
    details: [
      'O mentorado só marca as próprias ações como concluídas e anexa evidência — quem escreve o conteúdo do plano é a equipe.',
      '👤 Tela equivalente: em "/mentoria" ele vê "Competências" (barras, só leitura), "Evolução" (mini-gráfico das reavaliações), "Minhas Ações" (marca feito/pendente e anexa evidência) e um chat de "Mensagens" com a equipe.',
    ],
  },
  {
    title: 'Carreira',
    path: '/admin/carreira',
    summary: 'Consultoria individual de currículo/LinkedIn — o lado "pessoa física", separado do pipeline de vagas de R&S.',
    details: [
      'Acompanha o estágio (diagnóstico → versão 1 → revisão → versão final → LinkedIn otimizado) e um checklist de LinkedIn que a própria pessoa marca.',
      '👤 Tela equivalente: em "/portal/carreira/minha" ele vê o estágio atual, o objetivo, o "Checklist do LinkedIn" (que ele marca) e "Versões do Currículo" (baixa cada versão que a consultora sobe).',
    ],
  },
  {
    title: 'Avaliações',
    path: '/admin/avaliacoes',
    summary: 'Modelos reutilizáveis de avaliação (ex: perfil comportamental, teste técnico) e o histórico de aplicações a candidatos ou mentorados.',
    details: [
      'Uma aplicação nunca é editada depois de respondida — corrigir é aplicar de novo, pra manter o histórico fiel.',
      '👤 Não há tela própria pro candidato/mentorado responder dentro da plataforma ainda — a equipe registra aqui o resultado de uma avaliação aplicada por fora.',
    ],
  },
  {
    title: 'LGPD',
    path: '/admin/lgpd',
    summary: 'Central de privacidade: consentimento e prazo de retenção dos dados de candidatos, com exclusão manual quando o prazo vence.',
    details: [
      'Toda ação sensível grava um registro de auditoria que ninguém — nem o owner — consegue editar ou apagar depois.',
      '👤 100% interno — é sobre dados de candidatos de vaga, que nem têm login na plataforma.',
    ],
  },
  {
    title: 'Contas',
    path: '/admin/config',
    summary: 'Contas de acesso à plataforma — equipe (owner/manager) e clientes/mentorados.',
    details: [
      'Só o owner cria/apaga conta ou muda papel; managers podem editar o resto.',
      'Um manager pode ter acesso restrito a projetos específicos, e abas inteiras da sidebar podem ficar escondidas pra ele aqui.',
      '👤 Não existe tela equivalente — o cliente/mentorado só faz login e é redirecionado pro Portal ou pra Mentoria.',
    ],
  },
  {
    title: 'Configurações',
    path: '/admin/config',
    summary: 'Ajustes globais da plataforma: aparência, status de projeto, limites de armazenamento e os catálogos de Precificação e de Serviços usados na Prospecção e no Brainstorm — mais este Guia.',
    details: [
      'Precificação e Serviços são catálogos separados de propósito: um tem o valor de cada item, o outro descreve o que ele resolve — o Brainstorm usa os dois juntos. Dá pra preencher os dois de uma vez colando um texto e deixando a IA organizar.',
      '👤 100% interno — nada aqui tem tela espelhada pro cliente; ele só sente o efeito indireto (cor de marca, limite de upload, itens de uma Proposta).',
    ],
  },
];

@Component({
  selector: 'app-platform-guide',
  standalone: true,
  imports: [RouterLink],
  template: `
    <div class="card">
      <div class="card-title"><span class="card-title-bar"></span>Guia da plataforma</div>
      <p class="form-help" style="margin-bottom:1.5rem">
        O que cada tela do admin faz — um guia rápido pra quem está conhecendo a plataforma.
        O 👤 marca o que o cliente/mentorado vê do outro lado.
      </p>
      <div style="display:flex;flex-direction:column;gap:1.5rem">
        @for (s of screens; track s.title) {
          <div style="border-bottom:1px solid var(--border);padding-bottom:1.5rem">
            <div style="display:flex;align-items:baseline;gap:.6rem;flex-wrap:wrap;margin-bottom:.4rem">
              <span style="font-family:var(--serif);font-size:1.05rem;color:var(--accent-text);font-weight:400">{{ s.title }}</span>
              <a [routerLink]="s.path" class="link-btn" style="font-size:.68rem">abrir</a>
            </div>
            <p style="font-size:.87rem;color:var(--graphite);line-height:1.55">{{ s.summary }}</p>
            @if (s.details.length) {
              <ul style="margin:.6rem 0 0 1.1rem;display:flex;flex-direction:column;gap:.35rem">
                @for (d of s.details; track d) {
                  <li style="font-size:.82rem;color:var(--muted);line-height:1.5">{{ d }}</li>
                }
              </ul>
            }
          </div>
        }
      </div>
    </div>
  `,
})
export class PlatformGuideComponent {
  readonly screens = SCREENS;
}
