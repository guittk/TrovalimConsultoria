const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { initializeApp } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');
const { getFirestore } = require('firebase-admin/firestore');

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
