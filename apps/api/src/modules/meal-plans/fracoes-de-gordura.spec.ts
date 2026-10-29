import {
  extrairFracoesDeGordura, somarFracoesDeGordura, FRACOES_DE_GORDURA,
} from './fracoes-de-gordura';
import { somarMicronutrientes, MICRONUTRIENTES } from './micronutrientes';

/**
 * As frações de gordura — o pedido da nutricionista que mais podia dar errado
 * em silêncio, porque a TACO não traz o dado e somar ausência como zero
 * produziria "0 g de saturada" num plano de queijo e carne.
 */

const alimento = (over: Record<string, unknown> = {}) => ({
  gorduraSaturadaG: 10, gorduraTransG: 0.5, ...over,
}) as any;

describe('extrairFracoesDeGordura', () => {
  it('escala pela quantidade, como o resto da base (por 100 g)', () => {
    const r = extrairFracoesDeGordura(alimento(), 250);
    expect(r.gorduraSaturadaG).toBe(25);
    expect(r.gorduraTransG).toBe(1.25);
  });

  it('o que a base NAO tem fica de fora — nao vira zero', () => {
    // O caso da TACO: 0 de 597 alimentos com saturada.
    const r = extrairFracoesDeGordura(
      alimento({ gorduraSaturadaG: null, gorduraTransG: null }), 100,
    );
    expect(r).toEqual({});
    expect('gorduraSaturadaG' in r).toBe(false);
  });

  it('zero de verdade continua zero', () => {
    // Alimento que a base declara com 0 g de saturada e diferente de alimento
    // sem o dado, e a distincao tem de sobreviver.
    const r = extrairFracoesDeGordura(alimento({ gorduraSaturadaG: 0 }), 100);
    expect(r.gorduraSaturadaG).toBe(0);
  });
});

describe('somarFracoesDeGordura', () => {
  const item = (lip: number | null, sat: number | null, trans: number | null = null) => ({
    lipidiosG: lip,
    micronutrientes: {
      ...(sat === null ? {} : { gorduraSaturadaG: sat }),
      ...(trans === null ? {} : { gorduraTransG: trans }),
    },
  });

  it('soma e informa a cobertura', () => {
    const r = somarFracoesDeGordura([item(20, 8), item(10, 3)]);
    expect(r.saturadaG).toEqual(expect.objectContaining({
      valor: 11, itensComDado: 2, itensTotal: 2, completo: true,
    }));
  });

  it('marca INCOMPLETO quando algum item nao tem o dado', () => {
    // O caso real: plano misturando TACO (sem saturada) e IBGE (com).
    const r = somarFracoesDeGordura([item(20, 8), item(15, null)]);
    expect(r.saturadaG!.valor).toBe(8);
    expect(r.saturadaG!.completo).toBe(false);
    expect(r.saturadaG!.itensComDado).toBe(1);
    expect(r.saturadaG!.itensTotal).toBe(2);
  });

  it('nenhum item com o dado devolve NULL, nao zero', () => {
    // Plano inteiro de TACO. "0 g de saturada" afirmaria que nao tem.
    const r = somarFracoesDeGordura([item(20, null), item(15, null)]);
    expect(r.saturadaG).toBeNull();
    expect(r.insaturadaG).toBeNull();
  });

  describe('insaturada, que e deduzida', () => {
    it('e a subtracao: lipidio menos saturada menos trans', () => {
      const r = somarFracoesDeGordura([item(20, 8, 0.5)]);
      expect(r.insaturadaG!.valor).toBe(11.5);
      expect(r.insaturadaG!.derivada).toBe(true);
    });

    it('trans ausente conta como zero NA SUBTRACAO, so ela', () => {
      // Aqui zero e defensavel: a subtracao sem o trans superestima a
      // insaturada em no maximo o trans, que e pequeno. Ja a saturada
      // ausente inverteria o resultado, e por isso exclui o item.
      const r = somarFracoesDeGordura([item(20, 8)]);
      expect(r.insaturadaG!.valor).toBe(12);
      expect(r.transG).toBeNull();
    });

    it('item SEM saturada fica de fora da insaturada', () => {
      // Sem esta regra, o lipidio inteiro entraria como insaturado: numero
      // plausivel e falso.
      const r = somarFracoesDeGordura([item(20, 8), item(30, null)]);
      expect(r.insaturadaG!.valor).toBe(12);     // so o primeiro item
      expect(r.insaturadaG!.completo).toBe(false);
    });

    it('nao devolve insaturada negativa quando a base arredonda', () => {
      // saturada + trans maior que o lipidio acontece por arredondamento.
      const r = somarFracoesDeGordura([item(10, 10.2, 0.3)]);
      expect(r.insaturadaG!.valor).toBe(0);
    });
  });
});

describe('as fracoes NAO vazam para o relatorio de micronutrientes', () => {
  it('nenhuma chave de gordura esta na lista de micronutrientes', () => {
    for (const chave of FRACOES_DE_GORDURA) {
      expect(MICRONUTRIENTES).not.toContain(chave as never);
    }
  });

  it('somarMicronutrientes ignora as chaves de gordura', () => {
    // Elas moram no mesmo jsonb por nao exigir migracao. O preco e um campo
    // com nome de uma coisa guardando outra -- e este teste e quem garante
    // que o preco nao vira defeito.
    const total = somarMicronutrientes([
      { micronutrientes: { gorduraSaturadaG: 10, gorduraTransG: 1, calcioMg: 200 } },
    ]);
    expect(total.calcioMg.valor).toBe(200);
    expect(total).not.toHaveProperty('gorduraSaturadaG');
    expect(total).not.toHaveProperty('gorduraTransG');
  });
});
