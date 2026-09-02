// Testa a extracao de laudo em PDF contra PRODUCAO com um laudo real.
// Compara valor por valor contra o que esta escrito no PDF.
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

const pdf = readFileSync(process.argv[3]).toString('base64');
console.log(`PDF: ${(pdf.length / 1024).toFixed(0)} KB em base64\n`);

const r = await fetch(`${API}/laboratory/extrair-pdf`, {
  method: 'POST', headers: h, body: JSON.stringify({ pdfBase64: pdf }),
});
if (!r.ok) { console.log(`HTTP ${r.status} :: ${(await r.text()).slice(0, 300)}`); process.exit(1); }
const rascunho = await r.json();

// O que ESTA escrito no laudo de teste
const esperado = {
  hemoglobinGDl: 11.2, hematocritPct: 34.5, mcvFl: 78.4,
  leukocytesUl: 7500, plateletsUl: 245000,
  fastingGlucoseMgDl: 98, hba1cPct: 5.4,
  totalCholesterolMgDl: 212, hdlMgDl: 48, ldlMgDl: 138, triglyceridesMgDl: 132,
  creatinineMgDl: 0.82, altUL: 22,
  ferritinNgMl: 12.4, vitaminDNgMl: 21.7, vitaminB12PgMl: 310, zincUgDl: 74,
  tshUuiMl: 4.5, freeT4NgDl: 0.95,
};

const obtido = Object.fromEntries(rascunho.valores.map((v) => [v.campo, v.valor]));
let certos = 0, errados = 0, faltando = 0;

for (const [campo, esp] of Object.entries(esperado)) {
  const got = obtido[campo];
  if (got === undefined) { console.log(`FALTOU ${campo.padEnd(26)} esperado ${esp}`); faltando++; }
  else if (Math.abs(got - esp) < 0.001) { certos++; }
  else { console.log(`ERRADO ${campo.padEnd(26)} esperado ${esp}, veio ${got}`); errados++; }
}

const extras = Object.keys(obtido).filter((c) => !(c in esperado));
for (const c of extras) console.log(`EXTRA  ${c.padEnd(26)} veio ${obtido[c]} (nao estava no laudo)`);

console.log(`\n${certos}/${Object.keys(esperado).length} corretos | ${errados} errados | ${faltando} faltando | ${extras.length} extras`);
console.log(`data de coleta: ${rascunho.collectionDate} (esperado 2026-03-15)`);
console.log(`laboratorio: ${rascunho.laboratoryName}`);
console.log(`suspeitos: ${rascunho.valores.filter((v) => v.suspeito).length}`);
console.log(`nao mapeados: ${rascunho.naoMapeados.map((n) => n.nome).join(', ') || '(nenhum)'}`);
if (rascunho.avisos.length) console.log(`avisos: ${rascunho.avisos.join(' | ')}`);
const comTrecho = rascunho.valores.filter((v) => v.trecho && v.trecho.length > 5).length;
console.log(`com trecho literal: ${comTrecho}/${rascunho.valores.length}`);
