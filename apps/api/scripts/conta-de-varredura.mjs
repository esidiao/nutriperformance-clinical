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

const EMAIL = 'varredura@nutritest.com';
const WORKSPACE = '00000000-0000-0000-0000-000000000001'; // Clinica NutriTest Demo
const PAPEL = 'nutritionist'; // as varreduras de escrita exercitam prescricao

const aplicar = process.argv.includes('--aplicar');

const admin = createClient(B, CHAVE, { auth: { autoRefreshToken: false, persistSession: false } });

// Ja existe?
const { data: lista } = await admin.auth.admin.listUsers({ perPage: 500 });
const authExistente = (lista?.users ?? []).find((u) => u.email === EMAIL);
const perfis = await fetch(
  `${B}/rest/v1/users?select=id,email,auth_id,workspace_id,role&email=eq.${EMAIL}`,
  { headers: H },
).then((r) => r.json());
const perfilExistente = Array.isArray(perfis) ? perfis[0] : null;

// O workspace precisa existir, senao a conta nasce apontando para o vazio.
const ws = await fetch(`${B}/rest/v1/workspaces?select=id,name&id=eq.${WORKSPACE}`, { headers: H })
  .then((r) => r.json());
const workspaceOk = Array.isArray(ws) && ws.length === 1;

console.log('— plano —');
console.log(`  e-mail     ${EMAIL}`);
console.log(`  papel      ${PAPEL}`);
console.log(`  workspace  ${WORKSPACE} ${workspaceOk ? `(${ws[0].name})` : '<-- NAO EXISTE'}`);
console.log(`  usuario de autenticacao: ${authExistente ? 'ja existe' : 'a criar'}`);
console.log(`  perfil na aplicacao    : ${perfilExistente ? 'ja existe' : 'a criar'}`);

if (perfilExistente) {
  const invariante = perfilExistente.id === perfilExistente.auth_id;
  console.log(`  users.id === auth_id   : ${invariante ? 'SIM' : 'NAO — conta inutil para escrita'}`);
}

if (!workspaceOk) {
  console.log('\nSem workspace valido nao da para seguir.');
  process.exitCode = 1;
} else if (!aplicar) {
  console.log('\nENSAIO. Nada foi gravado. Para gravar, acrescente --aplicar.');
} else {
  console.log('\n— gravando —');

  let authId = authExistente?.id ?? null;
  if (!authId) {
    const { data, error } = await admin.auth.admin.createUser({
      email: EMAIL,
      email_confirm: true,
      user_metadata: { conta_de_teste: true },
    });
    if (error) throw new Error(`criar usuario de autenticacao: ${error.message}`);
    authId = data.user.id;
    console.log(`  usuario de autenticacao criado: ${authId}`);
  }

  // A INVARIANTE: id = auth_id. E o que faz `createdBy: req.user.id`
  // encontrar a linha certa na tabela `users`.
  if (!perfilExistente) {
    const r = await fetch(`${B}/rest/v1/users`, {
      method: 'POST',
      headers: { ...H, Prefer: 'return=representation' },
      body: JSON.stringify({
        id: authId,
        auth_id: authId,
        workspace_id: WORKSPACE,
        email: EMAIL,
        full_name: 'Conta de Varredura (testes)',
        role: PAPEL,
        council_type: 'CFN',
        council_number: 'CRN-0 000000',
        council_state: 'SP',
        is_active: true,
      }),
    });
    if (!r.ok) throw new Error(`criar perfil: ${r.status} ${await r.text()}`);
    console.log(`  perfil criado com id = auth_id`);
  } else if (perfilExistente.id !== authId) {
    console.log('  perfil ja existe com id DIFERENTE do auth_id — nao mexo nele aqui.');
  }

  // A identidade que o JwtAuthGuard le. Fica em app_metadata e nao em
  // user_metadata porque user_metadata e gravavel pelo proprio usuario.
  const { error: eMeta } = await admin.auth.admin.updateUserById(authId, {
    app_metadata: { role: PAPEL, workspace_id: WORKSPACE, conta_de_teste: true },
  });
  if (eMeta) throw new Error(`app_metadata: ${eMeta.message}`);
  console.log(`  app_metadata: role=${PAPEL} workspace=${WORKSPACE.slice(0, 8)}...`);

  console.log(`\nPronto. Use ${EMAIL} nas varreduras.`);
}
