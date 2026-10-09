/**
 * Mostra QUAIS micronutrientes a base de alimentos realmente tem.
 *
 * Importa antes de prometer relatorio de adequacao: so da para comparar com a
 * recomendacao aquilo que existe no alimento. Nutriente ausente na base nao
 * vira "zero" — vira lacuna, e exibir zero afirmaria que o alimento nao tem.
 */
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

const COLUNAS = ['calcio_mg', 'ferro_mg', 'potassio_mg', 'magnesio_mg', 'zinco_mg',
                 'sodio_mg', 'fibras_g', 'gordura_saturada_g', 'acucares_g'];

const r = await fetch(
  `${process.env.SUPABASE_URL}/rest/v1/foods?select=fonte,vitaminas,${COLUNAS.join(',')}&ativo=eq.true&limit=2000`,
  { headers: h },
);
const linhas = await r.json();
console.log(`alimentos ativos: ${linhas.length}\n`);

console.log('MINERAIS E MACROS (coluna propria)   preenchidos');
for (const c of COLUNAS) {
  const n = linhas.filter((l) => l[c] !== null && l[c] !== undefined).length;
  const pct = Math.round((n / linhas.length) * 100);
  console.log(`  ${c.padEnd(34)} ${String(n).padStart(4)}  (${pct}%)`);
}

const chaves = new Map();
for (const l of linhas) {
  for (const [k, v] of Object.entries(l.vitaminas ?? {})) {
    if (k === 'fonte') continue;
    if (v && typeof v === 'object' && 'valor' in v) {
      chaves.set(k, (chaves.get(k) ?? 0) + 1);
    }
  }
}
console.log('\nVITAMINAS (dentro do jsonb)          preenchidos');
for (const [k, n] of [...chaves.entries()].sort((a, b) => b[1] - a[1])) {
  console.log(`  ${k.padEnd(34)} ${String(n).padStart(4)}  (${Math.round((n / linhas.length) * 100)}%)`);
}

console.log('\nNAO existem na base (TACO 4a ed. nao publica):');
console.log('  vitamina D, vitamina B12, folato, vitamina E, vitamina K,');
console.log('  selenio, fosforo, cobre, manganes, iodo');
console.log('\n=> Um relatorio de adequacao so pode cobrir o que esta acima.');
console.log('   Para os demais seria preciso outra fonte de composicao.');
