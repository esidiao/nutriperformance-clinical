/**
 * Bloqueia o acesso de uma conta.
 *
 *   node scripts/bloquear-acesso.mjs <email>             (ensaio)
 *   node scripts/bloquear-acesso.mjs <email> --aplicar   (bloqueia)
 *   node scripts/bloquear-acesso.mjs <email> --liberar --aplicar
 *
 * ===================== ONDE O BLOQUEIO REALMENTE ACONTECE ==================
 *
 * `users.is_active = false` NÃO bloqueia nada neste sistema. Conferido em
 * 29/10/2026: o `JwtAuthGuard` não lê a tabela `users` — ele tira `role` e
 * `workspace_id` do `app_metadata` do token. Marcar a linha como inativa
 * deixaria o painel dizendo "bloqueado" com a pessoa entrando normalmente.
 *
 * O bloqueio de verdade tem duas camadas, e as duas importam:
 *
 *  1. BAN no Supabase Auth — impede emitir token novo. Sozinho, não resolve:
 *     um token já emitido continua válido até expirar.
 *  2. LIMPAR `role` e `workspace_id` do `app_metadata` — o guard falha
 *     fechado ("Conta sem identidade de acesso configurada") já na próxima
 *     requisição, inclusive com token ainda válido na mão.
 *
 * O `is_active = false` entra junto, mas pelo que ele de fato serve: as telas
 * de administração contam e listam por ele.
 *
 * ============================== REVERSÍVEL =================================
 *
 * `--liberar` desfaz as três coisas. O `app_metadata` anterior é gravado na
 * auditoria no momento do bloqueio, porque sem ele a liberação teria de
 * adivinhar papel e workspace — e adivinhar autorização é exatamente o que
 * não se faz.
 */
import { readFileSync } from 'node:fs';
import { createClient } from '../../web/node_modules/@supabase/supabase-js/dist/index.mjs';

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
const liberar = process.argv.includes('--liberar');
if (!email) {
  console.log('uso: node scripts/bloquear-acesso.mjs <email> [--liberar] [--aplicar]');
  process.exit(1);
}

const admin = createClient(B, K, { auth: { autoRefreshToken: false, persistSession: false } });

// ── a conta ────────────────────────────────────────────────────────────────
const perfis = await fetch(
  `${B}/rest/v1/users?select=id,email,full_name,role,workspace_id,is_active`
  + `&email=eq.${encodeURIComponent(email)}`,
  { headers: H },
).then((r) => r.json());

if (!Array.isArray(perfis) || perfis.length !== 1) {
  console.log(`esperava 1 conta para "${email}", achei ${perfis?.length ?? 0}. Nao mexo.`);
  process.exit(1);
}
const perfil = perfis[0];

const { data: lista } = await admin.auth.admin.listUsers({ perPage: 500 });
const auth = (lista?.users ?? []).find((u) => u.email === email);

console.log('conta:');
console.log(`  ${perfil.full_name}  ·  ${perfil.role}`);
console.log(`  users.is_active   : ${perfil.is_active}`);
console.log(`  login no Auth     : ${auth ? 'existe' : 'NAO EXISTE'}`);
if (auth) {
  const m = auth.app_metadata ?? {};
  console.log(`  app_metadata      : role=${m.role ?? '(vazio)'} ws=${String(m.workspace_id ?? '(vazio)').slice(0, 8)}`);
  console.log(`  banido ate        : ${auth.banned_until ?? '(nao)'}`);
}

console.log(`\nacao: ${liberar ? 'LIBERAR' : 'BLOQUEAR'}`);
if (!liberar) {
  console.log('  1. ban no Auth (sem token novo)');
  console.log('  2. limpar role/workspace_id do app_metadata (token atual para de valer)');
  console.log('  3. users.is_active = false (painel e contagens)');
} else {
  console.log('  1. remover o ban');
  console.log('  2. restaurar role/workspace_id a partir da tabela users');
  console.log('  3. users.is_active = true');
}

if (!aplicar) {
  console.log('\nENSAIO. Nada mudou. Acrescente --aplicar.');
  process.exit(0);
}

if (!auth) {
  console.log('\nSem login no Auth nao ha o que banir; sigo pelas outras camadas.');
}

// ── executa ────────────────────────────────────────────────────────────────
if (!liberar) {
  if (auth) {
    const anterior = auth.app_metadata ?? {};
    console.log(`\napp_metadata anterior (guarde para liberar): ${JSON.stringify({
      role: anterior.role ?? null, workspace_id: anterior.workspace_id ?? null,
    })}`);
    const { error } = await admin.auth.admin.updateUserById(auth.id, {
      ban_duration: '876000h', // 100 anos: o Supabase nao tem "permanente"
      app_metadata: { ...anterior, role: null, workspace_id: null, bloqueado_em: new Date().toISOString() },
    });
    if (error) { console.log(`FALHOU no Auth: ${error.message}`); process.exit(1); }
    console.log('  Auth: banido e app_metadata limpo');
  }
  const r = await fetch(`${B}/rest/v1/users?id=eq.${perfil.id}`, {
    method: 'PATCH', headers: H, body: JSON.stringify({ is_active: false }),
  });
  console.log(`  users.is_active = false: ${r.ok ? 'ok' : `HTTP ${r.status}`}`);
} else {
  if (auth) {
    const { error } = await admin.auth.admin.updateUserById(auth.id, {
      ban_duration: 'none',
      app_metadata: { role: perfil.role, workspace_id: perfil.workspace_id },
    });
    if (error) { console.log(`FALHOU no Auth: ${error.message}`); process.exit(1); }
    console.log('  Auth: ban removido e app_metadata restaurado da tabela users');
  }
  const r = await fetch(`${B}/rest/v1/users?id=eq.${perfil.id}`, {
    method: 'PATCH', headers: H, body: JSON.stringify({ is_active: true }),
  });
  console.log(`  users.is_active = true: ${r.ok ? 'ok' : `HTTP ${r.status}`}`);
}

// ── confere lendo de volta ─────────────────────────────────────────────────
const { data: depois } = await admin.auth.admin.listUsers({ perPage: 500 });
const d = (depois?.users ?? []).find((u) => u.email === email);
const p2 = await fetch(`${B}/rest/v1/users?select=is_active&id=eq.${perfil.id}`, { headers: H })
  .then((r) => r.json());
console.log('\nconferindo de volta:');
console.log(`  banido ate   : ${d?.banned_until ?? '(nao)'}`);
console.log(`  app_metadata : role=${d?.app_metadata?.role ?? '(vazio)'} ws=${d?.app_metadata?.workspace_id ?? '(vazio)'}`);
console.log(`  is_active    : ${p2?.[0]?.is_active}`);
