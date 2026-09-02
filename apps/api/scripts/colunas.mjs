// ATENCAO ao interpretar o resultado: este script le o cache de schema do
// PostgREST, que pode levar ate ~1 minuto para refletir um ALTER TABLE. Coluna
// ausente aqui NAO prova que a migracao nao rodou — reconfira antes de
// concluir. Ja me fez duvidar de uma migracao que tinha sido aplicada.
import { readFileSync } from 'node:fs';
function carregarEnv(c) {
  for (const l of readFileSync(c, 'utf8').split(/\r?\n/)) {
    const m = l.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}
carregarEnv(new URL('../.env', import.meta.url));
const r = await fetch(`${process.env.SUPABASE_URL}/rest/v1/`, {
  headers: { apikey: process.env.SUPABASE_SERVICE_ROLE_KEY,
             Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}` },
});
const spec = await r.json();
for (const t of process.argv.slice(2)) {
  const props = spec.definitions?.[t]?.properties;
  console.log(`\n== ${t} ==`);
  console.log(props ? Object.keys(props).join(', ') : 'nao encontrada');
}
