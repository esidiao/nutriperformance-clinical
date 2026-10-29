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

  it('traz mono e poli quando a fonte publica (TACO: 423 de 597)', () => {
    const r = extrairFracoesDeGordura(
      alimento({ gorduraMonoinsaturadaG: 4, gorduraPoliinsaturadaG: 2 }), 50,
    );
    expect(r.gorduraMonoinsaturadaG).toBe(2);
    expect(r.gorduraPoliinsaturadaG).toBe(1);
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

describe('insaturada: medido ganha de deduzido, item a item', () => {
  const medido = (lip: number, sat: number, mono: number, poli: number) => ({
    lipidiosG: lip,
    micronutrientes: {
      gorduraSaturadaG: sat,
      gorduraMonoinsaturadaG: mono,
      gorduraPoliinsaturadaG: poli,
    },
  });

  it('usa mono + poli quando a fonte publica as DUAS, e nao marca derivada', () => {
    // Lipidio 20 e saturada 8 dariam 12 por subtracao. O medido e 4+7=11, e
    // e ele que vale: a subtracao embute o que a fonte nao classificou.
    const r = somarFracoesDeGordura([medido(20, 8, 4, 7)]);
    expect(r.insaturadaG!.valor).toBe(11);
    expect(r.insaturadaG!.derivada).toBeUndefined();
    expect(r.insaturadaG!.itensDeduzidos).toBeUndefined();
    expect(r.monoinsaturadaG!.valor).toBe(4);
    expect(r.poliinsaturadaG!.valor).toBe(7);
  });

  it('com SO UMA das duas, cai na subtracao', () => {
    // Somar mono sozinha como "insaturada" subestimaria calado, que e o
    // mesmo defeito do zero.
    const r = somarFracoesDeGordura([
      { lipidiosG: 20, micronutrientes: { gorduraSaturadaG: 8, gorduraMonoinsaturadaG: 4 } },
    ]);
    expect(r.insaturadaG!.valor).toBe(12);
    expect(r.insaturadaG!.derivada).toBe(true);
    expect(r.insaturadaG!.itensDeduzidos).toBe(1);
    expect(r.poliinsaturadaG).toBeNull();
  });

  it('plano misto TACO + IBGE: conta quantos itens vieram por deducao', () => {
    // O caso real. A TACO publica mono e poli; o IBGE NAO publica nenhuma
    // das duas, nos seus 1971 alimentos.
    const r = somarFracoesDeGordura([
      medido(20, 8, 4, 7),                                              // TACO
      { lipidiosG: 10, micronutrientes: { gorduraSaturadaG: 3 } },      // IBGE
    ]);
    expect(r.insaturadaG!.valor).toBe(18);        // 11 medido + 7 deduzido
    expect(r.insaturadaG!.itensComDado).toBe(2);
    expect(r.insaturadaG!.completo).toBe(true);
    expect(r.insaturadaG!.derivada).toBe(true);
    expect(r.insaturadaG!.itensDeduzidos).toBe(1);
    // Mono e poli ficam INCOMPLETAS: o item do IBGE nao tem.
    expect(r.monoinsaturadaG!.itensComDado).toBe(1);
    expect(r.monoinsaturadaG!.completo).toBe(false);
  });

  it('mono e poli medidas dispensam a saturada para a insaturada existir', () => {
    // Dos 597 da TACO, 423 tem mono/poli e 417 tem saturada: ha alimento com
    // as insaturadas e sem a saturada. Antes ele sumia da insaturada.
    const r = somarFracoesDeGordura([
      { lipidiosG: 20, micronutrientes: { gorduraMonoinsaturadaG: 4, gorduraPoliinsaturadaG: 7 } },
    ]);
    expect(r.insaturadaG!.valor).toBe(11);
    expect(r.saturadaG).toBeNull();
  });

  it('zero medido e zero, nao ausencia', () => {
    const r = somarFracoesDeGordura([medido(10, 10, 0, 0)]);
    expect(r.insaturadaG!.valor).toBe(0);
    expect(r.insaturadaG!.derivada).toBeUndefined();
    expect(r.monoinsaturadaG!.valor).toBe(0);
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
      {
        micronutrientes: {
          gorduraSaturadaG: 10, gorduraTransG: 1,
          gorduraMonoinsaturadaG: 4, gorduraPoliinsaturadaG: 2,
          calcioMg: 200,
        },
      },
    ]);
    expect(total.calcioMg.valor).toBe(200);
    for (const chave of FRACOES_DE_GORDURA) {
      expect(total).not.toHaveProperty(chave);
    }
  });
});
