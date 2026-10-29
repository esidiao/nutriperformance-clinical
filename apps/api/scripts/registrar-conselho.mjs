/**
 * Preenche o registro de conselho de um profissional.
 *
 *   node scripts/registrar-conselho.mjs <email>            (ensaio)
 *   node scripts/registrar-conselho.mjs <email> --aplicar  (grava)
 *
 * POR QUE EXISTE
 *
 * A emissao de documento clinico passou a exigir nome e registro de conselho
 * (29/10/2026) -- assinar com registro de outra pessoa e pior que nao
 * assinar. Nenhuma das contas reais tinha o dado, e a tela de Configuracoes
 * que grava isso depende de um deploy que ainda nao subiu.
 *
 * Este script e a ponte: preenche o registro pela chave de servico, para o
 * profissional nao ficar impedido de trabalhar. Assim que a tela estiver no
 * ar, cada um mantem o proprio.
 *
 * SO MEXE EM TRES COLUNAS. Nome, papel, e-mail e workspace nao sao tocados --
 * papel e autorizacao, e este script nao e lugar de mexer nisso.
 */
import { readFileSync } from 'node:fs';

function carregarEnv(c) {
  try {
    for (const l of readFileSync(c, 'utf8').split(/\r?\n/)) {
      const m = l.match(/^([A-Z0-9_]+)=(.*)$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
    }
  } catch {}
}
carregarEnv(new URL('../.env', import.meta.url));

const B = process.env.SUPABASE_URL;
const K = process.env.SUPABASE_SERVICE_ROLE_KEY;
const H = { apikey: K, Authorization: `Bearer ${K}`, 'Content-Type': 'application/json' };

const email = process.argv[2];
const aplicar = process.argv.includes('--aplicar');
const tipo = process.argv[3] && !process.argv[3].startsWith('--') ? process.argv[3] : null;
const numero = process.argv[4] && !process.argv[4].startsWith('--') ? process.argv[4] : null;
const uf = process.argv[5] && !process.argv[5].startsWith('--') ? process.argv[5] : null;

if (!email || !tipo || !numero) {
  console.log('uso: node scripts/registrar-conselho.mjs <email> <tipo> <numero> [uf] [--aplicar]');
  process.exit(1);
}

const achados = await fetch(
  `${B}/rest/v1/users?select=id,email,full_name,role,council_type,council_number,council_state`
  + `&email=eq.${encodeURIComponent(email)}`,
  { headers: H },
).then((r) => r.json());

if (!Array.isArray(achados) || achados.length !== 1) {
  console.log(`esperava 1 conta para "${email}", achei ${achados?.length ?? 0}. Nao mexo.`);
  process.exit(1);
}

const u = achados[0];
console.log('conta:');
console.log(`  ${u.full_name} · ${u.role}`);
console.log(`  conselho atual: ${u.council_type ?? '(vazio)'} ${u.council_number ?? ''} ${u.council_state ?? ''}`);
console.log('\na gravar:');
console.log(`  council_type   = ${tipo}`);
console.log(`  council_number = ${numero}`);
console.log(`  council_state  = ${uf ?? '(nao informado)'}`);

if (!aplicar) {
  console.log('\nENSAIO. Nada gravado. Acrescente --aplicar.');
  process.exit(0);
}

const r = await fetch(`${B}/rest/v1/users?id=eq.${u.id}`, {
  method: 'PATCH',
  headers: { ...H, Prefer: 'return=representation' },
  body: JSON.stringify({ council_type: tipo, council_number: numero, council_state: uf }),
});
const depois = await r.json();
if (!r.ok) { console.log(`FALHOU: ${r.status} ${JSON.stringify(depois).slice(0, 200)}`); process.exit(1); }

const d = depois[0];
console.log('\ngravado. conferindo de volta:');
console.log(`  ${d.council_type} ${d.council_number} ${d.council_state ?? ''}`);
