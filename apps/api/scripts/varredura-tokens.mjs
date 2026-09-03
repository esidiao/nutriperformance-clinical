/**
 * Compara as operacoes de token do CODIGO com a tabela `token_costs` de
 * PRODUCAO.
 *
 * Existe porque a divergencia entre os dois nao aparece em teste nenhum: os
 * testes mockam o repositorio de precos, e o TokenBalanceGuard faz
 * `if (!cost) return true` — ou seja, operacao sem preco nao da erro, ela
 * PULA a conferencia de saldo e deixa a chamada paga ao Gemini acontecer.
 * Cinco operacoes ficaram assim por meses.
 *
 *   node scripts/varredura-tokens.mjs
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const AQUI = dirname(fileURLToPath(import.meta.url));
function carregarEnv(c) {
  for (const l of readFileSync(c, 'utf8').split(/\r?\n/)) {
    const m = l.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}
carregarEnv(join(AQUI, '..', '.env'));

function arquivos(dir) {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) return arquivos(p);
    return n.endsWith('.ts') && !n.includes('.spec.') ? [p] : [];
  });
}

const declaradas = new Set();   // @RequiresTokens -> o guard confere saldo
const cobradas = new Map();     // consume({ operation }) -> debita de fato
const comCustoFixo = new Set(); // consume({ cost }) -> ignora o preco da tabela

for (const arq of arquivos(join(AQUI, '..', 'src'))) {
  const src = readFileSync(arq, 'utf8');
  const curto = arq.split(/src[\\/]/)[1];

  // Ignora linha de comentario: o docstring do TokenBalanceGuard traz
  // `@RequiresTokens('nome_operacao')` como exemplo, e a varredura acusava
  // esse nome ficticio como operacao sem preco.
  for (const linha of src.split(/\r?\n/)) {
    if (/^\s*(\*|\/\/)/.test(linha)) continue;
    const m = linha.match(/@RequiresTokens\('([^']+)'\)/);
    if (m) declaradas.add(m[1]);
  }

  // Bloco de consume({...}) com chaves balanceadas — interpolacao `${x}` tem
  // uma `}` no meio e cortaria um regex ingenuo cedo demais.
  const marca = 'tokenService.consume({';
  let i = src.indexOf(marca);
  while (i !== -1) {
    // Pula `${...}` inteiro. Contar so a abertura como "nao e chave" ainda
    // deixava a chave de FECHAMENTO zerar a profundidade, e o bloco de
    // `operation: `${kind}_audio_intake`` era cortado antes do nome — as duas
    // operacoes de audio sumiam da varredura sem nenhum aviso.
    let prof = 1, j = i + marca.length;
    while (j < src.length && prof > 0) {
      if (src[j] === '$' && src[j + 1] === '{') {
        let d = 1; j += 2;
        while (j < src.length && d > 0) {
          if (src[j] === '{') d++;
          else if (src[j] === '}') d--;
          j++;
        }
        continue;
      }
      if (src[j] === '{') prof++;
      else if (src[j] === '}') prof--;
      j++;
    }
    const bloco = src.slice(i + marca.length, j - 1);
    const op = bloco.match(/operation:\s*[`']([^`']+)[`']/);
    if (op) {
      // `${kind}_audio_intake` vira as duas variantes concretas.
      const nomes = op[1].includes('${kind}')
        ? ['nutritional', 'physical'].map((k) => op[1].replace('${kind}', k))
        : [op[1]];
      for (const nome of nomes) {
        if (['consumption', 'admin_adjustment'].includes(nome)) continue;
        cobradas.set(nome, curto);
        if (/\bcost:/.test(bloco)) comCustoFixo.add(nome);
      }
    }
    i = src.indexOf(marca, j);
  }
}

const h = { apikey: process.env.SUPABASE_SERVICE_ROLE_KEY,
            Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}` };
const r = await fetch(`${process.env.SUPABASE_URL}/rest/v1/token_costs?select=operation,tokens_cost`, { headers: h });
const linhas = await r.json();
const precos = new Map(linhas.map((l) => [l.operation, l.tokens_cost]));

console.log(`token_costs em producao: ${precos.size} operacoes\n`);
console.log('operacao                          preco  guard  cobra  custo fixo');
const todas = [...new Set([...precos.keys(), ...declaradas, ...cobradas.keys()])].sort();
for (const op of todas) {
  console.log(
    `${op.padEnd(33)} ${String(precos.get(op) ?? '—').padStart(5)}`
    + `${(declaradas.has(op) ? '    sim' : '     — ')}`
    + `${(cobradas.has(op) ? '    sim' : '     — ')}`
    + `${(comCustoFixo.has(op) ? '     SIM' : '      — ')}`,
  );
}

const problemas = [];
for (const op of declaradas) {
  if (!precos.has(op)) {
    problemas.push(`${op}: tem @RequiresTokens e NAO tem preco — o guard libera sem conferir saldo`);
  }
}
for (const op of cobradas.keys()) {
  if (!precos.has(op)) problemas.push(`${op}: e cobrada e nao tem preco — nao aparece na lista publica`);
}
for (const op of comCustoFixo) {
  problemas.push(`${op}: passa \`cost\` fixo — o preco do painel de admin e ignorado`);
}
for (const op of precos.keys()) {
  if (!cobradas.has(op) && !declaradas.has(op)) {
    problemas.push(`${op}: tem preco e nenhum caminho do codigo a usa — preco fantasma na lista`);
  }
}

console.log(problemas.length ? `\n=== ${problemas.length} PROBLEMA(S) ===` : '\ncodigo e tabela de precos batem');
for (const p of problemas) console.log(`  ${p}`);
