/**
 * Corrige downloadUrl/logo/photoUrl que ainda apontam para o bucket do
 * projeto de origem, trocando pelo bucket do projeto de destino (o token
 * de download é preservado na migração, então só o nome do bucket muda).
 *
 * Uso: node scripts/fix-download-urls.js <chave-destino.json> <bucket-origem>
 */
const path = require('path');
const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

const [, , destKeyPath, sourceBucket] = process.argv;
if (!destKeyPath || !sourceBucket) {
  console.error('Uso: node scripts/fix-download-urls.js <chave-destino.json> <bucket-origem>');
  process.exit(1);
}

const destKey = require(path.resolve(destKeyPath));
const destBucket = `${destKey.project_id}.firebasestorage.app`;
const app = initializeApp({ credential: cert(destKey) });
const db = getFirestore(app);

function fixUrl(url) {
  if (typeof url !== 'string' || !url.includes(sourceBucket)) return null;
  return url.split(sourceBucket).join(destBucket);
}

async function fixFiles() {
  const projectsSnap = await db.collection('projects').get();
  let fixed = 0;
  for (const proj of projectsSnap.docs) {
    const filesSnap = await proj.ref.collection('files').get();
    for (const fileDoc of filesSnap.docs) {
      const newUrl = fixUrl(fileDoc.data().downloadUrl);
      if (newUrl) {
        await fileDoc.ref.update({ downloadUrl: newUrl });
        fixed++;
      }
    }
  }
  console.log(`Arquivos de projeto corrigidos: ${fixed}`);
}

async function fixBrandingLogos() {
  const empresasSnap = await db.collection('empresas').get();
  let fixed = 0;
  for (const doc of empresasSnap.docs) {
    const branding = doc.data().branding;
    const newUrl = branding && fixUrl(branding.logo);
    if (newUrl) {
      await doc.ref.update({ 'branding.logo': newUrl });
      fixed++;
    }
  }
  console.log(`Logos de empresa corrigidos: ${fixed}`);
}

async function fixAccountPhotos() {
  const usersSnap = await db.collection('users').get();
  let fixed = 0;
  for (const doc of usersSnap.docs) {
    const newUrl = fixUrl(doc.data().photoUrl);
    if (newUrl) {
      await doc.ref.update({ photoUrl: newUrl });
      fixed++;
    }
  }
  console.log(`Fotos de conta corrigidas: ${fixed}`);
}

async function main() {
  await fixFiles();
  await fixBrandingLogos();
  await fixAccountPhotos();
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
