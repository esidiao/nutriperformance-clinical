import { extrairDoAlimento, somarMicronutrientes, MICRONUTRIENTES } from './micronutrientes';

/**
 * A distinção que estes testes protegem: AUSENTE não é ZERO.
 *
 * Se um alimento não tem cálcio na base, o item do plano não pode guardar
 * `calcioMg: 0` — isso afirmaria que o alimento não fornece cálcio. E o total
 * do dia somado sobre parte dos alimentos não pode ser lido como número real.
 */
const alimento = (over: any = {}): any => ({
  nomePadronizado: 'Teste',
  calcioMg: 100, ferroMg: 2, potassioMg: 300, magnesioMg: 50, zincoMg: 1,
  vitaminas: {
    fonte: 'TACO',
    tiamina_mg: { valor: 0.4, unidade: 'mg' },
    vitamina_c_mg: { valor: 20, unidade: 'mg' },
  },
  ...over,
});

describe('micronutrientes no plano', () => {
  describe('extração do alimento', () => {
    it('escala por 100 g, como todo o resto da base', () => {
      const r = extrairDoAlimento(alimento(), 50);
      expect(r.calcioMg).toBe(50);
      expect(r.ferroMg).toBe(1);
    });

    it('100 g devolve o valor da base', () => {
      expect(extrairDoAlimento(alimento(), 100).calcioMg).toBe(100);
    });

    it('lê vitamina de dentro do jsonb, no formato { valor, unidade }', () => {
      const r = extrairDoAlimento(alimento(), 100);
      expect(r.tiaminaMg).toBe(0.4);
      expect(r.vitaminaCMg).toBe(20);
    });

    it('nutriente NULO na base fica AUSENTE, não zero', () => {
      const r = extrairDoAlimento(alimento({ calcioMg: null }), 100);
      expect('calcioMg' in r).toBe(false);
    });

    it('vitamina que o alimento não tem fica ausente', () => {
      const r = extrairDoAlimento(alimento(), 100);
      // O alimento de teste só tem tiamina e vitamina C.
      expect('riboflavinaMg' in r).toBe(false);
      expect('niacinaMg' in r).toBe(false);
    });

    it('zero na base é PRESERVADO como zero', () => {
      // "Não fornece" é informação; some com "não sei" seria perder dado.
      const r = extrairDoAlimento(alimento({ ferroMg: 0 }), 100);
      expect(r.ferroMg).toBe(0);
    });

    it('usa vitamina A em RAE, que é a unidade da DRI', () => {
      const r = extrairDoAlimento(alimento({
        vitaminas: {
          vitamina_a_rae_mcg: { valor: 300, unidade: 'µg' },
          vitamina_a_re_mcg: { valor: 999, unidade: 'µg' },
          retinol_mcg: { valor: 111, unidade: 'µg' },
        },
      }), 100);
      // RE e retinol não são equivalentes a RAE e não servem para comparar.
      expect(r.vitaminaAMcg).toBe(300);
    });

    it('alimento sem jsonb de vitaminas não quebra', () => {
      const r = extrairDoAlimento(alimento({ vitaminas: undefined }), 100);
      expect(r.calcioMg).toBe(100);
      expect('tiaminaMg' in r).toBe(false);
    });
  });

  describe('soma com cobertura', () => {
    it('soma e marca cobertura completa quando todos têm o dado', () => {
      const t = somarMicronutrientes([
        { micronutrientes: { calcioMg: 100 } },
        { micronutrientes: { calcioMg: 50 } },
      ]);
      expect(t.calcioMg).toEqual({
        valor: 150, itensComDado: 2, itensTotal: 2, completo: true,
      });
    });

    it('marca INCOMPLETO quando algum item não tem o dado', () => {
      const t = somarMicronutrientes([
        { micronutrientes: { calcioMg: 100 } },
        { micronutrientes: {} },
        { micronutrientes: { calcioMg: 50 } },
      ]);
      expect(t.calcioMg.valor).toBe(150);
      expect(t.calcioMg.completo).toBe(false);
      expect(t.calcioMg.itensComDado).toBe(2);
      expect(t.calcioMg.itensTotal).toBe(3);
    });

    it('item com ZERO conta como tendo o dado', () => {
      const t = somarMicronutrientes([
        { micronutrientes: { ferroMg: 2 } },
        { micronutrientes: { ferroMg: 0 } },
      ]);
      expect(t.ferroMg.completo).toBe(true);
      expect(t.ferroMg.valor).toBe(2);
    });

    it('nutriente que NENHUM item tem fica fora do resultado', () => {
      // Para o relatório, ausente e zero precisam continuar diferentes.
      const t = somarMicronutrientes([{ micronutrientes: { calcioMg: 100 } }]);
      expect('niacinaMg' in t).toBe(false);
    });

    it('plano vazio devolve objeto vazio', () => {
      expect(somarMicronutrientes([])).toEqual({});
    });

    it('item sem a coluna (gravado antes da migração) conta como sem dado', () => {
      const t = somarMicronutrientes([
        { micronutrientes: { calcioMg: 100 } },
        {},
      ]);
      expect(t.calcioMg.completo).toBe(false);
      expect(t.calcioMg.itensTotal).toBe(2);
    });
  });

  describe('cobertura da lista', () => {
    it('cobre os 19 nutrientes que a base fornece', () => {
      // Eram 11 enquanto a base era so a TACO. A importacao do IBGE trouxe a
      // composicao de mais sete, que ate entao apareciam no relatorio como
      // lacuna declarada em vez de valor.
      expect(MICRONUTRIENTES).toHaveLength(19);
      expect(MICRONUTRIENTES).toEqual(expect.arrayContaining([
        'calcioMg', 'ferroMg', 'potassioMg', 'magnesioMg', 'zincoMg',
        'tiaminaMg', 'riboflavinaMg', 'niacinaMg', 'piridoxinaMg',
        'vitaminaCMg', 'vitaminaAMcg',
        'fosforoMg', 'selenioMcg', 'cobreMg', 'manganesMg',
        'vitaminaEMg', 'cobalaminaMcg', 'folatoMcg', 'vitaminaDMcg',
      ]));
    });
  });
});
