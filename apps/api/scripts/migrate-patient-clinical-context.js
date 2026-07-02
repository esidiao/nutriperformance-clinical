/**
 * Migração aditiva e reversível: adiciona contexto clínico ao paciente.
 *   - medications          jsonb   DEFAULT '[]'   → [{ name, activePrinciple?, dose? }]
 *   - clinical_conditions  text[]  DEFAULT '{}'   → ['Hipertensão', ...]
 *
 * Idempotente (ADD COLUMN IF NOT EXISTS). Não altera dados existentes.
 * Executar via:  railway run node scripts/migrate-patient-clinical-context.js
 * Rollback:      ALTER TABLE patients DROP COLUMN IF EXISTS medications, DROP COLUMN IF EXISTS clinical_conditions;
 */
const { Client } = require('pg');

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error('DATABASE_URL ausente — execute via `railway run`.');
    process.exit(1);
  }
  const ssl = process.env.DB_SSL !== 'false' ? { rejectUnauthorized: false } : false;
  const client = new Client({ connectionString, ssl });
  await client.connect();
  try {
    await client.query(`
      ALTER TABLE patients
        ADD COLUMN IF NOT EXISTS medications jsonb NOT NULL DEFAULT '[]'::jsonb,
        ADD COLUMN IF NOT EXISTS clinical_conditions text[] NOT NULL DEFAULT '{}'::text[];
    `);
    // Verificação
    const { rows } = await client.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'patients'
        AND column_name IN ('medications', 'clinical_conditions')
      ORDER BY column_name;
    `);
    console.log('Colunas presentes após migração:');
    rows.forEach((r) => console.log(`  - ${r.column_name} (${r.data_type})`));
    if (rows.length !== 2) {
      console.error('ERRO: nem todas as colunas foram criadas.');
      process.exit(1);
    }
    console.log('Migração concluída com sucesso.');
  } finally {
    await client.end();
  }
}

main().catch((e) => { console.error('Falha na migração:', e.message); process.exit(1); });
