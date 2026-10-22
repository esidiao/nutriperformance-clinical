import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * O `.dockerignore` não pode excluir o que o Dockerfile copia.
 *
 * POR QUE UM TESTE, E NÃO SÓ UM COMENTÁRIO
 *
 * Errar aqui dá um erro de build obscuro — "package.json not found" dentro do
 * `pnpm install`, por exemplo — e só aparece no deploy, porque nada local lê
 * este arquivo. É a mesma categoria do `CMD` que apontava para um caminho que
 * o build não gerava mais: verificação que só o ambiente remoto faria.
 *
 * As duas pontas são cobradas: o que o Dockerfile PRECISA tem de entrar, e o
 * que não deve entrar (segredo, node_modules, dist, apps/web) tem de ficar
 * fora. Guarda que só confere um lado passaria com `.dockerignore` vazio.
 */

const RAIZ = join(__dirname, '..', '..', '..', '..');

/**
 * Semântica do Docker: regras em ORDEM, a ÚLTIMA que casa decide, `!` nega.
 * `**` cobre qualquer profundidade, `*` não atravessa `/`. Diretório excluído
 * leva o conteúdo junto — por isso o caminho é testado contra os próprios pais.
 */
function paraRegex(padrao: string): RegExp {
  let saida = '';
  let i = 0;
  while (i < padrao.length) {
    if (padrao.startsWith('**/', i)) { saida += '(?:.*\\/)?'; i += 3; }
    else if (padrao.startsWith('**', i)) { saida += '.*'; i += 2; }
    else if (padrao[i] === '*') { saida += '[^/]*'; i += 1; }
    else if (padrao[i] === '?') { saida += '[^/]'; i += 1; }
    else { saida += padrao[i].replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); i += 1; }
  }
  return new RegExp(`^${saida}$`);
}

function carregarRegras(): Array<{ negar: boolean; rx: RegExp }> {
  const texto = readFileSync(join(RAIZ, '.dockerignore'), 'utf8');
  return texto.split('\n')
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'))
    .map((l) => {
      const negar = l.startsWith('!');
      const padrao = (negar ? l.slice(1) : l).replace(/\/$/, '');
      return { negar, rx: paraRegex(padrao) };
    });
}

function ignorado(caminho: string, regras: ReturnType<typeof carregarRegras>): boolean {
  const partes = caminho.split('/');
  const alvos = partes.map((_, n) => partes.slice(0, n + 1).join('/'));
  let decisao = false;
  for (const { negar, rx } of regras) {
    if (alvos.some((a) => rx.test(a))) decisao = !negar;
  }
  return decisao;
}

/** Caminhos que o Dockerfile copia. Mudou o Dockerfile? Mude esta lista. */
const PRECISA = [
  'package.json',
  'pnpm-workspace.yaml',
  'pnpm-lock.yaml',
  'apps/api/package.json',
  // O `pnpm install --filter` precisa dele para resolver o workspace.
  'apps/web/package.json',
  'apps/api/tsconfig.json',
  'apps/api/tsconfig.build.json',
  'apps/api/nest-cli.json',
  'apps/api/src/main.ts',
  'apps/api/src/app.module.ts',
  // `scripts/` compila junto: o tsconfig da API não tem `include`.
  'apps/api/scripts/conferir-plurais-das-medidas.ts',
];

const NAO_DEVE = [
  'node_modules/react/index.js',
  'apps/api/node_modules/x/y.js',
  'apps/api/dist/src/main.js',
  // Segredo numa camada de imagem: service-role key e ENCRYPTION_KEY.
  'apps/api/.env',
  'apps/web/.env.local',
  // A imagem da API não compila nada de apps/web (conferido com --listFiles).
  'apps/web/lib/gasto-energetico.ts',
  '.git/config',
];

describe('.dockerignore', () => {
  const regras = carregarRegras();

  it.each(PRECISA)('deixa entrar o que o Dockerfile copia: %s', (caminho) => {
    expect(ignorado(caminho, regras)).toBe(false);
  });

  it.each(NAO_DEVE)('mantém fora da imagem: %s', (caminho) => {
    expect(ignorado(caminho, regras)).toBe(true);
  });

  it('os specs FICAM no contexto, de propósito', () => {
    // Excluí-los armaria a ratoeira: um `RUN pnpm test` futuro não acharia
    // arquivo nenhum e passaria com "0 tests" — falso verde, o defeito que
    // mais vezes nos pegou aqui.
    expect(ignorado('apps/api/src/common/dockerignore.spec.ts', regras)).toBe(false);
  });

  it('o Dockerfile não copia nada além do que esta guarda conhece', () => {
    // Se alguém acrescentar um COPY, a lista PRECISA tem de crescer com ele —
    // senão a guarda passa a cobrir menos do que diz cobrir.
    const docker = readFileSync(join(RAIZ, 'apps', 'api', 'Dockerfile'), 'utf8');
    const copiados = [...docker.matchAll(/^COPY (?!--from)(.+?) \.\//gm)]
      .flatMap((m) => m[1].trim().split(/\s+/));
    expect(copiados.sort()).toEqual([
      'apps/api',
      'apps/api/package.json',
      'apps/api/package.json',
      'apps/web/package.json',
      'apps/web/package.json',
      'package.json',
      'package.json',
      'pnpm-lock.yaml',
      'pnpm-lock.yaml',
      'pnpm-workspace.yaml',
      'pnpm-workspace.yaml',
    ]);
  });
});
