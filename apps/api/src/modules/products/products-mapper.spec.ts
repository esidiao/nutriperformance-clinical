import { mapOpenFoodFactsProduct, computeAlerts } from './products-mapper';

describe('products-mapper', () => {
  describe('computeAlerts (ANVISA RDC 429)', () => {
    it('sinaliza alto em sódio/açúcar/gordura saturada e ultraprocessado', () => {
      const alerts = computeAlerts({ sodio_mg: 700, acucares_g: 20, gordura_saturada_g: 8 }, 4);
      expect(alerts).toEqual(expect.arrayContaining([
        'Alto em sódio', 'Alto em açúcares', 'Alto em gordura saturada', 'Ultraprocessado (NOVA 4)',
      ]));
    });
    it('não sinaliza quando abaixo dos limiares', () => {
      expect(computeAlerts({ sodio_mg: 100, acucares_g: 2, gordura_saturada_g: 1 }, 1)).toEqual([]);
    });
  });

  describe('mapOpenFoodFactsProduct', () => {
    const off = {
      product_name: 'Biscoito Recheado',
      brands: 'MarcaX',
      ingredients_text: 'Farinha, açúcar, gordura vegetal',
      allergens_tags: ['en:gluten', 'pt:leite'],
      additives_tags: ['en:e322'],
      nutriscore_grade: 'e',
      nova_group: 4,
      countries: 'Brazil',
      image_url: 'http://img/x.jpg',
      nutriments: {
        'energy-kcal_100g': 480, 'proteins_100g': 6, 'carbohydrates_100g': 65,
        'fat_100g': 22, 'saturated-fat_100g': 10, 'sugars_100g': 35, 'fiber_100g': 2,
        'sodium_100g': 0.65, // g → 650 mg
      },
    };

    it('mapeia campos e converte sódio g→mg', () => {
      const m = mapOpenFoodFactsProduct('7891000000000', off);
      expect(m.codigo_barras).toBe('7891000000000');
      expect(m.nome_comercial).toBe('Biscoito Recheado');
      expect(m.nutri_score).toBe('E');
      expect(m.nova_classificacao).toBe(4);
      expect(m.tabela_nutricional.sodio_mg).toBe(650);
      expect(m.tabela_nutricional.energia_kcal).toBe(480);
      expect(m.alergenos).toEqual(expect.arrayContaining(['gluten', 'leite']));
    });

    it('calcula alertas (alto em sódio/açúcar/gord.sat + NOVA 4)', () => {
      const m = mapOpenFoodFactsProduct('7891000000000', off);
      expect(m.alerta_nutricional.length).toBeGreaterThanOrEqual(4);
    });

    it('usa sal/2.5 como fallback de sódio quando sodium_100g ausente', () => {
      const m = mapOpenFoodFactsProduct('1', { nutriments: { 'salt_100g': 2.5 } });
      expect(m.tabela_nutricional.sodio_mg).toBe(1000);
    });

    it('tolera produto sem nutriments/campos', () => {
      const m = mapOpenFoodFactsProduct('1', {});
      expect(m.tabela_nutricional).toEqual({});
      expect(m.nutri_score).toBeNull();
      expect(m.alerta_nutricional).toEqual([]);
    });
  });
});
