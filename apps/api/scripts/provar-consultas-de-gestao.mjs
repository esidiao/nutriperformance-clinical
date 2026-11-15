/**
 * Executa, contra um banco REAL e so para LER, as sete consultas do painel de
 * indicadores de gestao.
 *
 *   PGURL=postgresql://... node scripts/provar-consultas-de-gestao.mjs [workspace_id]
 *
 * ============================== POR QUE EXISTE ==============================
 *
 * `ManagementService` usa SQL cru, e os 35 testes de `management.service.spec`
 * mockam `DataSource.query`. Isso prova o FORMATO e a aritmetica — que
 * denominador zero vira `null` e nao `0`, que cancelada nao entra na taxa de
 * falta, que um bloco com erro nao contamina os outros.
 *
 * Nao prova UMA coisa: que o SQL roda. Nome de tabela errado, `percentile_cont
 * ... FILTER` com sintaxe invalida, `make_interval(days => $2::int)` recusado
 * pela versao do Postgres — nada disso aparece com a consulta mockada. Passaria
 * pela suite inteira e estouraria na primeira abertura da tela.
 *
 * ========================= POR QUE NAO COPIA O SQL =========================
 *
 * Este script NAO tem uma copia das consultas: ele LE
 * `src/modules/management/management.service.ts` e extrai os literais passados
 * para `this.db.query(...)`.
 *
 * Copia divergiria. O script ficaria verde testando o SQL de ontem enquanto o
 * servico roda o de hoje — e um script de prova que testa outra coisa e pior
 * que script nenhum, porque da confianca.
 *
 * ================================ SEGURANCA ================================
 *
 * Somente leitura, e a trava e dupla: `SET default_transaction_read_only = on`
 * na sessao, e uma recusa de rodar qualquer consulta extraida que nao comece
 * com SELECT ou WITH. Nao imprime dado de paciente — as consultas devolvem
 * contagem, soma e mediana. Nao le `.env`: a conexao vem de `PGURL`, igual ao
 * `aplicar-sql.mjs`.
 */
import pg from 'pg';
import { readFileSync } from 'node:fs';

if (!process.env.PGURL) {
  console.error('uso: PGURL=postgresql://... node scripts/provar-consultas-de-gestao.mjs [workspace_id]');
  process.exit(2);
}

const WS = process.argv[2] || '00000000-0000-0000-0000-000000000001';
const DIAS = 90;

// ── Extrai as consultas do servico ──────────────────────────────────────────
const fonte = readFileSync(
  new URL('../src/modules/management/management.service.ts', import.meta.url),
  'utf8',
);

const consultas = [];
const marca = 'this.db.query(';
let i = 0;
while ((i = fonte.indexOf(marca, i)) !== -1) {
  const abre = fonte.indexOf('`', i);
  if (abre === -1) break;
  const fecha = fonte.indexOf('`', abre + 1);
  if (fecha === -1) break;
  const sql = fonte.slice(abre + 1, fecha);
  // Nome do metodo que contem esta consulta, para o relatorio.
  const antes = fonte.slice(0, i);
  const m = [...antes.matchAll(/private async ([a-zA-Z]+)\(/g)].pop();
  consultas.push({ nome: m ? m[1] : `consulta ${consultas.length + 1}`, sql });
  i = fecha + 1;
}

if (consultas.length === 0) {
  console.error('nenhuma consulta extraida — o padrao `this.db.query(` mudou no servico?');
  process.exit(1);
}

const c = new pg.Client({
  connectionString: process.env.PGURL,
  ssl: { rejectUnauthorized: false },
  statement_timeout: 30000,
});

let falhas = 0;

try {
  await c.connect();
  await c.query('SET default_transaction_read_only = on');

  console.log(`consultas extraidas do servico: ${consultas.length}`);
  console.log(`workspace: ${WS}`);
  console.log(`janela: ${DIAS} dias\n`);

  for (const { nome, sql } of consultas) {
    // Trava 2: nada que nao seja leitura roda, mesmo que alguem edite o
    // servico e coloque um UPDATE ali.
    // `slice(0, 6)` aqui era defeito: de `WITH base` sai `WITH B`, que nao e
    // igual a `WITH`, e as duas consultas com CTE seriam recusadas — a trava
    // reprovando pelo motivo errado.
    const inicio = sql.trim().toUpperCase();
    if (!inicio.startsWith('SELECT') && !inicio.startsWith('WITH ')) {
      console.log(`--- ${nome}: RECUSADO, nao comeca com SELECT/WITH`);
      falhas++;
      continue;
    }

    // Quantos parametros a consulta usa; todos de data valem DIAS.
    const maior = Math.max(0, ...[...sql.matchAll(/\$(\d+)/g)].map((m) => Number(m[1])));
    const params = [WS, ...Array.from({ length: Math.max(0, maior - 1) }, () => DIAS)];

    const t = Date.now();
    try {
      const r = await c.query(sql, params);
      console.log(`--- ${nome}: OK (${Date.now() - t} ms, ${r.rowCount} linha(s), ${params.length} parametro(s))`);
      console.log(JSON.stringify(r.rows, null, 1));

      // Um aviso util, nao uma falha: consulta que devolve so zeros e nulos
      // roda certo e nao prova nada sobre o calculo.
      const vazia =
        r.rowCount === 1 &&
        Object.values(r.rows[0]).every((v) => v === null || v === 0 || v === '0');
      if (vazia) console.log('    (atencao: tudo zero/nulo — o SQL roda, mas este workspace nao exercita o calculo)');
    } catch (e) {
      falhas++;
      console.log(`--- ${nome}: FALHOU`);
      console.log(`    ${e.message}`);
      if (e.position) console.log(`    posicao ${e.position} do SQL`);
    }
    console.log('');
  }

  // Volume por tabela, para saber se o workspace escolhido e representativo.
  const { rows } = await c.query(
    `SELECT (SELECT count(*)::int FROM patients WHERE workspace_id = $1) AS pacientes,
            (SELECT count(*)::int FROM appointments WHERE workspace_id = $1) AS consultas,
            (SELECT count(*)::int FROM meal_plans WHERE workspace_id = $1) AS planos,
            (SELECT count(*)::int FROM charges WHERE workspace_id = $1) AS cobrancas,
            (SELECT count(*)::int FROM patient_goals WHERE workspace_id = $1) AS metas,
            (SELECT count(*)::int FROM food_diary_entries WHERE workspace_id = $1) AS registros_diario,
            (SELECT count(*)::int FROM clinical_alerts WHERE workspace_id = $1) AS alertas`,
    [WS],
  );
  console.log('volume neste workspace:');
  console.log(JSON.stringify(rows[0], null, 1));
} finally {
  await c.end();
}

console.log(`\nconsultas com falha: ${falhas} de ${consultas.length}`);
process.exit(falhas ? 1 : 0);
