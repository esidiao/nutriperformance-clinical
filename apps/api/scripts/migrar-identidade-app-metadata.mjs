// ============================================================================
// Migra a identidade de acesso: user_metadata -> app_metadata
// ============================================================================
//
// POR QUE
//
// O JwtAuthGuard lia `role` e `workspace_id` de `user_metadata`. No Supabase
// esse campo e gravavel pelo PROPRIO usuario: com o access token dele, um
// `supabase.auth.updateUser({ data: { role: 'admin' } })` reescreve o valor.
// Só `app_metadata` exige a service-role key.
//
// Enquanto foi assim, qualquer conta autenticada podia virar admin ou trocar o
// proprio workspace_id e ler o prontuario de outra clinica.
//
// O guard agora le de `app_metadata` e NEGA acesso a quem nao tiver role +
// workspace_id la. Este script copia os valores para o lugar certo.
//
// ⚠️ ORDEM OBRIGATORIA: rodar ANTES de subir a API corrigida. Se a API for
//    primeiro, ninguem entra ate a migracao terminar.
//
// USO
//
//   cd apps/api
//   node scripts/migrar-identidade-app-metadata.mjs            # simulacao (nao grava)
//   node scripts/migrar-identidade-app-metadata.mjs --aplicar  # grava
//
// Precisa de SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no ambiente (ou em
// apps/api/.env). Idempotente: rodar de novo nao muda nada.
//
// ⚠️ O .env local ja apontou para a regiao ERRADA em outros contextos. Aqui o
//    que importa e o projeto do SUPABASE_URL — conferir o ref impresso no
//    cabecalho antes de responder "sim" ao --aplicar.
// ============================================================================

import { createClient } from '../../web/node_modules/@supabase/supabase-js/dist/index.mjs';
import { readFileSync } from 'node:fs';

function carregarEnv(c) {
  for (const l of readFileSync(c, 'utf8').split(/\r?\n/)) {
    const m = l.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}
try { carregarEnv(new URL('../.env', import.meta.url)); } catch {}

const APLICAR = process.argv.includes('--aplicar');
const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Faltam SUPABASE_URL e/ou SUPABASE_SERVICE_ROLE_KEY no ambiente.');
  process.exit(1);
}

const PAPEIS_VALIDOS = new Set([
  'admin', 'nutritionist', 'fitness_professional',
  'supervised_student', 'clinic_manager', 'institutional_manager',
]);

const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

console.log('='.repeat(72));
console.log(`Projeto : ${SUPABASE_URL}`);
console.log(`Modo    : ${APLICAR ? 'APLICAR (grava)' : 'SIMULACAO (nao grava)'}`);
console.log('='.repeat(72));

// ─── Coleta todas as contas (a admin API pagina) ────────────────────────────
const contas = [];
for (let pagina = 1; ; pagina++) {
  const { data, error } = await admin.auth.admin.listUsers({ page: pagina, perPage: 200 });
  if (error) { console.error(`Falha ao listar contas (pagina ${pagina}): ${error.message}`); process.exit(1); }
  if (!data.users.length) break;
  contas.push(...data.users);
  if (data.users.length < 200) break;
}
console.log(`\n${contas.length} conta(s) encontradas.\n`);

const jaOk = [];
const migrar = [];
const semIdentidade = [];
const conflitos = [];

for (const u of contas) {
  const app = u.app_metadata ?? {};
  const user = u.user_metadata ?? {};

  const roleApp = app.role;
  const wsApp = app.workspace_id;
  const roleUser = user.role;
  const wsUser = user.workspace_id;

  // Ja migrada.
  if (roleApp && wsApp) {
    // Divergencia entre os dois lados merece olho humano: pode ser justamente
    // uma tentativa de escalada gravada em user_metadata. app_metadata vence.
    if ((roleUser && roleUser !== roleApp) || (wsUser && wsUser !== wsApp)) {
      conflitos.push({ u, roleApp, wsApp, roleUser, wsUser });
    } else {
      jaOk.push(u);
    }
    continue;
  }

  // Sem nada de onde copiar: a conta ficara sem acesso ate alguem definir o
  // papel e o workspace dela. Nao inventar valor — papel clinico nao se adivinha.
  if (!roleUser || !wsUser) { semIdentidade.push({ u, roleUser, wsUser }); continue; }

  if (!PAPEIS_VALIDOS.has(roleUser)) { semIdentidade.push({ u, roleUser, wsUser }); continue; }

  migrar.push({ u, role: roleApp ?? roleUser, workspace_id: wsApp ?? wsUser });
}

// ─── Relatorio ──────────────────────────────────────────────────────────────
console.log(`Ja em app_metadata ....... ${jaOk.length}`);
console.log(`A migrar ................. ${migrar.length}`);
console.log(`Divergentes (revisar) .... ${conflitos.length}`);
console.log(`SEM identidade (bloqueio)  ${semIdentidade.length}`);

if (conflitos.length) {
  console.log('\n--- DIVERGENTES: app_metadata ja existe e discorda de user_metadata ---');
  console.log('    app_metadata prevalece e NADA e alterado. Conferir se user_metadata');
  console.log('    foi adulterado pelo proprio usuario.');
  for (const c of conflitos) {
    console.log(`  ${c.u.email}`);
    console.log(`      app : role=${c.roleApp} ws=${c.wsApp}`);
    console.log(`      user: role=${c.roleUser} ws=${c.wsUser}`);
  }
}

if (semIdentidade.length) {
  console.log('\n--- SEM IDENTIDADE: estas contas NAO conseguirao entrar ---');
  console.log('    Definir papel e workspace manualmente antes de subir a API.');
  for (const s of semIdentidade) {
    console.log(`  ${s.u.email}  (role=${s.roleUser ?? '-'} ws=${s.wsUser ?? '-'})`);
  }
}

if (!migrar.length) {
  console.log('\nNada a migrar.');
  process.exit(semIdentidade.length ? 2 : 0);
}

console.log('\n--- A MIGRAR ---');
for (const m of migrar) console.log(`  ${m.u.email}  role=${m.role}  ws=${m.workspace_id}`);

if (!APLICAR) {
  console.log('\nSimulacao — nada foi gravado. Repita com --aplicar para efetivar.');
  process.exit(0);
}

// ─── Aplicacao ──────────────────────────────────────────────────────────────
console.log('\nAplicando...');
let ok = 0, falhas = 0;
for (const m of migrar) {
  const { error } = await admin.auth.admin.updateUserById(m.u.id, {
    app_metadata: { role: m.role, workspace_id: m.workspace_id },
  });
  if (error) { console.log(`  FALHA ${m.u.email}: ${error.message}`); falhas++; }
  else { console.log(`  OK    ${m.u.email}`); ok++; }
}

console.log(`\nMigradas: ${ok}  Falhas: ${falhas}`);
if (semIdentidade.length) {
  console.log(`\n⚠️ ${semIdentidade.length} conta(s) seguem sem identidade e NAO entrarao.`);
}
process.exit(falhas ? 1 : 0);
