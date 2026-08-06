/**
 * Cria no projeto DEV, com os MESMOS UIDs do export de Authentication, contas
 * com uma senha de teste conhecida (não preserva o hash real da senha —
 * usado apenas para popular o ambiente de testes).
 *
 * Uso: node scripts/seed-dev-auth.js <chave-destino.json> <auth-export.json> <senha-teste>
 */
const path = require('path');
const { initializeApp, cert } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');

const [, , destKeyPath, exportPath, tempPassword] = process.argv;
if (!destKeyPath || !exportPath || !tempPassword) {
  console.error('Uso: node scripts/seed-dev-auth.js <chave-destino.json> <auth-export.json> <senha-teste>');
  process.exit(1);
}

const destKey = require(path.resolve(destKeyPath));
const exported = require(path.resolve(exportPath));

const app = initializeApp({ credential: cert(destKey) });
const auth = getAuth(app);

async function main() {
  for (const u of exported.users) {
    try {
      await auth.createUser({
        uid: u.localId,
        email: u.email,
        password: tempPassword,
        emailVerified: true,
      });
      console.log('criado:', u.email, u.localId);
    } catch (e) {
      if (e.code === 'auth/uid-already-exists' || e.code === 'auth/email-already-exists') {
        console.log('já existia, atualizando senha:', u.email);
        await auth.updateUser(u.localId, { password: tempPassword });
      } else {
        console.error('erro em', u.email, e.message);
      }
    }
  }
  process.exit(0);
}

main();
