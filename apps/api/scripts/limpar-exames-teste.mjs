// Desativa os exames criados pelos scripts de verificacao. Nao apaga: exame e
// registro clinico, e a tabela nao tem rota de exclusao por desenho.
import { readFileSync } from 'node:fs';
function carregarEnv(c) {
  for (const l of readFileSync(c, 'utf8').split(/\r?\n/)) {
    const m = l.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}
carregarEnv(new URL('../.env', import.meta.url));
const U = process.env.SUPABASE_URL, K = process.env.SUPABASE_SERVICE_ROLE_KEY;
const h = { apikey: K, Authorization: `Bearer ${K}`, 'Content-Type': 'application/json' };

const r = await fetch(`${U}/rest/v1/laboratory_exams?select=id,collection_date,hemoglobin_g_dl,ferritin_ng_ml`, { headers: h });
const todos = await r.json();
console.log(`exames na base: ${Array.isArray(todos) ? todos.length : '?'}`);
if (!Array.isArray(todos)) { console.log(JSON.stringify(todos).slice(0,200)); process.exit(1); }

// Os de teste sao os criados pelos scripts: hemoglobina 11.20 + ferritina 12.40
const alvos = todos.filter((e) =>
  Math.abs(Number(e.hemoglobin_g_dl) - 11.2) < 0.001
  && Math.abs(Number(e.ferritin_ng_ml) - 12.4) < 0.001);
for (const a of alvos) console.log(`  teste: ${a.id} (${a.collection_date})`);
if (!alvos.length) { console.log('nenhum exame de teste encontrado'); process.exit(0); }
if (process.argv[2] !== '--apagar') { console.log('\nrode com --apagar para remover.'); process.exit(0); }

for (const a of alvos) {
  const d = await fetch(`${U}/rest/v1/laboratory_exams?id=eq.${a.id}`, { method: 'DELETE', headers: h });
  console.log(`removido ${a.id}: HTTP ${d.status}`);
}
