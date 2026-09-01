// Verifica a superficie PUBLICA da anamnese contra producao.
// Cria um formulario real (dado clinico vazio), exercita o link e cancela.
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
const { data: link } = await admin.auth.admin.generateLink({ type: 'magiclink', email: process.argv[2] });
const anon = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY, { auth: { persistSession: false } });
const { data: s } = await anon.auth.verifyOtp({ type: 'magiclink', token_hash: link.properties.hashed_token });
const h = { Authorization: `Bearer ${s.session.access_token}`, 'Content-Type': 'application/json' };

const passos = [];
const ok = (n, cond, d) => { passos.push(cond); console.log(`${cond ? 'OK   ' : 'FALHA'} ${n}${d ? ' — ' + d : ''}`); };

// Rota publica NAO exige autenticacao
const semAuth = await fetch(`${API}/publico/anamnese/${'x'.repeat(43)}`);
ok('rota publica dispensa login', semAuth.status !== 401, `HTTP ${semAuth.status}`);

// Token invalido nao vaza nada
const corpoInvalido = await semAuth.text();
ok('token invalido devolve erro generico', corpoInvalido.includes('inválido') || semAuth.status === 404,
   corpoInvalido.slice(0, 80));

// Cria formulario
const cr = await fetch(`${API}/pre-consult`, {
  method: 'POST', headers: h, body: JSON.stringify({ patientId: process.argv[3] }),
});
const criado = await cr.json();
ok('cria formulario autenticado', cr.status === 201 || cr.status === 200, `HTTP ${cr.status}`);
if (!criado?.token) { console.log('resposta:', JSON.stringify(criado).slice(0, 200)); process.exit(1); }

ok('token devolvido tem 43+ caracteres', criado.token.length >= 43, `${criado.token.length} chars`);
ok('resposta nao expoe o hash', criado.tokenHash === undefined || criado.tokenHash === null, '');

// Abre pelo link, sem autenticacao
const ab = await fetch(`${API}/publico/anamnese/${criado.token}`);
const publico = await ab.json();
ok('abre o formulario pelo link', ab.status === 200, `HTTP ${ab.status}`);
const chaves = Object.keys(publico ?? {}).sort();
ok('nao vaza dado do paciente', JSON.stringify(chaves) === JSON.stringify(['expiraEm','questionario','versao']),
   chaves.join(', '));
const texto = JSON.stringify(publico);
ok('nao contem patientId nem id do formulario',
   !texto.includes(process.argv[3]) && !texto.includes(criado.id), '');

// Rejeita resposta incompleta
const ruim = await fetch(`${API}/publico/anamnese/${criado.token}`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}),
});
ok('recusa envio sem obrigatorias', ruim.status === 400, `HTTP ${ruim.status}`);

// Cancela (deixa producao limpa)
const canc = await fetch(`${API}/pre-consult/${criado.id}/cancelar`, { method: 'PATCH', headers: h, body: '{}' });
ok('cancela o formulario de teste', canc.status === 200, `HTTP ${canc.status}`);

// Cancelado responde igual a inexistente
const dep = await fetch(`${API}/publico/anamnese/${criado.token}`);
ok('link cancelado deixa de abrir', dep.status === 404, `HTTP ${dep.status}`);

console.log(`\n${passos.filter(Boolean).length}/${passos.length} OK`);
process.exit(passos.every(Boolean) ? 0 : 1);
