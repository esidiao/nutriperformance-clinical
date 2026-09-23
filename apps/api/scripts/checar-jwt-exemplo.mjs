/**
 * Diz se os JWT que estao nos arquivos .env.example RASTREADOS pelo git sao
 * chaves reais deste projeto — sem imprimir nenhuma chave.
 *
 * Mostra so o que esta no payload (role, ref, validade) e se o valor confere
 * com o que o ambiente usa hoje. Arquivo de exemplo deve conter placeholder;
 * se contiver chave viva, e vazamento no repositorio, nao "documentacao".
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

// Impressao digital: permite comparar valores sem revelar nenhum deles.
const digital = (s) => createHash('sha256').update(s).digest('hex').slice(0, 12);

const vivos = new Map();
for (const nome of ['SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_ANON_KEY', 'NEXT_PUBLIC_SUPABASE_ANON_KEY']) {
  if (process.env[nome]) vivos.set(digital(process.env[nome]), nome);
}

const ARQUIVOS = [
  new URL('../.env.example', import.meta.url),
  new URL('../../web/.env.example', import.meta.url),
];

for (const arq of ARQUIVOS) {
  const caminho = decodeURIComponent(arq.pathname).replace(/^\//, '');
  console.log(`\n== ${caminho} ==`);
  let texto;
  try { texto = readFileSync(arq, 'utf8'); } catch { console.log('  (nao encontrado)'); continue; }

  const achados = texto.match(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g) ?? [];
  if (!achados.length) { console.log('  nenhum JWT'); continue; }

  for (const jwt of achados) {
    let payload;
    try {
      payload = JSON.parse(Buffer.from(jwt.split('.')[1], 'base64url').toString('utf8'));
    } catch { console.log('  JWT ilegivel — provavelmente placeholder truncado'); continue; }

    const exp = payload.exp ? new Date(payload.exp * 1000) : null;
    console.log(`  role .......... ${payload.role ?? '—'}`);
    console.log(`  projeto (ref) . ${payload.ref ?? '—'}`);
    console.log(`  expira ........ ${exp ? exp.toISOString().slice(0, 10) : '—'}${exp && exp < new Date() ? ' (VENCIDA)' : ''}`);

    const refAtual = (process.env.SUPABASE_URL ?? '').match(/https:\/\/([a-z]+)\./)?.[1];
    const mesmoProjeto = payload.ref && payload.ref === refAtual;
    const igualAoVivo = vivos.get(digital(jwt));

    if (igualAoVivo) {
      console.log(`  >> E EXATAMENTE a ${igualAoVivo} em uso. Vazamento no repositorio.`);
    } else if (mesmoProjeto) {
      console.log('  >> Mesmo projeto, mas valor diferente do atual: chave antiga deste banco.');
    } else {
      console.log('  >> Outro projeto (ou fictícia) — nao e credencial viva daqui.');
    }
  }
}
