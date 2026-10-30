/**
 * LEITURA APENAS: quem consegue entrar depois da conferencia de `is_active`.
 *
 * Nao escreve em nada. Nao suspende, nao desativa, nao reverte — porque nao
 * muda nada. Para provar o VETO (que desativar nega mesmo) existe
 * `provar-conta-desativada.mjs`, que escreve e precisa de autorizacao.
 *
 * O que este responde e a outra metade, e e a metade urgente: a conferencia
 * nova trancou alguem que deveria entrar?
 *
 * Nao imprime token nem dado de paciente.
 *
 *   node scripts/conferir-quem-entra.mjs
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
};

const admin = createClient(SB, process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } });
const anon = createClient(SB, process.env.SUPABASE_ANON_KEY, { auth: { persistSession: false } });

// So contas de TESTE. Conta de pessoa real nao se usa para sondar.
const CONTAS_DE_TESTE = [
  'varredura-admin@nutritest.com',
  'varredura@nutritest.com',
  'varredura-fit@nutritest.com',
];

const saude = await (await fetch(`${API}/health`)).json();
console.log(`API: commit ${saude.commit}, banco ${saude.database}`);
console.log('');

// ── o que o BANCO diz que deve acontecer, conta por conta ───────────────────
const contas = (await admin.auth.admin.listUsers({ perPage: 200 })).data.users;
const linhas = await (await fetch(
  `${SB}/rest/v1/users?select=id,email,is_active,workspace_id`, { headers: servico },
)).json();
const wss = await (await fetch(
  `${SB}/rest/v1/workspaces?select=id,name,is_active`, { headers: servico },
)).json();
const porId = new Map(linhas.map((u) => [u.id, u]));
const porWs = new Map(wss.map((w) => [w.id, w]));

console.log('previsao, pelo que o banco contem:');
console.log('');
const previsao = [];
for (const c of contas) {
  const meta = c.app_metadata ?? {};
  const u = porId.get(c.id);
  const w = u ? porWs.get(u.workspace_id) : undefined;

  let veredito;
  if (c.banned_until) veredito = 'banido no Auth';
  else if (!meta.role || !meta.workspace_id) veredito = 'sem identidade no token';
  else if (!u) veredito = 'NEGADO: sem linha em users';
  else if (u.is_active === false) veredito = 'NEGADO: conta desativada';
  else if (!porWs.get(meta.workspace_id)) veredito = 'NEGADO: workspace do token nao existe';
  else if (porWs.get(meta.workspace_id).is_active === false) veredito = 'NEGADO: workspace suspenso';
  else veredito = 'entra';

  previsao.push({ email: c.email, veredito });
  console.log(`  ${veredito.padEnd(38)} ${c.email}${w ? '  (' + w.name + ')' : ''}`);
}

const entram = previsao.filter((p) => p.veredito === 'entra');
const negados = previsao.filter((p) => p.veredito.startsWith('NEGADO'));
console.log('');
console.log(`${entram.length} entram, ${negados.length} negadas pela conferencia nova, ` +
  `${previsao.length - entram.length - negados.length} ja nao autenticavam antes dela.`);
console.log('');

// ── e o que PRODUCAO responde para as contas de teste ───────────────────────
console.log('sonda real em GET /users/me (so contas de teste):');
console.log('');
let falhas = 0;
for (const email of CONTAS_DE_TESTE) {
  const esperado = previsao.find((p) => p.email === email)?.veredito ?? '(fora da lista)';
  let status;
  let motivo = '';
  try {
    const { data: ml, error } = await admin.auth.admin.generateLink({ type: 'magiclink', email });
    if (error || !ml?.properties?.hashed_token) throw new Error(error?.message ?? 'sem link');
    const { data: s } = await anon.auth.verifyOtp({
      type: 'magiclink', token_hash: ml.properties.hashed_token,
    });
    if (!s?.session?.access_token) throw new Error('sem sessao');
    const r = await fetch(`${API}/users/me`, {
      headers: { Authorization: `Bearer ${s.session.access_token}` },
    });
    status = r.status;
    if (status !== 200) {
      try { motivo = (await r.json())?.message ?? ''; } catch {}
    }
  } catch (e) {
    status = 'erro: ' + e.message;
  }

  const bate = esperado === 'entra' ? status === 200 : status === 401;
  if (!bate) falhas++;
  console.log(`  ${bate ? 'OK     ' : 'FALHOU '} ${email.padEnd(34)} ` +
    `previsto "${esperado}", veio ${status}${motivo ? ' — ' + motivo : ''}`);
}

console.log('');
if (falhas === 0) {
  console.log('Producao responde o que o banco previa para todas as contas sondadas.');
} else {
  console.log(`${falhas} conta(s) nao responderam o previsto — investigar antes de qualquer outra coisa.`);
}
process.exit(falhas === 0 ? 0 : 1);
