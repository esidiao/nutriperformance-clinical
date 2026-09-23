/**
 * Fotografa o estado das credenciais ANTES e DEPOIS de uma rotacao — sem
 * imprimir nenhuma delas.
 *
 *   node scripts/estado-das-chaves.mjs
 *
 * Mostra impressao digital (sha256 curto) de cada chave, para comparar duas
 * execucoes e PROVAR que trocou. Mostra tambem se o projeto publica chaves
 * assimetricas no JWKS, porque isso muda o roteiro da rotacao:
 *
 *  - Com JWKS ativo, a API valida token pela chave publica. Girar a chave de
 *    assinatura nao exige mexer em env var da API.
 *  - Sem JWKS, a validacao cai no HS256 com SUPABASE_JWT_SECRET, e ai girar o
 *    segredo SEM atualizar a API derruba todo mundo na hora.
 */
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

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

const digital = (s) => createHash('sha256').update(s).digest('hex').slice(0, 12);

console.log(`projeto: ${process.env.SUPABASE_URL}\n`);
console.log('credencial                        impressao digital  observacao');

for (const nome of [
  'SUPABASE_SERVICE_ROLE_KEY',
  'SUPABASE_ANON_KEY',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'SUPABASE_JWT_SECRET',
  'DB_PASS',
]) {
  const v = process.env[nome];
  if (!v) { console.log(`${nome.padEnd(33)} ${'—'.padEnd(18)} ausente no ambiente local`); continue; }
  let obs = '';
  if (nome === 'DB_PASS') {
    obs = process.env.DB_HOST === 'localhost'
      ? 'banco LOCAL — nao e a senha de producao'
      : `banco ${process.env.DB_HOST}`;
  }
  console.log(`${nome.padEnd(33)} ${digital(v).padEnd(18)} ${obs}`);
}

// A chave de servico funciona? Um 200 aqui prova que ela e valida agora.
const r = await fetch(`${process.env.SUPABASE_URL}/rest/v1/workspaces?select=id&limit=1`, {
  headers: {
    apikey: process.env.SUPABASE_SERVICE_ROLE_KEY,
    Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
  },
});
console.log(`\nservice_role responde: HTTP ${r.status} ${r.ok ? '(valida)' : '(INVALIDA)'}`);

const j = await fetch(`${process.env.SUPABASE_URL}/auth/v1/.well-known/jwks.json`);
if (!j.ok) {
  console.log(`JWKS: HTTP ${j.status} — sem chaves assimetricas publicadas`);
} else {
  const { keys = [] } = await j.json();
  console.log(`JWKS: ${keys.length} chave(s) publicada(s)`);
  for (const k of keys) console.log(`  alg=${k.alg} kid=${String(k.kid).slice(0, 8)}…`);
  console.log(keys.length
    ? '  => a API valida pela chave publica; girar a assinatura nao exige env nova'
    : '  => validacao cai no HS256 com SUPABASE_JWT_SECRET; girar o segredo SEM'
      + ' atualizar a API derruba todo mundo');
}
