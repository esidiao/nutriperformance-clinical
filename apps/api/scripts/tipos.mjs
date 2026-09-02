// Mostra o TIPO de cada coluna, nao so o nome.
//
// Nome de coluna certo nao garante consulta valida: o JOIN de /admin/audit-logs
// citava duas colunas que existem, e mesmo assim devolvia 500. Divergencia de
// tipo (uuid = text) nao aparece numa checagem que so olha nomes.
//
// Mesma ressalva de colunas.mjs: le o cache de schema do PostgREST, que demora
// ate ~1 minuto para refletir um ALTER TABLE.
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

// [tabela.coluna, ...] — ou so a tabela para listar tudo.
for (const alvo of process.argv.slice(2)) {
  const [tabela, coluna] = alvo.split('.');
  const props = spec.definitions?.[tabela]?.properties;
  if (!props) { console.log(`${tabela}: nao encontrada`); continue; }
  for (const [nome, def] of Object.entries(props)) {
    if (coluna && nome !== coluna) continue;
    console.log(`${tabela}.${nome.padEnd(16)} ${def.format}`);
  }
}
