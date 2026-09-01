// Leitura autenticada de /charges. So GET: nao escreve nada.
// Endpoint registrado nao prova tabela criada — sem a tabela o TypeORM
// devolve 500, nao 401.
import { createClient } from '../../web/node_modules/@supabase/supabase-js/dist/index.mjs';
import { readFileSync } from 'node:fs';

function carregarEnv(caminho) {
  for (const linha of readFileSync(caminho, 'utf8').split(/\r?\n/)) {
    const m = linha.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}
carregarEnv(new URL('../.env', import.meta.url));
try {
  carregarEnv(new URL('../../web/.env.local', import.meta.url));
  process.env.SUPABASE_ANON_KEY ||= process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
} catch {}

const API = 'https://nutriperformance-clinical.onrender.com';
const email = process.argv[2];
const admin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } });
const { data: link } = await admin.auth.admin.generateLink({ type: 'magiclink', email });
const anon = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY,
  { auth: { persistSession: false } });
const { data: s } = await anon.auth.verifyOtp({
  type: 'magiclink', token_hash: link.properties.hashed_token,
});
const h = { Authorization: `Bearer ${s.session.access_token}` };

for (const rota of ['/charges', '/charges/resumo', '/appointments', '/patients']) {
  const r = await fetch(API + rota, { headers: h });
  const corpo = await r.text();
  console.log(`${rota} -> HTTP ${r.status} :: ${corpo.slice(0, 220)}`);
}
