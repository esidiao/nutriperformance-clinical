import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * A rota `/api/versao` do front: pública, e só identificadores de build.
 *
 * POR QUE O TESTE MORA AQUI
 *
 * `apps/web` não tem runner; a suíte da API já importa de `apps/web/lib` por
 * caminho relativo (spec não entra na imagem, só código compilado é que não
 * pode cruzar — ver `sem-import-de-web.spec.ts`).
 *
 * O QUE ELE PROTEGE
 *
 * Dois riscos opostos, e os dois já aconteceram neste projeto em outras
 * formas:
 *
 *  1. A rota deixar de ser pública. Ela existe para conferir o deploy DE
 *     FORA, antes de ter sessão; se sair da lista do middleware, passa a
 *     responder 307 para o login e vira inútil sem ninguém perceber — o
 *     mesmo tipo de falha silenciosa do `CMD` apontando para caminho que o
 *     build não gera.
 *  2. Alguém acrescentar um campo com segredo. `process.env` inteiro está ao
 *     alcance de um `...process.env` distraído, e esta rota é pública para a
 *     internet. O teste lista os campos permitidos e falha em qualquer campo
 *     novo, para a decisão de publicá-lo ser consciente.
 */

const WEB = join(__dirname, '..', '..', '..', '..', 'web');

const CAMPOS_PERMITIDOS = [
  'status', 'implantacao', 'commit', 'ambiente', 'regiao', 'agora',
];

describe('/api/versao do front', () => {
  const rota = readFileSync(join(WEB, 'app', 'api', 'versao', 'route.ts'), 'utf8');
  const middleware = readFileSync(join(WEB, 'middleware.ts'), 'utf8');

  it('está na lista de rotas públicas do middleware', () => {
    const lista = middleware.slice(
      middleware.indexOf('const PUBLIC_PREFIXES'),
      middleware.indexOf('// Admin-only'),
    );
    expect(lista).toContain("'/api/versao'");
  });

  it('não é cacheada: resposta guardada diria o build de ontem', () => {
    expect(rota).toContain("export const dynamic = 'force-dynamic'");
    expect(rota).toMatch(/no-store/);
  });

  it('devolve SÓ os campos previstos', () => {
    // Pega as chaves do objeto literal devolvido.
    const corpo = rota.slice(rota.indexOf('NextResponse.json('), rota.indexOf('{ headers:'));
    const chaves = [...corpo.matchAll(/^\s{6}(\w+):/gm)].map((m) => m[1]);
    expect(chaves.sort()).toEqual([...CAMPOS_PERMITIDOS].sort());
  });

  it('não derrama process.env inteiro', () => {
    expect(rota).not.toMatch(/\.\.\.process\.env/);
    // Toda leitura de env tem de ser de uma variável da própria Vercel.
    const lidas = [...rota.matchAll(/process\.env\.(\w+)/g)].map((m) => m[1]);
    expect(lidas.length).toBeGreaterThan(0);
    for (const v of lidas) expect(v).toMatch(/^VERCEL_/);
  });
});
