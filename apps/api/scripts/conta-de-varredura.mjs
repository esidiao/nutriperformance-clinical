// Cria a conta que as varreduras autenticadas usam.
//
//   node scripts/conta-de-varredura.mjs             (ensaio)
//   node scripts/conta-de-varredura.mjs --aplicar   (grava)
//
// POR QUE UMA CONTA NOVA, E NAO CONSERTAR AS SEMEADAS
//
// O sistema tem uma invariante que nao esta documentada nem verificada em
// lugar nenhum: `users.id` E IGUAL a `users.auth_id`. A linha da aplicacao
// usa o proprio UUID de autenticacao como chave primaria, e e por isso que
// o controller pode fazer `createdBy: req.user.id` com o `sub` do token.
//
// As contas semeadas nasceram com `auth_id` de marcador ("auth-nutri-001").
// Corrigir so o auth_id, como eu fiz antes, deixa `users.id` diferente do
// `auth_id` -- a conta passa a autenticar e TODA escrita falha com 500,
// porque `created_by` aponta para um id que nao existe em `users`.
//
// Consertar de verdade exigiria trocar a chave primaria e repontar os
// registros que dependem dela (a dra.ana tem 11). Esta conta nasce certa:
// `id` = `auth_id`, sem cirurgia e sem tocar em nada existente.
//
// SEM SENHA
//
// Email confirmado, sem senha. As varreduras entram por link magico gerado
// com a chave de servico, entao nao ha credencial para vazar nem rotacionar.

import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '../../web/node_modules/@supabase/supabase-js/dist/index.mjs';

const AQUI = dirname(fileURLToPath(import.meta.url));
function carregarEnv(p) {
  if (!existsSync(p)) return;
  for (const l of readFileSync(p, 'utf8').split(/\r?\n/)) {
    const m = l.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}
carregarEnv(join(AQUI, '..', '.env'));

const B = process.env.SUPABASE_URL;
const CHAVE = process.env.SUPABASE_SERVICE_ROLE_KEY;
const H = { apikey: CHAVE, Authorization: `Bearer ${CHAVE}`, 'Content-Type': 'application/json' };

/**
 * As tres contas que as varreduras usam.
 *
 * WORKSPACES DIFERENTES NAO E DETALHE: a varredura de acessos existe para
 * provar que um ator nao enxerga o prontuario de outra clinica. Com todos no
 * mesmo workspace ela passaria sem testar o isolamento -- que e exatamente o
 * tipo de falso verde que ja encontramos na varredura de rotas.
 *
 * Papeis diferentes tambem nao: a separacao CFN/CONFEF (nutricionista
 * prescreve dieta, educador fisico avalia composicao corporal) so se prova
 * com um ator de cada.
 */
const CONTAS = [
  {
    email: 'varredura@nutritest.com',
    papel: 'nutritionist',
    nome: 'Conta de Varredura (testes)',
    workspace: '00000000-0000-0000-0000-000000000001', // Clinica NutriTest Demo
  },
  {
    email: 'varredura-admin@nutritest.com',
    papel: 'admin',
    nome: 'Conta de Varredura — Admin (testes)',
    workspace: '00000000-0000-0000-0000-000000000001', // mesma clinica
  },
  {
    email: 'varredura-fit@nutritest.com',
    papel: 'fitness_professional',
    nome: 'Conta de Varredura — Educador Fisico (testes)',
    workspace: '00000000-0000-0000-0000-000000000002', // OUTRO workspace
  },
];

const aplicar = process.argv.includes('--aplicar');

const admin = createClient(B, CHAVE, { auth: { autoRefreshToken: false, persistSession: false } });

const { data: lista } = await admin.auth.admin.listUsers({ perPage: 500 });
const authPorEmail = new Map((lista?.users ?? []).map((u) => [u.email, u]));

const workspaces = await fetch(`${B}/rest/v1/workspaces?select=id,name`, { headers: H })
  .then((r) => r.json());
const wsPorId = new Map((Array.isArray(workspaces) ? workspaces : []).map((w) => [w.id, w.name]));

const perfis = await fetch(`${B}/rest/v1/users?select=id,email,auth_id,role,workspace_id&limit=200`,
  { headers: H }).then((r) => r.json());
const perfilPorEmail = new Map(
  (Array.isArray(perfis) ? perfis : []).map((u) => [u.email, u]),
);

console.log('— plano —\n');
let impedido = false;
for (const c of CONTAS) {
  const auth = authPorEmail.get(c.email);
  const perfil = perfilPorEmail.get(c.email);
  const wsNome = wsPorId.get(c.workspace);

  console.log(c.email);
  console.log(`  papel      ${c.papel}`);
  console.log(`  workspace  ${c.workspace.slice(0, 8)}... ${wsNome ?? '<-- NAO EXISTE'}`);
  console.log(`  login      ${auth ? 'ja existe' : 'a criar'}`);
  console.log(`  perfil     ${perfil ? 'ja existe' : 'a criar'}`);
  if (perfil) {
    const inv = perfil.id === perfil.auth_id;
    console.log(`  users.id === auth_id: ${inv ? 'SIM' : 'NAO — inutil para escrita'}`);
  }
  if (!wsNome) impedido = true;
  console.log();
}

if (impedido) {
  console.log('Workspace inexistente: nao da para seguir.');
  process.exitCode = 1;
} else if (!aplicar) {
  console.log('ENSAIO. Nada foi gravado. Para gravar, acrescente --aplicar.');
} else {
  console.log('— gravando —');
  for (const c of CONTAS) {
    let authId = authPorEmail.get(c.email)?.id ?? null;

    if (!authId) {
      const { data, error } = await admin.auth.admin.createUser({
        email: c.email, email_confirm: true,
        user_metadata: { conta_de_teste: true },
      });
      if (error) { console.log(`  FALHOU login ${c.email}: ${error.message}`); continue; }
      authId = data.user.id;
      console.log(`  ${c.email}: login criado`);
    }

    // A INVARIANTE: id = auth_id. E o que faz `createdBy: req.user.id`
    // encontrar a linha certa em `users`. Sem isso a conta autentica e falha
    // em toda escrita, com 500 generico.
    const perfil = perfilPorEmail.get(c.email);
    if (!perfil) {
      const r = await fetch(`${B}/rest/v1/users`, {
        method: 'POST',
        headers: { ...H, Prefer: 'return=minimal' },
        body: JSON.stringify({
          id: authId, auth_id: authId, workspace_id: c.workspace,
          email: c.email, full_name: c.nome, role: c.papel,
          council_type: c.papel === 'fitness_professional' ? 'CONFEF' : 'CFN',
          council_number: c.papel === 'fitness_professional' ? 'CREF-0 000000-G/SP' : 'CRN-0 000000',
          council_state: 'SP', is_active: true,
        }),
      });
      if (!r.ok) { console.log(`  FALHOU perfil ${c.email}: ${r.status} ${await r.text()}`); continue; }
      console.log(`  ${c.email}: perfil criado com id = auth_id`);
    } else if (perfil.id !== authId) {
      console.log(`  ${c.email}: perfil existe com id DIFERENTE do auth_id — nao mexo.`);
      continue;
    }

    const { error: eMeta } = await admin.auth.admin.updateUserById(authId, {
      app_metadata: { role: c.papel, workspace_id: c.workspace, conta_de_teste: true },
    });
    if (eMeta) { console.log(`  FALHOU app_metadata ${c.email}: ${eMeta.message}`); continue; }
    console.log(`    app_metadata: role=${c.papel} ws=${c.workspace.slice(0, 8)}...`);
  }
  console.log('\nPronto.');
}
