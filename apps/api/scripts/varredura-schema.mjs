/**
 * Compara TODAS as entidades do codigo com o schema real em producao.
 *
 * Foi exatamente esta divergencia que manteve o modulo de exames quebrado sem
 * ninguem saber: a tabela tinha um schema antigo, a entidade esperava outro, e
 * todo POST devolvia 500. Zero linhas, entao nenhuma reclamacao.
 *
 * Le a entidade com casamento de parenteses, e nao regex simples: o gerador de
 * migracao que usei antes pulou em silencio as colunas cujo `default: '{}'`
 * quebrava o padrao.
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

const snake = (s) => s.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);

function arquivos(dir) {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) return arquivos(p);
    return n.endsWith('.entity.ts') ? [p] : [];
  });
}

function lerEntidade(caminho) {
  const src = readFileSync(caminho, 'utf8');
  const tabela = (src.match(/@Entity\(\s*'([^']+)'/) || [])[1];
  if (!tabela) return null;

  const colunas = new Set();
  const re = /@(Column|PrimaryGeneratedColumn|CreateDateColumn|UpdateDateColumn|PrimaryColumn)\s*\(/g;
  let m;
  while ((m = re.exec(src))) {
    let i = re.lastIndex, nivel = 1;
    while (i < src.length && nivel > 0) {
      if (src[i] === '(') nivel++;
      else if (src[i] === ')') nivel--;
      i++;
    }
    const bloco = src.slice(re.lastIndex, i - 1);
    const nome = (bloco.match(/name:\s*'([^']+)'/) || [])[1];
    if (nome) { colunas.add(nome); continue; }
    const prop = (src.slice(i, i + 200).match(/^\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*[?!]?\s*:/) || [])[1];
    if (prop) colunas.add(snake(prop));
  }
  return { tabela, colunas: [...colunas], arquivo: caminho.split(/modules[\/]/)[1] ?? caminho };
}

const entidades = arquivos(join(AQUI, '..', 'src', 'modules')).map(lerEntidade).filter(Boolean);

const K = process.env.SUPABASE_SERVICE_ROLE_KEY;
const spec = await (await fetch(`${process.env.SUPABASE_URL}/rest/v1/`, {
  headers: { apikey: K, Authorization: `Bearer ${K}` },
})).json();

let problemas = 0;
console.log(`Entidades encontradas: ${entidades.length}\n`);

for (const e of entidades.sort((a, b) => a.tabela.localeCompare(b.tabela))) {
  const def = spec.definitions?.[e.tabela];
  if (!def) {
    console.log(`AUSENTE  ${e.tabela.padEnd(30)} tabela nao existe  (${e.arquivo})`);
    problemas++;
    continue;
  }
  const noBanco = new Set(Object.keys(def.properties ?? {}));
  const faltando = e.colunas.filter((c) => !noBanco.has(c));
  if (faltando.length) {
    console.log(`DIVERGE  ${e.tabela.padEnd(30)} ${faltando.length} coluna(s) sem par no banco`);
    console.log(`         ${faltando.join(', ')}`);
    console.log(`         (${e.arquivo})`);
    problemas++;
  } else {
    console.log(`OK       ${e.tabela.padEnd(30)} ${e.colunas.length} colunas conferem`);
  }
}
console.log(`\n${problemas ? problemas + ' tabela(s) com problema' : 'nenhuma divergencia'}`);
