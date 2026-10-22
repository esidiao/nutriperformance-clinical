import { readFileSync, readdirSync, statSync } from 'fs';
import { join, relative } from 'path';

/**
 * Código de PRODUÇÃO da API não importa de `apps/web`.
 *
 * O QUE ESTE TESTE IMPEDE DE REPETIR
 *
 * Em 22/10/2026 eu tirei uma duplicação importando `apps/web/lib/medida-caseira`
 * de dentro de `medida-aproximada.ts`. Tudo passou aqui: `tsc --noEmit` limpo,
 * 1062 testes verdes. O deploy do Render quebrou de duas maneiras ao mesmo
 * tempo:
 *
 *   1. `apps/api/Dockerfile` faz `COPY apps/api ./apps/api` — `apps/web/lib`
 *      nunca existe na imagem, então o import não resolve e o build falha.
 *   2. Mesmo resolvendo, o `tsc` passou a incluir um arquivo FORA de
 *      `apps/api` e re-enraizou a saída: `dist/api/src/main.js` em vez de
 *      `dist/src/main.js`, que é o caminho do `CMD`. O contêiner subiria
 *      apontando para um arquivo que não existe.
 *
 * O segundo é o traiçoeiro: não é erro de compilação, é a árvore de saída
 * mudando de forma porque mudou o ancestral comum dos arquivos compilados.
 * Nenhuma verificação local olha para isso.
 *
 * SPEC PODE: arquivo de teste não entra na imagem, e é assim que a equivalência
 * entre as duas cópias da regra de plural se prova
 * (`medida-caseira-na-tela.spec.ts`). A fronteira é só para o que é compilado
 * para `dist`.
 */

const SRC = join(__dirname, '..');

function arquivosDeProducao(dir: string): string[] {
  const achados: string[] = [];
  for (const nome of readdirSync(dir)) {
    const caminho = join(dir, nome);
    if (statSync(caminho).isDirectory()) {
      achados.push(...arquivosDeProducao(caminho));
    } else if (nome.endsWith('.ts') && !nome.endsWith('.spec.ts')) {
      achados.push(caminho);
    }
  }
  return achados;
}

/**
 * `scripts/` TAMBÉM conta.
 *
 * O `tsconfig.json` da API não tem `include`: ele compila tudo sob a raiz do
 * pacote menos os `exclude` (node_modules, dist, test, *.spec.ts). Então
 * `scripts/*.ts` entra no build — `dist/scripts` existe — e um import de
 * `apps/web` ali re-enraiza a saída exatamente como em `src/`.
 *
 * Foi o que aconteceu na segunda tentativa de consertar o deploy: tirei o
 * import de `src/`, reconstruí, e a saída continuou em `dist/api/...` porque
 * `scripts/conferir-plurais-das-medidas.ts` ainda importava da web. Varrer só
 * `src/` teria dado a guarda por boa com o deploy ainda quebrado.
 */
const RAIZ_DO_PACOTE = join(SRC, '..');

describe('fronteira de build: a API não compila arquivo de apps/web', () => {
  it('nenhum arquivo de produção importa de apps/web', () => {
    const culpados: string[] = [];
    const compilados = [
      ...arquivosDeProducao(SRC),
      ...arquivosDeProducao(join(RAIZ_DO_PACOTE, 'scripts')),
    ];

    for (const arquivo of compilados) {
      const fonte = readFileSync(arquivo, 'utf8');
      // Pega `from '../../../../web/...'` com qualquer número de subidas, e
      // também `import(...)` dinâmico.
      if (/(?:from|import\s*\()\s*['"](?:\.\.\/)+web\//.test(fonte)) {
        culpados.push(relative(RAIZ_DO_PACOTE, arquivo).replace(/\\/g, '/'));
      }
    }

    expect(culpados).toEqual([]);
  });

  it('o CMD do Dockerfile aponta para o caminho que o build gera', () => {
    // A outra metade do estrago. Se alguém mudar `outDir`, `rootDir` ou o
    // conjunto compilado, o contêiner sobe apontando para um arquivo que não
    // existe — e isso só aparece no deploy.
    const docker = readFileSync(join(SRC, '..', 'Dockerfile'), 'utf8');
    const tsconfig = readFileSync(join(SRC, '..', 'tsconfig.json'), 'utf8');

    const cmd = docker.match(/CMD \["node", "([^"]+)"\]/)?.[1];
    expect(cmd).toBe('apps/api/dist/src/main.js');
    // `outDir` "./dist" + fontes só sob `src/` ⇒ `dist/src/main.js`.
    expect(tsconfig).toMatch(/"outDir":\s*"\.\/dist"/);
  });
});
