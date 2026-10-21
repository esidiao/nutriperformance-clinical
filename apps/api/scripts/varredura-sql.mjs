/**
 * Confere as colunas citadas em SQL CRU contra o schema de producao.
 *
 * POR QUE EXISTE
 *
 * `varredura-schema.mjs` compara ENTIDADES com o banco. SQL escrito a mao nao
 * passa por entidade nenhuma, entao fica fora dela. Em 09/2026 a varredura de
 * rotas achou 8 rotas devolvendo 500 por esse motivo:
 *
 *   scientific-base pedia `total_references` e `high_evidence_count`, que nunca
 *   existiram, e `publication_year` / `evidence_level` / `conclusions` no lugar
 *   de `year` / `evidence_type` / `summary`.
 *
 *   admin pedia `patients.deleted_at` (a coluna e `is_active`) e
 *   `workspaces.monthly_price_brl`, que nao existe.
 *
 * Nenhum teste pegava: todos mockam o repositorio, e o mock aceita qualquer
 * nome de coluna. So o Postgres reclama, e so quando a rota e chamada.
 *
 * O QUE ELE VERIFICA
 *
 * Apenas referencias QUALIFICADAS (`alias.coluna`), resolvendo o alias pelo
 * `FROM`/`JOIN`. E a forma mais precisa: foi exatamente assim que os 8 defeitos
 * apareceram, e nao gera falso positivo com funcao, literal ou palavra-chave.
 *
 * Nao e um parser de SQL. Nao tenta cobrir subconsulta com alias proprio nem
 * CTE — nesses casos o alias nao resolve e ele DIZ que nao resolveu, em vez de
 * fingir que conferiu.
 *
 *   node scripts/varredura-sql.mjs
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

// ── schema de producao ──────────────────────────────────────────────────────
const r = await fetch(`${process.env.SUPABASE_URL}/rest/v1/`, {
  headers: {
    apikey: process.env.SUPABASE_SERVICE_ROLE_KEY,
    Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
  },
});
if (!r.ok) {
  console.error(`Nao consegui ler o schema: HTTP ${r.status}`);
  process.exit(1);
}
const spec = await r.json();
const COLUNAS = new Map(
  Object.entries(spec.definitions ?? {}).map(([t, d]) => [t, new Set(Object.keys(d.properties ?? {}))]),
);
console.log(`schema de producao: ${COLUNAS.size} tabelas\n`);

// ── fontes ──────────────────────────────────────────────────────────────────
function arquivos(dir) {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) return arquivos(p);
    return n.endsWith('.ts') && !n.includes('.spec.') ? [p] : [];
  });
}

/**
 * Blocos de SQL passados a `.query(`, nas TRES formas de string.
 *
 * A primeira versao so lia crase. Parecia funcionar — 41 referencias
 * conferidas, nenhum problema — e estava cega para 8 chamadas em aspas
 * (curation.service.ts, health.controller.ts e outras). Descobri injetando uma
 * coluna falsa de proposito: a varredura passou. Guarda que nao e falsificada
 * nao vale nada.
 */
function blocosSql(fonte) {
  const out = [];
  const marca = /\.query\(\s*(`|'|")/g;
  let m;
  while ((m = marca.exec(fonte)) !== null) {
    const aspa = m[1];
    const ini = m.index + m[0].length;
    // Fecha na proxima aspa do mesmo tipo que nao esteja escapada.
    let fim = ini;
    for (;;) {
      fim = fonte.indexOf(aspa, fim);
      if (fim === -1) break;
      if (fonte[fim - 1] !== '\\') break;
      fim++;
    }
    if (fim === -1) break;
    out.push(fonte.slice(ini, fim));
    marca.lastIndex = fim;
  }
  return out;
}

/** alias -> tabela, a partir de FROM/JOIN. */
function aliases(sql) {
  const mapa = new Map();
  const re = /\b(?:FROM|JOIN)\s+([a-z_][a-z0-9_]*)\s+(?:AS\s+)?([a-z_][a-z0-9_]*)?/gi;
  let m;
  while ((m = re.exec(sql)) !== null) {
    const tabela = m[1].toLowerCase();
    const apelido = (m[2] ?? '').toLowerCase();
    // Palavra que na verdade e clausula seguinte, nao alias.
    const RESERVADAS = new Set(['on', 'where', 'group', 'order', 'left', 'right',
                                'inner', 'outer', 'join', 'limit', 'having', 'using', 'set']);
    if (apelido && !RESERVADAS.has(apelido)) mapa.set(apelido, tabela);
    mapa.set(tabela, tabela); // referencia pelo proprio nome
  }
  return mapa;
}

// ── autoteste ───────────────────────────────────────────────────────────────
//
// Roda o parser contra o SQL REAL que quebrou em 09/2026. Sem isto, a
// varredura "passa" tanto quando esta funcionando quanto quando parou de
// enxergar — ja aconteceu neste projeto com a guarda de entidades.
if (process.argv.includes('--autoteste')) {
  const CASOS = [
    {
      nome: 'admin: patients.deleted_at (a coluna e is_active)',
      sql: 'SELECT COUNT(*) FROM patients p WHERE p.deleted_at IS NULL',
      esperaProblema: true,
    },
    {
      nome: 'admin: workspaces.monthly_price_brl (nao existe)',
      sql: 'SELECT SUM(w.monthly_price_brl) AS mrr FROM workspaces w',
      esperaProblema: true,
    },
    {
      nome: 'audit-logs: JOIN valido',
      sql: 'SELECT l.user_id FROM audit_logs l LEFT JOIN users u ON u.auth_id = l.user_id::text',
      esperaProblema: false,
    },
    {
      nome: 'scientific-base: r.publication_year (a coluna e year)',
      sql: 'SELECT r.publication_year FROM scientific_references r',
      esperaProblema: true,
    },
  ];

  let falhas = 0;
  for (const caso of CASOS) {
    const mapa = aliases(caso.sql);
    let achou = false;
    for (const ref of caso.sql.matchAll(/\b([a-z_][a-z0-9_]*)\.([a-z_][a-z0-9_]*)\b/gi)) {
      const tabela = mapa.get(ref[1].toLowerCase());
      const cols = tabela ? COLUNAS.get(tabela) : null;
      if (cols && !cols.has(ref[2].toLowerCase())) achou = true;
    }
    const ok = achou === caso.esperaProblema;
    if (!ok) falhas++;
    console.log(`${ok ? 'OK   ' : 'FALHA'} ${caso.nome} -> ${achou ? 'acusou' : 'nao acusou'}`);
  }
  console.log(falhas ? `\n${falhas} FALHA(S) no autoteste` : '\nautoteste: o parser enxerga os 4 casos reais');
  process.exit(falhas ? 1 : 0);
}

const problemas = [];
const naoResolvidos = [];
let conferidas = 0;
let blocos = 0;

for (const arq of arquivos(join(AQUI, '..', 'src'))) {
  const fonte = readFileSync(arq, 'utf8');
  const curto = arq.split(/src[\\/]/)[1];

  for (const sql of blocosSql(fonte)) {
    blocos++;
    const mapa = aliases(sql);
    if (mapa.size === 0) continue;

    // `alias.coluna`, ignorando `alias.*`.
    for (const ref of sql.matchAll(/\b([a-z_][a-z0-9_]*)\.([a-z_][a-z0-9_]*)\b/gi)) {
      const apelido = ref[1].toLowerCase();
      const coluna = ref[2].toLowerCase();
      const tabela = mapa.get(apelido);

      if (!tabela) {
        // Pode ser subconsulta, CTE ou um `objeto.propriedade` de JS que
        // vazou para dentro do template. Nao acuso o que nao entendi.
        naoResolvidos.push(`${curto}: ${apelido}.${coluna}`);
        continue;
      }

      const cols = COLUNAS.get(tabela);
      if (!cols) {
        naoResolvidos.push(`${curto}: tabela "${tabela}" nao esta no schema lido`);
        continue;
      }

      conferidas++;
      if (!cols.has(coluna)) {
        problemas.push(`${curto}: ${tabela}.${coluna} NAO EXISTE (alias "${apelido}")`);
      }
    }
  }
}

console.log(`${blocos} bloco(s) de SQL cru · ${conferidas} referencia(s) qualificada(s) conferida(s)`);

if (naoResolvidos.length) {
  const unicos = [...new Set(naoResolvidos)];
  console.log(`\n${unicos.length} referencia(s) que NAO consegui resolver (subconsulta, CTE ou alias fora do FROM):`);
  for (const n of unicos.slice(0, 15)) console.log(`  ${n}`);
  if (unicos.length > 15) console.log(`  ... e mais ${unicos.length - 15}`);
  console.log('  => nao sao erros; sao o que esta varredura nao cobre.');
}

if (problemas.length) {
  console.log(`\n=== ${problemas.length} COLUNA(S) INEXISTENTE(S) ===`);
  for (const p of problemas) console.log(`  ${p}`);
  // `exitCode` e nao `exit()`: com um fetch recem-fechado, o `exit()` abrupto
  // dispara uma asserção do libuv no Windows e o processo morre com codigo
  // errado — o orquestrador lia isso como falha de varredura que passou.
  process.exitCode = 1;
} else {
  console.log('\ntodas as colunas citadas em SQL cru existem no banco');
}
