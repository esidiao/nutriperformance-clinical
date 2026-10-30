/**
 * Prova, contra PRODUCAO, que desativar tira o acesso.
 *
 * ============================== POR QUE EXISTE ==============================
 *
 * `users.is_active` e `workspaces.is_active` ficaram meses sendo gravados pelo
 * painel administrativo e lidos por ninguem. 1.190 testes passavam. O painel
 * respondia 200 e mostrava "suspenso" na tela. Nada falhava, e por isso
 * ninguem viu.
 *
 * Teste unitario nao pega isso: todo teste roda com um `req.user` fabricado no
 * proprio teste. Prova so existe exercitando producao com token real.
 *
 * ============================== O QUE ELE FAZ ==============================
 *
 * Cada veto tem o caso ESPELHADO — o que nega E o que deixa passar. Um guard
 * que nega tudo e tao inutil quanto um que nega nada, e so o par distingue os
 * dois.
 *
 *   A. conta ativa em workspace ativo            -> espera 200
 *   B. `users.is_active = false`                 -> espera 401, e volta a 200
 *   C. suspender o workspace PELA ROTA do painel -> espera 401, e volta a 200
 *
 * O passo C vai pela rota real (`PATCH /admin/workspaces/:id/suspend`), nao
 * por UPDATE direto, porque e a rota que estava mentindo. Ele tambem e o unico
 * jeito de provar que o `limparCache()` funciona.
 *
 * ================================ SEGURANCA ================================
 *
 * CONTAS E WORKSPACES DE TESTE, NUNCA DE PESSOA REAL. O workspace do passo C
 * (`Academia PerformanceTest`) tem zero pacientes. Toda mudanca e revertida, e
 * o script reverte tambem quando falha no meio — e, no fim, CONFERE por
 * consulta nova que reverteu. Nao imprime token nem dado de paciente.
 *
 *   node scripts/provar-conta-desativada.mjs
 */
import { createClient } from '../../web/node_modules/@supabase/supabase-js/dist/index.mjs';
import { readFileSync } from 'node:fs';

function carregarEnv(c) {
  try {
    for (const l of readFileSync(c, 'utf8').split(/\r?\n/)) {
      const m = l.match(/^([A-Z0-9_]+)=(.*)$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
    }
  } catch {}
}
carregarEnv(new URL('../.env', import.meta.url));
carregarEnv(new URL('../../web/.env.local', import.meta.url));
process.env.SUPABASE_ANON_KEY ||= process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const API = 'https://nutriperformance-clinical.onrender.com';
const SB = process.env.SUPABASE_URL;
const servico = {
  apikey: process.env.SUPABASE_SERVICE_ROLE_KEY,
  Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
  'Content-Type': 'application/json',
};

const admin = createClient(SB, process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } });
const anon = createClient(SB, process.env.SUPABASE_ANON_KEY, { auth: { persistSession: false } });

const NUTRI = 'varredura@nutritest.com';
const FIT = 'varredura-fit@nutritest.com';
const ADM = 'varredura-admin@nutritest.com';

/** Janela de cache do ContasAtivasService, mais folga. */
const ESPERA_CACHE_MS = 35_000;

async function token(email) {
  const { data: ml, error } = await admin.auth.admin.generateLink({ type: 'magiclink', email });
  if (error || !ml?.properties?.hashed_token) throw new Error(`link para ${email}: ${error?.message}`);
  const { data: s } = await anon.auth.verifyOtp({
    type: 'magiclink', token_hash: ml.properties.hashed_token,
  });
  if (!s?.session?.access_token) throw new Error(`sem sessao para ${email}`);
  return s.session.access_token;
}

/** Sonda: 200 = entrou, 401 = o guard negou. */
async function sondar(tok) {
  const r = await fetch(`${API}/users/me`, { headers: { Authorization: `Bearer ${tok}` } });
  let motivo = '';
  try {
    const corpo = await r.json();
    motivo = corpo?.message ?? '';
  } catch {}
  return { status: r.status, motivo };
}

async function gravarUsuario(email, ativo) {
  const r = await fetch(`${SB}/rest/v1/users?email=eq.${encodeURIComponent(email)}`, {
    method: 'PATCH', headers: { ...servico, Prefer: 'return=representation' },
    body: JSON.stringify({ is_active: ativo }),
  });
  if (!r.ok) throw new Error(`gravar is_active de ${email}: ${r.status} ${await r.text()}`);
  const linhas = await r.json();
  if (linhas.length !== 1) throw new Error(`esperava 1 linha para ${email}, veio ${linhas.length}`);
  return linhas[0];
}

async function lerUsuario(email) {
  const r = await fetch(
    `${SB}/rest/v1/users?select=id,email,is_active,workspace_id&email=eq.${encodeURIComponent(email)}`,
    { headers: servico },
  );
  return (await r.json())[0];
}

async function lerWorkspace(id) {
  const r = await fetch(`${SB}/rest/v1/workspaces?select=id,name,is_active&id=eq.${id}`, { headers: servico });
  return (await r.json())[0];
}

async function rotaDoPainel(tokAdm, id, acao) {
  const r = await fetch(`${API}/admin/workspaces/${id}/${acao}`, {
    method: 'PATCH', headers: { Authorization: `Bearer ${tokAdm}` },
  });
  if (!r.ok) throw new Error(`${acao} ${id}: ${r.status} ${await r.text()}`);
  return r.json();
}

const esperar = (ms) => new Promise((ok) => setTimeout(ok, ms));

const resultados = [];
function conferir(nome, passou, detalhe) {
  resultados.push({ nome, passou, detalhe });
  console.log(`  ${passou ? 'OK     ' : 'FALHOU '} ${nome}${detalhe ? ' — ' + detalhe : ''}`);
}

// ── o que vamos mexer, e a checagem de que e seguro mexer ───────────────────
const saude = await (await fetch(`${API}/health`)).json();
console.log(`API no ar: commit ${saude.commit}, banco ${saude.database}`);
console.log('');

const nutri = await lerUsuario(NUTRI);
const fit = await lerUsuario(FIT);
if (!nutri || !fit) throw new Error('contas de varredura nao existem; rode scripts/conta-de-varredura.mjs');

const wsFit = await lerWorkspace(fit.workspace_id);
const pacientesDoWs = await (await fetch(
  `${SB}/rest/v1/patients?select=id&workspace_id=eq.${fit.workspace_id}`, { headers: servico },
)).json();

console.log(`conta do passo B: ${NUTRI} (is_active atual: ${nutri.is_active})`);
console.log(`workspace do passo C: ${wsFit.name} (ativo: ${wsFit.is_active}, pacientes: ${pacientesDoWs.length})`);
if (pacientesDoWs.length > 0) {
  // Suspender workspace com paciente dentro tiraria o acesso de quem o atende.
  throw new Error('o workspace do passo C tem paciente dentro; abortado por seguranca');
}
if (!nutri.is_active || !wsFit.is_active) {
  throw new Error('estado inicial nao esta ativo; o espelho do teste nao valeria. Abortado.');
}
console.log('');

let reverterUsuario = false;
let reverterWorkspace = null;

try {
  // ── A: quem esta em ordem entra ──────────────────────────────────────────
  console.log('A. conta ativa em workspace ativo');
  const tokNutri = await token(NUTRI);
  const a = await sondar(tokNutri);
  conferir('entra (200)', a.status === 200, `status ${a.status}`);
  console.log('');

  // ── B: usuario desativado ────────────────────────────────────────────────
  console.log('B. users.is_active = false');
  await gravarUsuario(NUTRI, false);
  reverterUsuario = true;
  console.log(`   esperando ${ESPERA_CACHE_MS / 1000}s pela janela de cache...`);
  await esperar(ESPERA_CACHE_MS);

  const b = await sondar(await token(NUTRI));
  conferir('NEGA (401)', b.status === 401, `status ${b.status}`);
  conferir('o motivo diz que a conta esta desativada', /desativada/i.test(b.motivo), b.motivo || '(sem mensagem)');

  await gravarUsuario(NUTRI, true);
  reverterUsuario = false;
  console.log(`   esperando ${ESPERA_CACHE_MS / 1000}s pela janela de cache...`);
  await esperar(ESPERA_CACHE_MS);
  const b2 = await sondar(await token(NUTRI));
  conferir('volta a entrar depois de reativar (200)', b2.status === 200, `status ${b2.status}`);
  console.log('');

  // ── C: workspace suspenso PELA ROTA do painel ────────────────────────────
  console.log(`C. PATCH /admin/workspaces/:id/suspend em "${wsFit.name}"`);
  const tokAdm = await token(ADM);
  const tokFit = await token(FIT);

  const antes = await sondar(tokFit);
  conferir('o educador fisico entrava antes (200)', antes.status === 200, `status ${antes.status}`);

  await rotaDoPainel(tokAdm, fit.workspace_id, 'suspend');
  reverterWorkspace = fit.workspace_id;

  // SEM espera de proposito: o limparCache() da rota precisa fazer valer na
  // hora. Se precisasse esperar 30s, o administrador nao teria como adivinhar.
  const c = await sondar(tokFit);
  conferir('NEGA na hora, sem esperar o cache (401)', c.status === 401, `status ${c.status}`);
  conferir('o motivo diz que o workspace esta suspenso', /suspenso/i.test(c.motivo), c.motivo || '(sem mensagem)');

  await rotaDoPainel(tokAdm, fit.workspace_id, 'reactivate');
  reverterWorkspace = null;
  const c2 = await sondar(tokFit);
  conferir('volta a entrar na hora depois de reativar (200)', c2.status === 200, `status ${c2.status}`);
  console.log('');
} finally {
  // ── reverter, inclusive se algo estourou no meio ─────────────────────────
  if (reverterUsuario) {
    console.log(`revertendo is_active de ${NUTRI}...`);
    await gravarUsuario(NUTRI, true).catch((e) => console.log('  FALHA ao reverter:', e.message));
  }
  if (reverterWorkspace) {
    console.log(`revertendo o workspace ${reverterWorkspace}...`);
    await fetch(`${SB}/rest/v1/workspaces?id=eq.${reverterWorkspace}`, {
      method: 'PATCH', headers: servico, body: JSON.stringify({ is_active: true }),
    }).catch((e) => console.log('  FALHA ao reverter:', e.message));
  }

  // Confere o estado final por consulta NOVA, nao pelo retorno das escritas.
  const nutriFim = await lerUsuario(NUTRI);
  const wsFim = await lerWorkspace(fit.workspace_id);
  console.log('');
  console.log('estado final conferido por consulta nova:');
  console.log(`  ${NUTRI} is_active = ${nutriFim?.is_active}`);
  console.log(`  ${wsFim?.name} is_active = ${wsFim?.is_active}`);
  const limpo = nutriFim?.is_active === true && wsFim?.is_active === true;
  if (!limpo) console.log('  ⚠️  ESTADO NAO REVERTIDO — corrigir a mao antes de qualquer outra coisa.');

  const falhas = resultados.filter((r) => !r.passou);
  console.log('');
  console.log(`${resultados.length - falhas.length} de ${resultados.length} conferencias passaram.`);
  process.exit(falhas.length === 0 && limpo ? 0 : 1);
}
