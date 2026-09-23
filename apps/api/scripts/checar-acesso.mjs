/**
 * Diagnostica por que um e-mail nao consegue entrar.
 *
 *   node scripts/checar-acesso.mjs pessoa@exemplo.com
 *
 * NAO recebe nem imprime senha. Entrar depende de cinco coisas distintas, e
 * "nao consigo acessar" nao diz qual delas falhou:
 *
 *   1. existe usuario em auth.users
 *   2. o e-mail esta confirmado
 *   3. app_metadata tem workspace_id e role
 *      (a identidade vem de app_metadata — user_metadata o proprio usuario
 *      grava, entao nao serve para autorizar)
 *   4. existe linha correspondente na tabela `users`
 *   5. o workspace existe e esta ativo
 */
import { createClient } from '../../web/node_modules/@supabase/supabase-js/dist/index.mjs';
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

const email = (process.argv[2] ?? '').trim().toLowerCase();
if (!email) {
  console.error('uso: node scripts/checar-acesso.mjs <email>');
  process.exit(1);
}

const admin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } });

// listUsers pagina; procura ate achar para nao depender da primeira pagina.
let achado = null;
for (let pagina = 1; pagina <= 20 && !achado; pagina++) {
  const { data, error } = await admin.auth.admin.listUsers({ page: pagina, perPage: 200 });
  if (error) { console.error('falha ao listar usuarios:', error.message); process.exit(1); }
  if (!data.users.length) break;
  achado = data.users.find((u) => (u.email ?? '').toLowerCase() === email) ?? null;
}

console.log(`== ${email} ==\n`);

if (!achado) {
  console.log('1. auth.users ................. NAO EXISTE');
  console.log('\nO usuario nunca foi criado no Supabase Auth. Senha temporaria');
  console.log('anotada em algum lugar nao cria conta — alguem precisa convidar.');
  process.exit(0);
}

console.log(`1. auth.users ................. existe (${achado.id})`);
console.log(`2. e-mail confirmado .......... ${achado.email_confirmed_at ? 'sim' : 'NAO'}`);
console.log(`   criado em .................. ${achado.created_at}`);
console.log(`   ultimo login .............. ${achado.last_sign_in_at ?? 'NUNCA'}`);

const am = achado.app_metadata ?? {};
const um = achado.user_metadata ?? {};
console.log(`3. app_metadata.workspace_id .. ${am.workspace_id ?? 'AUSENTE'}`);
console.log(`   app_metadata.role .......... ${am.role ?? 'AUSENTE'}`);
// Mostra o user_metadata so para revelar o caso em que a identidade foi
// gravada no lugar errado — nao para usa-lo.
if (um.workspace_id || um.role) {
  console.log(`   (user_metadata tem role=${um.role ?? '—'} workspace_id=${um.workspace_id ?? '—'}`);
  console.log('    — gravavel pelo proprio usuario, NAO serve para autorizar)');
}

const h = { apikey: process.env.SUPABASE_SERVICE_ROLE_KEY,
            Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}` };

const ru = await fetch(
  `${process.env.SUPABASE_URL}/rest/v1/users?select=id,email,role,workspace_id,is_active,auth_id&email=eq.${encodeURIComponent(email)}`,
  { headers: h },
);
const linhas = await ru.json();
if (!Array.isArray(linhas) || !linhas.length) {
  console.log('4. tabela users ............... SEM LINHA');
} else {
  const u = linhas[0];
  console.log(`4. tabela users ............... existe (role=${u.role}, ativo=${u.is_active})`);
  console.log(`   users.auth_id .............. ${u.auth_id ?? 'NULO'}`);
  if (u.auth_id !== achado.id) {
    console.log(`   >> auth_id NAO bate com o id do Auth (${achado.id})`);
  }
  const rw = await fetch(
    `${process.env.SUPABASE_URL}/rest/v1/workspaces?select=id,name,is_active&id=eq.${u.workspace_id}`,
    { headers: h },
  );
  const ws = await rw.json();
  console.log(`5. workspace .................. ${ws?.[0] ? `${ws[0].name} (ativo=${ws[0].is_active})` : 'NAO ENCONTRADO'}`);
}
