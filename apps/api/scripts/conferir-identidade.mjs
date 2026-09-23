/**
 * Compara a identidade em `user_metadata` com a linha da tabela `users`.
 *
 *   node scripts/conferir-identidade.mjs
 *
 * POR QUE, antes de rodar a migracao de identidade:
 *
 * A migracao copia role/workspace_id de `user_metadata` para `app_metadata`.
 * Mas `user_metadata` e gravavel pelo PROPRIO usuario — foi exatamente essa a
 * falha que a mudanca de guard fechou. Copiar sem conferir significaria pegar
 * um valor que o usuario pode ter escrito e promove-lo a fonte confiavel.
 *
 * A tabela `users` so muda pela service role. Se as duas baterem, copiar e
 * seguro. Se divergirem, a linha da tabela manda — e a divergencia precisa ser
 * olhada, porque pode ser tentativa de escalonamento.
 *
 * Nao grava nada.
 */
import { createClient } from '../../web/node_modules/@supabase/supabase-js/dist/index.mjs';
import { readFileSync } from 'node:fs';

function carregarEnv(c) {
  for (const l of readFileSync(c, 'utf8').split(/\r?\n/)) {
    const m = l.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}
carregarEnv(new URL('../.env', import.meta.url));

const admin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } });
const h = { apikey: process.env.SUPABASE_SERVICE_ROLE_KEY,
            Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}` };

const r = await fetch(
  `${process.env.SUPABASE_URL}/rest/v1/users?select=auth_id,email,role,workspace_id,is_active`,
  { headers: h },
);
const tabela = new Map((await r.json()).map((u) => [u.auth_id, u]));

const { data } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });

console.log(`Projeto: ${process.env.SUPABASE_URL}\n`);
console.log('conta                                  user_metadata          tabela users          veredito');

const divergentes = [];
for (const u of data.users) {
  const um = u.user_metadata ?? {};
  const linha = tabela.get(u.id);

  const noMeta = `${um.role ?? '—'}/${(um.workspace_id ?? '—').slice(0, 8)}`;
  const naTabela = linha ? `${linha.role}/${String(linha.workspace_id).slice(0, 8)}` : 'SEM LINHA';

  let veredito;
  if (!linha) {
    veredito = 'sem linha na tabela — nao migrar';
  } else if (!um.role && !um.workspace_id) {
    veredito = 'usar a tabela';
  } else if (um.role === linha.role && um.workspace_id === linha.workspace_id) {
    veredito = 'batem';
  } else {
    veredito = 'DIVERGEM — a tabela manda';
    divergentes.push({ email: u.email, noMeta, naTabela });
  }

  console.log(`${(u.email ?? '?').padEnd(38)} ${noMeta.padEnd(22)} ${naTabela.padEnd(21)} ${veredito}`);
}

console.log(divergentes.length
  ? `\n=== ${divergentes.length} DIVERGENCIA(S) — olhar antes de migrar ===`
  : '\nNenhuma divergencia: copiar de user_metadata da no mesmo que usar a tabela.');
for (const d of divergentes) console.log(`  ${d.email}: meta=${d.noMeta} tabela=${d.naTabela}`);
