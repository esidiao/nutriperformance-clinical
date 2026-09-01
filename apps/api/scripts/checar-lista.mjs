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
const { data: link } = await admin.auth.admin.generateLink({
  type: 'magiclink', email: process.argv[2],
});
const anon = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY,
  { auth: { persistSession: false } });
const { data: s } = await anon.auth.verifyOtp({
  type: 'magiclink', token_hash: link.properties.hashed_token,
});
const h = { Authorization: `Bearer ${s.session.access_token}` };

const fake = '00000000-0000-0000-0000-000000000000';
const rf = await fetch(`${API}/meal-plans/${fake}/lista-compras?dias=7`, { headers: h });
console.log(`rota (plano inexistente) -> HTTP ${rf.status} :: ${(await rf.text()).slice(0, 160)}`);
const rd = await fetch(`${API}/meal-plans/${fake}/lista-compras?dias=999`, { headers: h });
console.log(`dias=999 -> HTTP ${rd.status} :: ${(await rd.text()).slice(0, 160)}`);

const planos = await (await fetch(`${API}/meal-plans/patient/${process.argv[3] ?? ''}`, { headers: h })).json().catch(() => null);
console.log('planos do paciente:', Array.isArray(planos) ? planos.length : JSON.stringify(planos).slice(0, 120));
const plano = Array.isArray(planos) ? planos[0] : null;
if (!plano) { console.log('sem plano para testar'); process.exit(0); }
const r = await fetch(`${API}/meal-plans/${plano.id}/lista-compras?dias=7`, { headers: h });
console.log(`lista-compras -> HTTP ${r.status}`);
console.log(JSON.stringify(await r.json(), null, 1).slice(0, 900));
