// Remove APENAS os registros de diario criados pelos scripts de verificacao —
// os que comecam com "[TESTE]" — e as fotos correspondentes no bucket.
// Lista antes de apagar; nao toca em nada que nao case com o marcador.
import { readFileSync } from 'node:fs';
function carregarEnv(c) {
  for (const l of readFileSync(c, 'utf8').split(/\r?\n/)) {
    const m = l.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}
carregarEnv(new URL('../.env', import.meta.url));
const URL_ = process.env.SUPABASE_URL, KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const BUCKET = process.env.SUPABASE_STORAGE_BUCKET;
const h = { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' };

const r = await fetch(
  `${URL_}/rest/v1/food_diary_entries?descricao=like.%5BTESTE%5D*&select=id,descricao,foto_path`,
  { headers: h },
);
const alvos = await r.json();
console.log(`encontrados: ${Array.isArray(alvos) ? alvos.length : JSON.stringify(alvos).slice(0,200)}`);
if (!Array.isArray(alvos) || !alvos.length) process.exit(0);
for (const a of alvos) console.log(`  ${a.id}  ${a.descricao}  foto=${a.foto_path ?? '-'}`);

if (process.argv[2] !== '--apagar') {
  console.log('\nnada apagado. rode com --apagar para confirmar.');
  process.exit(0);
}

// Storage primeiro, banco depois. Invertido, um erro aqui deixaria imagem que
// ninguem sabe que existe — foi exatamente o que aconteceu enquanto este script
// usava DELETE no objeto (`/object/<bucket>/<caminho>`), forma que devolve 400
// nesta versao da API: ele imprimia o erro, apagava o registro mesmo assim e
// seguia em frente. O certo e DELETE no bucket com `prefixes`, igual a
// src/common/storage.ts.
for (const a of alvos) {
  if (a.foto_path) {
    const d = await fetch(`${URL_}/storage/v1/object/${BUCKET}`, {
      method: 'DELETE',
      headers: { ...h, 'Content-Type': 'application/json' },
      body: JSON.stringify({ prefixes: [a.foto_path] }),
    });
    console.log(`foto ${a.foto_path}: HTTP ${d.status}`);
    if (!d.ok) {
      console.log('  registro PRESERVADO — sem ele a imagem virava orfa sem ponteiro.');
      continue;
    }
  }
  const d = await fetch(`${URL_}/rest/v1/food_diary_entries?id=eq.${a.id}`, { method: 'DELETE', headers: h });
  console.log(`registro ${a.id}: HTTP ${d.status}`);
}
