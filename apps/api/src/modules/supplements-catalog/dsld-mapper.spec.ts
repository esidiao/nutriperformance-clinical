import { mapDsldItem } from './dsld-mapper';

describe('dsld-mapper', () => {
  const sample = {
    _id: '43261',
    brandName: 'BPI Sports',
    fullName: 'BPI Sports Best Creatine',
    physicalState: { langualCodeDescription: 'Capsule' },
    allIngredients: [
      { name: 'Creatine', ingredientGroup: 'Creatine', notes: 'Creatine Monohydrate' },
      { name: 'Caffeine Anhydrous', ingredientGroup: 'Caffeine' },
    ],
    statements: [{ type: 'Precautions', notes: 'Consult a physician before use.' }],
  };

  it('mapeia id, nome, marca, forma e ingredientes', () => {
    const m = mapDsldItem(sample);
    expect(m.dsld_id).toBe('43261');
    expect(m.nome).toBe('BPI Sports Best Creatine');
    expect(m.marca).toBe('BPI Sports');
    expect(m.forma_farmaceutica).toBe('Capsule');
    expect(m.ingredientes_ativos.length).toBe(2);
    expect(m.ingredientes_ativos[0].name).toBe('Creatine');
  });

  it('detecta flag de cafeína a partir dos ingredientes', () => {
    const m = mapDsldItem(sample);
    expect(m.flags).toContain('Contém cafeína');
  });

  it('extrai advertências de statements de precaução', () => {
    const m = mapDsldItem(sample);
    expect(m.advertencias).toContain('Consult a physician before use.');
  });

  it('detecta vitamina K e ferro', () => {
    const m = mapDsldItem({
      _id: '1', brandName: 'X',
      allIngredients: [{ name: 'Vitamin K2 (Menaquinone)' }, { name: 'Ferrous bisglycinate' }],
    });
    expect(m.flags).toEqual(expect.arrayContaining(['Contém vitamina K', 'Contém ferro']));
  });

  it('tolera item sem ingredientes/campos', () => {
    const m = mapDsldItem({ _id: '2' });
    expect(m.ingredientes_ativos).toEqual([]);
    expect(m.flags).toEqual([]);
    expect(m.nome).toBeNull();
  });
});
