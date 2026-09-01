import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Toda entidade precisa estar na lista `entities` do DataSource.
 *
 * Este teste existe por causa de um bug real: o módulo de charges foi
 * registrado e `TypeOrmModule.forFeature([Charge])` injetou o repositório
 * normalmente, mas a entidade ficou fora da lista do DataSource raiz. A API
 * subiu, respondeu ao health check e devolveu 401 sem token — tudo parecia
 * certo. O erro só apareceu na primeira consulta real, em produção:
 *
 *   EntityMetadataNotFoundError: No metadata for "Charge" was found.
 *
 * Os 385 testes da suíte passaram porque todos mockam o repositório e nunca
 * tocam o DataSource. Nenhuma quantidade de teste de serviço pega isto — só
 * uma verificação estrutural como esta.
 */
describe('app.module — registro de entidades', () => {
  const raizModulos = join(__dirname, 'modules');
  const fonteAppModule = readFileSync(join(__dirname, 'app.module.ts'), 'utf8');

  const arquivosDeEntidade = (dir: string): string[] =>
    readdirSync(dir).flatMap((nome) => {
      const caminho = join(dir, nome);
      if (statSync(caminho).isDirectory()) return arquivosDeEntidade(caminho);
      return nome.endsWith('.entity.ts') ? [caminho] : [];
    });

  const listaDeEntidades = (() => {
    const i = fonteAppModule.indexOf('entities: [');
    const j = fonteAppModule.indexOf(']', i);
    return fonteAppModule.slice(i, j);
  })();

  const entidades = arquivosDeEntidade(raizModulos).flatMap((caminho) => {
    const fonte = readFileSync(caminho, 'utf8');
    // Aceita decoradores entre @Entity e a classe. A primeira versão deste
    // regex exigia `export class` logo depois de @Entity(...), e por isso
    // pulava em silêncio justamente Charge e Appointment, que têm @Index no
    // meio — o teste passava sem verificar nada. Um guarda que não falha
    // quando deveria é pior que nenhum guarda.
    return [...fonte.matchAll(/@Entity\([^)]*\)(?:\s*@\w+\([^)]*\))*\s*export class (\w+)/g)]
      .map((m) => ({ classe: m[1], caminho }));
  });

  it('encontra as entidades do projeto', () => {
    // Se o glob quebrar, os testes abaixo passariam vazios e o guarda sumiria.
    expect(entidades.length).toBeGreaterThan(5);
  });

  it.each(entidades.map((e) => [e.classe, e.caminho]))(
    '%s está na lista `entities` do DataSource',
    (classe) => {
      expect(listaDeEntidades).toContain(classe as string);
    },
  );

  it.each(entidades.map((e) => [e.classe]))(
    '%s é importada em app.module.ts',
    (classe) => {
      expect(fonteAppModule).toMatch(
        new RegExp(`import\\s*\\{[^}]*\\b${classe}\\b[^}]*\\}`),
      );
    },
  );
});
