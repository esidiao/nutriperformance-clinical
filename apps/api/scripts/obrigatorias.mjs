import { readFileSync } from 'node:fs';
function carregarEnv(c) {
  for (const l of readFileSync(c, 'utf8').split(/\r?\n/)) {
    const m = l.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}
carregarEnv(new URL('../.env', import.meta.url));
const K = process.env.SUPABASE_SERVICE_ROLE_KEY;
const r = await fetch(`${process.env.SUPABASE_URL}/rest/v1/`, {
  headers: { apikey: K, Authorization: `Bearer ${K}` },
});
const spec = await r.json();
for (const t of process.argv.slice(2)) {
  const d = spec.definitions?.[t];
  console.log(`== ${t} ==`);
  console.log('obrigatorias:', (d?.required ?? []).join(', ') || '(nenhuma)');
  for (const [nome, p] of Object.entries(d?.properties ?? {})) {
    console.log(`  ${nome.padEnd(28)} ${p.format ?? p.type}`);
  }
}
