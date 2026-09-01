import { montarListaCompras, formatarQuantidade, SECOES, ORDEM_SECOES } from './lista-compras';
import { MealPlanItem } from './meal-plan-item.entity';

const item = (over: Partial<MealPlanItem> = {}): MealPlanItem => ({
  id: 'i', mealPlanId: 'p', workspaceId: 'w', refeicao: 'almoco', horario: null, ordem: 0,
  foodId: null, fonte: null, alimentoNome: 'Arroz', quantidadeG: 100 as any,
  medidaCaseira: null, kcal: 0 as any, proteinasG: 0 as any, carboidratosG: 0 as any,
  lipidiosG: 0 as any, fibrasG: 0 as any, sodioMg: 0 as any,
  substituicoes: [], observacao: null, createdAt: new Date(), updatedAt: new Date(),
  ...over,
} as MealPlanItem);

const semGrupos = new Map<string, string | null>();

describe('lista de compras', () => {
  describe('agregação', () => {
    it('soma o mesmo alimento em refeições diferentes', () => {
      const r = montarListaCompras([
        item({ foodId: 'f1', refeicao: 'cafe_manha', quantidadeG: 50 as any }),
        item({ foodId: 'f1', refeicao: 'lanche_tarde', quantidadeG: 30 as any }),
      ], semGrupos, 1);
      expect(r.totalItens).toBe(1);
      expect(r.secoes[0].itens[0].totalG).toBe(80);
      expect(r.secoes[0].itens[0].ocorrencias).toBe(2);
    });

    it('multiplica pelos dias', () => {
      const r = montarListaCompras([item({ foodId: 'f1', quantidadeG: 100 as any })], semGrupos, 7);
      expect(r.secoes[0].itens[0].totalG).toBe(700);
      expect(r.dias).toBe(7);
    });

    it('trata numeric do Postgres, que chega como string', () => {
      const r = montarListaCompras([item({ foodId: 'f1', quantidadeG: '120.50' as any })], semGrupos, 2);
      expect(r.secoes[0].itens[0].totalG).toBe(241);
    });

    it('não funde alimentos distintos da base com nome parecido', () => {
      // Dois foodId diferentes continuam duas linhas, mesmo com nome igual:
      // somar "Queijo minas frescal" com "Queijo minas curado" mandaria a
      // pessoa comprar o dobro do errado.
      const r = montarListaCompras([
        item({ foodId: 'f1', alimentoNome: 'Queijo minas' }),
        item({ foodId: 'f2', alimentoNome: 'Queijo minas' }),
      ], semGrupos, 1);
      expect(r.totalItens).toBe(2);
    });

    it('funde item digitado à mão ignorando acento e caixa', () => {
      const r = montarListaCompras([
        item({ alimentoNome: 'Açúcar' }),
        item({ alimentoNome: 'acucar' }),
      ], semGrupos, 1);
      expect(r.totalItens).toBe(1);
    });

    it('conta os itens sem vínculo com a base', () => {
      const r = montarListaCompras([
        item({ foodId: 'f1' }),
        item({ alimentoNome: 'Tempero caseiro' }),
      ], semGrupos, 1);
      expect(r.semVinculo).toBe(1);
    });
  });

  describe('medida caseira', () => {
    it('soma quando todas as ocorrências usam a mesma medida', () => {
      const r = montarListaCompras([
        item({ foodId: 'f1', medidaCaseira: 'unidade' }),
        item({ foodId: 'f1', medidaCaseira: 'unidade' }),
      ], semGrupos, 3);
      const i = r.secoes[0].itens[0];
      expect(i.medidaCaseira).toBe('unidade');
      expect(i.quantidadeMedidas).toBe(6); // 2 por dia × 3 dias
    });

    it('omite quando as medidas divergem', () => {
      // "2 colheres" + "1 fatia" não vira medida nenhuma. Melhor só os gramas
      // que dar um número que não existe.
      const r = montarListaCompras([
        item({ foodId: 'f1', medidaCaseira: 'colher de sopa' }),
        item({ foodId: 'f1', medidaCaseira: 'fatia' }),
      ], semGrupos, 1);
      expect(r.secoes[0].itens[0].medidaCaseira).toBeNull();
    });

    it('omite quando só parte das ocorrências tem medida', () => {
      const r = montarListaCompras([
        item({ foodId: 'f1', medidaCaseira: 'unidade' }),
        item({ foodId: 'f1', medidaCaseira: null }),
      ], semGrupos, 1);
      expect(r.secoes[0].itens[0].medidaCaseira).toBeNull();
    });
  });

  describe('seções', () => {
    it('usa o grupo alimentar da base', () => {
      const grupos = new Map([['f1', 'Frutas e derivados'], ['f2', 'Carnes e derivados']]);
      const r = montarListaCompras([
        item({ foodId: 'f1', alimentoNome: 'Banana' }),
        item({ foodId: 'f2', alimentoNome: 'Patinho' }),
      ], grupos, 1);
      expect(r.secoes.map((s) => s.secao)).toEqual(['Hortifrúti', 'Açougue e peixaria']);
    });

    it('respeita a ordem de percurso no mercado, não a alfabética', () => {
      const grupos = new Map([
        ['f1', 'Bebidas (alcoólicas e não alcoólicas)'],
        ['f2', 'Frutas e derivados'],
      ]);
      const r = montarListaCompras([
        item({ foodId: 'f1', alimentoNome: 'Água de coco' }),
        item({ foodId: 'f2', alimentoNome: 'Maçã' }),
      ], grupos, 1);
      expect(r.secoes.map((s) => s.secao)).toEqual(['Hortifrúti', 'Bebidas']);
    });

    it('grupo desconhecido cai em Outros e continua visível', () => {
      const r = montarListaCompras(
        [item({ foodId: 'f1' })], new Map([['f1', 'Grupo que nao existe']]), 1,
      );
      expect(r.secoes[0].secao).toBe('Outros');
      expect(r.secoes[0].itens).toHaveLength(1);
    });

    it('item sem vínculo com a base também aparece', () => {
      const r = montarListaCompras([item({ alimentoNome: 'Tempero caseiro' })], semGrupos, 1);
      expect(r.secoes[0].secao).toBe('Outros');
    });

    it('ordena os itens de cada seção por nome', () => {
      const grupos = new Map([['f1', 'Frutas e derivados'], ['f2', 'Frutas e derivados']]);
      const r = montarListaCompras([
        item({ foodId: 'f1', alimentoNome: 'Uva' }),
        item({ foodId: 'f2', alimentoNome: 'Abacaxi' }),
      ], grupos, 1);
      expect(r.secoes[0].itens.map((i) => i.nome)).toEqual(['Abacaxi', 'Uva']);
    });

    it('toda seção do mapa está na ordem de percurso', () => {
      // Sem isto, um grupo mapeado para uma seção fora de ORDEM_SECOES seria
      // filtrado e desapareceria da lista sem erro nenhum.
      for (const secao of new Set(Object.values(SECOES))) {
        expect(ORDEM_SECOES).toContain(secao);
      }
    });
  });

  it('plano vazio devolve lista vazia, não erro', () => {
    const r = montarListaCompras([], semGrupos, 7);
    expect(r.secoes).toEqual([]);
    expect(r.totalItens).toBe(0);
  });
});

describe('formatarQuantidade', () => {
  it.each([
    [250, '250 g'],
    [999, '999 g'],
    [1000, '1 kg'],
    [1500, '1,5 kg'],
    [2340, '2,34 kg'],
  ])('%i g → %s', (g, esperado) => {
    expect(formatarQuantidade(g as number)).toBe(esperado);
  });
});
