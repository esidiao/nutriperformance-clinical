/**
 * Fase 4 — Catálogo de suplementos (cache do NIH DSLD, domínio público).
 * ADITIVA, reversível, idempotente (UNIQUE dsld_id).
 *
 * Executar:  cd apps/api && railway run node scripts/migrate-supplements-catalog.js
 * Rollback:  DROP TABLE IF EXISTS supplements_catalog;
 */
const { Client } = require('pg');

const DDL = `
CREATE TABLE IF NOT EXISTS supplements_catalog (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dsld_id            text UNIQUE NOT NULL,
  nome               text,
  marca              text,
  forma_farmaceutica text,
  ingredientes_ativos jsonb NOT NULL DEFAULT '[]'::jsonb,
  flags              text[] NOT NULL DEFAULT '{}',
  finalidade         text,
  advertencias       text[] NOT NULL DEFAULT '{}',
  pais               text DEFAULT 'EUA',
  fonte              text NOT NULL DEFAULT 'dsld',
  confiabilidade     text NOT NULL DEFAULT 'alta',
  licenca            text NOT NULL DEFAULT 'Domínio público (NIH DSLD)',
  data_atualizacao   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_suppcat_nome ON supplements_catalog USING gin (to_tsvector('simple', coalesce(nome,'') || ' ' || coalesce(marca,'')));
`;

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) { console.error('DATABASE_URL ausente — use `railway run`.'); process.exit(1); }
  const ssl = process.env.DB_SSL !== 'false' ? { rejectUnauthorized: false } : false;
  const client = new Client({ connectionString, ssl });
  await client.connect();
  try {
    await client.query(DDL);
    const { rows } = await client.query("SELECT 1 FROM information_schema.tables WHERE table_name='supplements_catalog'");
    if (rows.length !== 1) { console.error('ERRO: tabela não criada.'); process.exit(1); }
    console.log('Migração Fase 4 (supplements_catalog) concluída com sucesso.');
  } finally {
    await client.end();
  }
}
main().catch((e) => { console.error('Falha na migração:', e.message); process.exit(1); });
