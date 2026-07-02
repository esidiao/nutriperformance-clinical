import { mapUsdaFood } from './usda-mapper';

describe('usda-mapper', () => {
  const food = {
    fdcId: 173263,
    description: 'Rice, brown, parboiled, cooked',
    foodCategory: 'Cereal Grains and Pasta',
    foodNutrients: [
      { nutrientName: 'Energy', unitName: 'KCAL', value: 147 },
      { nutrientName: 'Energy', unitName: 'kJ', value: 615 },
      { nutrientName: 'Protein', unitName: 'G', value: 3.09 },
      { nutrientName: 'Carbohydrate, by difference', unitName: 'G', value: 31.3 },
      { nutrientName: 'Total lipid (fat)', unitName: 'G', value: 0.85 },
      { nutrientName: 'Fiber, total dietary', unitName: 'G', value: 1.7 },
      { nutrientName: 'Sodium, Na', unitName: 'MG', value: 4 },
      { nutrientName: 'Iron, Fe', unitName: 'MG', value: 0.53 },
      { nutrientName: 'Magnesium, Mg', unitName: 'MG', value: 39 },
      { nutrientName: 'Vitamin C, total ascorbic acid', unitName: 'MG', value: 0 },
    ],
  };

  it('mapeia descrição, fdcId e energia em KCAL (ignora kJ)', () => {
    const m = mapUsdaFood(food);
    expect(m.nome_padronizado).toBe('Rice, brown, parboiled, cooked');
    expect(m.fonte_id_externo).toBe('173263');
    expect(m.energia_kcal).toBe(147);
  });

  it('mapeia macros e minerais', () => {
    const m = mapUsdaFood(food);
    expect(m.proteinas_g).toBe(3.09);
    expect(m.carboidratos_g).toBe(31.3);
    expect(m.fibras_g).toBe(1.7);
    expect(m.sodio_mg).toBe(4);
    expect(m.ferro_mg).toBe(0.53);
    expect(m.magnesio_mg).toBe(39);
  });

  it('coleta vitaminas com rótulo legível', () => {
    const m = mapUsdaFood(food);
    expect(m.vitaminas['Vitamina C (mg)']).toBe(0);
  });

  it('tolera alimento sem nutrientes', () => {
    const m = mapUsdaFood({ fdcId: 1, description: 'X' });
    expect(m.energia_kcal).toBeNull();
    expect(m.vitaminas).toEqual({});
  });
});
