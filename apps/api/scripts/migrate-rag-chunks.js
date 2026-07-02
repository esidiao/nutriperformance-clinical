/**
 * Fase 5 — RAG: tabela de chunks vetorizados (pgvector).
 * ADITIVA, reversível. Embedding 768d (gemini-embedding-001, normalizado → cosseno).
 *
 * Executar:  cd apps/api && railway run node scripts/migrate-rag-chunks.js
 * Rollback:  DROP TABLE IF EXISTS rag_chunks;
 */
const { Client } = require('pg');

const DDL = `
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS rag_chunks (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  texto          text NOT NULL,
  fonte          text NOT NULL,            -- taco | openfoodfacts | dsld | evidence_base
  fonte_ref      text,                     -- id/chave do registro de origem
  confiabilidade text NOT NULL DEFAULT 'media',
  metadata       jsonb NOT NULL DEFAULT '{}'::jsonb,
  embedding      vector(768),
  ativo          boolean NOT NULL DEFAULT true,
  created_at     timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT rag_fonte_ref_uq UNIQUE (fonte, fonte_ref)
);

CREATE INDEX IF NOT EXISTS idx_rag_embedding ON rag_chunks USING hnsw (embedding vector_cosine_ops);
`;

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) { console.error('DATABASE_URL ausente — use `railway run`.'); process.exit(1); }
  const ssl = process.env.DB_SSL !== 'false' ? { rejectUnauthorized: false } : false;
  const client = new Client({ connectionString, ssl });
  await client.connect();
  try {
    await client.query(DDL);
    const { rows } = await client.query("SELECT 1 FROM information_schema.tables WHERE table_name='rag_chunks'");
    if (rows.length !== 1) { console.error('ERRO: tabela não criada.'); process.exit(1); }
    console.log('Migração Fase 5 (rag_chunks + pgvector + índice hnsw) concluída.');
  } finally {
    await client.end();
  }
}
main().catch((e) => { console.error('Falha na migração:', e.message); process.exit(1); });
