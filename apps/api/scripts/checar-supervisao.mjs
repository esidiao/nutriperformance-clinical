// Verifica o fluxo de supervisao contra PRODUCAO com dois usuarios reais:
// um estagiario e a supervisora. Cria um usuario estagiario temporario, roda
// o fluxo completo e remove no fim.
import { createClient } from '../../web/node_modules/@supabase/supabase-js/dist/index.mjs';
import { readFileSync } from 'node:fs';
function carregarEnv(c) {
  for (const l of readFileSync(c, 'utf8').split(/\r?\n/)) {
    const m = l.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}
carregarEnv(new URL('../.env', import.meta.url));
try {
  carregarEnv(new URL('../../web/.env.local', import.meta.url));
  process.env.SUPABASE_ANON_KEY ||= process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
} catch {}

const API = 'https://nutriperformance-clinical.onrender.com';
const admin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } });
const anon = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY,
  { auth: { persistSession: false } });

async function token(email) {
  const { data, error } = await admin.auth.admin.generateLink({ type: 'magiclink', email });
  if (error) throw new Error(`link para ${email}: ${error.message}`);
  const { data: s, error: e2 } = await anon.auth.verifyOtp({
    type: 'magiclink', token_hash: data.properties.hashed_token,
  });
  if (e2) throw new Error(`sessao para ${email}: ${e2.message}`);
  return s.session.access_token;
}

const passos = [];
const ok = (n, c, d) => { passos.push(c); console.log(`${c ? 'OK   ' : 'FALHA'} ${n}${d ? ' — ' + d : ''}`); };

const emailSupervisora = process.argv[2];
const patientId = process.argv[3];

// Supervisora: descobre workspace pelo token
const tSup = await token(emailSupervisora);
const hSup = { Authorization: `Bearer ${tSup}`, 'Content-Type': 'application/json' };
const { data: { user: uSup } } = await admin.auth.admin.listUsers()
  .then((r) => ({ data: { user: r.data.users.find((u) => u.email === emailSupervisora) } }));
const workspaceId = uSup.user_metadata?.workspace_id;
ok('supervisora tem workspace', !!workspaceId, `role=${uSup.user_metadata?.role}`);

// Cria estagiario temporario no MESMO workspace
const emailEst = `estagio.teste.${Date.now()}@nutriperformance.local`;
const { data: novo, error: erroNovo } = await admin.auth.admin.createUser({
  email: emailEst,
  email_confirm: true,
  user_metadata: { role: 'supervised_student', workspace_id: workspaceId, full_name: '[TESTE] Estagiario' },
});
ok('cria estagiario temporario', !erroNovo && !!novo?.user?.id, erroNovo?.message ?? emailEst);
if (!novo?.user?.id) process.exit(1);
const estudanteId = novo.user.id;

try {
  const tEst = await token(emailEst);
  const hEst = { Authorization: `Bearer ${tEst}`, 'Content-Type': 'application/json' };

  // Estagiario cria plano
  const cp = await fetch(`${API}/meal-plans`, {
    method: 'POST', headers: hEst,
    body: JSON.stringify({ patientId, nome: '[TESTE] plano do estagiario' }),
  });
  const plano = await cp.json();
  ok('estagiario cria plano', cp.status === 201 || cp.status === 200, `HTTP ${cp.status}`);
  if (!plano?.id) { console.log(JSON.stringify(plano).slice(0, 250)); process.exit(1); }

  // Tenta ENTREGAR sem supervisao — tem que ser barrado
  const semSup = await fetch(`${API}/meal-plans/${plano.id}`, {
    method: 'PATCH', headers: hEst, body: JSON.stringify({ isDraft: false }),
  });
  const msgSem = await semSup.text();
  ok('entrega SEM supervisao e barrada', semSup.status === 400,
     `HTTP ${semSup.status} — ${(msgSem.match(/"message":"([^"]{0,70})/) || [])[1] ?? ''}`);

  // Estagiario edita livremente
  const edita = await fetch(`${API}/meal-plans/${plano.id}`, {
    method: 'PATCH', headers: hEst, body: JSON.stringify({ objetivo: 'Reeducacao alimentar' }),
  });
  ok('estagiario EDITA livremente', edita.status === 200, `HTTP ${edita.status}`);

  // Solicita supervisao
  const sol = await fetch(`${API}/supervision`, {
    method: 'POST', headers: hEst,
    body: JSON.stringify({ recurso: 'meal_plan', recursoId: plano.id }),
  });
  const pedido = await sol.json();
  ok('estagiario solicita supervisao', sol.status === 201 || sol.status === 200, `HTTP ${sol.status}`);

  // Estagiario tenta DECIDIR o proprio pedido — RolesGuard deve barrar
  const auto = await fetch(`${API}/supervision/${pedido.id}/decidir`, {
    method: 'PATCH', headers: hEst, body: JSON.stringify({ status: 'aprovado' }),
  });
  ok('estagiario NAO pode decidir', auto.status === 403 || auto.status === 401, `HTTP ${auto.status}`);

  // Supervisora pede ajustes SEM parecer — deve recusar
  const semParecer = await fetch(`${API}/supervision/${pedido.id}/decidir`, {
    method: 'PATCH', headers: hSup, body: JSON.stringify({ status: 'ajustes_solicitados' }),
  });
  ok('ajustes SEM parecer sao recusados', semParecer.status === 400, `HTTP ${semParecer.status}`);

  // Supervisora aprova
  const aprova = await fetch(`${API}/supervision/${pedido.id}/decidir`, {
    method: 'PATCH', headers: hSup, body: JSON.stringify({ status: 'aprovado' }),
  });
  const decidido = await aprova.json();
  ok('supervisora aprova', aprova.status === 200, `HTTP ${aprova.status}`);
  ok('registra quem decidiu e quando', !!decidido?.supervisorId && !!decidido?.decididoEm, '');

  // Agora a entrega passa
  const comSup = await fetch(`${API}/meal-plans/${plano.id}`, {
    method: 'PATCH', headers: hEst, body: JSON.stringify({ isDraft: false }),
  });
  ok('entrega COM aprovacao passa', comSup.status === 200, `HTTP ${comSup.status}`);

  // Limpeza
  await fetch(`${API}/meal-plans/${plano.id}`, { method: 'DELETE', headers: hEst });
} finally {
  await admin.auth.admin.deleteUser(estudanteId);
  console.log(`\nestagiario de teste removido`);
}

console.log(`${passos.filter(Boolean).length}/${passos.length} OK`);
process.exit(passos.every(Boolean) ? 0 : 1);
