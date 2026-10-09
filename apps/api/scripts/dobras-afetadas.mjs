/**
 * Levanta quantas avaliacoes fisicas podem estar com as dobras nas colunas
 * erradas.
 *
 * CONTEXTO: a tela de avaliacao fisica nao tinha campo de sexo e usava
 * `?? 'female'`, entao SEMPRE gravava pelo protocolo feminino
 * (triceps / supra-iliaca / coxa). Para paciente do sexo masculino o protocolo
 * correto e peitoral / abdominal / coxa.
 *
 * O que este script NAO consegue saber: o que a profissional de fato mediu.
 * O rotulo na tela dizia "Triceps" e "Supra-iliaca" mesmo para homem — entao
 * ou ela mediu o que estava escrito (e o dado esta CERTO na coluna certa), ou
 * mediu o protocolo masculino que conhece (e o dado esta na coluna errada).
 * So quem mediu sabe. Por isso aqui so conta e mostra; nao corrige nada.
 *
 *   node scripts/dobras-afetadas.mjs
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

async function buscar(caminho) {
  const r = await fetch(`${process.env.SUPABASE_URL}/rest/v1/${caminho}`, { headers: h });
  if (!r.ok) throw new Error(`${caminho}: HTTP ${r.status} ${(await r.text()).slice(0, 160)}`);
  return r.json();
}

const COLUNAS = [
  'skinfold_triceps_mm', 'skinfold_subscapular_mm', 'skinfold_suprailiac_mm',
  'skinfold_abdominal_mm', 'skinfold_thigh_mm', 'skinfold_chest_mm',
];

const avaliacoes = await buscar(
  `physical_assessments?select=id,patient_id,assessment_date,created_at,skinfold_protocol,${COLUNAS.join(',')}&limit=2000`,
);
const pacientes = await buscar('patients?select=id,gender,internal_code&limit=2000');
const sexoPorId = new Map(pacientes.map((p) => [p.id, p.gender]));

const temAlgumaDobra = (a) => COLUNAS.some((c) => a[c] !== null && a[c] !== undefined);
const comDobras = avaliacoes.filter(temAlgumaDobra);

console.log(`avaliacoes fisicas no total ......... ${avaliacoes.length}`);
console.log(`com ao menos uma dobra registrada ... ${comDobras.length}\n`);

if (!comDobras.length) {
  console.log('Nenhuma avaliacao com dobra cutanea. Nada foi gravado errado,');
  console.log('porque nada foi gravado.');
  process.exit(0);
}

const porSexo = { male: [], female: [], outro: [] };
for (const a of comDobras) {
  const s = sexoPorId.get(a.patient_id);
  (porSexo[s === 'male' ? 'male' : s === 'female' ? 'female' : 'outro']).push(a);
}

console.log(`  de paciente do sexo masculino ..... ${porSexo.male.length}  <= possivelmente trocadas`);
console.log(`  de paciente do sexo feminino ...... ${porSexo.female.length}  (o chute acertava)`);
console.log(`  sexo ausente ou outro ............. ${porSexo.outro.length}`);

// Se o caminho masculino nunca rodou, as colunas dele estao todas vazias.
const usouColunaMasculina = comDobras.filter(
  (a) => a.skinfold_chest_mm !== null || a.skinfold_abdominal_mm !== null,
);
console.log(`\nregistros com peitoral ou abdominal preenchidos: ${usouColunaMasculina.length}`);
console.log(usouColunaMasculina.length === 0
  ? '  => confirma que o caminho masculino NUNCA foi executado.'
  : '  => alguem gravou por esse caminho; investigar antes de concluir.');

if (porSexo.male.length) {
  console.log('\n--- avaliacoes de pacientes do sexo masculino, com dobras ---');
  console.log('(sem nome: o levantamento nao precisa de dado pessoal)');
  for (const a of porSexo.male) {
    const vals = COLUNAS
      .filter((c) => a[c] !== null && a[c] !== undefined)
      .map((c) => `${c.replace('skinfold_', '').replace('_mm', '')}=${a[c]}`)
      .join(' ');
    console.log(`  ${a.id.slice(0, 8)}  ${String(a.assessment_date ?? a.created_at).slice(0, 10)}  ${vals}`);
  }
  console.log('\nNAO corrigir sem perguntar a quem mediu: o rotulo na tela dizia');
  console.log('"Triceps" e "Supra-iliaca". Se a medicao seguiu o rotulo, o dado');
  console.log('esta certo e remapear e que estragaria.');
}
