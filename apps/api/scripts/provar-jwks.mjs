/**
 * Prova que um token REAL de producao e verificavel SO pelo JWKS, sem o
 * fallback HS256 do SUPABASE_JWT_SECRET.
 *
 *   node scripts/provar-jwks.mjs <email>
 *
 * Existe porque "o JWKS esta publicado" nao e o mesmo que "os tokens emitidos
 * hoje sao verificaveis por ele". Remover uma variavel de autenticacao com
 * base na primeira afirmacao e apostar; com base na segunda, e conclusao.
 *
 * Nao imprime token nem segredo.
 */
import { createClient } from '../../web/node_modules/@supabase/supabase-js/dist/index.mjs';
import { createRemoteJWKSet, jwtVerify } from '../node_modules/jose/dist/node/cjs/index.js';
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

const email = process.argv[2];
if (!email) { console.error('uso: node scripts/provar-jwks.mjs <email>'); process.exit(1); }

const admin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } });
const { data: ml } = await admin.auth.admin.generateLink({ type: 'magiclink', email });
const anon = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY,
  { auth: { persistSession: false } });
const { data: s } = await anon.auth.verifyOtp({ type: 'magiclink', token_hash: ml.properties.hashed_token });

const token = s.session.access_token;
const cabecalho = JSON.parse(Buffer.from(token.split('.')[0], 'base64url').toString('utf8'));

console.log(`token emitido agora para ${email}`);
console.log(`  alg ... ${cabecalho.alg}`);
console.log(`  kid ... ${String(cabecalho.kid ?? '—').slice(0, 8)}…`);

if (cabecalho.alg === 'HS256') {
  console.log('\n>> Os tokens de hoje ainda sao HS256. Remover SUPABASE_JWT_SECRET');
  console.log('   DERRUBARIA a autenticacao. NAO remover.');
  process.exit(1);
}

const JWKS = createRemoteJWKSet(new URL(`${process.env.SUPABASE_URL}/auth/v1/.well-known/jwks.json`));
try {
  const { payload } = await jwtVerify(token, JWKS, { audience: 'authenticated' });
  console.log('\nverificacao SO por JWKS: OK');
  console.log(`  sub ............ ${payload.sub}`);
  console.log(`  role (claim) ... ${payload.role ?? '—'}`);
  console.log(`  app_metadata ... role=${payload.app_metadata?.role ?? '—'} ws=${String(payload.app_metadata?.workspace_id ?? '—').slice(0, 8)}…`);
  console.log('\n>> O caminho JWKS sozinho valida o token de producao.');
  console.log('   Remover SUPABASE_JWT_SECRET fecha o segundo caminho sem quebrar nada.');
} catch (e) {
  console.log(`\nverificacao SO por JWKS: FALHOU — ${e.message}`);
  console.log('>> NAO remover SUPABASE_JWT_SECRET enquanto isto falhar.');
  process.exit(1);
}
