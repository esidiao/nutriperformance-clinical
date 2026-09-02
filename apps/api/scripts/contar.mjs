import { readFileSync } from 'node:fs';
function carregarEnv(c) {
  for (const l of readFileSync(c, 'utf8').split(/\r?\n/)) {
    const m = l.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}
carregarEnv(new URL('../.env', import.meta.url));
const h = { apikey: process.env.SUPABASE_SERVICE_ROLE_KEY,
            Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
            Prefer: 'count=exact' };
for (const t of process.argv.slice(2)) {
  const r = await fetch(`${process.env.SUPABASE_URL}/rest/v1/${t}?select=id&limit=1`, { headers: h });
  console.log(`${t.padEnd(24)} HTTP ${r.status}  linhas=${r.headers.get('content-range') ?? '?'}`);
}
