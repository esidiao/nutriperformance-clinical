// Chama uma rota de IA que usa SO TEXTO. Se funcionar, a chave do Gemini esta
// boa e o problema e especifico do PDF.
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

const ce = await fetch(`${API}/laboratory`, {
  method: 'POST', headers: h,
  body: JSON.stringify({ patientId, collectionDate: '2026-03-15', hemoglobinGDl: 11.2, ferritinNgMl: 12.4 }),
});
const exame = await ce.json();
console.log(`cria exame -> HTTP ${ce.status}`);
if (!exame?.id) { console.log(JSON.stringify(exame).slice(0, 250)); process.exit(1); }

const an = await fetch(`${API}/laboratory/${exame.id}/analyze`, {
  method: 'POST', headers: h, body: JSON.stringify({}),
});
const corpo = await an.text();
console.log(`analise por IA (so texto) -> HTTP ${an.status}`);
console.log(corpo.slice(0, 400));
console.log(`\nexame de teste: ${exame.id}`);
