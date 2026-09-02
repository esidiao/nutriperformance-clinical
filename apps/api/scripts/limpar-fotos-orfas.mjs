// Remove objetos do bucket que nao tem registro correspondente no banco.
import { readFileSync } from 'node:fs';
function carregarEnv(c) {
  for (const l of readFileSync(c, 'utf8').split(/\r?\n/)) {
    const m = l.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}
carregarEnv(new URL('../.env', import.meta.url));
const U = process.env.SUPABASE_URL, K = process.env.SUPABASE_SERVICE_ROLE_KEY;
const B = process.env.SUPABASE_STORAGE_BUCKET;
const h = { apikey: K, Authorization: `Bearer ${K}`, 'Content-Type': 'application/json' };

async function listar(prefixo) {
  const r = await fetch(`${U}/storage/v1/object/list/${B}`, {
    method: 'POST', headers: h,
    body: JSON.stringify({ prefix: prefixo, limit: 200, sortBy: { column: 'name', order: 'asc' } }),
  });
  return r.ok ? r.json() : [];
}

const caminhos = [];
for (const nivel1 of await listar('diario/')) {
  if (nivel1.id) { caminhos.push(`diario/${nivel1.name}`); continue; }
  for (const nivel2 of await listar(`diario/${nivel1.name}/`)) {
    if (nivel2.id) { caminhos.push(`diario/${nivel1.name}/${nivel2.name}`); continue; }
    for (const f of await listar(`diario/${nivel1.name}/${nivel2.name}/`)) {
      caminhos.push(`diario/${nivel1.name}/${nivel2.name}/${f.name}`);
    }
  }
}
console.log(`objetos no bucket: ${caminhos.length}`);
caminhos.forEach((c) => console.log('  ' + c));
if (!caminhos.length) process.exit(0);

const usados = new Set();
const r = await fetch(`${U}/rest/v1/food_diary_entries?select=foto_path`, { headers: h });
for (const x of await r.json()) if (x.foto_path) usados.add(x.foto_path);

const orfas = caminhos.filter((c) => !usados.has(c));
console.log(`\norfas: ${orfas.length}`);
if (!orfas.length || process.argv[2] !== '--apagar') {
  if (orfas.length) console.log('rode com --apagar para remover.');
  process.exit(0);
}
const d = await fetch(`${U}/storage/v1/object/${B}`, {
  method: 'DELETE', headers: h, body: JSON.stringify({ prefixes: orfas }),
});
console.log(`remocao: HTTP ${d.status} :: ${(await d.text()).slice(0, 200)}`);
