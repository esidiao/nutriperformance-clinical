/**
 * Remove os registros criados por `varredura-escrita.mjs`.
 *
 * Existe porque a API NAO oferece DELETE de paciente — a exclusao e um PEDIDO
 * (`POST /patients/:id/deletion-request`, LGPD), nao uma acao. A varredura de
 * escrita descobriu isso na pratica: o paciente de teste ficou em producao.
 *
 * So apaga paciente cujo `internal_code` comeca com "TESTE-" (varredura de
 * escrita) ou "SONDA-" (varredura de acessos), e remove antes os registros que
 * dependem dele. Lista o que achou e exige `--apagar`.
 *
 *   node scripts/limpar-teste-escrita.mjs            # so lista
 *   node scripts/limpar-teste-escrita.mjs --apagar
 */
import { readFileSync } from 'node:fs';

function carregarEnv(c) {
  for (const l of readFileSync(c, 'utf8').split(/\r?\n/)) {
    const m = l.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}
carregarEnv(new URL('../.env', import.meta.url));

const URL_ = process.env.SUPABASE_URL;
const h = {
  apikey: process.env.SUPABASE_SERVICE_ROLE_KEY,
  Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
  'Content-Type': 'application/json',
};

const r = await fetch(`${URL_}/rest/v1/patients?select=id,internal_code&or=(internal_code.like.TESTE-*,internal_code.like.SONDA-*)`, { headers: h });
const alvos = await r.json();

if (!Array.isArray(alvos) || !alvos.length) {
  console.log('nenhum paciente de teste encontrado');
  process.exit(0);
}

console.log(`${alvos.length} paciente(s) de teste:`);
for (const p of alvos) console.log(`  ${p.id}  ${p.internal_code}`);

if (!process.argv.includes('--apagar')) {
  console.log('\nnada apagado. rode com --apagar para confirmar.');
  process.exit(0);
}

// Ordem importa: filhos antes do pai, senao a FK recusa.
const DEPENDENTES = [
  'meal_plan_items', 'meal_plans', 'patient_goals', 'patient_supplementations',
  'laboratory_exams', 'physical_assessments', 'nutritional_assessments',
  'clinical_alerts', 'audit_logs',
];

console.log('\napagando:');
for (const p of alvos) {
  for (const tabela of DEPENDENTES) {
    const d = await fetch(`${URL_}/rest/v1/${tabela}?patient_id=eq.${p.id}`, { method: 'DELETE', headers: h });
    // 404 = a tabela nao tem patient_id; nao e erro.
    if (d.ok) console.log(`  ${tabela.padEnd(26)} limpo`);
    else if (d.status !== 404) console.log(`  ${tabela.padEnd(26)} HTTP ${d.status}`);
  }
  const dp = await fetch(`${URL_}/rest/v1/patients?id=eq.${p.id}`, { method: 'DELETE', headers: h });
  console.log(`  paciente ${p.internal_code}: HTTP ${dp.status}`);
}

const conf = await fetch(`${URL_}/rest/v1/patients?select=id&or=(internal_code.like.TESTE-*,internal_code.like.SONDA-*)`, { headers: h });
const restam = await conf.json();
console.log(`\nrestam ${Array.isArray(restam) ? restam.length : '?'} paciente(s) de teste`);
process.exitCode = Array.isArray(restam) && restam.length ? 1 : 0;
