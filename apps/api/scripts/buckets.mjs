import { readFileSync } from 'node:fs';
function carregarEnv(c) {
  for (const l of readFileSync(c, 'utf8').split(/\r?\n/)) {
    const m = l.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}
carregarEnv(new URL('../.env', import.meta.url));
const r = await fetch(`${process.env.SUPABASE_URL}/storage/v1/bucket`, {
  headers: { apikey: process.env.SUPABASE_SERVICE_ROLE_KEY,
             Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}` },
});
const b = await r.json();
console.log(`HTTP ${r.status}`);
console.log(Array.isArray(b) ? b.map(x => `${x.name} (publico=${x.public})`).join('\n') || '(nenhum)' : JSON.stringify(b).slice(0,200));
console.log('bucket configurado no .env:', process.env.SUPABASE_STORAGE_BUCKET);
