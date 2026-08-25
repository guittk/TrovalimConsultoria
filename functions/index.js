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
