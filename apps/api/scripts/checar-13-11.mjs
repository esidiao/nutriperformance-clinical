// Verifica telessaude (13) e fotos de evolucao (11) contra PRODUCAO.
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
const limpar = { consultas: [], fotos: [] };

console.log('── Lacuna 13: telessaude ──');
const daqui = (h_) => { const d = new Date(); d.setHours(d.getHours() + h_, 0, 0, 0); return d.toISOString(); };

// Consulta ONLINE daqui a 30 min (dentro da janela de 15 min? nao — janela abre 15 antes)
const cOnline = await fetch(`${API}/appointments`, {
  method: 'POST', headers: h,
  body: JSON.stringify({ patientId, inicio: daqui(48), duracaoMin: 60, tipo: 'online' }),
});
const online = await cOnline.json();
ok('cria consulta online', cOnline.status === 201, `HTTP ${cOnline.status}`);
if (!online?.id) { console.log(JSON.stringify(online).slice(0,200)); process.exit(1); }
limpar.consultas.push(online.id);

const sala = await fetch(`${API}/appointments/${online.id}/sala`, { method: 'PATCH', headers: h, body: '{}' });
const comSala = await sala.json();
ok('gera sala de video', sala.status === 200, `HTTP ${sala.status}`);
ok('link e https e aleatorio', /^https:\/\/meet\.jit\.si\/npc-[0-9a-f]{24}$/.test(comSala.linkVideo ?? ''),
   comSala.linkVideo ?? '');
ok('marca a origem como gerada', comSala.videoOrigem === 'gerado', `origem=${comSala.videoOrigem}`);

const proprio = await fetch(`${API}/appointments/${online.id}/sala`, {
  method: 'PATCH', headers: h, body: JSON.stringify({ link: 'https://meet.google.com/abc-defg-hij' }),
});
const comProprio = await proprio.json();
ok('aceita link proprio', comProprio.videoOrigem === 'proprio', `origem=${comProprio.videoOrigem}`);

const inseguro = await fetch(`${API}/appointments/${online.id}/sala`, {
  method: 'PATCH', headers: h, body: JSON.stringify({ link: 'http://inseguro.com/x' }),
});
ok('recusa link http', inseguro.status === 400, `HTTP ${inseguro.status}`);

// Consulta PRESENCIAL nao aceita sala
const cPres = await fetch(`${API}/appointments`, {
  method: 'POST', headers: h,
  body: JSON.stringify({ patientId, inicio: daqui(50), duracaoMin: 60, tipo: 'retorno' }),
});
const pres = await cPres.json();
if (pres?.id) {
  limpar.consultas.push(pres.id);
  const r = await fetch(`${API}/appointments/${pres.id}/sala`, { method: 'PATCH', headers: h, body: '{}' });
  ok('presencial NAO aceita sala', r.status === 400, `HTTP ${r.status}`);
}

// Portal: consulta daqui a 48h — link NAO deve aparecer
const cl = await fetch(`${API}/patient-portal/links`, { method: 'POST', headers: h, body: JSON.stringify({ patientId }) });
const linkPortal = await cl.json();
if (linkPortal?.token) {
  const p = await (await fetch(`${API}/publico/portal/${linkPortal.token}`)).json();
  const consultaOnline = (p.consultas ?? []).find((c) => c.tipo === 'online');
  ok('portal NAO entrega o link 48h antes', consultaOnline && consultaOnline.linkVideo === null,
     consultaOnline ? `linkVideo=${consultaOnline.linkVideo}` : 'consulta nao listada');
  ok('portal AVISA que havera sala', consultaOnline?.temSalaMarcada === true, '');
  await fetch(`${API}/patient-portal/links/${linkPortal.id}/revogar`, { method: 'PATCH', headers: h, body: '{}' });
}

console.log('\n── Lacuna 11: fotos de evolucao ──');
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');

const cf = await fetch(`${API}/progress-photos`, {
  method: 'POST', headers: h,
  body: JSON.stringify({ patientId, angulo: 'frente', mimeFoto: 'image/png' }),
});
const foto = await cf.json();
ok('cria registro de foto', cf.status === 201, `HTTP ${cf.status}`);
if (foto?.id) {
  limpar.fotos.push(foto.id);
  ok('devolve URL de envio', !!foto.envio?.url, '');
  const up = await fetch(foto.envio.url, { method: 'PUT', headers: { 'Content-Type': 'image/png' }, body: png });
  ok('envia direto ao Storage', up.ok, `HTTP ${up.status}`);

  const lista = await (await fetch(`${API}/progress-photos/patient/${patientId}`, { headers: h })).json();
  const grupo = lista.find((g) => g.angulo === 'frente');
  ok('aparece agrupada por angulo', !!grupo && grupo.fotos.length > 0, '');
  ok('vem com URL assinada', !!grupo?.fotos?.[0]?.fotoUrl, '');
  // A URL assinada CARREGA o caminho do objeto — foi assim no diario tambem.
  // O que importa e que o caminho nao contenha identificadores.
  const txt = JSON.stringify(lista);
  ok('URL nao expoe patientId nem workspaceId',
     !txt.includes(patientId) && !txt.includes(process.env.WS_ID ?? '@@nunca@@'), '');
  ok('resposta nao traz o campo fotoPath', !('fotoPath' in (grupo?.fotos?.[0] ?? {})), '');
}

const anguloRuim = await fetch(`${API}/progress-photos`, {
  method: 'POST', headers: h,
  body: JSON.stringify({ patientId, angulo: 'diagonal', mimeFoto: 'image/png' }),
});
ok('recusa angulo invalido', anguloRuim.status === 400, `HTTP ${anguloRuim.status}`);

// Limpeza
for (const id of limpar.fotos) await fetch(`${API}/progress-photos/${id}`, { method: 'DELETE', headers: h });
for (const id of limpar.consultas) {
  await fetch(`${API}/appointments/${id}/status`, { method: 'PATCH', headers: h, body: JSON.stringify({ status: 'cancelada', motivo: 'Teste automatizado' }) });
}
console.log(`\nlimpeza: ${limpar.fotos.length} foto(s) apagada(s), ${limpar.consultas.length} consulta(s) cancelada(s)`);
console.log(`${passos.filter(Boolean).length}/${passos.length} OK`);
process.exit(passos.every(Boolean) ? 0 : 1);
