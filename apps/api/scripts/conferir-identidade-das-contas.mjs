/**
 * Confere a invariante `users.id` === `users.auth_id` nas contas reais.
 *
 *   node scripts/conferir-identidade-das-contas.mjs
 *
 * Somente LEITURA. Nao conserta nada, de proposito: consertar a conta errada
 * exige trocar a chave primaria e repontar os dependentes, e isso e decisao,
 * nao rotina de script.
 *
 * A regra esta explicada em `src/common/identidade-da-conta.ts` e travada por
 * `src/common/identidade-da-conta.spec.ts`. Aqui ela e reescrita em JS porque o
 * script roda sem compilar TypeScript; o teste cobre a versao que o sistema
 * usa, e as duas dizem a mesma coisa.
 *
 * O que este script veria no dia 22/10/2026, antes de eu descobrir pelo 500:
 * as contas semeadas com auth_id de marcador aparecendo como "escreve: NAO".
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
if (!B || !K) {
  console.log('Faltam SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY no .env.');
  process.exit(1);
}

/** Mesma regra de `conferirIdentidadeDaConta`. */
function conferir(linha) {
  if (!linha.auth_id) {
    return 'sem auth_id: nao autentica (falha no login, nao na escrita)';
  }
  if (linha.id !== linha.auth_id) {
    return 'id != auth_id: autentica e TODA escrita falha com 500';
  }
  return null;
}

const linhas = await fetch(
  `${B}/rest/v1/users?select=id,email,auth_id,role,workspace_id,is_active&limit=500`,
  { headers: { apikey: K, Authorization: `Bearer ${K}` } },
).then((r) => r.json());

if (!Array.isArray(linhas)) {
  console.log('Resposta inesperada do banco:', JSON.stringify(linhas).slice(0, 200));
  process.exit(1);
}

// E-mail e dado pessoal: mostro o local, nunca o endereco inteiro.
const mascarar = (e) => (e ? `${String(e).split('@')[0].slice(0, 3)}***@${String(e).split('@')[1] ?? '?'}` : '—');

const quebradas = [];
console.log(`${linhas.length} conta(s) em users:\n`);
for (const u of linhas) {
  const problema = conferir(u);
  if (problema) quebradas.push({ u, problema });
  console.log(
    `  ${(problema ? 'ESCREVE: NAO' : 'ok          ').padEnd(13)}`
    + `${String(u.role ?? '?').padEnd(22)}${mascarar(u.email).padEnd(28)}`
    + `${u.is_active === false ? '(inativa) ' : ''}${problema ?? ''}`,
  );
}

console.log(`\n${'='.repeat(62)}`);
if (!quebradas.length) {
  console.log('Todas as contas satisfazem users.id === auth_id.');
} else {
  console.log(`${quebradas.length} conta(s) NAO conseguem escrever:\n`);
  for (const { u, problema } of quebradas) {
    console.log(`  ${mascarar(u.email)} — ${problema}`);
  }
  console.log(
    '\nNao conserte gravando so o auth_id: isso deixa id != auth_id e troca\n'
    + 'falha de login (visivel) por falha de escrita (500 generico em tudo).\n'
    + 'Conta de teste: criar nova com scripts/conta-de-varredura.mjs.\n'
    + 'Conta real: migracao de verdade, com os dependentes repontados.',
  );
  process.exitCode = 1;
}
