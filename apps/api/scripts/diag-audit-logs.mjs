/**
 * Roda a consulta de /admin/audit-logs direto no banco para VER o erro do
 * Postgres, em vez de deduzir a causa pelo 500 generico da API.
 *
 * Somente SELECT. Nao altera nada.
 *
 * Existe porque eu ja errei o diagnostico aqui: apontei divergencia de tipo com
 * confianca, corrigi, e a rota continuou em 500. Ler a mensagem do banco custa
 * menos que uma rodada de deploy.
 */
import pg from 'pg';
import { readFileSync } from 'node:fs';

function carregarEnv(c) {
  for (const l of readFileSync(c, 'utf8').split(/\r?\n/)) {
    const m = l.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}
carregarEnv(new URL('../.env', import.meta.url));

// O .env do repositorio aponta para localhost. Sem trocar DB_HOST/DB_USER/
// DB_PASS pelos de producao, isto testa o banco local — que pode ter schema
// diferente e dar uma resposta tranquilizadora e errada.
if (!process.env.DB_HOST || process.env.DB_HOST === 'localhost') {
  console.error(
    'DB_HOST=localhost — este script so vale contra PRODUCAO.\n'
    + 'Rode com as credenciais de producao no ambiente, ex.:\n'
    + '  DB_HOST=... DB_USER=... DB_PASS=... DB_NAME=... node scripts/diag-audit-logs.mjs',
  );
  process.exit(1);
}

const c = new pg.Client({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT ?? 5432),
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  ssl: { rejectUnauthorized: false },
});
await c.connect();

const COLUNAS = `id, workspace_id, user_id, patient_id, action, resource,
  resource_id, ip_address, success, created_at`;

const consultas = {
  'JOIN completo (o que a rota faz)': [
    `SELECT ${COLUNAS.split(',').map((x) => `l.${x.trim()}`).join(', ')}, u.email AS user_email
     FROM audit_logs l
     LEFT JOIN users u ON u.auth_id = l.user_id::text
     ORDER BY l.created_at DESC
     LIMIT $1 OFFSET $2`, [100, 0]],
  'so o SELECT, sem JOIN': [
    `SELECT ${COLUNAS.split(',').map((x) => `l.${x.trim()}`).join(', ')}
     FROM audit_logs l LIMIT 1`, []],
  'so o JOIN, sem colunas': [
    `SELECT 1 FROM audit_logs l LEFT JOIN users u ON u.auth_id = l.user_id::text LIMIT 1`, []],
  'COUNT (a outra metade do Promise.all)': [
    `SELECT COUNT(*) AS total FROM audit_logs l`, []],
};

for (const [nome, [sql, params]] of Object.entries(consultas)) {
  try {
    const r = await c.query(sql, params);
    console.log(`OK    ${nome} — ${r.rowCount} linha(s)`);
  } catch (e) {
    console.log(`FALHA ${nome}`);
    console.log(`      ${e.message}`);
    if (e.hint) console.log(`      hint: ${e.hint}`);
  }
}

await c.end();
