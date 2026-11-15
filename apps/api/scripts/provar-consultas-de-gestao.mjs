/**
 * Executa, contra um banco REAL e so para LER, as sete consultas do painel de
 * indicadores de gestao.
 *
 *   node scripts/provar-consultas-de-gestao.mjs [workspace_id]
 *
 * Sem argumento nenhum ele usa as credenciais de `apps/api/.env` (DB_HOST,
 * DB_USER, DB_PASS, DB_NAME, DB_PORT) — as mesmas que a API usa. `PGURL`, se
 * estiver no ambiente, tem preferencia.
 *
 * A primeira versao exigia `PGURL` e so. Isso virou defeito na pratica: a
 * instrucao de uso trazia um texto de exemplo entre `<...>`, foi colado
 * literalmente, e o erro saiu como `getaddrinfo ENOTFOUND base` — host `base`,
 * de "connection string do banco". Comando que exige preencher a mao e comando
 * que vai ser preenchido errado.
 *
 * ============================== POR QUE EXISTE ==============================
 *
 * `ManagementService` usa SQL cru, e os 35 testes de `management.service.spec`
 * mockam `DataSource.query`. Isso prova o FORMATO e a aritmetica — que
 * denominador zero vira `null` e nao `0`, que cancelada nao entra na taxa de
 * falta, que um bloco com erro nao contamina os outros.
 *
 * Nao prova UMA coisa: que o SQL roda. Nome de tabela errado, `percentile_cont
 * ... FILTER` com sintaxe invalida, `make_interval(days => $2::int)` recusado
 * pela versao do Postgres — nada disso aparece com a consulta mockada. Passaria
 * pela suite inteira e estouraria na primeira abertura da tela.
 *
 * ========================= POR QUE NAO COPIA O SQL =========================
 *
 * Este script NAO tem uma copia das consultas: ele LE
 * `src/modules/management/management.service.ts` e extrai os literais passados
 * para `this.db.query(...)`.
 *
 * Copia divergiria. O script ficaria verde testando o SQL de ontem enquanto o
 * servico roda o de hoje — e um script de prova que testa outra coisa e pior
 * que script nenhum, porque da confianca.
 *
 * ================================ SEGURANCA ================================
 *
 * Somente leitura, e a trava e dupla: `SET default_transaction_read_only = on`
 * na sessao, e uma recusa de rodar qualquer consulta extraida que nao comece
 * com SELECT ou WITH. Nao imprime dado de paciente — as consultas devolvem
 * contagem, soma e mediana. Nao imprime a senha nem a string de conexao: so o
 * host e o banco, para voce conferir CONTRA QUAL banco a prova rodou.
 */
import pg from 'pg';
import { readFileSync, writeFileSync } from 'node:fs';

// ── Relatorio em arquivo ────────────────────────────────────────────────────
// O script grava a propria saida. Antes eu dependia de `*>` do PowerShell e de
// apagar o arquivo antes para saber se o que lia era novo; isso falhou tres
// vezes seguidas (redirecionamento sem arquivo, arquivo apagado por mim, saida
// em UTF-16 com a pilha do PowerShell no meio). Caminho fixo, UTF-8, e a data
// no topo dizendo quando rodou — assim nao preciso apagar para confiar.
const RELATORIO = new URL('./ultima-prova.txt', import.meta.url);
const linhas = [`# prova das consultas de gestao — ${new Date().toISOString()}`];
const log = (...a) => {
  const t = a.join(' ');
  linhas.push(t);
  console.log(t);
};
const erro = (...a) => {
  const t = a.join(' ');
  linhas.push(t);
  console.error(t);
};
function gravar() {
  try {
    writeFileSync(RELATORIO, linhas.join('\n') + '\n', 'utf8');
    console.log(`\nrelatorio: ${new URL(RELATORIO).pathname.slice(1)}`);
  } catch (e) {
    console.error(`nao consegui gravar o relatorio: ${e.message}`);
  }
}
process.on('exit', gravar);

// ── Conexao ─────────────────────────────────────────────────────────────────
/** Le um .env simples: `CHAVE=valor`, com ou sem aspas, ignorando comentario. */
function lerEnv(caminho) {
  const fora = {};
  let texto;
  try {
    texto = readFileSync(caminho, 'utf8');
  } catch {
    return fora;
  }
  for (const linha of texto.split('\n')) {
    const corte = linha.indexOf('=');
    if (corte === -1) continue;
    const chave = linha.slice(0, corte).trim();
    if (!chave || chave.startsWith('#')) continue;
    let valor = linha.slice(corte + 1).trim();
    const q = valor[0];
    if ((q === '"' || q === "'") && valor.endsWith(q)) valor = valor.slice(1, -1);
    fora[chave] = valor;
  }
  return fora;
}

function conexao() {
  if (process.env.PGURL) {
    // PGURL tem preferencia, mas so se for uma URL de verdade. Sem esta
    // conferencia, um PGURL velho e invalido — que sobrevive na janela do
    // terminal depois de um comando errado — vence em silencio o `.env` que
    // funciona, e o erro sai como host inexistente. Aconteceu: o host virou
    // `base`, de um texto de exemplo colado inteiro.
    let host = '';
    try {
      host = new URL(process.env.PGURL).hostname;
    } catch {
      /* nao e URL */
    }
    if (!host) {
      erro('PGURL esta definida mas nao e uma URL de conexao valida.');
      erro('  Limpe com:  Remove-Item Env:PGURL');
      erro('  Depois rode de novo: sem PGURL ele usa o apps/api/.env.');
      process.exit(2);
    }
    return { url: process.env.PGURL, origem: 'PGURL' };
  }

  // Variavel de ambiente sobrepoe o arquivo: permite apontar para outro banco
  // sem editar o `.env`, e deixa a montagem da URL testavel com valor falso.
  const arquivo = lerEnv(new URL('../.env', import.meta.url));
  const env = {};
  const doAmbiente = [];
  for (const k of ['DB_HOST', 'DB_USER', 'DB_PASS', 'DB_NAME', 'DB_PORT']) {
    if (process.env[k]) {
      env[k] = process.env[k];
      doAmbiente.push(k);
    } else {
      env[k] = arquivo[k];
    }
  }
  const faltando = ['DB_HOST', 'DB_USER', 'DB_PASS', 'DB_NAME'].filter((k) => !env[k]);
  if (faltando.length) {
    erro(
      `nao achei a conexao: defina PGURL, ou apps/api/.env com ${faltando.join(', ')}`,
    );
    process.exit(2);
  }
  // encodeURIComponent na senha: `@`, `:` e `/` numa senha quebram a URL em
  // silencio e o erro sai como host inexistente, nao como senha invalida.
  const u = encodeURIComponent(env.DB_USER);
  const p = encodeURIComponent(env.DB_PASS);
  const porta = env.DB_PORT || '5432';
  return {
    url: `postgresql://${u}:${p}@${env.DB_HOST}:${porta}/${env.DB_NAME}`,
    origem: doAmbiente.length
      ? `apps/api/.env, com ${doAmbiente.join(', ')} vindo do ambiente`
      : 'apps/api/.env',
    host: env.DB_HOST,
    banco: env.DB_NAME,
  };
}

const conn = conexao();

const WS = process.argv[2] || '00000000-0000-0000-0000-000000000001';
const DIAS = 90;

// ── Extrai as consultas do servico ──────────────────────────────────────────
const fonte = readFileSync(
  new URL('../src/modules/management/management.service.ts', import.meta.url),
  'utf8',
);

const consultas = [];
const marca = 'this.db.query(';
let i = 0;
while ((i = fonte.indexOf(marca, i)) !== -1) {
  const abre = fonte.indexOf('`', i);
  if (abre === -1) break;
  const fecha = fonte.indexOf('`', abre + 1);
  if (fecha === -1) break;
  const sql = fonte.slice(abre + 1, fecha);
  // Nome do metodo que contem esta consulta, para o relatorio.
  const antes = fonte.slice(0, i);
  const m = [...antes.matchAll(/private async ([a-zA-Z]+)\(/g)].pop();
  consultas.push({ nome: m ? m[1] : `consulta ${consultas.length + 1}`, sql });
  i = fecha + 1;
}

if (consultas.length === 0) {
  erro('nenhuma consulta extraida — o padrao `this.db.query(` mudou no servico?');
  process.exit(1);
}

// SSL ligado fixo quebrava contra Postgres local ("The server does not support
// SSL connections"). Supabase exige TLS; um banco local normalmente nao fala
// TLS nenhum. Entao a decisao sai do host, nao de um palpite.
const hostDaConexao = (() => {
  if (conn.host) return conn.host;
  try {
    return new URL(conn.url).hostname;
  } catch {
    return '';
  }
})();
const ehLocal = ['localhost', '127.0.0.1', '::1', ''].includes(hostDaConexao);

const c = new pg.Client({
  connectionString: conn.url,
  // rejectUnauthorized: false apenas porque o Supabase serve certificado de
  // cadeia propria; nao e para desligar verificacao de um host qualquer.
  ssl: ehLocal ? false : { rejectUnauthorized: false },
  statement_timeout: 30000,
});

let falhas = 0;
let semSchema = 0;

// Qual banco vai ser provado. Isto sai ANTES de conectar, de proposito: se a
// conexao falhar, a mensagem mais util e justamente contra que host ele tentou.
// Host e banco apenas — nunca usuario nem senha.
let onde = conn.host && conn.banco ? `${conn.host}/${conn.banco}` : '(nao identificado)';
if (!conn.host) {
  try {
    const u = new URL(conn.url);
    onde = `${u.hostname}${u.pathname}`;
  } catch {
    /* string de conexao em formato libpq; segue sem identificar */
  }
}
log(`banco: ${onde}  (origem da conexao: ${conn.origem}, TLS: ${ehLocal ? 'nao' : 'sim'})`);
if (ehLocal) {
  log(
    'ATENCAO: banco LOCAL. Isto prova a SINTAXE do SQL contra este Postgres,\n' +
      '         nao prova que o schema de producao e igual a este.',
  );
}
log(`consultas extraidas do servico: ${consultas.length}`);
log(`workspace: ${WS}`);
log(`janela: ${DIAS} dias\n`);

try {
  await c.connect();
} catch (e) {
  // Pilha crua aqui nao ajuda ninguem: o que importa e o host e o motivo.
  erro(`nao conectei em ${onde}: ${e.message}`);
  if (e.code === 'ENOTFOUND') {
    erro('  host nao existe — confira DB_HOST no apps/api/.env, ou PGURL se estiver definida');
  }
  process.exit(2);
}

try {
  await c.query('SET default_transaction_read_only = on');

  for (const { nome, sql } of consultas) {
    // Trava 2: nada que nao seja leitura roda, mesmo que alguem edite o
    // servico e coloque um UPDATE ali.
    // `slice(0, 6)` aqui era defeito: de `WITH base` sai `WITH B`, que nao e
    // igual a `WITH`, e as duas consultas com CTE seriam recusadas — a trava
    // reprovando pelo motivo errado.
    const inicio = sql.trim().toUpperCase();
    if (!inicio.startsWith('SELECT') && !inicio.startsWith('WITH ')) {
      log(`--- ${nome}: RECUSADO, nao comeca com SELECT/WITH`);
      falhas++;
      continue;
    }

    // Quantos parametros a consulta usa; todos de data valem DIAS.
    const maior = Math.max(0, ...[...sql.matchAll(/\$(\d+)/g)].map((m) => Number(m[1])));
    const params = [WS, ...Array.from({ length: Math.max(0, maior - 1) }, () => DIAS)];

    const t = Date.now();
    try {
      const r = await c.query(sql, params);
      log(`--- ${nome}: OK (${Date.now() - t} ms, ${r.rowCount} linha(s), ${params.length} parametro(s))`);
      log(JSON.stringify(r.rows, null, 1));

      // Um aviso util, nao uma falha: consulta que devolve so zeros e nulos
      // roda certo e nao prova nada sobre o calculo.
      const vazia =
        r.rowCount === 1 &&
        Object.values(r.rows[0]).every((v) => v === null || v === 0 || v === '0');
      if (vazia) log('    (atencao: tudo zero/nulo — o SQL roda, mas este workspace nao exercita o calculo)');
    } catch (e) {
      // 42P01 = relation does not exist. Isso nao reprova o SQL: reprova o
      // banco escolhido, que nao tem o schema. Somar junto faria a saida dizer
      // "7 de 7 falharam" num banco vazio, e eu leria como SQL quebrado.
      if (e.code === '42P01') {
        semSchema++;
        log(`--- ${nome}: SEM SCHEMA NESTE BANCO (nao reprova o SQL)`);
        log(`    ${e.message}`);
      } else {
        falhas++;
        log(`--- ${nome}: FALHOU`);
        log(`    ${e.message}`);
        if (e.position) log(`    posicao ${e.position} do SQL`);
      }
    }
    log('');
  }

  // Volume por tabela, para saber se o workspace escolhido e representativo.
  // Em try proprio: num banco com schema parcial esta consulta estoura por
  // tabela ausente, e sem a protecao ela matava o processo ANTES do resumo —
  // o relatorio terminava sem dizer quantas consultas falharam. Informacao
  // acessoria nao pode derrubar a conclusao.
  try {
    await volume();
  } catch (e) {
    log(`volume por tabela: nao deu para medir (${e.message})`);
  }
} finally {
  await c.end();
}

async function volume() {
  const { rows } = await c.query(
    `SELECT (SELECT count(*)::int FROM patients WHERE workspace_id = $1) AS pacientes,
            (SELECT count(*)::int FROM appointments WHERE workspace_id = $1) AS consultas,
            (SELECT count(*)::int FROM meal_plans WHERE workspace_id = $1) AS planos,
            (SELECT count(*)::int FROM charges WHERE workspace_id = $1) AS cobrancas,
            (SELECT count(*)::int FROM patient_goals WHERE workspace_id = $1) AS metas,
            (SELECT count(*)::int FROM food_diary_entries WHERE workspace_id = $1) AS registros_diario,
            (SELECT count(*)::int FROM clinical_alerts WHERE workspace_id = $1) AS alertas`,
    [WS],
  );
  log('volume neste workspace:');
  log(JSON.stringify(rows[0], null, 1));
}

log(`\nconsultas com falha: ${falhas} de ${consultas.length}`);
if (semSchema) {
  log(
    `${semSchema} consulta(s) nao rodaram porque ESTE banco nao tem as tabelas.\n` +
      'Isso nao prova nem reprova o SQL: escolha um banco com o schema aplicado.',
  );
}
// Banco sem schema nenhum nao prova nada, e sair 0 ali seria um verde falso.
if (semSchema === consultas.length) process.exit(3);
process.exit(falhas ? 1 : 0);
