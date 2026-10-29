import { distribuicaoMacros, KCAL_POR_GRAMA } from '../../../../web/lib/distribuicao-macros';

/**
 * A distribuição dos macros na energia — o número com que a nutricionista
 * confere se o plano fecha dentro da faixa aceitável.
 */
describe('distribuicaoMacros', () => {
  it('usa Atwater: 4 para proteína e carboidrato, 9 para lipídio', () => {
    expect(KCAL_POR_GRAMA).toEqual({ proteina: 4, carboidrato: 4, lipidio: 9 });
  });

  it('os três percentuais somam 100, sempre', () => {
    // É a propriedade que mais importa na tela: soma diferente de 100 faz a
    // profissional desconfiar da conta, com razão.
    const casos = [
      { proteinasG: 30, carboidratosG: 100, lipidiosG: 25 },
      { proteinasG: 1, carboidratosG: 1, lipidiosG: 1 },
      { proteinasG: 7, carboidratosG: 93, lipidiosG: 13 },
      { proteinasG: 0.3, carboidratosG: 0.3, lipidiosG: 0.3 },
      { proteinasG: 120, carboidratosG: 11, lipidiosG: 3 },
    ];
    for (const c of casos) {
      const d = distribuicaoMacros(c)!;
      expect(d.proteinas + d.carboidratos + d.lipidios).toBe(100);
    }
  });

  it('calcula a distribuição de uma refeição típica', () => {
    // 30 g P = 120 kcal · 100 g C = 400 kcal · 25 g L = 225 kcal → 745 kcal
    const d = distribuicaoMacros({ proteinasG: 30, carboidratosG: 100, lipidiosG: 25 })!;
    expect(d.kcalPorMacros).toBe(745);
    expect(d.proteinas).toBe(16);
    expect(d.carboidratos).toBe(54);
    expect(d.lipidios).toBe(30);
  });

  it('devolve null quando não há macro nenhum — e null não é zero', () => {
    // "0% de proteína" AFIRMA que não tem proteína. Refeição vazia, ou feita
    // de alimentos sem composição na base, não afirma nada.
    expect(distribuicaoMacros({})).toBeNull();
    expect(distribuicaoMacros({ proteinasG: 0, carboidratosG: 0, lipidiosG: 0 })).toBeNull();
    expect(distribuicaoMacros({ kcal: 200 })).toBeNull();
    expect(distribuicaoMacros({ proteinasG: null, carboidratosG: undefined })).toBeNull();
  });

  it('expõe a divergência entre a energia da tabela e a dos macros', () => {
    // Os dois quase nunca batem, e a diferença grande costuma ser macro
    // faltando na base. Melhor poder olhar do que supor.
    const d = distribuicaoMacros({
      kcal: 800, proteinasG: 30, carboidratosG: 100, lipidiosG: 25,
    })!;
    expect(d.divergenciaKcal).toBe(800 - 745);
  });

  it('sem energia registrada, a divergência é null e não zero', () => {
    const d = distribuicaoMacros({ proteinasG: 30, carboidratosG: 100, lipidiosG: 25 })!;
    expect(d.divergenciaKcal).toBeNull();
  });

  it('valor negativo ou inválido conta como ausente, não como desconto', () => {
    const d = distribuicaoMacros({ proteinasG: -10, carboidratosG: 100, lipidiosG: 0 })!;
    expect(d.proteinas).toBe(0);
    expect(d.carboidratos).toBe(100);
  });
});
