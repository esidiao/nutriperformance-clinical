/**
 * Preenche as frações de gordura nos itens de plano JÁ existentes.
 *
 *   node scripts/repor-gorduras-nos-itens.mjs             (ensaio)
 *   node scripts/repor-gorduras-nos-itens.mjs --aplicar   (grava)
 *
 * ============================== POR QUE EXISTE =============================
 *
 * O item de plano guarda a composição COPIADA do alimento no momento em que
 * foi adicionado — é assim de propósito: o plano não muda sozinho quando a
 * base é corrigida. O efeito colateral é que `gorduraSaturadaG` e
 * `gorduraTransG`, que passaram a ser copiadas em 29/10/2026, não existem nos
 * itens anteriores.
 *
 * Sem esta reposição, a tela diria "nenhum alimento deste plano tem a
 * composição de gorduras na base" para todo plano antigo — e seria FALSO: o
 * alimento tem, o item é que não copiou. Afirmação errada com cara de
 * informação, que é o defeito que mais se repete neste projeto.
 *
 * =============================== É ADITIVO =================================
 *
 * Faz MERGE no jsonb: as chaves de micronutriente que já estavam lá ficam
 * intactas. Substituir o objeto apagaria cálcio, ferro e o resto.
 *
 * Idempotente: item que já tem a chave é pulado, então rodar duas vezes não
 * muda nada. E só toca em item com `food_id` — item digitado à mão não tem de
 * onde tirar o dado, e inventar seria pior que deixar vazio.
 */
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

const B = process.env.SUPABASE_URL;
const K = process.env.SUPABASE_SERVICE_ROLE_KEY;
const H = { apikey: K, Authorization: `Bearer ${K}`, 'Content-Type': 'application/json' };
const aplicar = process.argv.includes('--aplicar');

const finito = (v) => {
  if (v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

const itens = await fetch(
  `${B}/rest/v1/meal_plan_items?select=id,food_id,quantidade_g,alimento_nome,micronutrientes&limit=5000`,
  { headers: H },
).then((r) => r.json());

if (!Array.isArray(itens)) {
  console.log('resposta inesperada do banco.');
  process.exit(1);
}

const idsDeAlimento = [...new Set(itens.filter((i) => i.food_id).map((i) => i.food_id))];
const alimentos = new Map();
for (let i = 0; i < idsDeAlimento.length; i += 100) {
  const lote = idsDeAlimento.slice(i, i + 100).join(',');
  const j = await fetch(
    `${B}/rest/v1/foods?select=id,nome_padronizado,gordura_saturada_g,gordura_trans_g&id=in.(${lote})`,
    { headers: H },
  ).then((r) => r.json());
  for (const a of j) alimentos.set(a.id, a);
}

const planeados = [];
for (const it of itens) {
  if (!it.food_id) continue;
  const micros = it.micronutrientes ?? {};
  if (micros.gorduraSaturadaG !== undefined || micros.gorduraTransG !== undefined) continue;

  const a = alimentos.get(it.food_id);
  if (!a) continue;

  const fator = Number(it.quantidade_g) / 100;
  const novas = {};
  const sat = finito(a.gordura_saturada_g);
  const tra = finito(a.gordura_trans_g);
  if (sat !== null) novas.gorduraSaturadaG = Math.round(sat * fator * 1000) / 1000;
  if (tra !== null) novas.gorduraTransG = Math.round(tra * fator * 1000) / 1000;
  if (Object.keys(novas).length === 0) continue; // a base nao tem: nada a repor

  planeados.push({ it, novas, nome: a.nome_padronizado });
}

console.log(`${itens.length} item(ns) de plano · ${planeados.length} a preencher\n`);
for (const p of planeados.slice(0, 20)) {
  console.log(`  ${String(p.nome).slice(0, 44).padEnd(46)} ${JSON.stringify(p.novas)}`);
}
if (planeados.length > 20) console.log(`  ... e mais ${planeados.length - 20}`);

if (!aplicar) {
  console.log('\nENSAIO. Nada gravado. Acrescente --aplicar.');
  process.exit(0);
}

let ok = 0;
for (const p of planeados) {
  // MERGE: preserva o que ja estava no jsonb.
  const corpo = { micronutrientes: { ...(p.it.micronutrientes ?? {}), ...p.novas } };
  const r = await fetch(`${B}/rest/v1/meal_plan_items?id=eq.${p.it.id}`, {
    method: 'PATCH', headers: H, body: JSON.stringify(corpo),
  });
  if (r.ok) ok++;
  else console.log(`  FALHOU ${p.it.id}: HTTP ${r.status}`);
}
console.log(`\ngravados: ${ok} de ${planeados.length}`);

// Confere lendo de volta, inclusive que o que ja existia continua la.
const conf = await fetch(
  `${B}/rest/v1/meal_plan_items?select=id,micronutrientes&limit=5000`, { headers: H },
).then((r) => r.json());
const comGordura = conf.filter((i) => i.micronutrientes?.gorduraSaturadaG !== undefined).length;
const comCalcio = conf.filter((i) => i.micronutrientes?.calcioMg !== undefined).length;
console.log(`conferindo: ${comGordura} item(ns) com gordura saturada · ${comCalcio} com calcio (nao podia mudar)`);
