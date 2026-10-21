/**
 * Suite de regressao contra PRODUCAO.
 *
 *   node scripts/regressao.mjs <email> <patientId>
 *
 * POR QUE EXISTE, e por que nao e "mais um teste"
 *
 * Este projeto tem 800+ testes unitarios verdes. NENHUM dos defeitos serios
 * encontrados em 09-10/2026 foi pego por eles:
 *
 *   laboratory_exams com schema divergente  — modulo nunca funcionou
 *   8 rotas em 500 por coluna inexistente   — SQL cru, mock aceita qualquer nome
 *   JOIN uuid = text em /admin/audit-logs   — so o Postgres reclama
 *   INSERT de auditoria falhando calado     — fire-and-forget engolia o erro
 *   5 telas nunca ligadas ao backend        — codigo que ninguem chamava
 *   preco anunciado e removido do banco     — constante na tela
 *
 * O padrao: teste unitario mocka o repositorio, o provedor de IA e a
 * configuracao. Ele prova que a FUNCAO faz o que diz. Nao prova que a coluna
 * existe, que a rota responde, que a credencial vale ou que alguem chama o
 * codigo. Para isso e preciso exercitar producao — e e o que esta suite faz.
 *
 * Cada varredura existe por causa de um defeito que chegou ao ar.
 */
import { spawn } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const AQUI = dirname(fileURLToPath(import.meta.url));
const [email, patientId] = process.argv.slice(2);

const API = 'https://nutriperformance-clinical.onrender.com';

const VARREDURAS = [
  {
    nome: 'schema',
    script: 'varredura-schema.mjs',
    args: [],
    porque: 'entidade pedindo coluna que nao existe derruba TODA consulta a tabela',
  },
  {
    nome: 'sql cru',
    script: 'varredura-sql.mjs',
    args: [],
    porque: 'SQL escrito a mao nao passa por entidade e escapa da varredura de schema',
  },
  {
    nome: 'tokens',
    script: 'varredura-tokens.mjs',
    args: [],
    porque: 'operacao sem preco PULA a conferencia de saldo e libera chamada paga',
  },
  {
    nome: 'rotas',
    script: 'varredura-rotas.mjs',
    args: () => [email, patientId],
    precisaCredencial: true,
    porque: 'schema correto nao garante rota viva; o 500 so aparece na primeira consulta',
  },
];

function rodar(script, args) {
  return new Promise((resolve) => {
    const p = spawn(process.execPath, [join(AQUI, script), ...args], {
      cwd: join(AQUI, '..'),
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let saida = '';
    p.stdout.on('data', (d) => { saida += d; });
    p.stderr.on('data', (d) => { saida += d; });
    p.on('close', (code) => resolve({ code, saida }));
  });
}

/** Acorda a instancia. O plano gratuito hiberna e a primeira varredura pagaria o cold start. */
async function acordar() {
  process.stdout.write('acordando a API');
  for (let i = 0; i < 12; i++) {
    try {
      const corpo = await (await fetch(`${API}/health`, { signal: AbortSignal.timeout(60_000) })).text();
      if (corpo.includes('"database":"connected"')) {
        const commit = corpo.match(/"commit":"([^"]*)"/)?.[1] ?? '?';
        console.log(` ok (commit ${commit})\n`);
        return commit;
      }
    } catch {}
    process.stdout.write('.');
    await new Promise((r) => setTimeout(r, 15_000));
  }
  console.log('\nA API nao respondeu com database:connected.');
  console.log('Supabase pausado? O host para de resolver em DNS quando pausa.');
  process.exit(2);
}

const commit = await acordar();

const semCredencial = !email || !patientId;
if (semCredencial) {
  console.log('Sem <email> e <patientId>: as varreduras que precisam de token serao PULADAS.');
  console.log('Uso completo: node scripts/regressao.mjs <email> <patientId>\n');
}

const resultados = [];
for (const v of VARREDURAS) {
  if (v.precisaCredencial && semCredencial) {
    resultados.push({ ...v, status: 'pulada' });
    console.log(`PULADA  ${v.nome}`);
    continue;
  }
  const args = typeof v.args === 'function' ? v.args() : v.args;
  const { code, saida } = await rodar(v.script, args);
  // CODIGO DE SAIDA, nao texto. A primeira versao farejava a saida por
  // "DIVERGENCIA|ERRO DE SERVIDOR" e acusava as duas varreduras que tinham
  // passado: "nenhuma divergencia" contem "divergencia", e "nenhuma rota
  // devolveu erro de servidor" contem "erro de servidor". Uma suite de
  // regressao que grita falso e pior que nenhuma — some no ruido.
  const ok = code === 0;
  resultados.push({ ...v, status: ok ? 'ok' : 'falhou', saida });
  console.log(`${ok ? 'OK    ' : 'FALHOU'}  ${v.nome}`);
  if (!ok) {
    // So o fim importa: o veredito das varreduras fica nas ultimas linhas.
    console.log(saida.split('\n').slice(-25).map((l) => `        ${l}`).join('\n'));
  }
}

const falharam = resultados.filter((r) => r.status === 'falhou');
const puladas = resultados.filter((r) => r.status === 'pulada');

console.log(`\n${'='.repeat(60)}`);
console.log(`commit em producao: ${commit}`);
console.log(`${resultados.length - falharam.length - puladas.length} ok · ${falharam.length} falhou · ${puladas.length} pulada`);

if (falharam.length) {
  console.log('\nO QUE CADA FALHA SIGNIFICA:');
  for (const f of falharam) console.log(`  ${f.nome}: ${f.porque}`);
  process.exit(1);
}

if (puladas.length) {
  console.log('\nAtencao: varredura pulada nao e varredura passada.');
  process.exit(0);
}

console.log('\nnenhuma regressao detectada em producao');
