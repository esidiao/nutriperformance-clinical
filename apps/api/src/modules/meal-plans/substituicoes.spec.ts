import {
  montarSubstituicoes, NUTRIENTE_DO_GRUPO, GRUPOS_SEM_EQUIVALENCIA,
  GRUPOS_COBERTOS, ROTULO_NUTRIENTE,
  type AlimentoComposicao,
} from './substituicoes';

/**
 * O risco desta lista não é errar a aritmética — é propor uma troca que a
 * aritmética aprova e a clínica não. Então os testes travam, principalmente,
 * as recusas: quando a lista PRECISA vir vazia com motivo em vez de vir
 * cheia de sugestões plausíveis.
 */

const alimento = (over: Partial<AlimentoComposicao> = {}): AlimentoComposicao => ({
  id: over.id ?? 'id-1',
  nomePadronizado: 'Genérico',
  grupoAlimentar: 'Cereais e derivados',
  energiaKcal: 100,
  proteinasG: 2,
  carboidratosG: 20,
  lipidiosG: 1,
  fibrasG: 1,
  ...over,
});

// Arroz cozido e batata cozida, valores redondos para a conta ser conferível.
const ARROZ = alimento({
  id: 'arroz', nomePadronizado: 'Arroz, cozido',
  energiaKcal: 128, proteinasG: 2.5, carboidratosG: 28, lipidiosG: 0.2, fibrasG: 1.6,
});
const BATATA = alimento({
  id: 'batata', nomePadronizado: 'Batata, cozida',
  energiaKcal: 52, proteinasG: 1.2, carboidratosG: 11.9, lipidiosG: 0, fibrasG: 1.3,
});

describe('lista de substituições', () => {
  describe('a conta', () => {
    it('iguala o nutriente de referência do grupo, não a massa', () => {
      // 100 g de arroz têm 28 g de carboidrato. Batata tem 11,9 g por 100 g.
      // Equivalente = 100 × (28 ÷ 11,9) = 235,3 g.
      const r = montarSubstituicoes(ARROZ, 100, [ARROZ, BATATA]);
      expect(r.nutrienteReferencia).toBe('carboidratosG');
      expect(r.referenciaOriginal).toBe(28);
      expect(r.substituicoes).toHaveLength(1);
      expect(r.substituicoes[0].quantidadeG).toBeCloseTo(235.3, 1);
    });

    it('escala com a porção prescrita, não com 100 g fixos', () => {
      const cem = montarSubstituicoes(ARROZ, 100, [BATATA]).substituicoes[0];
      const duzentos = montarSubstituicoes(ARROZ, 200, [BATATA]).substituicoes[0];
      expect(duzentos.quantidadeG).toBeCloseTo(cem.quantidadeG * 2, 1);
    });

    it('a referência fica igualada e o resto divergente — e a divergência aparece', () => {
      const s = montarSubstituicoes(ARROZ, 100, [BATATA]).substituicoes[0];
      // Carboidrato é a referência: diferença ~zero por construção.
      expect(Math.abs(s.divergencia.carboidratosG)).toBeLessThanOrEqual(0.1);
      // Calorias NÃO são iguais, e omitir isso faria a troca parecer livre.
      expect(s.divergencia.kcal).not.toBe(0);
    });

    it('mostra a conta em texto, para conferência', () => {
      const s = montarSubstituicoes(ARROZ, 100, [BATATA]).substituicoes[0];
      expect(s.calculo).toContain('28');
      expect(s.calculo).toContain('11.9');
      expect(s.calculo).toContain('carboidratos');
    });

    it('exclui o próprio alimento da lista', () => {
      const r = montarSubstituicoes(ARROZ, 100, [ARROZ, BATATA]);
      expect(r.substituicoes.map((s) => s.foodId)).not.toContain('arroz');
    });
  });

  describe('as recusas', () => {
    it('candidato com zero do nutriente de referência sai da lista', () => {
      // Dividir por zero daria Infinity, e Infinity arredondado vira uma
      // porção enorme que parece um número de verdade.
      const semCarbo = alimento({ id: 'oleo', carboidratosG: 0 });
      const r = montarSubstituicoes(ARROZ, 100, [semCarbo]);
      expect(r.substituicoes).toHaveLength(0);
      expect(r.indisponivel).toMatch(/Nenhum outro alimento/);
      expect(r.substituicoes.every((s) => Number.isFinite(s.quantidadeG))).toBe(true);
    });

    it('candidato com nutriente nulo sai da lista', () => {
      const nulo = alimento({ id: 'nulo', carboidratosG: null });
      expect(montarSubstituicoes(ARROZ, 100, [nulo]).substituicoes).toHaveLength(0);
    });

    it('origem sem o nutriente de referência recusa com motivo', () => {
      const semCarbo = alimento({ id: 'x', carboidratosG: 0 });
      const r = montarSubstituicoes(semCarbo, 100, [ARROZ, BATATA]);
      expect(r.substituicoes).toHaveLength(0);
      expect(r.indisponivel).toMatch(/não registra carboidratos/);
    });

    it('porção implausível é descartada, e o motivo diz quantas eram', () => {
      // Alimento com carboidrato minúsculo exigiria quilos para igualar.
      const diluido = alimento({ id: 'diluido', carboidratosG: 0.5 });
      const r = montarSubstituicoes(ARROZ, 100, [diluido]);
      expect(r.substituicoes).toHaveLength(0);
      expect(r.indisponivel).toMatch(/fora do que se serve/);
      expect(r.indisponivel).toMatch(/1 alimento/);
    });

    it('grupo sem papel nutricional comum recusa em bloco', () => {
      const preparado = alimento({ id: 'lasanha', grupoAlimentar: 'Alimentos preparados' });
      const outro = alimento({ id: 'sopa', grupoAlimentar: 'Alimentos preparados' });
      const r = montarSubstituicoes(preparado, 100, [outro]);
      expect(r.substituicoes).toHaveLength(0);
      expect(r.indisponivel).toMatch(/Alimentos preparados/);
      expect(r.nutrienteReferencia).toBeNull();
    });

    it('alimento sem grupo recusa, em vez de comparar com a base toda', () => {
      const semGrupo = alimento({ id: 'sg', grupoAlimentar: null });
      const r = montarSubstituicoes(semGrupo, 100, [ARROZ, BATATA]);
      expect(r.substituicoes).toHaveLength(0);
      expect(r.indisponivel).toMatch(/não tem grupo alimentar/);
    });

    it('toda lista vazia tem motivo: nunca silenciosa', () => {
      const casos: Array<[AlimentoComposicao, AlimentoComposicao[]]> = [
        [alimento({ grupoAlimentar: null }), [ARROZ]],
        [alimento({ grupoAlimentar: 'Alimentos preparados' }), [ARROZ]],
        [alimento({ grupoAlimentar: 'Grupo Inventado' }), [ARROZ]],
        [alimento({ carboidratosG: 0 }), [ARROZ]],
        [ARROZ, []],
      ];
      for (const [origem, candidatos] of casos) {
        const r = montarSubstituicoes(origem, 100, candidatos);
        expect(r.substituicoes).toHaveLength(0);
        expect(r.indisponivel).toBeTruthy();
        expect(r.indisponivel!.length).toBeGreaterThan(25);
      }
    });

    it('grupo novo na base não vira troca arbitrária', () => {
      // Se a importação do IBGE trouxer um grupo que não está no mapa, a
      // lista precisa recusar — e não eleger um nutriente de referência por
      // conta própria.
      const novo = alimento({ id: 'n', grupoAlimentar: 'Preparações regionais' });
      const r = montarSubstituicoes(novo, 100, [alimento({ id: 'm', grupoAlimentar: 'Preparações regionais' })]);
      expect(r.substituicoes).toHaveLength(0);
      expect(r.indisponivel).toMatch(/ainda não tem nutriente de referência/);
    });
  });

  describe('ordenação', () => {
    it('o mais parecido nos outros macros vem primeiro', () => {
      const parecido = alimento({
        id: 'parecido', nomePadronizado: 'Parecido',
        energiaKcal: 128, proteinasG: 2.5, carboidratosG: 28, lipidiosG: 0.2, fibrasG: 1.6,
      });
      const distante = alimento({
        id: 'distante', nomePadronizado: 'Distante',
        energiaKcal: 400, proteinasG: 20, carboidratosG: 28, lipidiosG: 15, fibrasG: 0,
      });
      const r = montarSubstituicoes(ARROZ, 100, [distante, parecido]);
      expect(r.substituicoes[0].foodId).toBe('parecido');
      expect(r.substituicoes[0].distancia).toBeLessThan(r.substituicoes[1].distancia);
    });

    it('a distância ignora a referência, que está igualada', () => {
      // Dois candidatos idênticos no resto: mesma distância, embora a
      // porção equivalente de cada um seja diferente.
      const a = alimento({ id: 'a', carboidratosG: 28, energiaKcal: 128, proteinasG: 2.5, lipidiosG: 0.2 });
      const b = alimento({ id: 'b', carboidratosG: 14, energiaKcal: 64, proteinasG: 1.25, lipidiosG: 0.1 });
      const r = montarSubstituicoes(ARROZ, 100, [a, b]);
      expect(r.substituicoes[0].distancia).toBeCloseTo(r.substituicoes[1].distancia, 3);
      expect(r.substituicoes.find((s) => s.foodId === 'b')!.quantidadeG).toBeCloseTo(200, 0);
    });

    it('respeita o limite de sugestões', () => {
      const muitos = Array.from({ length: 30 }, (_, i) =>
        alimento({ id: `c${i}`, carboidratosG: 20 + i * 0.1, energiaKcal: 100 + i }));
      expect(montarSubstituicoes(ARROZ, 100, muitos, 5).substituicoes).toHaveLength(5);
    });
  });

  describe('o mapa de grupos', () => {
    it('cada um dos 15 grupos da base está coberto ou recusado, nunca omisso', () => {
      // Os 15 grupos da TACO, conferidos em produção. Grupo que não esteja
      // em nenhum dos dois mapas cai no caso genérico e some sem explicação.
      const DA_BASE = [
        'Carnes e derivados', 'Verduras, hortaliças e derivados', 'Frutas e derivados',
        'Cereais e derivados', 'Pescados e frutos do mar', 'Alimentos preparados',
        'Leguminosas e derivados', 'Leite e derivados', 'Produtos açucarados',
        'Gorduras e óleos', 'Bebidas (alcoólicas e não alcoólicas)', 'Nozes e sementes',
        'Miscelâneas', 'Ovos e derivados', 'Outros alimentos industrializados',
      ];
      for (const g of DA_BASE) {
        const coberto = g in NUTRIENTE_DO_GRUPO;
        const recusado = g in GRUPOS_SEM_EQUIVALENCIA;
        expect(coberto || recusado).toBe(true);
        expect(coberto && recusado).toBe(false);
      }
      expect(DA_BASE).toHaveLength(15);
      expect(GRUPOS_COBERTOS.length + Object.keys(GRUPOS_SEM_EQUIVALENCIA).length).toBe(15);
    });

    it('fonte de proteína não se iguala por carboidrato', () => {
      for (const g of ['Carnes e derivados', 'Pescados e frutos do mar', 'Ovos e derivados', 'Leite e derivados']) {
        expect(NUTRIENTE_DO_GRUPO[g]).toBe('proteinasG');
      }
    });

    it('hortaliça se iguala por energia, não por carboidrato', () => {
      // Igualar carboidrato entre alface e beterraba pede ~400 g de alface.
      expect(NUTRIENTE_DO_GRUPO['Verduras, hortaliças e derivados']).toBe('energiaKcal');
    });

    it('todo nutriente de referência tem rótulo em português', () => {
      for (const n of Object.values(NUTRIENTE_DO_GRUPO)) {
        expect(ROTULO_NUTRIENTE[n]).toBeTruthy();
      }
    });

    it('todo grupo recusado explica o motivo', () => {
      for (const [g, motivo] of Object.entries(GRUPOS_SEM_EQUIVALENCIA)) {
        expect(g.trim()).not.toBe('');
        expect(motivo.length).toBeGreaterThan(20);
      }
    });
  });

  describe('uma troca de proteína ponta a ponta', () => {
    const FRANGO = alimento({
      id: 'frango', nomePadronizado: 'Frango, peito, grelhado',
      grupoAlimentar: 'Carnes e derivados',
      energiaKcal: 159, proteinasG: 32, carboidratosG: 0, lipidiosG: 2.5, fibrasG: 0,
    });
    const PATINHO = alimento({
      id: 'patinho', nomePadronizado: 'Patinho, cozido',
      grupoAlimentar: 'Carnes e derivados',
      energiaKcal: 219, proteinasG: 35.9, carboidratosG: 0, lipidiosG: 7.3, fibrasG: 0,
    });

    it('iguala proteína e expõe o custo em gordura', () => {
      const r = montarSubstituicoes(FRANGO, 120, [PATINHO]);
      expect(r.rotuloReferencia).toBe('proteínas');
      expect(r.referenciaOriginal).toBeCloseTo(38.4, 1);

      const s = r.substituicoes[0];
      // 120 × (32 ÷ 35,9) = 107 g de patinho.
      expect(s.quantidadeG).toBeCloseTo(107, 0);
      expect(Math.abs(s.divergencia.proteinasG)).toBeLessThanOrEqual(0.1);
      // A troca custa gordura, e isso tem de estar visível.
      // 120 g de frango = 190,8 kcal; 107 g de patinho = 234,3 kcal.
      expect(s.divergencia.lipidiosG).toBeGreaterThan(4);
      expect(s.divergencia.kcal).toBe(43);
    });

    it('carboidrato zero nos dois não vira divisão por zero na distância', () => {
      const s = montarSubstituicoes(FRANGO, 120, [PATINHO]).substituicoes[0];
      expect(Number.isFinite(s.distancia)).toBe(true);
    });
  });
});
