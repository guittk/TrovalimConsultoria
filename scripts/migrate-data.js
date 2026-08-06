/**
 * Migra Firestore (recursivo, todas as coleções/subcoleções) e Storage
 * (todos os objetos) do projeto de origem para o projeto de destino, usando
 * as chaves de conta de serviço de cada um (Admin SDK, ignora as regras).
 *
 * Uso: node scripts/migrate-data.js <caminho-chave-origem.json> <caminho-chave-destino.json>
 */
const path = require('path');
const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const { getStorage } = require('firebase-admin/storage');

const [, , sourceKeyPath, destKeyPath] = process.argv;
if (!sourceKeyPath || !destKeyPath) {
  console.error('Uso: node scripts/migrate-data.js <chave-origem.json> <chave-destino.json>');
  process.exit(1);
}

const sourceKey = require(path.resolve(sourceKeyPath));
const destKey = require(path.resolve(destKeyPath));

const sourceApp = initializeApp(
  {
    credential: cert(sourceKey),
    storageBucket: `${sourceKey.project_id}.firebasestorage.app`,
  },
  'source',
);
const destApp = initializeApp(
  {
    credential: cert(destKey),
    storageBucket: `${destKey.project_id}.firebasestorage.app`,
  },
  'dest',
);

const sourceDb = getFirestore(sourceApp);
const destDb = getFirestore(destApp);

let docsCopied = 0;

/** Copia recursivamente uma coleção inteira (docs + subcoleções de cada doc). */
async function copyCollection(sourceColRef, destColRef, depth = 0) {
  const snap = await sourceColRef.get();
  const indent = '  '.repeat(depth);
  console.log(`${indent}${sourceColRef.path} — ${snap.size} doc(s)`);
  for (const doc of snap.docs) {
    await destColRef.doc(doc.id).set(doc.data());
    docsCopied++;
    const subcols = await doc.ref.listCollections();
    for (const subcol of subcols) {
      await copyCollection(subcol, destColRef.doc(doc.id).collection(subcol.id), depth + 1);
    }
  }
}

async function migrateFirestore() {
  console.log('\n=== Firestore ===');
  const topCollections = await sourceDb.listCollections();
  for (const col of topCollections) {
    await copyCollection(col, destDb.collection(col.id));
  }
  console.log(`Total de documentos copiados: ${docsCopied}`);
}

async function migrateStorage() {
  console.log('\n=== Storage ===');
  const sourceBucket = getStorage(sourceApp).bucket();
  const destBucket = getStorage(destApp).bucket();
  const [files] = await sourceBucket.getFiles();
  console.log(`${files.length} objeto(s) encontrados no bucket de origem`);
  let copied = 0;
  for (const file of files) {
    const [buffer] = await file.download();
    const [metadata] = await file.getMetadata();
    await destBucket.file(file.name).save(buffer, {
      contentType: metadata.contentType,
      metadata: { metadata: metadata.metadata || {} },
    });
    copied++;
    if (copied % 10 === 0 || copied === files.length) {
      console.log(`  ${copied}/${files.length} copiados`);
    }
  }
  console.log(`Total de objetos copiados: ${copied}`);
}

async function main() {
  await migrateFirestore();
  await migrateStorage();
  console.log('\nMigração concluída.');
  process.exit(0);
}

main().catch((err) => {
  console.error('Erro na migração:', err);
  process.exit(1);
});
