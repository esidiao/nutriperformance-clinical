// Confere via PostgREST se uma tabela existe. Somente leitura.
import { readFileSync } from 'node:fs';
function carregarEnv(c) {
  for (const l of readFileSync(c, 'utf8').split(/\r?\n/)) {
    const m = l.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}
carregarEnv(new URL('../.env', import.meta.url));
const url = process.env.SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY;
for (const t of process.argv.slice(2)) {
  const r = await fetch(`${url}/rest/v1/${t}?select=id&limit=1`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
  });
  const corpo = await r.text();
  console.log(`${t.padEnd(14)} HTTP ${r.status} :: ${corpo.slice(0, 160)}`);
}
