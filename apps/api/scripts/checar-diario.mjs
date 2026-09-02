// Verifica a superficie publica do diario contra producao, incluindo o
// caminho completo da foto: assinatura de envio, upload real e leitura.
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

const cr = await fetch(`${API}/food-diary/links`, { method: 'POST', headers: h, body: JSON.stringify({ patientId }) });
const link = await cr.json();
ok('cria link do diario', cr.status === 201 || cr.status === 200, `HTTP ${cr.status}`);
if (!link?.token) { console.log(JSON.stringify(link).slice(0, 200)); process.exit(1); }
ok('resposta nao expoe o hash', !link.tokenHash, '');

const ab = await fetch(`${API}/publico/diario/${link.token}`);
const pub = await ab.json();
ok('abre o diario sem login', ab.status === 200, `HTTP ${ab.status}`);
ok('nao vaza identificadores', !JSON.stringify(pub).includes(patientId), '');

// PNG 1x1 real
const png = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64');

const reg = await fetch(`${API}/publico/diario/${link.token}`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ refeicao: 'almoco', descricao: '[TESTE] verificacao de deploy', mimeFoto: 'image/png' }),
});
const criado = await reg.json();
ok('registra refeicao com foto', reg.status === 201 || reg.status === 200, `HTTP ${reg.status}`);
ok('devolve URL assinada de envio', !!criado?.envio?.url, criado?.envio ? `expira em ${criado.envio.expiraEmS}s` : JSON.stringify(criado).slice(0,120));

if (criado?.envio?.url) {
  const up = await fetch(criado.envio.url, { method: 'PUT', headers: { 'Content-Type': 'image/png' }, body: png });
  ok('envia a foto direto ao Storage', up.ok, `HTTP ${up.status}`);
}

const ab2 = await fetch(`${API}/publico/diario/${link.token}`);
const pub2 = await ab2.json();
const r0 = pub2.registros?.[0];
ok('registro aparece no diario', !!r0, '');
ok('foto vem com URL assinada', !!r0?.fotoUrl, r0?.fotoUrl ? 'assinada' : 'sem url');
// A URL assinada CARREGA o caminho do objeto — e por isso o caminho nao pode
// conter os identificadores. Foi assim que descobri o vazamento: o caminho
// antigo era diario/{workspaceId}/{patientId}/{id}.
const texto2 = JSON.stringify(pub2);
ok('URL da foto nao expoe workspaceId nem patientId',
   !texto2.includes(patientId) && !texto2.includes(link.workspaceId), '');
ok('resposta nao traz o campo fotoPath', !('fotoPath' in (r0 ?? {})), '');

if (r0?.fotoUrl) {
  const img = await fetch(r0.fotoUrl);
  ok('a foto baixa pela URL assinada', img.ok, `HTTP ${img.status}`);
  const semAssinatura = await fetch(r0.fotoUrl.split('?')[0]);
  ok('bucket privado: sem assinatura nao baixa', !semAssinatura.ok, `HTTP ${semAssinatura.status}`);
}

const cm = await fetch(`${API}/food-diary/entries/${criado.id}/comentario`, {
  method: 'PATCH', headers: h, body: JSON.stringify({ comentario: '[TESTE] anotacao clinica' }),
});
ok('profissional comenta o registro', cm.status === 200, `HTTP ${cm.status}`);

const ab3 = await fetch(`${API}/publico/diario/${link.token}`);
ok('comentario NAO vaza para o paciente',
   !(await ab3.text()).includes('anotacao clinica'), '');

const rv = await fetch(`${API}/food-diary/links/${link.id}/revogar`, { method: 'PATCH', headers: h, body: '{}' });
ok('revoga o link de teste', rv.status === 200, `HTTP ${rv.status}`);
const dep = await fetch(`${API}/publico/diario/${link.token}`);
ok('link revogado deixa de abrir', dep.status === 404, `HTTP ${dep.status}`);

console.log(`\n${passos.filter(Boolean).length}/${passos.length} OK`);
console.log(`registro de teste criado: ${criado?.id} (apagar depois se quiser)`);
