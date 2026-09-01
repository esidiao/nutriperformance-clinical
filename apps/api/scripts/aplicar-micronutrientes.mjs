/**
 * Preenche micronutrientes (vitaminas e minerais) na tabela `foods` a partir da
 * TACO 4a edicao — PDF oficial do NEPA/UNICAMP.
 *
 *   PGURL=... node scripts/aplicar-micronutrientes.mjs <taco-extraido.json> [--aplicar]
 *
 * O pareamento e pelo NUMERO TACO (fonte_id_externo), nao pelo nome: e exato e
 * imune a variacao de grafia.
 *
 * So preenche campo que esta NULO — nunca sobrescreve valor existente. Os
 * macros ja gravados foram conferidos contra o PDF antes desta entrega: 575
 * alimentos casaram por nome com ZERO divergencia em kcal e proteina, o que
 * confirma tanto o extrator quanto a fidelidade da importacao anterior.
 *
 * Marcadores da TACO: "Tr" (traco) vira 0; "NA" (nao analisado) fica NULO —
 * ausencia de analise nao e ausencia do nutriente, e registrar 0 seria afirmar
 * o que a tabela nao afirma.
 */
import pg from 'pg';
import { readFileSync } from 'node:fs';

const arquivo = process.argv[2];
const aplicar = process.argv.includes('--aplicar');
if (!arquivo) {
  console.error('uso: node scripts/aplicar-micronutrientes.mjs <taco-extraido.json> [--aplicar]');
  process.exit(1);
}

const taco = JSON.parse(readFileSync(arquivo, 'utf8'));

// Colunas do banco <- chaves do JSON extraido.
// Tudo o que e vitamina vai para o JSONB `vitaminas`.
const MINERAIS = {
  sodio_mg: 'sodio',
  potassio_mg: 'potassio',
  magnesio_mg: 'magnesio',
  zinco_mg: 'zinco',
  ferro_mg: 'ferro',
  calcio_mg: 'calcio',
};

// Vitaminas vao para o JSONB `vitaminas`, com unidade explicita: sem ela, um
// numero solto nao diz se e mg ou µg, e a diferenca e de mil vezes.
//
// RE e RAE entram junto do retinol: retinol so existe em alimento de origem
// animal, entao sem elas cenoura e abobora apareceriam sem nenhuma vitamina A.
const VITAMINAS = [
  ['retinol', 'retinol_mcg', 'µg'],
  ['re', 'vitamina_a_re_mcg', 'µg'],
  ['rae', 'vitamina_a_rae_mcg', 'µg'],
  ['tiamina', 'tiamina_mg', 'mg'],
  ['riboflavina', 'riboflavina_mg', 'mg'],
  ['piridoxina', 'piridoxina_mg', 'mg'],
  ['niacina', 'niacina_mg', 'mg'],
  ['vitamina_c', 'vitamina_c_mg', 'mg'],
];

const c = new pg.Client({ connectionString: process.env.PGURL, ssl: { rejectUnauthorized: false } });
await c.connect();

const { rows } = await c.query(
  `SELECT id, fonte_id_externo, nome_padronizado, energia_kcal, proteinas_g,
          sodio_mg, potassio_mg, magnesio_mg, zinco_mg, ferro_mg, calcio_mg,
          fibras_g, vitaminas
     FROM foods WHERE ativo AND fonte = 'taco'`,
);

/**
 * Porteira de confianca por alimento.
 *
 * A extracao do PDF acerta a metade esquerda (nome e macros) em 100% dos casos,
 * mas desalinha a metade direita em parte das linhas — celulas vazias somem do
 * fluxo e algumas paginas nao calibram. Ferro divergia em 29 alimentos.
 *
 * Como os macros e minerais ja gravados foram conferidos e batem, eles servem
 * de gabarito: se o PDF reproduz exatamente kcal, proteina, calcio E ferro
 * daquele alimento, a linha foi lida coluna a coluna sem deslocamento, e as
 * vitaminas ao lado sao confiaveis. Se qualquer um diverge, o alimento fica
 * sem vitamina — melhor faltar dado do que gravar micronutriente trocado.
 */
const confere = (a, b) => {
  if (a === null || a === undefined || b === null) return false;
  return Math.abs(Number(a) - Number(b)) <= 0.15;
};

const linhaConfiavel = (t, f) =>
  confere(t.kcal, f.energia_kcal) &&
  confere(t.proteina, f.proteinas_g) &&
  confere(t.calcio, f.calcio_mg) &&
  confere(t.ferro, f.ferro_mg);

let semPar = 0, comVit = 0, mineraisPreenchidos = 0, fibrasPreenchidas = 0, reprovados = 0;
const amostra = [];

for (const f of rows) {
  const t = taco[String(f.fonte_id_externo)];
  if (!t) { semPar++; continue; }
  if (!linhaConfiavel(t, f)) { reprovados++; continue; }

  const set = {};

  // minerais: so onde esta nulo
  for (const [coluna, chave] of Object.entries(MINERAIS)) {
    if (f[coluna] === null && t[chave] !== null && t[chave] !== undefined) {
      set[coluna] = t[chave];
      mineraisPreenchidos++;
    }
  }

  // fibra: faltava em 235 dos 597
  if (f.fibras_g === null && t.fibra !== null && t.fibra !== undefined) {
    set.fibras_g = t.fibra;
    fibrasPreenchidas++;
  }

  // vitaminas: monta o JSONB apenas com o que a TACO analisou
  const vit = {};
  for (const [chave, campo, unidade] of VITAMINAS) {
    if (t[chave] !== null && t[chave] !== undefined) vit[campo] = { valor: t[chave], unidade };
  }
  const jaTem = f.vitaminas && Object.keys(f.vitaminas).length > 0;
  if (!jaTem && Object.keys(vit).length > 0) {
    set.vitaminas = JSON.stringify({ ...vit, fonte: 'TACO 4a ed. (NEPA/UNICAMP)' });
    comVit++;
  }

  if (Object.keys(set).length === 0) continue;
  if (amostra.length < 8) {
    amostra.push(`${f.nome_padronizado} -> ${Object.keys(set).join(', ')}`);
  }

  if (aplicar) {
    const campos = Object.keys(set);
    const clausula = campos.map((k, i) => `${k} = $${i + 1}`).join(', ');
    await c.query(`UPDATE foods SET ${clausula} WHERE id = $${campos.length + 1}`,
      [...campos.map((k) => set[k]), f.id]);
  }
}

console.log(`alimentos taco no banco: ${rows.length}`);
console.log(`sem par no PDF: ${semPar}`);
console.log(`reprovados na conferencia (linha desalinhada): ${reprovados}`);
console.log(`receberiam vitaminas: ${comVit}`);
console.log(`campos de mineral a preencher: ${mineraisPreenchidos}`);
console.log(`fibras a preencher: ${fibrasPreenchidas}`);
console.log('\namostra:');
amostra.forEach((a) => console.log('   ' + a));

if (aplicar) {
  const { rows: fim } = await c.query(
    `SELECT COUNT(*) FILTER (WHERE vitaminas IS NOT NULL AND vitaminas::text NOT IN ('{}','null'))::int com_vit,
            COUNT(fibras_g)::int com_fibra, COUNT(*)::int total
       FROM foods WHERE ativo AND fonte = 'taco'`);
  console.log(`\nAPLICADO. Com vitaminas: ${fim[0].com_vit}/${fim[0].total} | com fibra: ${fim[0].com_fibra}/${fim[0].total}`);
} else {
  console.log('\n(simulacao — rode com --aplicar para gravar)');
}

await c.end();
