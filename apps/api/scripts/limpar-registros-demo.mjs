/**
 * Apaga registros que uma varredura deixou no workspace de DEMONSTRACAO.
 *
 *   node scripts/limpar-registros-demo.mjs             (ensaio)
 *   node scripts/limpar-registros-demo.mjs --apagar    (apaga)
 *
 * POR QUE EXISTE
 *
 * `limpar-teste-escrita.mjs` limpa pelo paciente: so reconhece internal_code
 * "SONDA-" ou "TESTE-". Em 22/10/2026 a varredura de acessos nao conseguiu
 * criar os pacientes de sonda (502 na hibernacao do Render), caiu no paciente
 * preexistente do workspace de demonstracao e deixou cinco registros que
 * nenhuma limpeza reconhecia.
 *
 * A causa esta corrigida — a varredura agora espera a API acordar e se recusa
 * a escrever em prontuario que nao seja de sonda. Este script e para o
 * residuo, e por isso filtra por JANELA DE TEMPO: `CORTE` separa o que a
 * varredura escreveu do que e semente do workspace. Mexer no corte sem olhar
 * os `created_at` apaga a semente da demonstracao.
 */
import { readFileSync } from 'node:fs';
for (const l of readFileSync(new URL('../.env', import.meta.url), 'utf8').split(/\r?\n/)) {
  const m = l.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
}
const B = process.env.SUPABASE_URL, K = process.env.SUPABASE_SERVICE_ROLE_KEY;
const h = { apikey: K, Authorization: `Bearer ${K}`, 'Content-Type': 'application/json' };
const ws = '00000000-0000-0000-0000-000000000001';
const apagar = process.argv.includes('--apagar');
const CORTE = '2026-10-22T18:40:00Z'; // antes disto e semente, nao e desta varredura
for (const t of ['meal_plan_items', 'meal_plans', 'physical_assessments', 'nutritional_assessments']) {
  if (t === 'meal_plan_items') {
    const pl = await fetch(`${B}/rest/v1/meal_plans?select=id&workspace_id=eq.${ws}&created_at=gte.${CORTE}`, { headers: h }).then(r => r.json());
    if (!Array.isArray(pl) || !pl.length) { console.log('  meal_plan_items           nenhum plano novo'); continue; }
    const r = await fetch(`${B}/rest/v1/meal_plan_items?meal_plan_id=in.(${pl.map(x => x.id).join(',')})`, { method: apagar ? 'DELETE' : 'GET', headers: h });
    console.log(`  meal_plan_items           ${apagar ? (r.ok ? 'apagado' : 'HTTP ' + r.status) : (await r.json()).length + ' a apagar'}`);
    continue;
  }
  const alvo = `${B}/rest/v1/${t}?workspace_id=eq.${ws}&created_at=gte.${CORTE}`;
  if (!apagar) {
    const j = await fetch(`${alvo}&select=id`, { headers: h }).then(r => r.json());
    console.log(`  ${t.padEnd(25)} ${Array.isArray(j) ? j.length : '?'} a apagar`);
  } else {
    const r = await fetch(alvo, { method: 'DELETE', headers: h });
    console.log(`  ${t.padEnd(25)} ${r.ok ? 'apagado' : 'HTTP ' + r.status + ' ' + (await r.text()).slice(0, 120)}`);
  }
}
console.log(apagar ? '\nPronto.' : '\nENSAIO. Para apagar: --apagar');
