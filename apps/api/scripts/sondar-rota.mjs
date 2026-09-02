/**
 * Bate numa unica rota autenticada de tempos em tempos, ate ela mudar de
 * status ou o tempo acabar.
 *
 *   node scripts/sondar-rota.mjs <email> /admin/audit-logs [tentativas]
 *
 * Serve para separar "ainda nao subiu o build" de "continua quebrado". Sondar
 * sem token nao resolve: a rota devolve 401 antes de tocar no handler, e o 401
 * parece melhora quando nao e nada.
 */
import { createClient } from '../../web/node_modules/@supabase/supabase-js/dist/index.mjs';
import { readFileSync } from 'node:fs';

function carregarEnv(c) {
  try {
    for (const l of readFileSync(c, 'utf8').split(/\r?\n/)) {
      const m = l.match(/^([A-Z0-9_]+)=(.*)$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
    }
  } catch {}
}
carregarEnv(new URL('../.env', import.meta.url));
carregarEnv(new URL('../../web/.env.local', import.meta.url));
process.env.SUPABASE_ANON_KEY ||= process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const API = 'https://nutriperformance-clinical.onrender.com';
const [email, rotaArg, tentativasArg] = process.argv.slice(2);
const tentativas = Number(tentativasArg ?? 20);

// O Git Bash no Windows converte argumento iniciado por '/' em caminho Windows:
// '/admin/audit-logs' chega como 'C:/Program Files/Git/admin/audit-logs' e a
// URL sai como 'https://...onrender.comC:/...'. Em vez de tentar desfazer isso
// por regex — que erra na primeira rota com nome inesperado —, recuso a entrada
// e digo como passar.
if (/^[A-Za-z]:[\\/]/.test(rotaArg ?? '')) {
  console.error(
    `A rota chegou como caminho do Windows: ${rotaArg}\n`
    + 'O Git Bash reescreveu a barra inicial. Passe a rota SEM ela:\n'
    + '  node scripts/sondar-rota.mjs <email> admin/audit-logs',
  );
  process.exit(1);
}
const rota = '/' + String(rotaArg ?? '').replace(/^\/+/, '');

const admin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } });
const { data: ml } = await admin.auth.admin.generateLink({ type: 'magiclink', email });
const anon = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY,
  { auth: { persistSession: false } });
const { data: s } = await anon.auth.verifyOtp({ type: 'magiclink', token_hash: ml.properties.hashed_token });
const h = { Authorization: `Bearer ${s.session.access_token}` };

let anterior = null;
for (let i = 1; i <= tentativas; i++) {
  const r = await fetch(API + rota, { headers: h });
  const corpo = (await r.text()).slice(0, 200);
  if (r.status !== anterior) {
    console.log(`[${new Date().toLocaleTimeString('pt-BR')}] tentativa ${i}: HTTP ${r.status}`);
    if (r.status >= 400) console.log(`   ${corpo}`);
    if (anterior !== null && r.status < 500) { console.log('mudou de estado — parando'); break; }
    anterior = r.status;
  }
  if (i < tentativas) await new Promise((ok) => setTimeout(ok, 20000));
}
