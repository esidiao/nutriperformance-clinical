/**
 * Aplica um arquivo .sql no banco e mostra o antes e o depois.
 *
 *   PGURL=postgresql://... node scripts/aplicar-sql.mjs docs/migrations/arquivo.sql
 *
 * As migracoes do projeto sao escritas para serem idempotentes (CREATE TABLE IF
 * NOT EXISTS, DROP POLICY IF EXISTS antes de CREATE POLICY), entao rodar duas
 * vezes nao quebra.
 *
 * O `synchronize` do TypeORM fica desligado em producao de proposito: o schema
 * muda por arquivo revisado, nunca por inferencia a partir das entidades.
 */
import pg from 'pg';
import { readFileSync } from 'node:fs';

const arquivo = process.argv[2];
if (!arquivo || !process.env.PGURL) {
  console.error('uso: PGURL=... node scripts/aplicar-sql.mjs <arquivo.sql>');
  process.exit(1);
}

const sql = readFileSync(arquivo, 'utf8');

// Tabelas citadas no arquivo, para relatar o antes e o depois
const tabelas = [...new Set(
  [...sql.matchAll(/CREATE TABLE(?:\s+IF NOT EXISTS)?\s+([a-z_][a-z0-9_]*)/gi)].map((m) => m[1]),
)];

const c = new pg.Client({ connectionString: process.env.PGURL, ssl: { rejectUnauthorized: false } });

const estado = async () => {
  if (tabelas.length === 0) return {};
  const { rows } = await c.query(
    `SELECT t.nome,
            to_regclass('public.' || t.nome) IS NOT NULL AS existe,
            COALESCE((SELECT COUNT(*)::int FROM pg_policies p WHERE p.tablename = t.nome), 0) AS politicas
       FROM unnest($1::text[]) AS t(nome)`,
    [tabelas],
  );
  return Object.fromEntries(rows.map((r) => [r.nome, r]));
};

try {
  await c.connect();
  console.log(`arquivo: ${arquivo}`);

  const antes = await estado();
  for (const t of tabelas) {
    console.log(`   antes  ${t}: ${antes[t]?.existe ? 'existe' : 'ausente'} (${antes[t]?.politicas ?? 0} políticas)`);
  }

  await c.query(sql);
  console.log('\nSQL executado.');

  const depois = await estado();
  for (const t of tabelas) {
    console.log(`   depois ${t}: ${depois[t]?.existe ? 'existe' : 'AUSENTE'} (${depois[t]?.politicas ?? 0} políticas)`);
  }

  const { rows: rls } = await c.query(
    `SELECT relname, relrowsecurity FROM pg_class WHERE relname = ANY($1)`, [tabelas],
  );
  if (rls.length) console.log('\nRLS ligado:', JSON.stringify(rls));
} catch (e) {
  console.error('ERRO:', e.message);
  process.exit(1);
} finally {
  await c.end();
}
