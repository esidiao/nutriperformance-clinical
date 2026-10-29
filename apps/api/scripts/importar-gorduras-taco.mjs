/**
 * Importa gordura saturada e trans da TACO, da planilha OFICIAL do NEPA.
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

const daTaco = new Map();
for (const [numero, v] of Object.entries(bruto)) {
  // `null` significa NAO ANALISADO e tem de continuar null ate o banco:
  // converter para 0 aqui afirmaria ausencia de gordura no alimento.
  const sat = v?.saturadaG === null || v?.saturadaG === undefined
    ? null
    : Math.round(v.saturadaG * 1000) / 1000;
  // A soma dos dois trans traz ruido de ponto flutuante
  // (7.800000000000001). A TACO publica com 1-3 casas; arredondo em 3 para
  // guardar o numero e nao o artefato da soma.
  const trans = v?.transG === null || v?.transG === undefined
    ? null
    : Math.round(v.transG * 1000) / 1000;
  if (sat === null && trans === null) continue;
  daTaco.set(String(numero), { sat, trans });
}
console.log(`planilha: ${daTaco.size} alimento(s) com gordura saturada ou trans\n`);

// ── a nossa base ───────────────────────────────────────────────────────────
const nossos = [];
for (let de = 0; de < 5000; de += 1000) {
  const j = await fetch(
    `${B}/rest/v1/foods?select=id,nome_padronizado,fonte_id_externo,gordura_saturada_g,gordura_trans_g`
    + `&fonte=eq.taco&limit=1000&offset=${de}`,
    { headers: H },
  ).then((r) => r.json());
  if (!Array.isArray(j) || !j.length) break;
  nossos.push(...j);
}
console.log(`base: ${nossos.length} alimento(s) da TACO`);

const planeados = [];
let semPar = 0;
for (const a of nossos) {
  const d = daTaco.get(String(a.fonte_id_externo));
  if (!d) { semPar++; continue; }
  // Ja preenchido com o mesmo valor: nao reescreve.
  const mudaSat = d.sat !== null && Number(a.gordura_saturada_g) !== d.sat;
  const mudaTra = d.trans !== null && Number(a.gordura_trans_g) !== d.trans;
  if (!mudaSat && !mudaTra) continue;
  planeados.push({ a, d });
}

console.log(`  sem par na planilha : ${semPar}`);
console.log(`  a gravar            : ${planeados.length}\n`);
for (const p of planeados.slice(0, 12)) {
  console.log(`  ${String(p.a.nome_padronizado).slice(0, 40).padEnd(42)} sat=${p.d.sat}  trans=${p.d.trans}`);
}
if (planeados.length > 12) console.log(`  ... e mais ${planeados.length - 12}`);

if (!aplicar) {
  console.log('\nENSAIO. Nada gravado. Acrescente --aplicar.');
  process.exit(0);
}

let ok = 0;
for (const p of planeados) {
  const corpo = {};
  if (p.d.sat !== null) corpo.gordura_saturada_g = p.d.sat;
  if (p.d.trans !== null) corpo.gordura_trans_g = p.d.trans;
  const r = await fetch(`${B}/rest/v1/foods?id=eq.${p.a.id}`, {
    method: 'PATCH', headers: H, body: JSON.stringify(corpo),
  });
  if (r.ok) ok++;
  else console.log(`  FALHOU ${p.a.nome_padronizado}: HTTP ${r.status}`);
}
console.log(`\ngravados: ${ok} de ${planeados.length}`);

// ── confere lendo de volta ─────────────────────────────────────────────────
const conf = await fetch(
  `${B}/rest/v1/foods?select=gordura_saturada_g,lipidios_g&fonte=eq.taco&limit=1000`, { headers: H },
).then((r) => r.json());
const comSat = conf.filter((x) => x.gordura_saturada_g !== null).length;
const comLip = conf.filter((x) => x.lipidios_g !== null).length;
console.log(`conferindo: ${comSat} de ${conf.length} alimentos da TACO com saturada (lipidio total: ${comLip})`);
