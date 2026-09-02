// Verifica o portal do paciente contra PRODUCAO.
// Planta dados sensiveis no plano e confere, um a um, o que NAO deve vazar.
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
const { data: ml } = await admin.auth.admin.generateLink({ type: 'magiclink', email: process.argv[2] });
const anon = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY, { auth: { persistSession: false } });
const { data: s } = await anon.auth.verifyOtp({ type: 'magiclink', token_hash: ml.properties.hashed_token });
const h = { Authorization: `Bearer ${s.session.access_token}`, 'Content-Type': 'application/json' };
const patientId = process.argv[3];

const passos = [];
const ok = (n, c, d) => { passos.push(c); console.log(`${c ? 'OK   ' : 'FALHA'} ${n}${d ? ' — ' + d : ''}`); };
const criados = [];

// Marcadores que NAO podem aparecer no portal
const SEGREDO_OBS = 'OBSERVACAO_INTERNA_NAO_DEVE_VAZAR';
const SEGREDO_COMENT = 'ANOTACAO_CLINICA_NAO_DEVE_VAZAR';

// 1. Plano em RASCUNHO com observacao interna
const cr = await fetch(`${API}/meal-plans`, {
  method: 'POST', headers: h,
  body: JSON.stringify({
    patientId, nome: '[TESTE] plano do portal', metaKcal: 1800,
    objetivo: 'Manutencao', orientacoesGerais: 'ORIENTACAO_PARA_O_PACIENTE',
    observacoes: SEGREDO_OBS,
  }),
});
const plano = await cr.json();
ok('cria plano', cr.status === 201, `HTTP ${cr.status}`);
if (!plano?.id) { console.log(JSON.stringify(plano).slice(0, 250)); process.exit(1); }
criados.push(plano.id);

await fetch(`${API}/meal-plans/${plano.id}/items`, {
  method: 'POST', headers: h,
  body: JSON.stringify({ refeicao: 'almoco', alimentoNome: 'Arroz integral', quantidadeG: 120, medidaCaseira: 'colher' }),
});

// 2. Gera o link do portal
const cl = await fetch(`${API}/patient-portal/links`, {
  method: 'POST', headers: h, body: JSON.stringify({ patientId }),
});
const link = await cl.json();
ok('gera link do portal', cl.status === 201, `HTTP ${cl.status}`);
if (!link?.token) { console.log(JSON.stringify(link).slice(0, 250)); process.exit(1); }
ok('resposta nao expoe o hash', !link.tokenHash, '');

// 3. Abre o portal SEM login — plano ainda em rascunho
const ab1 = await fetch(`${API}/publico/portal/${link.token}`);
const p1 = await ab1.json();
ok('abre o portal sem login', ab1.status === 200, `HTTP ${ab1.status}`);
ok('plano em RASCUNHO nao aparece', p1.plano === null, `plano=${p1.plano === null ? 'null' : 'presente'}`);

// 4. Publica o plano
const pub = await fetch(`${API}/meal-plans/${plano.id}`, {
  method: 'PATCH', headers: h, body: JSON.stringify({ isDraft: false }),
});
ok('publica o plano', pub.status === 200, `HTTP ${pub.status}`);

// 5. Reabre — agora o plano aparece
const ab2 = await fetch(`${API}/publico/portal/${link.token}`);
const p2 = await ab2.json();
const texto = JSON.stringify(p2);
ok('plano PUBLICADO aparece', !!p2.plano, p2.plano?.nome ?? '');
ok('mostra a estrutura do cardapio', texto.includes('Arroz integral') && texto.includes('colher'), '');
ok('mostra as orientacoes gerais', texto.includes('ORIENTACAO_PARA_O_PACIENTE'), '');

// 6. O QUE NAO PODE VAZAR
ok('NAO vaza observacoes internas do plano', !texto.includes(SEGREDO_OBS), '');
ok('NAO vaza a meta calorica', p2.plano?.metaKcal === undefined, '');
ok('NAO vaza patientId nem workspaceId', !texto.includes(patientId), '');
ok('mostra so o primeiro nome', !!p2.primeiroNome && !p2.primeiroNome.includes(' '),
   `primeiroNome=${p2.primeiroNome}`);

// 7. Registra refeicao pelo portal e comenta como profissional
const reg = await fetch(`${API}/publico/portal/${link.token}/refeicao`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ refeicao: 'almoco', descricao: '[TESTE] refeicao pelo portal' }),
});
const registro = await reg.json();
ok('registra refeicao pelo portal', reg.status === 201, `HTTP ${reg.status}`);

if (registro?.id) {
  await fetch(`${API}/food-diary/entries/${registro.id}/comentario`, {
    method: 'PATCH', headers: h, body: JSON.stringify({ comentario: SEGREDO_COMENT }),
  });
  const ab3 = await fetch(`${API}/publico/portal/${link.token}`);
  const t3 = await ab3.text();
  ok('NAO vaza o comentario da profissional', !t3.includes(SEGREDO_COMENT), '');
  ok('o registro do paciente aparece', t3.includes('refeicao pelo portal'), '');
}

// 8. Revogacao
const rv = await fetch(`${API}/patient-portal/links/${link.id}/revogar`, {
  method: 'PATCH', headers: h, body: '{}',
});
ok('revoga o acesso', rv.status === 200, `HTTP ${rv.status}`);
const dep = await fetch(`${API}/publico/portal/${link.token}`);
ok('link revogado deixa de abrir', dep.status === 404, `HTTP ${dep.status}`);

// Limpeza
for (const id of criados) await fetch(`${API}/meal-plans/${id}`, { method: 'DELETE', headers: h });
console.log(`\nlimpeza: ${criados.length} plano(s) desativado(s)`);
if (registro?.id) console.log(`registro de diario de teste: ${registro.id}`);
console.log(`${passos.filter(Boolean).length}/${passos.length} OK`);
process.exit(passos.every(Boolean) ? 0 : 1);
