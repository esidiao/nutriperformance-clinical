/**
 * Evolução — tabela canônica de interações (migrada do frontend evidence-base.ts).
 * ADITIVA, idempotente (PK textual = id da entrada). Rollback: DROP TABLE IF EXISTS interactions_base;
 */
const { Client } = require('pg');
const DDL = `
CREATE TABLE IF NOT EXISTS interactions_base (
  id              text PRIMARY KEY,
  entity_a        text NOT NULL,
  entity_a_type   text,
  entity_b        text NOT NULL,
  entity_b_type   text,
  risk_level      text NOT NULL,
  mechanism       text,
  recommendation  text,
  confidence      text,
  evidence_type   text,
  references_text text,
  fonte           text NOT NULL DEFAULT 'evidence_base',
  confiabilidade  text NOT NULL DEFAULT 'alta',
  created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_interbase_entities ON interactions_base (lower(entity_a), lower(entity_b));
`;
async function main() {
  const cs = process.env.DATABASE_URL;
  if (!cs) { console.error('DATABASE_URL ausente — railway run.'); process.exit(1); }
  const client = new Client({ connectionString: cs, ssl: process.env.DB_SSL !== 'false' ? { rejectUnauthorized: false } : false });
  await client.connect();
  try {
    await client.query(DDL);
    const { rows } = await client.query("SELECT 1 FROM information_schema.tables WHERE table_name='interactions_base'");
    console.log(rows.length === 1 ? 'Migração interactions_base concluída.' : 'ERRO: tabela não criada.');
  } finally { await client.end(); }
}
main().catch((e) => { console.error('Falha:', e.message); process.exit(1); });
