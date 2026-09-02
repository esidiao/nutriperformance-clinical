import { readFileSync } from 'node:fs';
function carregarEnv(c) {
  for (const l of readFileSync(c, 'utf8').split(/\r?\n/)) {
    const m = l.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}
carregarEnv(new URL('../.env', import.meta.url));
const h = { apikey: process.env.SUPABASE_SERVICE_ROLE_KEY,
            Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}` };
const [tabela, campos, limite] = process.argv.slice(2);
const r = await fetch(`${process.env.SUPABASE_URL}/rest/v1/${tabela}?select=${campos}&limit=${limite ?? 5}`, { headers: h });
console.log(`${tabela}: HTTP ${r.status}`);
console.log(JSON.stringify(await r.json(), null, 1).slice(0, 900));
