/**
 * Importa gordura saturada, trans, mono e poli-insaturada da TACO, da
 * planilha OFICIAL do NEPA.
 *
 *   python -I scripts/extrair-gorduras-taco.py Taco-4a-Edicao.xlsx > gorduras.json
 *   node scripts/importar-gorduras-taco.mjs gorduras.json
 *   node scripts/importar-gorduras-taco.mjs gorduras.json --aplicar
 *
 * ============================== POR QUE EXISTE =============================
 *
 * Medido em 29/10/2026: dos 597 alimentos da TACO na base, **zero** tinham
 * gordura saturada. A coluna existia; a importação original nunca a
 * preencheu, porque a Tabela 1 da TACO (de onde ela veio) não traz ácidos
 * graxos — eles estão numa tabela própria.
 *
 * Efeito prático: todo plano montado com TACO mostrava "sem dado na base" nas
 * gorduras, que a nutricionista pediu em 29/10/2026.
 *
 * ============================= DE ONDE VEM O DADO ==========================
 *
 * Planilha oficial do NEPA/UNICAMP, aba `AGtaco3`:
 *
 *   https://nepa.unicamp.br/wp-content/uploads/sites/27/2023/10/Taco-4a-Edicao.xlsx
 *
 * Não é mirror nem transcrição: é o arquivo que o NEPA publica. Isso importa
 * porque a composição principal da nossa base veio de um espelho de terceiro
 * (`fonte_versao` diz "via mirror machine-learning-mocha"), e coeficiente de
 * terceiro já nos custou caro neste projeto.
 *
 * ============================ AS CONVENÇÕES DA TACO ========================
 *
 *   Tr  = traço, abaixo do limite de quantificação  -> 0
 *   NA  = não analisado                             -> NULO, nunca 0
 *   ""  = idem                                      -> NULO
 *
 * A distinção entre `Tr` e `NA` é a razão de ser deste script: gravar NA como
 * zero afirmaria que o alimento não tem gordura saturada, que é precisamente
 * a mentira que a tela passou o dia evitando.
 *
 * TRANS = 18:1t + 18:2t, os dois trans que a TACO publica. Se os dois forem
 * NA, o total fica NULO; se um for Tr e o outro número, soma normalmente.
 *
 * ================================= CASAMENTO ===============================
 *
 * `foods.fonte_id_externo` guarda o "Número do Alimento" da TACO — conferido:
 * 0 de 597 sem id. O casamento é direto, sem busca por nome (que erraria em
 * acento e abreviação).
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

const caminho = process.argv[2];
const aplicar = process.argv.includes('--aplicar');
if (!caminho) {
  console.log('uso: node scripts/importar-gorduras-taco.mjs <gorduras.json> [--aplicar]');
  console.log('o JSON sai de: python -I scripts/extrair-gorduras-taco.py <Taco-4a-Edicao.xlsx>');
  process.exit(1);
}

// O JSON e a saida do extrator: dado de arquivo, nao instrucao.
let bruto;
try {
  bruto = JSON.parse(readFileSync(caminho, 'utf8'));
} catch (e) {
  console.log(`nao consegui ler "${caminho}": ${e.message}`);
  process.exit(1);
}

// As quatro fracoes, na mesma estrutura: chave do JSON -> coluna do banco.
// Mono e poli so existem no banco a partir da migracao
// docs/migrations/2026-10-29-gordura-mono-poli.sql -- este script FALHA alto
// se elas nao estiverem aplicadas, em vez de gravar metade calado.
//
// `casas` e a ESCALA REAL da coluna no banco, e nao preferencia de
// apresentacao. Medido em 29/10/2026 lendo 1000 linhas: nenhum valor de
// gordura_saturada_g, gordura_trans_g, lipidios_g ou energia_kcal tem 3
// casas -- essas colunas sao numeric de escala 2. As duas novas foram
// criadas numeric(6,3).
//
// Arredondar UMA VEZ, na escala da coluna, conserta tambem um erro de
// 0,01 g que a importacao anterior deixou em producao: ela arredondava em 3
// casas e o Postgres arredondava ESSE resultado para 2. Porco, bisteca,
// frita tem 5,974666 na planilha; virou 5,975 e depois 5,98, quando o certo
// e 5,97. Arredondamento duplo nao e empate de precisao, e um valor errado.
//
// Arredondar aqui, na escala da coluna, e o que torna o script IDEMPOTENTE.
// Sem isso o Postgres arredondava calado na gravacao (2.095 virava 2.1), a
// comparacao da proxima execucao achava 2.1 != 2.095 e o script anunciava
// "84 saturadas a gravar" para sempre, regravando as mesmas linhas toda vez.
// Um numero de trabalho pendente que nunca chega a zero e um numero que nao
// quer dizer nada.
const CAMPOS = [
  { json: 'saturadaG', coluna: 'gordura_saturada_g', casas: 2 },
  { json: 'transG', coluna: 'gordura_trans_g', casas: 2 },
  { json: 'monoinsaturadaG', coluna: 'gordura_monoinsaturada_g', casas: 3 },
  { json: 'poliinsaturadaG', coluna: 'gordura_poliinsaturada_g', casas: 3 },
];

// `null` significa NAO ANALISADO e tem de continuar null ate o banco:
// converter para 0 aqui afirmaria ausencia de gordura no alimento.
//
// O arredondamento tambem tira o ruido de ponto flutuante da soma dos dois
// trans (7.800000000000001): quero o numero, nao o artefato da soma.
function naEscala(v, casas) {
  if (v === null || v === undefined) return null;
  const f = 10 ** casas;
  return Math.round(v * f) / f;
}

const daTaco = new Map();
for (const [numero, v] of Object.entries(bruto)) {
  const d = {};
  let temAlgum = false;
  for (const c of CAMPOS) {
    d[c.coluna] = naEscala(v?.[c.json], c.casas);
    if (d[c.coluna] !== null) temAlgum = true;
  }
  if (!temAlgum) continue;
  daTaco.set(String(numero), d);
}
console.log(`planilha: ${daTaco.size} alimento(s) com alguma fracao de gordura`);
for (const c of CAMPOS) {
  const n = [...daTaco.values()].filter((d) => d[c.coluna] !== null).length;
  console.log(`  ${c.coluna.padEnd(28)} ${n}`);
}
console.log('');

// ── a nossa base ───────────────────────────────────────────────────────────
//
// O select cita as quatro colunas DE PROPOSITO: se a migracao de mono/poli
// nao tiver sido aplicada, o PostgREST devolve 400 aqui e o script para --
// em vez de gravar saturada e trans e deixar mono e poli de fora calado.
const SELECT = ['id', 'nome_padronizado', 'fonte_id_externo', ...CAMPOS.map((c) => c.coluna)];

const nossos = [];
for (let de = 0; de < 5000; de += 1000) {
  const r = await fetch(
    `${B}/rest/v1/foods?select=${SELECT.join(',')}&fonte=eq.taco&limit=1000&offset=${de}`,
    { headers: H },
  );
  const j = await r.json();
  if (!r.ok) {
    console.log('');
    console.log(`FALHOU ao ler a base: HTTP ${r.status}`);
    console.log(JSON.stringify(j));
    console.log('');
    console.log('Se a reclamacao for de coluna inexistente, aplique primeiro');
    console.log('docs/migrations/2026-10-29-gordura-mono-poli.sql.');
    process.exit(1);
  }
  if (!Array.isArray(j) || !j.length) break;
  nossos.push(...j);
}
console.log(`base: ${nossos.length} alimento(s) da TACO`);

const planeados = [];
let semPar = 0;
for (const a of nossos) {
  const d = daTaco.get(String(a.fonte_id_externo));
  if (!d) { semPar++; continue; }
  // Ja preenchido com o mesmo valor: nao reescreve. `null` na planilha
  // significa nao analisado e NAO apaga o que ja estiver no banco.
  //
  // O teste de coluna nula vem ANTES do Number() de proposito: a versao
  // anterior comparava `Number(a[coluna]) !== v` direto, e `Number(null)` e
  // 0 -- entao zero de verdade (o `Tr` da TACO) parecia ja gravado e 6
  // alimentos ficaram nulos sem ninguem perceber.
  const corpo = {};
  for (const c of CAMPOS) {
    const v = d[c.coluna];
    if (v === null) continue;
    if (a[c.coluna] !== null && Number(a[c.coluna]) === v) continue;
    corpo[c.coluna] = v;
  }
  if (!Object.keys(corpo).length) continue;
  planeados.push({ a, corpo });
}

console.log(`  sem par na planilha : ${semPar}`);
console.log(`  a gravar            : ${planeados.length}`);
for (const c of CAMPOS) {
  const n = planeados.filter((p) => c.coluna in p.corpo).length;
  console.log(`    ${c.coluna.padEnd(26)} ${n}`);
}
console.log('');
for (const p of planeados.slice(0, 10)) {
  const v = CAMPOS.filter((c) => c.coluna in p.corpo)
    .map((c) => `${c.json.replace('G', '')}=${p.corpo[c.coluna]}`).join(' ');
  console.log(`  ${String(p.a.nome_padronizado).slice(0, 34).padEnd(36)} ${v}`);
}
if (planeados.length > 10) console.log(`  ... e mais ${planeados.length - 10}`);

if (!aplicar) {
  console.log('');
  console.log('ENSAIO. Nada gravado. Acrescente --aplicar.');
  process.exit(0);
}

let ok = 0;
for (const p of planeados) {
  const r = await fetch(`${B}/rest/v1/foods?id=eq.${p.a.id}`, {
    method: 'PATCH', headers: H, body: JSON.stringify(p.corpo),
  });
  if (r.ok) ok++;
  else console.log(`  FALHOU ${p.a.nome_padronizado}: HTTP ${r.status}`);
}
console.log('');
console.log(`gravados: ${ok} de ${planeados.length}`);

// ── confere lendo de volta ─────────────────────────────────────────────────
//
// Le do banco, nao da memoria: o que interessa e o que a tela vai ler.
const conf = await fetch(
  `${B}/rest/v1/foods?select=lipidios_g,${CAMPOS.map((c) => c.coluna).join(',')}`
  + `&fonte=eq.taco&limit=1000`,
  { headers: H },
).then((r) => r.json());
console.log('');
console.log(`conferindo ${conf.length} alimentos da TACO no banco:`);
console.log(`  lipidio total              ${conf.filter((x) => x.lipidios_g !== null).length}`);
for (const c of CAMPOS) {
  const n = conf.filter((x) => x[c.coluna] !== null).length;
  console.log(`  ${c.coluna.padEnd(26)} ${n}`);
}
