/**
 * Aplica docs/migrations/2026-09-03-token-costs.sql via PostgREST.
 *
 * O aplicar-sql.mjs exige PGURL (credencial de producao do Postgres), que nao
 * esta neste ambiente. Esta migracao e so DML em `token_costs` — renomear,
 * inserir e apagar linhas —, e isso o PostgREST faz com a service role.
 *
 *   node scripts/aplicar-token-costs.mjs            # so mostra o plano
 *   node scripts/aplicar-token-costs.mjs --aplicar  # executa
 *
 * Nao ha transacao aqui: o PostgREST executa uma requisicao por vez. Por isso a
 * ordem importa e esta escrita para ser segura em qualquer ponto de parada —
 * primeiro o que ADICIONA, depois o que REMOVE. Parar no meio deixa preco
 * sobrando, nunca preco faltando; preco faltando e o estado perigoso, porque e
 * ele que faz o TokenBalanceGuard liberar chamada paga sem conferir saldo.
 */
import { readFileSync } from 'node:fs';

function carregarEnv(c) {
  for (const l of readFileSync(c, 'utf8').split(/\r?\n/)) {
    const m = l.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}
carregarEnv(new URL('../.env', import.meta.url));

const URL_ = process.env.SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const h = {
  apikey: KEY,
  Authorization: `Bearer ${KEY}`,
  'Content-Type': 'application/json',
};

const APLICAR = process.argv.includes('--aplicar');

const NOVAS = [
  { operation: 'laboratory_analysis', tokens_cost: 10, description: 'Análise de exames laboratoriais com IA' },
  { operation: 'nutritional_assessment_summary', tokens_cost: 8, description: 'Resumo da avaliação nutricional com IA' },
  { operation: 'assistant_query', tokens_cost: 5, description: 'Consulta ao assistente nutricional (RAG)' },
  { operation: 'nutritional_audio_intake', tokens_cost: 15, description: 'Transcrição da consulta nutricional' },
  { operation: 'physical_audio_intake', tokens_cost: 15, description: 'Transcrição da avaliação física' },
];

const REMOVER = [
  'nutritional_assessment_ai',
  'physical_assessment_ai',
  'goal_ai_suggestion',
  'clinical_alert_processing',
];

async function ler() {
  const r = await fetch(`${URL_}/rest/v1/token_costs?select=operation,tokens_cost&order=operation`, { headers: h });
  if (!r.ok) throw new Error(`leitura falhou: HTTP ${r.status}`);
  return new Map((await r.json()).map((l) => [l.operation, l.tokens_cost]));
}

const antes = await ler();
console.log(`token_costs antes: ${antes.size} linhas`);
for (const [op, v] of antes) console.log(`  ${op.padEnd(33)} ${v}`);

const plano = [];
if (antes.has('lab_analysis')) {
  plano.push(antes.has('laboratory_analysis')
    ? 'APAGAR lab_analysis (laboratory_analysis ja existe)'
    : 'RENOMEAR lab_analysis -> laboratory_analysis');
}
for (const n of NOVAS) if (!antes.has(n.operation)) plano.push(`INSERIR ${n.operation} = ${n.tokens_cost}`);
for (const op of REMOVER) if (antes.has(op)) plano.push(`APAGAR ${op}`);

console.log(`\nplano (${plano.length} passos):`);
for (const p of plano) console.log(`  ${p}`);

if (!plano.length) { console.log('\nnada a fazer — ja aplicada.'); process.exit(0); }
if (!APLICAR) { console.log('\nnada alterado. rode com --aplicar para executar.'); process.exit(0); }

async function exigir(resp, oque) {
  if (!resp.ok) {
    const corpo = await resp.text();
    throw new Error(`${oque}: HTTP ${resp.status} ${corpo.slice(0, 200)}`);
  }
  console.log(`  ok  ${oque}`);
}

console.log('\naplicando:');

// 1. lab_analysis e o nome antigo de laboratory_analysis.
if (antes.has('lab_analysis')) {
  if (antes.has('laboratory_analysis')) {
    await exigir(await fetch(`${URL_}/rest/v1/token_costs?operation=eq.lab_analysis`, {
      method: 'DELETE', headers: h,
    }), 'apagar lab_analysis');
  } else {
    await exigir(await fetch(`${URL_}/rest/v1/token_costs?operation=eq.lab_analysis`, {
      method: 'PATCH',
      headers: h,
      body: JSON.stringify({
        operation: 'laboratory_analysis',
        description: 'Análise de exames laboratoriais com IA',
      }),
    }), 'renomear lab_analysis -> laboratory_analysis');
  }
}

// 2. ADICIONAR antes de remover: ver o comentario do topo.
const faltando = NOVAS.filter((n) => !antes.has(n.operation) && n.operation !== 'laboratory_analysis');
const comLaboratory = antes.has('lab_analysis') || antes.has('laboratory_analysis')
  ? faltando
  : NOVAS;
if (comLaboratory.length) {
  await exigir(await fetch(`${URL_}/rest/v1/token_costs`, {
    method: 'POST', headers: h, body: JSON.stringify(comLaboratory),
  }), `inserir ${comLaboratory.length} precos`);
}

// 3. Remover os que nenhum caminho do codigo usa.
const paraRemover = REMOVER.filter((op) => antes.has(op));
if (paraRemover.length) {
  const lista = paraRemover.map((o) => `"${o}"`).join(',');
  await exigir(await fetch(`${URL_}/rest/v1/token_costs?operation=in.(${lista})`, {
    method: 'DELETE', headers: h,
  }), `apagar ${paraRemover.length} precos sem uso`);
}

const depois = await ler();
console.log(`\ntoken_costs depois: ${depois.size} linhas`);
for (const [op, v] of depois) console.log(`  ${op.padEnd(33)} ${v}`);

const sumiu = [...antes.keys()].filter((o) => !depois.has(o));
const surgiu = [...depois.keys()].filter((o) => !antes.has(o));
console.log(`\nsairam: ${sumiu.join(', ') || '—'}`);
console.log(`entraram: ${surgiu.join(', ') || '—'}`);
