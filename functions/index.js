const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { onDocumentCreated } = require('firebase-functions/v2/firestore');
const { onSchedule } = require('firebase-functions/v2/scheduler');
const { defineSecret } = require('firebase-functions/params');
const { initializeApp } = require('firebase-admin/app');

/**
 * Chave da OpenAI — segredo do Functions, não mais um doc em /settings/openai.
 * Setar com:  firebase functions:secrets:set OPENAI_API_KEY --project prod
 * As functions que a usam declaram `{ secrets: [OPENAI_API_KEY] }` e leem
 * `OPENAI_API_KEY.value()` em runtime. O navegador nunca a vê.
 */
const OPENAI_API_KEY = defineSecret('OPENAI_API_KEY');

const PRICING_UNITS = ['vaga', 'participante', 'encontro', 'projeto', 'hora'];

/**
 * Catálogo ÚNICO (`settings/catalog`), com fallback: enquanto o doc novo não
 * existir, compõe a lista a partir dos dois docs antigos (`settings/pricing`
 * + `settings/services`) juntando por nome. Espelha a lógica de
 * `CatalogSettingsService.compose` no cliente. Devolve
 * `[{ name, description, unit, baseValue }]`.
 */
async function loadCatalog(db) {
  const [catSnap, pricingSnap, servicesSnap] = await Promise.all([
    db.collection('settings').doc('catalog').get(),
    db.collection('settings').doc('pricing').get(),
    db.collection('settings').doc('services').get(),
  ]);
  if (catSnap.exists && Array.isArray(catSnap.data().items)) {
    return catSnap.data().items
      .filter((it) => it && it.name)
      .map((it) => ({
        name: String(it.name),
        description: it.description ? String(it.description) : '',
        unit: PRICING_UNITS.includes(it.unit) ? it.unit : null,
        baseValue: typeof it.baseValue === 'number' ? it.baseValue : null,
      }));
  }
  const priceItems = pricingSnap.exists && Array.isArray(pricingSnap.data().items) ? pricingSnap.data().items : [];
  const svcItems = servicesSnap.exists && Array.isArray(servicesSnap.data().items) ? servicesSnap.data().items : [];
  const byName = new Map();
  for (const p of priceItems) {
    if (!p || !p.name) continue;
    byName.set(String(p.name).toLowerCase(), {
      name: String(p.name),
      description: '',
      unit: PRICING_UNITS.includes(p.unit) ? p.unit : 'projeto',
      baseValue: Number(p.baseValue) || 0,
    });
  }
  for (const s of svcItems) {
    if (!s || !s.name) continue;
    const k = String(s.name).toLowerCase();
    const existing = byName.get(k);
    if (existing) existing.description = s.description ? String(s.description) : '';
    else byName.set(k, { name: String(s.name), description: s.description ? String(s.description) : '', unit: null, baseValue: null });
  }
  return [...byName.values()];
}
const { getAuth } = require('firebase-admin/auth');
const { getFirestore } = require('firebase-admin/firestore');
const { getMessaging } = require('firebase-admin/messaging');

initializeApp();

/**
 * Manda a mesma notificação pra todos os tokens registrados e apaga na hora
 * qualquer token que o FCM recusou como morto — usado pelos 3 gatilhos de
 * push (mensagem, arquivo novo, resumo diário) pra não repetir essa faxina
 * em cada um.
 */
async function sendPushToAll(db, tokensSnap, notification, link) {
  const tokens = tokensSnap.docs.map((d) => d.id);
  const response = await getMessaging().sendEachForMulticast({
    tokens,
    notification,
    webpush: { fcmOptions: { link } },
  });
  const deletions = [];
  response.responses.forEach((r, i) => {
    if (!r.success && (r.error?.code === 'messaging/registration-token-not-registered' || r.error?.code === 'messaging/invalid-registration-token')) {
      deletions.push(db.collection('pushTokens').doc(tokens[i]).delete());
    }
  });
  await Promise.all(deletions);
}

/**
 * Exclui um usuário do Firebase Authentication. Chamada pelo app depois de
 * excluir o doc em /users — o Admin SDK é o único jeito de remover o login,
 * o client SDK só pode apagar a própria conta autenticada.
 * Só o Owner (verificado pelo doc /users/{callerUid}, igual às regras do
 * Firestore) pode chamar isso, e nunca para a própria conta.
 */
exports.deleteAccountAuth = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Você precisa estar autenticado.');
  }

  const callerUid = request.auth.uid;
  const targetUid = request.data && request.data.uid;
  if (!targetUid || typeof targetUid !== 'string') {
    throw new HttpsError('invalid-argument', 'uid é obrigatório.');
  }
  if (targetUid === callerUid) {
    throw new HttpsError('failed-precondition', 'Não é possível excluir a própria conta.');
  }

  const db = getFirestore();
  const callerSnap = await db.collection('users').doc(callerUid).get();
  const callerRole = callerSnap.exists ? callerSnap.data().role : null;
  if (callerRole !== 'owner') {
    throw new HttpsError('permission-denied', 'Apenas o Proprietário pode excluir contas.');
  }

  try {
    await getAuth().deleteUser(targetUid);
  } catch (err) {
    if (err.code !== 'auth/user-not-found') {
      throw new HttpsError('internal', 'Erro ao excluir usuário do Authentication.');
    }
  }

  return { ok: true };
});

/**
 * Avisa a equipe por push quando a EMPRESA-CLIENTE (nunca a própria equipe)
 * manda mensagem num projeto. Manda pra TODOS os aparelhos registrados em
 * /pushTokens — ainda não filtra por projectAccess do manager (fica pra uma
 * rodada futura); pior caso hoje é um manager sem acesso àquele projeto
 * saber que "chegou mensagem", sem ver o conteúdo aqui.
 * Token que o FCM recusa como inválido é apagado no próprio envio, senão a
 * coleção acumula aparelho morto pra sempre.
 */
exports.notifyClientMessage = onDocumentCreated('projects/{projectId}/messages/{messageId}', async (event) => {
  const message = event.data && event.data.data();
  if (!message || message.authorRole !== 'client') return;

  const db = getFirestore();
  const projectId = event.params.projectId;

  const [projectSnap, tokensSnap] = await Promise.all([
    db.collection('projects').doc(projectId).get(),
    db.collection('pushTokens').get(),
  ]);
  if (tokensSnap.empty) return;

  const projectName = projectSnap.exists ? projectSnap.data().name : 'um projeto';

  await sendPushToAll(
    db,
    tokensSnap,
    { title: `Nova mensagem — ${projectName}`, body: String(message.text || '').slice(0, 140) },
    `/admin/projeto/${projectId}`,
  );
});

/**
 * Avisa a equipe quando a EMPRESA-CLIENTE sobe um arquivo num projeto —
 * mesma lógica do aviso de mensagem, mas pro gatilho de arquivo novo.
 * Arquivo subido pela própria equipe (uploadedByRole 'admin') não notifica
 * ninguém, óbvio.
 */
exports.notifyClientFile = onDocumentCreated('projects/{projectId}/files/{fileId}', async (event) => {
  const file = event.data && event.data.data();
  if (!file || file.uploadedByRole !== 'client') return;

  const db = getFirestore();
  const projectId = event.params.projectId;

  const [projectSnap, tokensSnap] = await Promise.all([
    db.collection('projects').doc(projectId).get(),
    db.collection('pushTokens').get(),
  ]);
  if (tokensSnap.empty) return;

  const projectName = projectSnap.exists ? projectSnap.data().name : 'um projeto';

  await sendPushToAll(
    db,
    tokensSnap,
    { title: `Novo arquivo — ${projectName}`, body: file.name || 'Arquivo enviado pelo cliente' },
    `/admin/projeto/${projectId}`,
  );
});

/**
 * Resumo diário, 9h em dias úteis (horário de Brasília): junta conversa sem
 * resposta, tarefa atrasada e prazo de projeto vencido numa notificação SÓ —
 * nunca uma por item, pra não virar spam. Se não há nada a avisar, não manda
 * nada (silêncio é melhor que "resumo vazio").
 */
exports.dailyDigest = onSchedule({ schedule: '0 9 * * 1-5', timeZone: 'America/Sao_Paulo' }, async () => {
  const db = getFirestore();
  const today = new Date().toISOString().slice(0, 10);

  const [unreadSnap, tasksSnap, projectsSnap, tokensSnap] = await Promise.all([
    db.collection('projects').where('unreadForStaff', '==', true).get(),
    db.collection('tasks').get(),
    db.collection('projects').get(),
    db.collection('pushTokens').get(),
  ]);
  if (tokensSnap.empty) return;

  const overdueTasks = tasksSnap.docs.filter((d) => {
    const t = d.data();
    return t.dueDate && t.dueDate < today && t.status !== 'concluido';
  }).length;
  const overdueProjects = projectsSnap.docs.filter((d) => {
    const p = d.data();
    return p.deadline && p.deadline < today && p.status !== 'concluido';
  }).length;
  const unreadCount = unreadSnap.size;

  const parts = [];
  if (unreadCount) parts.push(`${unreadCount} conversa${unreadCount > 1 ? 's' : ''} sem resposta`);
  if (overdueTasks) parts.push(`${overdueTasks} tarefa${overdueTasks > 1 ? 's' : ''} atrasada${overdueTasks > 1 ? 's' : ''}`);
  if (overdueProjects) parts.push(`${overdueProjects} prazo${overdueProjects > 1 ? 's' : ''} de projeto vencido${overdueProjects > 1 ? 's' : ''}`);
  if (!parts.length) return;

  await sendPushToAll(db, tokensSnap, { title: 'Resumo do dia', body: parts.join(' · ') }, '/admin/painel');
});

/**
 * Brainstorm de prospecção via OpenAI: dado o nome e a dor declarada de um
 * lead, sugere quais serviços do catálogo atacam aquela dor, perguntas de
 * diagnóstico e um rascunho de mensagem de abordagem. A chave da OpenAI vem
 * do segredo OPENAI_API_KEY do Functions — o navegador nunca a vê.
 * O catálogo é lido aqui (não confiado do payload do cliente) e usado
 * pra FILTRAR a resposta depois: a IA nunca pode sugerir um serviço que
 * não existe de verdade, senão o time vê algo que não vende.
 */
exports.suggestProspectApproach = onCall({ secrets: [OPENAI_API_KEY] }, async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Você precisa estar autenticado.');
  }

  const db = getFirestore();
  const callerSnap = await db.collection('users').doc(request.auth.uid).get();
  const callerRole = callerSnap.exists ? callerSnap.data().role : null;
  if (callerRole !== 'owner' && callerRole !== 'manager') {
    throw new HttpsError('permission-denied', 'Apenas a equipe pode usar o brainstorm.');
  }

  const name = request.data && request.data.name;
  const dor = request.data && request.data.dor;
  if (!name || typeof name !== 'string') {
    throw new HttpsError('invalid-argument', 'name é obrigatório.');
  }
  if (!dor || typeof dor !== 'string' || !dor.trim()) {
    throw new HttpsError('invalid-argument', 'Preencha a Dor Declarada / Contexto antes de pedir sugestão.');
  }

  const apiKey = OPENAI_API_KEY.value();
  if (!apiKey) {
    throw new HttpsError('failed-precondition', 'Segredo OPENAI_API_KEY não configurado no Functions.');
  }

  // Catálogo único (com fallback pros docs antigos). `catalogNames` alimenta
  // o filtro anti-alucinação lá embaixo — a IA nunca pode sugerir um nome
  // que não está no catálogo real.
  const catalog = await loadCatalog(db);
  const catalogNames = catalog.map((c) => c.name);
  const catalogLines = catalog.map((c) => (c.description ? `- ${c.name}: ${c.description}` : `- ${c.name}`));

  const prompt = [
    'Você ajuda uma consultoria de RH e carreira (a Trovalim) a preparar a abordagem de um lead.',
    `Nome do lead: ${name}`,
    `Dor declarada / contexto: ${dor}`,
    catalogLines.length
      ? `Catálogo de serviços da Trovalim (sugira SOMENTE destes, pelo nome exato):\n${catalogLines.join('\n')}`
      : 'Não há catálogo de serviços cadastrado ainda — não sugira nomes de serviço, deixe a lista vazia.',
    'Responda em JSON com exatamente estas chaves: "perguntasDiagnostico" (array de 3 a 5 perguntas em português, pra fazer na primeira conversa), "servicosRecomendados" (array com os nomes EXATOS do catálogo acima que atacam essa dor, vazio se nenhum catálogo foi passado), "mensagemAbordagem" (um rascunho curto, em português, de mensagem pra abordar esse lead — tom profissional e direto, sem emoji).',
  ].join('\n');

  let aiResponse;
  try {
    aiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        response_format: { type: 'json_object' },
        temperature: 0.5,
      }),
    });
  } catch (err) {
    throw new HttpsError('unavailable', 'Não consegui contatar a OpenAI. Tente novamente.');
  }

  if (!aiResponse.ok) {
    const status = aiResponse.status;
    if (status === 401) throw new HttpsError('failed-precondition', 'Segredo OPENAI_API_KEY inválido — regenere a chave e rode firebase functions:secrets:set OPENAI_API_KEY.');
    if (status === 429) throw new HttpsError('resource-exhausted', 'Limite da OpenAI atingido — tente novamente em instantes.');
    throw new HttpsError('internal', `Erro da OpenAI (${status}).`);
  }

  const payload = await aiResponse.json();
  let parsed;
  try {
    parsed = JSON.parse(payload.choices[0].message.content);
  } catch (err) {
    throw new HttpsError('internal', 'A OpenAI devolveu uma resposta que não deu pra entender. Tente novamente.');
  }

  const catalogNamesLower = new Set(catalogNames.map((n) => n.toLowerCase()));
  const servicosRecomendados = Array.isArray(parsed.servicosRecomendados)
    ? parsed.servicosRecomendados.filter((s) => typeof s === 'string' && catalogNamesLower.has(s.toLowerCase()))
    : [];

  return {
    perguntasDiagnostico: Array.isArray(parsed.perguntasDiagnostico) ? parsed.perguntasDiagnostico.filter((p) => typeof p === 'string') : [],
    servicosRecomendados,
    mensagemAbordagem: typeof parsed.mensagemAbordagem === 'string' ? parsed.mensagemAbordagem : '',
  };
});

/**
 * Dado um texto livre descrevendo tudo que a consultoria faz, a OpenAI
 * devolve o catálogo estruturado — uma lista de itens { name, description,
 * unit, baseValue }, onde `unit`/`baseValue` são null quando o item é só
 * descrição (sem preço). NÃO grava nada: a tela de Configurações mostra o
 * antes/depois e a pessoa confirma.
 */
exports.fillCatalogsFromContext = onCall({ secrets: [OPENAI_API_KEY] }, async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Você precisa estar autenticado.');
  }
  const db = getFirestore();
  const callerSnap = await db.collection('users').doc(request.auth.uid).get();
  if (!callerSnap.exists || callerSnap.data().role !== 'owner') {
    throw new HttpsError('permission-denied', 'Apenas o Proprietário pode preencher os catálogos.');
  }

  const context = request.data && request.data.context;
  if (!context || typeof context !== 'string' || context.trim().length < 20) {
    throw new HttpsError('invalid-argument', 'Descreva os serviços da consultoria com um pouco mais de detalhe.');
  }

  const apiKey = OPENAI_API_KEY.value();
  if (!apiKey) {
    throw new HttpsError('failed-precondition', 'Segredo OPENAI_API_KEY não configurado no Functions.');
  }

  const prompt = [
    'Você organiza o catálogo de uma consultoria de RH e carreira (a Trovalim) a partir de um texto livre.',
    'Texto fornecido pela consultora:',
    '"""',
    context.trim().slice(0, 8000),
    '"""',
    'Extraia a lista de serviços que a consultoria oferece. Responda em JSON com a chave "items": array de objetos com:',
    '- "name": string curto do serviço.',
    '- "description": string com o que ele resolve e pra quem é indicado (1 a 2 frases).',
    '- "unit": um de ["vaga","participante","encontro","projeto","hora"] SE o texto indica como o serviço é cobrado; caso contrário null.',
    '- "baseValue": número em reais se o texto dá um valor de referência; caso contrário null. Se "unit" for null, "baseValue" também é null.',
    'Não invente serviços que não estão no texto. Sem comentários, só o JSON.',
  ].join('\n');

  let aiResponse;
  try {
    aiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        response_format: { type: 'json_object' },
        temperature: 0.2,
      }),
    });
  } catch (err) {
    throw new HttpsError('unavailable', 'Não consegui contatar a OpenAI. Tente novamente.');
  }
  if (!aiResponse.ok) {
    const status = aiResponse.status;
    if (status === 401) throw new HttpsError('failed-precondition', 'Segredo OPENAI_API_KEY inválido — rode firebase functions:secrets:set OPENAI_API_KEY.');
    if (status === 429) throw new HttpsError('resource-exhausted', 'Limite da OpenAI atingido — tente novamente em instantes.');
    throw new HttpsError('internal', `Erro da OpenAI (${status}).`);
  }

  const payload = await aiResponse.json();
  let parsed;
  try {
    parsed = JSON.parse(payload.choices[0].message.content);
  } catch (err) {
    throw new HttpsError('internal', 'A OpenAI devolveu uma resposta que não deu pra entender. Tente novamente.');
  }

  const clean = (s) => (typeof s === 'string' ? s.trim() : '');
  const items = Array.isArray(parsed.items)
    ? parsed.items
        .map((it) => {
          const hasUnit = it && PRICING_UNITS.includes(it.unit);
          const baseValue = Number(it && it.baseValue);
          return {
            name: clean(it && it.name),
            description: clean(it && it.description),
            unit: hasUnit ? it.unit : null,
            baseValue: hasUnit && Number.isFinite(baseValue) && baseValue > 0 ? Math.round(baseValue) : hasUnit ? 0 : null,
          };
        })
        .filter((it) => it.name)
    : [];

  return { items };
});

/**
 * Candidatos liberados pra empresa-cliente ver, dentro de UM projeto —
 * chamada pelo portal (nunca lê /candidates direto: a regra do Firestore
 * é staff-only pra leitura, porque um get()/list() não filtra campo a
 * campo, e o resto do documento — currículo, notas, contato — é dado
 * pessoal de terceiro que a empresa nunca pode ver). Esta function lê com
 * o Admin SDK (ignora a regra) e devolve só os campos seguros.
 */
exports.listVisibleCandidates = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Você precisa estar autenticado.');
  }
  const projectId = request.data && request.data.projectId;
  if (!projectId || typeof projectId !== 'string') {
    throw new HttpsError('invalid-argument', 'projectId é obrigatório.');
  }

  const db = getFirestore();
  const [callerSnap, projectSnap] = await Promise.all([
    db.collection('users').doc(request.auth.uid).get(),
    db.collection('projects').doc(projectId).get(),
  ]);
  if (!projectSnap.exists) {
    throw new HttpsError('not-found', 'Projeto não encontrado.');
  }
  const caller = callerSnap.exists ? callerSnap.data() : {};
  const project = projectSnap.data();
  const isOwner = project.ownerId && (project.ownerId === request.auth.uid || project.ownerId === caller.companyId);
  const isStaff = caller.role === 'owner' || caller.role === 'manager';
  if (!isOwner && !isStaff) {
    throw new HttpsError('permission-denied', 'Sem acesso a este projeto.');
  }

  const snap = await db
    .collection('candidates')
    .where('projectId', '==', projectId)
    .where('clientVisible', '==', true)
    .get();

  return {
    candidates: snap.docs.map((d) => {
      const c = d.data();
      return {
        id: d.id,
        name: c.name || '',
        stage: c.stage || '',
        linkedinUrl: c.linkedinUrl || '',
        clientFeedback: c.clientFeedback || '',
      };
    }),
  };
});
