const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { onDocumentCreated } = require('firebase-functions/v2/firestore');
const { initializeApp } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');
const { getFirestore } = require('firebase-admin/firestore');
const { getMessaging } = require('firebase-admin/messaging');

initializeApp();

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
  const tokens = tokensSnap.docs.map((d) => d.id);

  const response = await getMessaging().sendEachForMulticast({
    tokens,
    notification: {
      title: `Nova mensagem — ${projectName}`,
      body: String(message.text || '').slice(0, 140),
    },
    webpush: {
      fcmOptions: { link: `/admin/projeto/${projectId}` },
    },
  });

  const deletions = [];
  response.responses.forEach((r, i) => {
    if (!r.success && (r.error?.code === 'messaging/registration-token-not-registered' || r.error?.code === 'messaging/invalid-registration-token')) {
      deletions.push(db.collection('pushTokens').doc(tokens[i]).delete());
    }
  });
  await Promise.all(deletions);
});

/**
 * Brainstorm de prospecção via OpenAI: dado o nome e a dor declarada de um
 * lead, sugere quais serviços do catálogo atacam aquela dor, perguntas de
 * diagnóstico e um rascunho de mensagem de abordagem. A chave da OpenAI é
 * lida de /settings/openai via Admin SDK — o navegador nunca a vê, e a
 * regra do Firestore já restringe o doc a owner mesmo por engano.
 * O catálogo é lido aqui (não confiado do payload do cliente) e usado
 * pra FILTRAR a resposta depois: a IA nunca pode sugerir um serviço que
 * não existe de verdade, senão o time vê algo que não vende.
 */
exports.suggestProspectApproach = onCall(async (request) => {
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

  const [keySnap, pricingSnap] = await Promise.all([
    db.collection('settings').doc('openai').get(),
    db.collection('settings').doc('pricing').get(),
  ]);
  const apiKey = keySnap.exists ? keySnap.data().apiKey : '';
  if (!apiKey) {
    throw new HttpsError('failed-precondition', 'Chave da OpenAI não configurada — cole em Configurações → Integração com IA.');
  }
  const catalogItems = (pricingSnap.exists && Array.isArray(pricingSnap.data().items)) ? pricingSnap.data().items : [];
  const catalogNames = catalogItems.map((it) => it.name).filter(Boolean);

  const prompt = [
    'Você ajuda uma consultoria de RH e carreira (a Trovalim) a preparar a abordagem de um lead.',
    `Nome do lead: ${name}`,
    `Dor declarada / contexto: ${dor}`,
    catalogNames.length
      ? `Catálogo de serviços da Trovalim (sugira SOMENTE destes, pelo nome exato): ${catalogNames.join(', ')}`
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
    if (status === 401) throw new HttpsError('failed-precondition', 'Chave da OpenAI inválida — confira em Configurações → Integração com IA.');
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
