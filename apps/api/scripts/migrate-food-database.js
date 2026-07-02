/**
 * Fase 1 — Banco de dados de alimentos (aditivo, reversível, idempotente).
 *
 * Tabelas (globais; proveniência obrigatória em cada linha):
 *   - data_sources           catálogo de fontes (TACO/TBCA/USDA/OFF...)
 *   - foods                  composição de alimentos
 *   - food_household_measures medidas caseiras (N:1 com foods)
 *   - import_logs            trilha de cada importação
 *
 * Executar:  cd apps/api && railway run node scripts/migrate-food-database.js
 * Rollback:  DROP TABLE IF EXISTS food_household_measures, foods, import_logs, data_sources CASCADE;
 */
const { Client } = require('pg');

const DDL = `
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE TABLE IF NOT EXISTS data_sources (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome          text UNIQUE NOT NULL,
  descricao     text,
  url           text,
  licenca       text,
  versao        text,
  ultimo_import timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS foods (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome_padronizado    text NOT NULL,
  nomes_populares     text[] NOT NULL DEFAULT '{}',
  grupo_alimentar     text,
  nova_classificacao  smallint,                 -- 1..4 (NOVA), nullable
  energia_kcal        numeric(8,2),
  carboidratos_g      numeric(8,2),
  proteinas_g         numeric(8,2),
  lipidios_g          numeric(8,2),
  gordura_saturada_g  numeric(8,2),
  gordura_trans_g     numeric(8,2),
  fibras_g            numeric(8,2),
  sodio_mg            numeric(10,2),
  acucares_g          numeric(8,2),
  calcio_mg           numeric(10,2),
  ferro_mg            numeric(10,2),
  potassio_mg         numeric(10,2),
  magnesio_mg         numeric(10,2),
  zinco_mg            numeric(10,2),
  vitaminas           jsonb NOT NULL DEFAULT '{}'::jsonb,
  indice_glicemico    numeric(5,1),
  porcao_padrao_g     numeric(8,2) NOT NULL DEFAULT 100,
  alergenos           text[] NOT NULL DEFAULT '{}',
  fonte               text NOT NULL,            -- taco|tbca|usda|openfoodfacts|curadoria
  fonte_id_externo    text,
  fonte_versao        text,
  data_importacao     timestamptz NOT NULL DEFAULT now(),
  confiabilidade      text NOT NULL DEFAULT 'pendente', -- alta|media|baixa|pendente
  licenca             text,
  observacoes_clinicas text,
  ativo               boolean NOT NULL DEFAULT true,
  CONSTRAINT foods_confiabilidade_chk CHECK (confiabilidade IN ('alta','media','baixa','pendente')),
  CONSTRAINT foods_fonte_externo_uq UNIQUE (fonte, fonte_id_externo)
);

CREATE INDEX IF NOT EXISTS idx_foods_nome_trgm ON foods USING gin (nome_padronizado gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_foods_ativo ON foods (ativo) WHERE ativo = true;

CREATE TABLE IF NOT EXISTS food_household_measures (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  food_id        uuid NOT NULL REFERENCES foods(id) ON DELETE CASCADE,
  descricao      text NOT NULL,                 -- "1 colher de sopa"
  gramas         numeric(8,2) NOT NULL,
  fonte          text,
  confiabilidade text NOT NULL DEFAULT 'pendente'
);
CREATE INDEX IF NOT EXISTS idx_hhmeasures_food ON food_household_measures (food_id);

CREATE TABLE IF NOT EXISTS import_logs (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fonte             text NOT NULL,
  linhas_inseridas  integer NOT NULL DEFAULT 0,
  linhas_atualizadas integer NOT NULL DEFAULT 0,
  linhas_rejeitadas integer NOT NULL DEFAULT 0,
  detalhes          jsonb,
  hash              text,
  created_at        timestamptz NOT NULL DEFAULT now()
);
`;

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) { console.error('DATABASE_URL ausente — use `railway run`.'); process.exit(1); }
  const ssl = process.env.DB_SSL !== 'false' ? { rejectUnauthorized: false } : false;
  const client = new Client({ connectionString, ssl });
  await client.connect();
  try {
    await client.query(DDL);
    const { rows } = await client.query(`
      SELECT table_name FROM information_schema.tables
      WHERE table_name IN ('foods','food_household_measures','data_sources','import_logs')
      ORDER BY table_name;
    `);
    console.log('Tabelas presentes:', rows.map((r) => r.table_name).join(', '));
    if (rows.length !== 4) { console.error('ERRO: nem todas as tabelas foram criadas.'); process.exit(1); }
    console.log('Migração Fase 1 concluída com sucesso.');
  } finally {
    await client.end();
  }
}

main().catch((e) => { console.error('Falha na migração:', e.message); process.exit(1); });
