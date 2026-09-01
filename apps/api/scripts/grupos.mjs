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
const r = await fetch(`${process.env.SUPABASE_URL}/rest/v1/foods?select=grupo_alimentar&limit=2000`, { headers: h });
const linhas = await r.json();
const conta = {};
for (const l of linhas) conta[l.grupo_alimentar ?? '(nulo)'] = (conta[l.grupo_alimentar ?? '(nulo)'] ?? 0) + 1;
console.log(`total lido: ${linhas.length}`);
for (const [g, n] of Object.entries(conta).sort((a, b) => b[1] - a[1])) console.log(`${String(n).padStart(4)}  ${g}`);
