/**
 * Exercita TODAS as rotas GET com token valido e procura erro 500.
 *
 * Schema correto nao garante rota funcionando: o EntityMetadataNotFoundError
 * do modulo de charges tinha schema perfeito e a rota respondia 401 sem token
 * — o erro so aparecia na primeira consulta autenticada.
 *
 * 500 = bug. 404/400 com id inventado = comportamento esperado.
 */
import { createClient } from '../../web/node_modules/@supabase/supabase-js/dist/index.mjs';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const AQUI = dirname(fileURLToPath(import.meta.url));
function carregarEnv(c) {
  try {
    for (const l of readFileSync(c, 'utf8').split(/\r?\n/)) {
      const m = l.match(/^([A-Z0-9_]+)=(.*)$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
    }
  } catch {}
}
carregarEnv(join(AQUI, '..', '.env'));
carregarEnv(join(AQUI, '..', '..', 'web', '.env.local'));
process.env.SUPABASE_ANON_KEY ||= process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const API = 'https://nutriperformance-clinical.onrender.com';
const admin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } });
const { data: ml } = await admin.auth.admin.generateLink({ type: 'magiclink', email: process.argv[2] });
const anon = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY, { auth: { persistSession: false } });
const { data: s } = await anon.auth.verifyOtp({ type: 'magiclink', token_hash: ml.properties.hashed_token });
const h = { Authorization: `Bearer ${s.session.access_token}` };

const PACIENTE = process.argv[3];
const FALSO = '00000000-0000-0000-0000-000000000000';

function arquivos(dir) {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) return arquivos(p);
    return n.endsWith('.controller.ts') && !n.includes('spec') ? [p] : [];
  });
}

// Extrai o prefixo do @Controller e cada @Get do arquivo.
const rotas = [];
for (const arq of arquivos(join(AQUI, '..', 'src'))) {
  const src = readFileSync(arq, 'utf8');
  for (const bloco of src.split('@Controller(')) {
    const prefixo = (bloco.match(/^\s*'([^']*)'/) || [])[1];
    if (prefixo === undefined) continue;
    for (const m of bloco.matchAll(/@Get\(\s*(?:'([^']*)')?\s*\)/g)) {
      const sub = m[1] ?? '';
      // A barra inicial precisa vir depois do filter: `filter(Boolean)` come a
      // string vazia e a URL sai sem '/', virando "https://dominiohealth".
      const caminho = '/' + [prefixo, sub].filter(Boolean).join('/').replace(/\/+/g, '/');
      rotas.push({ caminho, arquivo: arq.split(/src[\/]/)[1] });
    }
  }
}

const vistos = new Set();
const resultados = [];

for (const r of rotas) {
  // Substitui parametros por ids reais quando da, ou por um UUID inexistente.
  const url = r.caminho
    .replace(/:patientId/g, PACIENTE)
    .replace(/:token/g, 'x'.repeat(43))
    .replace(/:[a-zA-Z]+/g, FALSO);
  if (vistos.has(url)) continue;
  vistos.add(url);

  let status = 0, corpo = '';
  try {
    const resp = await fetch(API + url, { headers: h });
    status = resp.status;
    corpo = (await resp.text()).slice(0, 120);
  } catch (e) { status = -1; corpo = String(e.message); }

  resultados.push({ url, status, corpo, arquivo: r.arquivo });
}

const quebradas = resultados.filter((x) => x.status >= 500 || x.status === -1);
const ok = resultados.filter((x) => x.status < 500 && x.status !== -1);

console.log(`${resultados.length} rotas GET exercitadas com token valido\n`);
for (const x of ok.sort((a, b) => a.url.localeCompare(b.url))) {
  console.log(`  ${String(x.status).padEnd(4)} ${x.url}`);
}
if (quebradas.length) {
  console.log(`\n=== ${quebradas.length} ROTA(S) COM ERRO DE SERVIDOR ===`);
  for (const x of quebradas) {
    console.log(`  ${x.status}  ${x.url}`);
    console.log(`        ${x.corpo}`);
    console.log(`        ${x.arquivo}`);
  }
} else {
  console.log('\nnenhuma rota devolveu erro de servidor');
}
