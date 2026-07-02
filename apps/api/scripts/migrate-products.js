/**
 * Fase 2 — Produtos industrializados (cache local do Open Food Facts).
 * ADITIVA, reversível, idempotente (UNIQUE codigo_barras).
 *
 * Executar:  cd apps/api && railway run node scripts/migrate-products.js
 * Rollback:  DROP TABLE IF EXISTS industrialized_products;
 */
const { Client } = require('pg');

const DDL = `
CREATE TABLE IF NOT EXISTS industrialized_products (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo_barras      text UNIQUE NOT NULL,
  marca              text,
  nome_comercial     text,
  ingredientes       text,
  alergenos          text[] NOT NULL DEFAULT '{}',
  tabela_nutricional jsonb NOT NULL DEFAULT '{}'::jsonb,  -- por 100g
  aditivos           text[] NOT NULL DEFAULT '{}',
  nutri_score        text,                                 -- A..E
  nova_classificacao smallint,                             -- 1..4
  pais               text,
  imagem_rotulo_url  text,
  alerta_nutricional text[] NOT NULL DEFAULT '{}',
  fonte              text NOT NULL DEFAULT 'openfoodfacts',
  confiabilidade     text NOT NULL DEFAULT 'media',
  licenca            text NOT NULL DEFAULT 'ODbL (Open Food Facts)',
  data_atualizacao   timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT products_conf_chk CHECK (confiabilidade IN ('alta','media','baixa','pendente'))
);
CREATE INDEX IF NOT EXISTS idx_products_nome ON industrialized_products USING gin (to_tsvector('portuguese', coalesce(nome_comercial,'') || ' ' || coalesce(marca,'')));
`;

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) { console.error('DATABASE_URL ausente — use `railway run`.'); process.exit(1); }
  const ssl = process.env.DB_SSL !== 'false' ? { rejectUnauthorized: false } : false;
  const client = new Client({ connectionString, ssl });
  await client.connect();
  try {
    await client.query(DDL);
    const { rows } = await client.query(
      "SELECT 1 FROM information_schema.tables WHERE table_name = 'industrialized_products'",
    );
    if (rows.length !== 1) { console.error('ERRO: tabela não criada.'); process.exit(1); }
    console.log('Migração Fase 2 (industrialized_products) concluída com sucesso.');
  } finally {
    await client.end();
  }
}

main().catch((e) => { console.error('Falha na migração:', e.message); process.exit(1); });
