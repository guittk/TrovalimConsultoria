/**
 * Popula o Firebase Emulator Suite (Auth + Firestore) com dados de teste
 * pra dev local. NÃO toca no projeto prod real — usa os hosts de emulador
 * (localhost:9099 / localhost:8085), então precisa estar rodando com
 * `npm run emulators` já de pé em outro terminal.
 *
 * Uso:
 *   npm run emulators          (num terminal)
 *   node scripts/seed-emulator.js   (noutro terminal)
 *
 * Contas criadas (senha igual para todas: "teste123"):
 *   owner@trovalim.local     - owner
 *   manager@trovalim.local   - manager
 *   cliente@trovalim.local   - client (vinculado à Empresa Teste Ltda)
 *   mentorado@trovalim.local - mentorado (fora da Empresa Teste, "carreira")
 */
process.env.FIRESTORE_EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST || 'localhost:8085';
process.env.FIREBASE_AUTH_EMULATOR_HOST = process.env.FIREBASE_AUTH_EMULATOR_HOST || 'localhost:9099';

const { initializeApp } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');

const PROJECT_ID = 'geovana-trovalim-prod'; // mesmo id do .firebaserc — o emulador não fala com o projeto real
const app = initializeApp({ projectId: PROJECT_ID });
const auth = getAuth(app);
const db = getFirestore(app);

const SENHA = 'teste123';
const TS = FieldValue.serverTimestamp();

const USERS = [
  { uid: 'seed-owner', email: 'owner@trovalim.local', name: 'Geovana Trovalim', role: 'owner' },
  { uid: 'seed-manager', email: 'manager@trovalim.local', name: 'Ana Gerente', role: 'manager' },
  { uid: 'seed-client', email: 'cliente@trovalim.local', name: 'Carlos Cliente', role: 'client', companyId: 'seed-empresa' },
  { uid: 'seed-mentorado', email: 'mentorado@trovalim.local', name: 'Marina Mentorada', role: 'mentorado' },
];

async function upsertAuthUser(u) {
  try {
    await auth.createUser({ uid: u.uid, email: u.email, password: SENHA, emailVerified: true, displayName: u.name });
    console.log('  auth criado:', u.email);
  } catch (e) {
    if (e.code === 'auth/uid-already-exists' || e.code === 'auth/email-already-exists') {
      await auth.updateUser(u.uid, { password: SENHA, displayName: u.name });
      console.log('  auth já existia, senha resetada:', u.email);
    } else {
      throw e;
    }
  }
}

async function seedUsersAndEmpresa() {
  console.log('Contas (Auth + /users)...');
  for (const u of USERS) {
    await upsertAuthUser(u);
    await db.doc(`users/${u.uid}`).set(
      {
        uid: u.uid,
        name: u.name,
        email: u.email,
        role: u.role,
        companyId: u.companyId ?? null,
      },
      { merge: true }
    );
  }

  await db.doc('empresas/seed-empresa').set(
    {
      id: 'seed-empresa',
      branding: { companyName: 'Empresa Teste Ltda', primaryColor: '#2f6f4f', logo: null },
      storageLimitMb: 500,
      storageUsageBytes: 0,
      createdAt: TS,
    },
    { merge: true }
  );
}

async function seedSettings() {
  console.log('Settings globais...');
  await db.doc('settings/platformSettings').set({ primaryColor: '#2f6f4f' }, { merge: true });
  await db.doc('settings/projectStatusSettings').set(
    {
      statuses: [
        { key: 'em-andamento', label: 'Em andamento' },
        { key: 'aguardando-cliente', label: 'Aguardando cliente' },
        { key: 'em-revisao', label: 'Em revisão' },
        { key: 'concluido', label: 'Concluído' },
        { key: 'pausado', label: 'Pausado' },
      ],
    },
    { merge: true }
  );
  await db.doc('settings/storageSettings').set(
    {
      totalLimitMb: 10000,
      defaultClientLimitMb: 500,
      typeLimits: [
        { key: 'documento', label: 'Documentos', extensions: ['pdf', 'doc', 'docx'], maxSizeMb: 20 },
        { key: 'imagem', label: 'Imagens', extensions: ['png', 'jpg', 'jpeg'], maxSizeMb: 10 },
      ],
    },
    { merge: true }
  );
  await db.doc('settings/storageUsage').set({ totalBytes: 0 }, { merge: true });
  await db.doc('settings/pricing').set(
    {
      items: [
        { key: 'vaga-rs', name: 'Recrutamento e Seleção', unit: 'vaga', baseValue: 3500 },
        { key: 'mentoria', name: 'Mentoria individual', unit: 'encontro', baseValue: 450 },
        { key: 'diagnostico', name: 'Diagnóstico organizacional', unit: 'projeto', baseValue: 6000 },
      ],
    },
    { merge: true }
  );
}

async function seedProject() {
  console.log('Projeto de teste...');
  const ref = db.doc('projects/seed-project');
  await ref.set(
    {
      id: 'seed-project',
      name: 'Recrutamento - Analista Financeiro',
      description: 'Processo seletivo para vaga de Analista Financeiro Sênior.',
      clientName: 'Empresa Teste Ltda',
      clientEmail: 'cliente@trovalim.local',
      ownerId: 'seed-empresa',
      status: 'em-andamento',
      progress: 40,
      steps: [
        { id: 'step-1', name: 'Divulgação da vaga', date: '2026-08-01', done: true },
        { id: 'step-2', name: 'Triagem de currículos', date: '2026-08-10', done: true },
        { id: 'step-3', name: 'Entrevistas', date: '2026-08-28', done: false },
        { id: 'step-4', name: 'Proposta e fechamento', date: '2026-09-10', done: false },
      ],
      branding: { companyName: 'Empresa Teste Ltda', primaryColor: '#2f6f4f', logo: null },
      timelineMode: 'data',
      startDate: '2026-08-01',
      deadline: '2026-09-15',
      responsibleUid: 'seed-manager',
      hidden: false,
      createdAt: TS,
      lastMessageAt: TS,
      unreadForStaff: true,
    },
    { merge: true }
  );

  await ref.collection('messages').add({
    author: 'Carlos Cliente',
    authorRole: 'client',
    text: 'Oi, tudo bem? Alguma novidade sobre os candidatos triados?',
    date: TS,
  });
  await ref.collection('messages').add({
    author: 'Ana Gerente',
    authorRole: 'admin',
    text: 'Tudo certo! Estamos fechando a lista pra entrevista, te mando até sexta.',
    date: TS,
  });

  await ref.collection('internal').doc('notes').set(
    { text: 'Cliente é bem exigente com prazo — priorizar retorno rápido.' },
    { merge: true }
  );

  await db.doc('vagas/seed-vaga').set(
    {
      id: 'seed-vaga',
      projectId: 'seed-project',
      title: 'Analista Financeiro Sênior',
      description: 'Vaga para atuação em planejamento financeiro e FP&A.',
      status: 'aberta',
      createdAt: TS,
    },
    { merge: true }
  );

  await db.doc('candidates/seed-candidate-1').set(
    {
      id: 'seed-candidate-1',
      vagaId: 'seed-vaga',
      projectId: 'seed-project',
      name: 'Fernanda Souza',
      email: 'fernanda.souza@example.com',
      phone: '(11) 91234-5678',
      stage: 'entrevista-rh',
      notes: 'Boa comunicação, experiência prévia em FP&A.',
      consentGiven: true,
      consentDate: '2026-08-05',
      retentionMonths: 12,
      clientVisible: true,
      createdAt: TS,
    },
    { merge: true }
  );
  await db.doc('candidates/seed-candidate-2').set(
    {
      id: 'seed-candidate-2',
      vagaId: 'seed-vaga',
      projectId: 'seed-project',
      name: 'Rodrigo Lima',
      email: 'rodrigo.lima@example.com',
      stage: 'triagem',
      consentGiven: true,
      consentDate: '2026-08-06',
      retentionMonths: 12,
      clientVisible: false,
      createdAt: TS,
    },
    { merge: true }
  );
}

async function seedProspeccaoEProposta() {
  console.log('Prospecção + proposta...');
  await db.doc('leads/seed-lead').set(
    {
      id: 'seed-lead',
      name: 'Nova Consultoria Ltda',
      contactName: 'Patrícia Nova',
      email: 'patricia@novaconsultoria.example.com',
      phone: '(11) 99876-5432',
      stage: 'proposta-enviada',
      source: 'site',
      valorEstimado: 8500,
      dor: 'Alta rotatividade no time comercial.',
      diagnostico: 'Falta de processo estruturado de R&S e onboarding.',
      propostaId: 'seed-proposta',
      createdAt: TS,
    },
    { merge: true }
  );

  await db.doc('propostas/seed-proposta').set(
    {
      id: 'seed-proposta',
      leadId: 'seed-lead',
      clientName: 'Nova Consultoria Ltda',
      contactName: 'Patrícia Nova',
      email: 'patricia@novaconsultoria.example.com',
      items: [
        { key: 'vaga-rs', name: 'Recrutamento e Seleção', unit: 'vaga', baseValue: 3500, qty: 2 },
        { key: 'diagnostico', name: 'Diagnóstico organizacional', unit: 'projeto', baseValue: 6000, qty: 1 },
      ],
      total: 13000,
      escopo: 'Recrutamento para 2 posições comerciais + diagnóstico do processo atual.',
      condicoes: 'Pagamento em 2x, início em até 5 dias úteis após aceite.',
      status: 'enviada',
      createdAt: TS,
      sentAt: TS,
    },
    { merge: true }
  );
}

async function seedTasksECalendario() {
  console.log('Kanban + calendário...');
  await db.doc('tasks/seed-task-1').set(
    {
      id: 'seed-task-1',
      titulo: 'Montar roteiro de entrevista técnica',
      descricao: 'Roteiro para a vaga de Analista Financeiro Sênior.',
      projectId: 'seed-project',
      assigneeIds: ['seed-manager'],
      status: 'em-andamento',
      prioridade: 'alta',
      dueDate: '2026-08-29',
      tags: ['r&s'],
      checklist: [
        { id: 'c1', texto: 'Definir perguntas técnicas', feito: true },
        { id: 'c2', texto: 'Validar com cliente', feito: false },
      ],
      ordem: 0,
      createdAt: TS,
    },
    { merge: true }
  );
  await db.doc('tasks/seed-task-2').set(
    {
      id: 'seed-task-2',
      titulo: 'Follow-up proposta Nova Consultoria',
      projectId: null,
      assigneeIds: ['seed-owner'],
      status: 'a-fazer',
      prioridade: 'media',
      dueDate: '2026-08-30',
      tags: ['comercial'],
      ordem: 0,
      createdAt: TS,
    },
    { merge: true }
  );

  await db.doc('calendarEvents/seed-evento-1').set(
    {
      id: 'seed-evento-1',
      title: 'Entrevista - Fernanda Souza',
      date: '2026-08-28',
      time: '14:00',
      type: 'entrevista',
      description: 'Entrevista técnica com o time de RH.',
      projectId: 'seed-project',
      createdByName: 'Ana Gerente',
      createdAt: TS,
    },
    { merge: true }
  );
}

async function seedMentoriaECarreira() {
  console.log('Mentoria + carreira...');
  await db.doc('mentorships/seed-mentorado').set(
    {
      uid: 'seed-mentorado',
      mentoradoName: 'Marina Mentorada',
      empresaId: null,
      objetivo: 'Evoluir para uma posição de liderança em até 12 meses.',
      competencias: [
        { id: 'comp-1', nome: 'Comunicação', atual: 3, desejado: 5 },
        { id: 'comp-2', nome: 'Gestão de pessoas', atual: 2, desejado: 4 },
      ],
      updatedAt: TS,
    },
    { merge: true }
  );
  await db.doc('mentorships/seed-mentorado/actions/seed-action-1').set(
    {
      id: 'seed-action-1',
      titulo: 'Liderar reunião semanal do time',
      comoFazer: 'Assumir a condução da daily por 4 semanas seguidas.',
      prazo: '2026-09-30',
      categoria: '70',
      status: 'pendente',
      createdAt: TS,
    },
    { merge: true }
  );

  await db.doc('careerTracks/seed-mentorado').set(
    {
      uid: 'seed-mentorado',
      clientName: 'Marina Mentorada',
      stage: 'versao1',
      objetivo: 'Currículo e LinkedIn otimizados para vaga de coordenação.',
      linkedinChecklist: [
        { key: 'foto', label: 'Foto profissional', done: true },
        { key: 'headline', label: 'Headline otimizada', done: false },
      ],
      updatedAt: TS,
    },
    { merge: true }
  );

  await db.doc('assessmentTemplates/seed-template-1').set(
    {
      id: 'seed-template-1',
      name: 'Perfil Comportamental',
      description: 'Avaliação padrão de perfil comportamental.',
      questions: [
        { id: 'q1', text: 'Comunico minhas ideias com clareza.', type: 'escala' },
        { id: 'q2', text: 'O que mais te motiva no trabalho?', type: 'texto' },
      ],
      createdAt: TS,
    },
    { merge: true }
  );
}

async function main() {
  console.log(`Conectando ao Emulator Suite (project: ${PROJECT_ID})...`);
  await seedUsersAndEmpresa();
  await seedSettings();
  await seedProject();
  await seedProspeccaoEProposta();
  await seedTasksECalendario();
  await seedMentoriaECarreira();
  console.log('\nPronto! Contas de teste (senha "teste123"):');
  for (const u of USERS) console.log(`  ${u.role.padEnd(10)} ${u.email}`);
  console.log('\nAbra http://localhost:4200 (npm start) e faça login com uma delas.');
  console.log('Firestore/Auth Emulator UI: http://localhost:4000');
  process.exit(0);
}

main().catch((e) => {
  console.error('Erro no seed:', e);
  process.exit(1);
});
