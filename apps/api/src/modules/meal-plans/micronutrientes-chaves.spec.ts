import { readFileSync } from 'fs';
import { join } from 'path';
import { MICRONUTRIENTES as DO_BACKEND } from './micronutrientes';
import {
  MICRONUTRIENTES as DO_FRONT,
  CAMPO_DIRETO,
  CHAVE_NO_JSONB,
} from '../../../../web/lib/micronutrientes-alimento';

/**
 * Os dois extratores de micronutriente precisam concordar.
 *
 * Existem dois por necessidade: o do backend recebe a entidade do TypeORM, o
 * do frontend recebe o DTO da API, e `apps/api` não consegue importar de
 * `apps/web` sem quebrar o build do Nest (o `tsc` emitiria caminho fora do
 * `rootDir`). Specs são excluídas do build, então o teste pode.
 *
 * Sem esta comparação, acrescentar um nutriente de um lado só faria o
 * relatório da prescrição e o do plano discordarem — e o nutriente sumiria de
 * um deles sem nenhum aviso.
 */
describe('mapeamento de micronutrientes — backend x frontend', () => {
  it('as duas listas são idênticas, na mesma ordem', () => {
    expect([...DO_FRONT]).toEqual([...DO_BACKEND]);
  });

  it('cobre os 19 nutrientes que a base fornece', () => {
    // 11 da TACO, mais os sete que o IBGE trouxe, mais a vitamina D — que
    // so entrou depois que a DRI revisada de 2011 foi lida na fonte.
    expect(DO_BACKEND).toHaveLength(19);
  });

  it('todo nutriente sai de um campo direto OU de uma chave do jsonb', () => {
    // Nutriente sem origem seria sempre ausente, e a tela mostraria "sem dado"
    // para algo que a base tem.
    const semOrigem = DO_FRONT.filter(
      (c) => !(c in CAMPO_DIRETO) && !(c in CHAVE_NO_JSONB),
    );
    expect(semOrigem).toEqual([]);
  });

  it('nenhum nutriente tem as DUAS origens', () => {
    const ambos = DO_FRONT.filter((c) => c in CAMPO_DIRETO && c in CHAVE_NO_JSONB);
    expect(ambos).toEqual([]);
  });

  it('o backend usa as MESMAS chaves de jsonb que o frontend', () => {
    // Comparado pelo fonte porque o mapa do backend não é exportado — e não
    // precisa ser só para este teste.
    const fonte = readFileSync(join(__dirname, 'micronutrientes.ts'), 'utf8');
    for (const [nutriente, chave] of Object.entries(CHAVE_NO_JSONB)) {
      expect(fonte).toContain(`${nutriente}: '${chave}'`);
    }
  });

  it('vitamina A usa RAE, nao RE nem retinol', () => {
    // As três existem na base e NÃO são equivalentes. A DRI é em RAE; usar
    // outra produziria adequação calculada contra a unidade errada.
    expect(CHAVE_NO_JSONB.vitaminaAMcg).toBe('vitamina_a_rae_mcg');
  });

  it('as chaves batem com as da tabela de referência DRI', () => {
    // Se divergirem, o relatório compara nutriente com recomendação de outro
    // — ou simplesmente não encontra a referência e mostra tudo "sem dado".
    const dri = readFileSync(
      join(__dirname, '..', '..', '..', '..', 'web', 'lib', 'referencia-dri.ts'),
      'utf8',
    );
    for (const chave of DO_FRONT) {
      expect(dri).toContain(`nutriente: '${chave}'`);
    }
  });
});
