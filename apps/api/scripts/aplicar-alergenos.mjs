/**
 * Preenche `alergenos` nos alimentos a partir do dicionário curado em
 * src/modules/foods/alergenos.ts (RDC 26/2015 da ANVISA).
 *
 *   PGURL=postgresql://... node scripts/aplicar-alergenos.mjs [--aplicar] [--tudo]
 *
 * Sem --aplicar apenas mostra o que mudaria. Idempotente.
 *
 * A derivação vem só do nome do alimento — não infere receita, processo
 * industrial nem contaminação cruzada, e não substitui a leitura do rótulo.
 */
import pg from 'pg';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const aqui = dirname(fileURLToPath(import.meta.url));
const fonte = readFileSync(join(aqui, '../src/modules/foods/alergenos.ts'), 'utf8');

// Resolve as constantes (LEITE, GLUTEN...) para os rótulos reais
const CONST = Object.fromEntries(
  [...fonte.matchAll(/^\s*([A-Z_]+):\s*'([^']+)',/gm)].map(([, k, v]) => [k, v]),
);

const REGRAS = [...fonte.matchAll(
  /\{\s*contem:\s*'([^']+)',\s*alergenos:\s*\[([^\]]*)\]\s*(?:,\s*exceto:\s*\[([^\]]*)\]\s*)?,?\s*\}/g,
)].map(([, contem, lista, excecoes]) => ({
  contem,
  alergenos: lista
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => CONST[s] ?? s.replace(/'/g, '')),
  exceto: excecoes ? [...excecoes.matchAll(/'([^']+)'/g)].map((m) => m[1]) : [],
}));

if (REGRAS.length === 0 || Object.keys(CONST).length === 0) {
  console.error('Dicionário não pôde ser lido — abortando para não gravar vazio.');
  process.exit(1);
}
console.log(`${REGRAS.length} regras, ${Object.keys(CONST).length} rótulos carregados.`);

const semAcento = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '');
const norm = (s) => semAcento(s).toLowerCase();

const alergenosPara = (nome) => {
  const n = norm(nome);
  const out = new Set();
  for (const r of REGRAS) {
    if (!n.includes(norm(r.contem))) continue;
    if (r.exceto.some((e) => n.includes(norm(e)))) continue;
    for (const a of r.alergenos) out.add(a);
  }
  return [...out].sort();
};

const aplicar = process.argv.includes('--aplicar');
const teto = process.argv.includes('--tudo') ? Infinity : 15;

const c = new pg.Client({ connectionString: process.env.PGURL, ssl: { rejectUnauthorized: false } });
await c.connect();

const { rows } = await c.query(
  `SELECT id, nome_padronizado, COALESCE(alergenos, '{}') AS atuais FROM foods WHERE ativo ORDER BY nome_padronizado`,
);

let mudariam = 0;
const amostra = [];
const porAlergeno = {};

for (const f of rows) {
  const novos = alergenosPara(f.nome_padronizado);
  if (novos.length === 0) continue;
  for (const a of novos) porAlergeno[a] = (porAlergeno[a] ?? 0) + 1;

  const uniao = [...new Set([...f.atuais, ...novos])].sort();
  if (uniao.length === f.atuais.length) continue;

  mudariam++;
  if (amostra.length < teto) amostra.push(`${f.nome_padronizado}  ->  ${uniao.join(', ')}`);

  if (aplicar) {
    await c.query(`UPDATE foods SET alergenos = $1 WHERE id = $2`, [uniao, f.id]);
  }
}

console.log(`\nalimentos: ${rows.length}`);
console.log(`receberiam alérgeno: ${mudariam}`);
console.log('\npor alérgeno:');
Object.entries(porAlergeno).sort((a, b) => b[1] - a[1])
  .forEach(([a, n]) => console.log(`   ${a.padEnd(12)} ${n}`));
console.log('\namostra:');
amostra.forEach((a) => console.log('   ' + a));

if (aplicar) {
  const { rows: fim } = await c.query(
    `SELECT COUNT(*) FILTER (WHERE array_length(alergenos,1) > 0)::int com, COUNT(*)::int total
       FROM foods WHERE ativo`,
  );
  console.log(`\nAPLICADO. Com alérgeno: ${fim[0].com}/${fim[0].total}`);
} else {
  console.log('\n(simulação — rode com --aplicar para gravar)');
}

await c.end();
