// Verifica os modelos de plano contra PRODUCAO, incluindo o que mais importa:
// que o texto livre de um paciente nao viaja para o plano de outro.
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
const criados = { planos: [], modelos: [] };

// Plano de origem, com texto que fala de UMA pessoa
const SEGREDO = 'RELATA AZIA APOS O JANTAR';
const cp = await fetch(`${API}/meal-plans`, {
  method: 'POST', headers: h,
  body: JSON.stringify({
    patientId, nome: '[TESTE] plano origem', metaKcal: 1800,
    observacoes: SEGREDO, orientacoesGerais: 'EVITAR POR CAUSA DA MEDICACAO DELA',
  }),
});
const plano = await cp.json();
ok('cria plano de origem', cp.status === 201 || cp.status === 200, `HTTP ${cp.status}`);
if (!plano?.id) { console.log(JSON.stringify(plano).slice(0, 250)); process.exit(1); }
criados.planos.push(plano.id);

const ci = await fetch(`${API}/meal-plans/${plano.id}/items`, {
  method: 'POST', headers: h,
  body: JSON.stringify({
    refeicao: 'almoco', alimentoNome: 'Arroz', quantidadeG: 100,
    medidaCaseira: 'colher', observacao: 'ELA NAO TOLERA BEM',
  }),
});
ok('adiciona item ao plano', ci.status === 201 || ci.status === 200, `HTTP ${ci.status}`);

// Salva como modelo
const cm = await fetch(`${API}/meal-plans/${plano.id}/salvar-como-modelo`, {
  method: 'POST', headers: h, body: JSON.stringify({ nome: '[TESTE] modelo' }),
});
const modelo = await cm.json();
ok('salva como modelo', cm.status === 201 || cm.status === 200, `HTTP ${cm.status}`);
if (!modelo?.id) { console.log(JSON.stringify(modelo).slice(0, 250)); process.exit(1); }
criados.modelos.push(modelo.id);

ok('modelo nao guarda o paciente', modelo.patientId === null || modelo.patientId === undefined,
   `patientId=${modelo.patientId}`);
ok('modelo e marcado como template', modelo.isTemplate === true, '');

// Le o modelo completo
const lm = await (await fetch(`${API}/meal-plans/${modelo.id}`, { headers: h })).json();
const textoModelo = JSON.stringify(lm);
ok('modelo NAO contem a observacao do paciente', !textoModelo.includes(SEGREDO), '');
ok('modelo NAO contem a orientacao do paciente', !textoModelo.includes('MEDICACAO DELA'), '');
ok('modelo NAO contem a observacao do item', !textoModelo.includes('NAO TOLERA BEM'), '');
ok('modelo MANTEM a estrutura', textoModelo.includes('Arroz') && textoModelo.includes('colher'), '');

// Aparece na listagem
const lista = await (await fetch(`${API}/meal-plans/modelos`, { headers: h })).json();
ok('modelo aparece na listagem', Array.isArray(lista) && lista.some((m) => m.id === modelo.id),
   Array.isArray(lista) ? `${lista.length} modelo(s)` : JSON.stringify(lista).slice(0,120));

// Aplica a um paciente
const ap = await fetch(`${API}/meal-plans/modelos/${modelo.id}/aplicar`, {
  method: 'POST', headers: h, body: JSON.stringify({ patientId, nome: '[TESTE] gerado do modelo' }),
});
const gerado = await ap.json();
ok('aplica o modelo a um paciente', ap.status === 201 || ap.status === 200, `HTTP ${ap.status}`);
if (gerado?.id) {
  criados.planos.push(gerado.id);
  ok('plano gerado nasce rascunho', gerado.isDraft === true, `isDraft=${gerado.isDraft}`);
  ok('plano gerado tem paciente', gerado.patientId === patientId, '');
  const lg = await (await fetch(`${API}/meal-plans/${gerado.id}`, { headers: h })).json();
  const textoGerado = JSON.stringify(lg);
  ok('plano gerado NAO herdou texto do outro paciente',
     !textoGerado.includes(SEGREDO) && !textoGerado.includes('NAO TOLERA BEM'), '');
  ok('plano gerado herdou a estrutura', textoGerado.includes('Arroz'), '');
}

// Recusa transformar modelo em modelo
const dobro = await fetch(`${API}/meal-plans/${modelo.id}/salvar-como-modelo`, {
  method: 'POST', headers: h, body: '{}',
});
ok('recusa transformar modelo em modelo', dobro.status === 400, `HTTP ${dobro.status}`);

// Limpeza
for (const id of [...criados.planos, ...criados.modelos]) {
  await fetch(`${API}/meal-plans/${id}`, { method: 'DELETE', headers: h });
}
console.log(`\nlimpeza: ${criados.planos.length + criados.modelos.length} registros de teste desativados`);
console.log(`${passos.filter(Boolean).length}/${passos.length} OK`);
process.exit(passos.every(Boolean) ? 0 : 1);
