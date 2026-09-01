/**
 * Preenche `nomes_populares` nos alimentos a partir do dicionário curado em
 * src/modules/foods/sinonimos-populares.ts.
 *
 * O campo existia vazio nos 597 itens da TACO, com a busca já consultando ele:
 * preencher passa a valer sem tocar em código de aplicação.
 *
 *   PGURL=postgresql://... node scripts/aplicar-sinonimos.mjs [--aplicar]
 *
 * Sem --aplicar apenas mostra o que mudaria. Idempotente: rodar de novo não
 * duplica termo já gravado.
 */
import pg from 'pg';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const aqui = dirname(fileURLToPath(import.meta.url));
const fonte = readFileSync(join(aqui, '../src/modules/foods/sinonimos-populares.ts'), 'utf8');

// Lê as regras do próprio .ts para não duplicar o dicionário — ele é a fonte
// única, versionada e coberta por testes.
//
// O `exceto` precisa ser lido junto: é ele que impede o pinhão de receber
// sinônimo de pinha. Ignorá-lo aqui gravaria no banco justamente o erro que a
// exceção existe para evitar.
const REGRAS = [...fonte.matchAll(
  /\{\s*contem:\s*'([^']+)',\s*sinonimos:\s*\[([^\]]*)\]\s*(?:,\s*exceto:\s*\[([^\]]*)\]\s*)?,?\s*\}/g,
)].map(([, contem, lista, excecoes]) => ({
  contem,
  sinonimos: [...lista.matchAll(/'([^']+)'/g)].map((m) => m[1]),
  exceto: excecoes ? [...excecoes.matchAll(/'([^']+)'/g)].map((m) => m[1]) : [],
}));

if (REGRAS.length === 0) {
  console.error('Nenhuma regra lida do dicionário — abortando para não gravar vazio.');
  process.exit(1);
}
console.log(`${REGRAS.length} regras carregadas do dicionário.`);

const semAcento = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '');
const norm = (s) => semAcento(s).toLowerCase();

const sinonimosPara = (nome) => {
  const n = norm(nome);
  const out = new Set();
  for (const r of REGRAS) {
    if (!n.includes(norm(r.contem))) continue;
    if (r.exceto.some((e) => n.includes(norm(e)))) continue;
    for (const s of r.sinonimos) if (!n.includes(norm(s))) out.add(s);
  }
  return [...out].sort();
};

const aplicar = process.argv.includes('--aplicar');
const c = new pg.Client({ connectionString: process.env.PGURL, ssl: { rejectUnauthorized: false } });
await c.connect();

const { rows } = await c.query(
  `SELECT id, nome_padronizado, COALESCE(nomes_populares, '{}') AS atuais FROM foods WHERE ativo`,
);

let mudariam = 0;
let totalTermos = 0;
const amostra = [];

for (const f of rows) {
  const novos = sinonimosPara(f.nome_padronizado);
  if (novos.length === 0) continue;

  // União com o que já existe — nunca sobrescreve curadoria manual anterior
  const uniao = [...new Set([...f.atuais, ...novos])].sort();
  if (uniao.length === f.atuais.length) continue;

  mudariam++;
  totalTermos += uniao.length - f.atuais.length;
  const teto = process.argv.includes('--tudo') ? Infinity : 12;
  if (amostra.length < teto) amostra.push(`${f.nome_padronizado} -> ${uniao.join(', ')}`);

  if (aplicar) {
    await c.query(`UPDATE foods SET nomes_populares = $1 WHERE id = $2`, [uniao, f.id]);
  }
}

console.log(`\nalimentos: ${rows.length}`);
console.log(`receberiam sinônimo: ${mudariam}`);
console.log(`termos a acrescentar: ${totalTermos}`);
console.log('\namostra:');
amostra.forEach((a) => console.log('   ' + a));

if (aplicar) {
  const { rows: fim } = await c.query(
    `SELECT COUNT(*) FILTER (WHERE array_length(nomes_populares,1) > 0)::int com,
            COUNT(*)::int total FROM foods WHERE ativo`,
  );
  console.log(`\nAPLICADO. Com sinônimo: ${fim[0].com}/${fim[0].total}`);
} else {
  console.log('\n(simulação — rode com --aplicar para gravar)');
}

await c.end();
