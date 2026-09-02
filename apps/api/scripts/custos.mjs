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
const r = await fetch(`${process.env.SUPABASE_URL}/rest/v1/token_costs?select=*`, { headers: h });
const linhas = await r.json();
console.log(`HTTP ${r.status}`);
if (Array.isArray(linhas)) for (const l of linhas) console.log(`  ${String(l.tokens_cost).padStart(5)}  ${l.operation}`);
else console.log(JSON.stringify(linhas).slice(0, 200));
