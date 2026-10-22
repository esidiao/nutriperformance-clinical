// Conserta o vinculo de identidade das contas de TESTE.
//
//   node scripts/contas-de-teste.mjs             (ensaio, nao grava)
//   node scripts/contas-de-teste.mjs --aplicar   (grava)
//
// POR QUE ISTO EXISTE
//
// As varreduras autenticadas (rotas, escrita, acessos) precisam de uma conta
// que a API aceite. As contas semeadas estavam quebradas de dois jeitos:
//
//   - `users.auth_id` apontando para um usuario de autenticacao que nao
//     existe mais (vinculo DIVERGENTE);
//   - perfil sem nenhum usuario de autenticacao correspondente.
//
// Em ambos a API responde 401 com "Conta sem identidade de acesso
// configurada", e a varredura de rotas -- antes do conserto em 41e04ee --
// concluia que estava tudo bem, porque nao achava erro 500 em 67 respostas
// 401.
//
// POR QUE SO CONTAS DE TESTE
//
// As unicas contas com vinculo correto sao de pessoas reais. Emitir sessao
// na conta de uma profissional, ainda que so para ler rotas, nao e decisao
// de ferramenta. Este script RECUSA qualquer e-mail fora da lista abaixo.
//
// SEM SENHA
//
// As contas sao criadas sem senha, so com e-mail confirmado. As varreduras
// entram por link magico gerado com a chave de servico, entao nao ha
// credencial para vazar nem para rotacionar.

import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '../../web/node_modules/@supabase/supabase-js/dist/index.mjs';

const AQUI = dirname(fileURLToPath(import.meta.url));

function carregarEnv(p) {
  if (!existsSync(p)) return;
  for (const l of readFileSync(p, 'utf8').split(/\r?\n/)) {
    const m = l.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}
carregarEnv(join(AQUI, '..', '.env'));

const B = process.env.SUPABASE_URL;
const CHAVE = process.env.SUPABASE_SERVICE_ROLE_KEY;
const H = { apikey: CHAVE, Authorization: `Bearer ${CHAVE}`, 'Content-Type': 'application/json' };

/**
 * Lista fechada. Nenhum e-mail fora daqui e tocado, por mais que o vinculo
 * esteja quebrado: conta de pessoa real nao se conserta por script.
 */
const CONTAS_DE_TESTE = new Set([
  'dra.ana@nutritest.com',
  'admin@nutritest.com',
  'prof.lucas@performance.com',
  'estudante@nutritest.com',
]);

const aplicar = process.argv.includes('--aplicar');

const admin = createClient(B, CHAVE, { auth: { autoRefreshToken: false, persistSession: false } });

const { data: lista, error: eLista } = await admin.auth.admin.listUsers({ perPage: 500 });
if (eLista) throw new Error(`listUsers: ${eLista.message}`);
const authPorEmail = new Map((lista?.users ?? []).map((u) => [u.email, u]));

const perfis = await fetch(
  `${B}/rest/v1/users?select=id,email,role,auth_id,workspace_id,is_active&limit=200`,
  { headers: H },
).then((r) => r.json());

/** Quantos registros a conta possui. Conta com dado real nao e de teste. */
async function contar(tabela, coluna, valor) {
  const r = await fetch(`${B}/rest/v1/${tabela}?select=count&${coluna}=eq.${valor}`, {
    headers: { ...H, Prefer: 'count=exact', Range: '0-0' },
  });
  if (!r.ok) return null;
  return Number((r.headers.get('content-range') || '').split('/')[1]);
}

const planos = [];

for (const p of perfis) {
  if (!CONTAS_DE_TESTE.has(p.email)) continue;

  const u = authPorEmail.get(p.email);
  const pacientes = await contar('patients', 'created_by', p.id);
  const avaliacoes = await contar('nutritional_assessments', 'created_by', p.id);

  /**
   * DUAS COISAS PRECISAM ESTAR CERTAS, E ELAS SAO INDEPENDENTES.
   *
   * 1. `users.auth_id` apontando para o usuario de autenticacao -- e o que
   *    liga o perfil da aplicacao a conta de login.
   *
   * 2. `app_metadata` do usuario de autenticacao com role e workspace_id --
   *    e DAI que o JwtAuthGuard le a identidade, nao da tabela `users`.
   *    Fica em app_metadata e nao em user_metadata porque user_metadata e
   *    gravavel pelo proprio usuario: quem tivesse o proprio token poderia
   *    se promover a admin ou trocar de workspace.
   *
   * Consertar so a primeira nao destrava nada, e foi o que eu fiz na
   * primeira tentativa: o auth_id ficou certo e a API continuou respondendo
   * 401, porque o token continuava sem identidade.
   */
  const meta = u?.app_metadata ?? {};
  const faltaMetadado = !meta.role || !meta.workspace_id;

  const acoes = [];
  if (!u) acoes.push('criar usuario de autenticacao');
  if (u && p.auth_id !== u.id) acoes.push('corrigir auth_id');
  if (!u || faltaMetadado) acoes.push('definir role e workspace_id em app_metadata');
  if (!p.workspace_id) acoes.length = 0;

  let acao = acoes.length ? acoes.join(' + ') : null;
  if (!p.workspace_id) acao = 'SEM WORKSPACE no perfil — nao da para consertar por aqui';

  planos.push({
    email: p.email, perfilId: p.id, role: p.role, workspaceId: p.workspace_id,
    authIdAtual: p.auth_id, authIdCerto: u?.id ?? null,
    metaAtual: meta, pacientes, avaliacoes, workspace: !!p.workspace_id, acao,
  });
}

console.log('— contas de teste —\n');
for (const x of planos) {
  console.log(`${x.email}`);
  console.log(`  perfil        ${x.role}  ·  workspace ${x.workspace ? 'sim' : 'NAO'}`);
  console.log(`  dados que possui: ${x.pacientes ?? '?'} paciente(s), ${x.avaliacoes ?? '?'} avaliacao(oes)`);
  console.log(`  auth_id atual ${x.authIdAtual ?? '(nulo)'}`);
  console.log(`  auth_id certo ${x.authIdCerto ?? '(nao existe usuario de autenticacao)'}`);
  console.log(`  app_metadata  role=${x.metaAtual?.role ?? '-'} ws=${x.metaAtual?.workspace_id ?? '-'}`);
  console.log(`  acao          ${x.acao ?? 'nada a fazer'}`);
  console.log();
}

const comDados = planos.filter((x) => (x.pacientes ?? 0) > 0 || (x.avaliacoes ?? 0) > 0);
if (comDados.length) {
  console.log('ATENCAO: estas contas possuem registros. Confira se sao mesmo de teste:');
  for (const x of comDados) console.log(`  ${x.email}: ${x.pacientes} paciente(s), ${x.avaliacoes} avaliacao(oes)`);
  console.log();
}

const aFazer = planos.filter((x) => x.acao && !x.acao.startsWith('SEM WORKSPACE'));
console.log(`${aFazer.length} conta(s) a consertar.`);

if (!aplicar) {
  console.log('\nENSAIO. Nada foi gravado. Para gravar, acrescente --aplicar.');
  process.exit(0);
}

console.log('\n— gravando —');
for (const x of aFazer) {
  let authId = x.authIdCerto;

  if (!authId) {
    // Sem senha: so e-mail confirmado. As varreduras entram por link magico.
    const { data, error } = await admin.auth.admin.createUser({
      email: x.email,
      email_confirm: true,
      user_metadata: { conta_de_teste: true },
    });
    if (error) { console.log(`  FALHOU criar ${x.email}: ${error.message}`); continue; }
    authId = data.user.id;
    console.log(`  criado usuario de autenticacao para ${x.email}`);
  }

  const r = await fetch(`${B}/rest/v1/users?id=eq.${x.perfilId}`, {
    method: 'PATCH',
    headers: { ...H, Prefer: 'return=minimal' },
    body: JSON.stringify({ auth_id: authId }),
  });
  if (!r.ok) { console.log(`  FALHOU vincular ${x.email}: ${r.status} ${await r.text()}`); continue; }
  console.log(`  vinculado ${x.email} -> ${authId}`);

  // A identidade que o guard le. Sem isto o token e valido e o acesso e
  // negado, que foi exatamente o que aconteceu na primeira tentativa.
  const { error: eMeta } = await admin.auth.admin.updateUserById(authId, {
    app_metadata: { role: x.role, workspace_id: x.workspaceId, conta_de_teste: true },
  });
  if (eMeta) { console.log(`  FALHOU app_metadata ${x.email}: ${eMeta.message}`); continue; }
  console.log(`    app_metadata: role=${x.role} ws=${String(x.workspaceId).slice(0, 8)}...`);
}

console.log('\nPronto. Rode a varredura de rotas para conferir.');
