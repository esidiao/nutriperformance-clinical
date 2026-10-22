import {
  montarSubstituicoes,
  type AlimentoComposicao,
} from './substituicoes';
import {
  classificarGrupoTroca, NUTRIENTE_DO_GRUPO, ROTULO_NUTRIENTE, GRUPOS_TROCA,
  LIPIDIO_PURO, LIPIDIO_MAGRO, DENSIDADE_LACTEO,
} from './grupos-troca';

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

    it('condimento recusa, porque nao e porcao de nada', () => {
      const shoyu = alimento({ id: 'shoyu', grupoAlimentar: 'Miscelaneas' });
      const r = montarSubstituicoes(shoyu, 100, [alimento({ id: 'o', grupoAlimentar: 'Miscelaneas' })]);
      expect(r.substituicoes).toHaveLength(0);
      expect(r.indisponivel).toMatch(/condimento|tempero/i);
      expect(r.nutrienteReferencia).toBeNull();
    });

    it('alimento sem grupo E com nome desconhecido recusa, em vez de comparar com a base toda', () => {
      // O motivo mudou de texto em 22/10/2026, nao de sentido: alimento sem
      // grupo da TACO passou a tentar a classificacao por NOME antes de
      // desistir (familias-por-nome.ts). Com nome que nenhuma familia
      // reivindica, a recusa continua -- e e ela que este teste protege.
      const semGrupo = alimento({
        id: 'sg', grupoAlimentar: null, nomePadronizado: 'XIRIMBABO DO AGRESTE',
      });
      const r = montarSubstituicoes(semGrupo, 100, [ARROZ, BATATA]);
      expect(r.substituicoes).toHaveLength(0);
      expect(r.indisponivel).toMatch(/nao casa com nenhuma familia|não casa com nenhuma família/);
    });

    it('alimento sem grupo mas com nome conhecido agora RECEBE troca', () => {
      // O outro lado da mudanca, e o motivo dela: 1971 dos 2568 alimentos da
      // base nao tem grupo da TACO (o IBGE nao publica grupo), e TODOS os 1967
      // que tem medida caseira estavam entre eles. Sem isto, a lista de trocas
      // nao servia para 77% da base.
      const batataIbge = alimento({
        id: 'bi', grupoAlimentar: null, nomePadronizado: 'BATATA-INGLESA, cozido(a)',
        carboidratosG: 20, proteinasG: 2, lipidiosG: 0.1, energiaKcal: 90,
      });
      const r = montarSubstituicoes(batataIbge, 100, [ARROZ, BATATA]);
      expect(r.indisponivel).toBeFalsy();
      expect(r.substituicoes.length).toBeGreaterThan(0);
    });

    it('o MESMO alimento em outra preparacao nao conta como troca', () => {
      // O IBGE cadastra cada preparacao como registro proprio. Sem o filtro,
      // as primeiras opcoes de batata cozida eram batata crua, batata assada
      // e batata grelhada -- a lista ocupada sem dar escolha nenhuma.
      const cozida = alimento({
        id: 'b1', grupoAlimentar: null, nomePadronizado: 'BATATA-INGLESA, cozido(a)',
        carboidratosG: 20, proteinasG: 2, lipidiosG: 0.1, energiaKcal: 90,
      });
      const crua = alimento({
        id: 'b2', grupoAlimentar: null, nomePadronizado: 'BATATA-INGLESA, cru(a)',
        carboidratosG: 20, proteinasG: 2, lipidiosG: 0.1, energiaKcal: 90,
      });
      const r = montarSubstituicoes(cozida, 100, [crua, ARROZ]);
      expect(r.substituicoes.map((x) => x.foodId)).not.toContain('b2');
    });

    it('uma opcao por ALIMENTO, nao uma por preparacao', () => {
      // Tres preparacoes do mesmo alimento ocupavam tres lugares da lista.
      // "Evita monotonia" foi o pedido da nutricionista, e repetir o mesmo
      // alimento em quatro cozimentos e justamente a monotonia.
      const origem = alimento({
        id: 'o', grupoAlimentar: null, nomePadronizado: 'FEIJAO (PRETO)',
        carboidratosG: 14, proteinasG: 5, lipidiosG: 0.5, energiaKcal: 77,
      });
      const preparacoes = ['cru(a)', 'cozido(a)', 'ensopado'].map((prep, i) => alimento({
        id: `l${i}`, grupoAlimentar: null, nomePadronizado: `LENTILHA, ${prep}`,
        carboidratosG: 16, proteinasG: 6, lipidiosG: 0.5, energiaKcal: 93,
      }));
      const r = montarSubstituicoes(origem, 100, preparacoes);
      const lentilhas = r.substituicoes.filter((x) => x.nome.startsWith('LENTILHA'));
      expect(lentilhas).toHaveLength(1);
    });

    it('toda lista vazia tem motivo: nunca silenciosa', () => {
      const casos: Array<[AlimentoComposicao, AlimentoComposicao[]]> = [
        [alimento({ grupoAlimentar: null }), [ARROZ]],
        [alimento({ grupoAlimentar: 'Miscelâneas' }), [ARROZ]],
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
      expect(r.indisponivel).toMatch(/ainda não tem regra de classificação/);
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
      // Nomes DISTINTOS de proposito: a lista passou a devolver uma opcao por
      // alimento, e o `alimento()` nomeia todo mundo igual por padrao. Na base
      // real nao existem dois registros com o mesmo nome.
      const a = alimento({ id: 'a', nomePadronizado: 'Alimento A', carboidratosG: 28, energiaKcal: 128, proteinasG: 2.5, lipidiosG: 0.2 });
      const b = alimento({ id: 'b', nomePadronizado: 'Alimento B', carboidratosG: 14, energiaKcal: 64, proteinasG: 1.25, lipidiosG: 0.1 });
      const r = montarSubstituicoes(ARROZ, 100, [a, b]);
      expect(r.substituicoes[0].distancia).toBeCloseTo(r.substituicoes[1].distancia, 3);
      expect(r.substituicoes.find((s) => s.foodId === 'b')!.quantidadeG).toBeCloseTo(200, 0);
    });

    it('respeita o limite de sugestões', () => {
      const muitos = Array.from({ length: 30 }, (_, i) =>
        alimento({
          id: `c${i}`, nomePadronizado: `Alimento ${i}`,
          carboidratosG: 20 + i * 0.1, energiaKcal: 100 + i,
        }));
      expect(montarSubstituicoes(ARROZ, 100, muitos, 5).substituicoes).toHaveLength(5);
    });
  });

  describe('a taxonomia de troca', () => {
    const classificar = (over: Partial<AlimentoComposicao>) =>
      classificarGrupoTroca(alimento(over)).grupo;

    it('tuberculo sai de hortalicas e vai para os cereais', () => {
      // Decisao da profissional: batata-doce troca com arroz no almoco, nao
      // com alface. A TACO guarda tuberculo em "Verduras e hortalicas".
      for (const nome of ['Batata, doce, cozida', 'Mandioca, cozida', 'Inhame, cru', 'Cará, cozido']) {
        expect(classificar({
          nomePadronizado: nome, grupoAlimentar: 'Verduras, hortaliças e derivados',
          energiaKcal: 77, carboidratosG: 18, proteinasG: 1, lipidiosG: 0.1,
        })).toBe('Cereais, pães e tubérculos');
      }
      expect(classificar({
        nomePadronizado: 'Alface, crespa, crua', grupoAlimentar: 'Verduras, hortaliças e derivados',
        energiaKcal: 15, carboidratosG: 2.4, proteinasG: 1.3, lipidiosG: 0.2,
      })).toBe('Hortaliças e vegetais');
    });

    it('o limite de palavra acentuado funciona nos dois sentidos', () => {
      // CATRACA. A versão anterior usava `\b`, que em JavaScript só conhece
      // letras ASCII: "Cará, cozido" nunca casava, e o cará caía calado em
      // hortaliças enquanto batata e inhame eram reclassificados. Metade da
      // regra funcionando é pior que a regra ausente, porque ninguém
      // desconfia. Estes dois casos provam o lookahead nos dois sentidos.
      expect(classificar({
        nomePadronizado: 'Cará, cozido', grupoAlimentar: 'Verduras, hortaliças e derivados',
        energiaKcal: 97, carboidratosG: 23, proteinasG: 2, lipidiosG: 0.2,
      })).toBe('Cereais, pães e tubérculos');

      // E continua NÃO casando palavras que só começam igual.
      for (const nome of ['Caramelo, bala', 'Caranguejo, cozido', 'Batatinha, doce']) {
        expect(classificar({
          nomePadronizado: nome, grupoAlimentar: 'Verduras, hortaliças e derivados',
          energiaKcal: 40, carboidratosG: 8, proteinasG: 1, lipidiosG: 0.2,
        })).toBe('Hortaliças e vegetais');
      }
    });

    it('batata chips é ultraprocessado, não tubérculo', () => {
      // Mesma razão do biscoito: oferecê-la como troca de arroz numa lista
      // que vai para a mão do paciente é dar permissão. E ela escapava da
      // regra da gordura por pouco — 58% da energia, contra o corte de 60.
      expect(classificar({
        nomePadronizado: 'Batata, frita, tipo chips, industrializada',
        grupoAlimentar: 'Verduras, hortaliças e derivados',
        energiaKcal: 543, carboidratosG: 50.3, proteinasG: 5.6, lipidiosG: 35,
      })).toBe('Açúcares e ultraprocessados');

      // A batata que não é chips continua tubérculo.
      expect(classificar({
        nomePadronizado: 'Batata, inglesa, cozida',
        grupoAlimentar: 'Verduras, hortaliças e derivados',
        energiaKcal: 52, carboidratosG: 11.9, proteinasG: 1.2, lipidiosG: 0,
      })).toBe('Cereais, pães e tubérculos');
    });

    it('biscoito e bolo nao sao troca de arroz', () => {
      // A lista vai para a mao do paciente: o que estiver nela e permissao.
      for (const nome of ['Biscoito, doce, wafer, recheado', 'Bolo, pronto, coco', 'Bolo, mistura para']) {
        expect(classificar({
          nomePadronizado: nome, grupoAlimentar: 'Cereais e derivados',
          energiaKcal: 502, carboidratosG: 67, proteinasG: 5, lipidiosG: 24,
        })).toBe('Açúcares e ultraprocessados');
      }
      expect(classificar({
        nomePadronizado: 'Arroz, integral, cozido', grupoAlimentar: 'Cereais e derivados',
        energiaKcal: 124, carboidratosG: 25.8, proteinasG: 2.6, lipidiosG: 1,
      })).toBe('Cereais, pães e tubérculos');
    });

    it('fruta gorda vai com as oleaginosas', () => {
      // Abacate troca com castanha, nao com maca.
      expect(classificar({
        nomePadronizado: 'Abacate, cru', grupoAlimentar: 'Frutas e derivados',
        energiaKcal: 96, carboidratosG: 6, proteinasG: 1.2, lipidiosG: 8.4,
      })).toBe('Gorduras e oleaginosas');
      expect(classificar({
        nomePadronizado: 'Maçã, Fuji, com casca, crua', grupoAlimentar: 'Frutas e derivados',
        energiaKcal: 56, carboidratosG: 15.2, proteinasG: 0.3, lipidiosG: 0,
      })).toBe('Frutas');
    });

    it('carne gorda continua carne: origem manda sobre percentual', () => {
      // Costela tem 81% da energia em gordura e nao e azeite.
      expect(classificar({
        nomePadronizado: 'Carne, bovina, costela, crua', grupoAlimentar: 'Carnes e derivados',
        energiaKcal: 358, carboidratosG: 0, proteinasG: 16.9, lipidiosG: 32.3,
      })).toBe('Proteínas gordas');
      expect(classificar({
        nomePadronizado: 'Frango, peito, grelhado', grupoAlimentar: 'Carnes e derivados',
        energiaKcal: 159, carboidratosG: 0, proteinasG: 32, lipidiosG: 2.5,
      })).toBe('Proteínas magras');
    });

    it('feijao e leguminosa, nao proteina', () => {
      // Decisao da profissional: a origem manda, ainda que o feijao tenha
      // proteina suficiente para cair no grupo das proteinas.
      expect(classificar({
        nomePadronizado: 'Feijão, carioca, cozido', grupoAlimentar: 'Leguminosas e derivados',
        energiaKcal: 76, carboidratosG: 13.6, proteinasG: 4.8, lipidiosG: 0.5,
      })).toBe('Leguminosas');
    });

    it('leite se separa de queijo por concentracao, nao por gordura', () => {
      // Leite integral tem ~50% da energia em gordura e continua leite.
      expect(classificar({
        nomePadronizado: 'Leite, de vaca, integral', grupoAlimentar: 'Leite e derivados',
        energiaKcal: 61, carboidratosG: 4.7, proteinasG: 3.2, lipidiosG: 3.3,
      })).toBe('Leites e iogurtes');
      expect(classificar({
        nomePadronizado: 'Queijo, prato', grupoAlimentar: 'Leite e derivados',
        energiaKcal: 360, carboidratosG: 1.9, proteinasG: 22.7, lipidiosG: 29.1,
      })).toBe('Queijos');
      expect(DENSIDADE_LACTEO).toBe(100);
    });

    it('preparacao pronta se classifica pelo macro dominante', () => {
      expect(classificar({
        nomePadronizado: 'Feijoada', grupoAlimentar: 'Alimentos preparados',
        energiaKcal: 117, carboidratosG: 4, proteinasG: 8.6, lipidiosG: 7.1,
      })).toBe('Proteínas gordas');
      expect(classificar({
        nomePadronizado: 'Tabule', grupoAlimentar: 'Alimentos preparados',
        energiaKcal: 64, carboidratosG: 12, proteinasG: 1.6, lipidiosG: 1.1,
      })).toBe('Cereais, pães e tubérculos');
    });

    it('condimento nao e porcao e fica fora, com motivo', () => {
      const c = classificarGrupoTroca(alimento({
        nomePadronizado: 'Shoyu', grupoAlimentar: 'Miscelâneas',
        energiaKcal: 61, carboidratosG: 5.5, proteinasG: 6, lipidiosG: 0.1,
      }));
      expect(c.grupo).toBeNull();
      expect(c.motivo).toMatch(/condimento|tempero/i);
    });

    it('alimento sem macros na base fica fora, com motivo', () => {
      const c = classificarGrupoTroca(alimento({
        nomePadronizado: 'Leite, de vaca, integral', grupoAlimentar: 'Leite e derivados',
        energiaKcal: 61, carboidratosG: 0, proteinasG: 0, lipidiosG: 0,
      }));
      expect(c.grupo).toBeNull();
      expect(c.motivo).toMatch(/macronutrientes/i);
    });

    it('marca as reclassificacoes, para a tela poder explicar', () => {
      const abacate = classificarGrupoTroca(alimento({
        nomePadronizado: 'Abacate, cru', grupoAlimentar: 'Frutas e derivados',
        energiaKcal: 96, carboidratosG: 6, proteinasG: 1.2, lipidiosG: 8.4,
      }));
      expect(abacate.reclassificado).toBe(true);

      const azeite = classificarGrupoTroca(alimento({
        nomePadronizado: 'Azeite, de oliva, extra virgem', grupoAlimentar: 'Gorduras e óleos',
        energiaKcal: 884, carboidratosG: 0, proteinasG: 0, lipidiosG: 100,
      }));
      expect(azeite.reclassificado).toBe(false);
    });

    it('todo grupo tem nutriente de referencia, e o mapa e exaustivo', () => {
      // O Record<GrupoTroca, Nutriente> faz o compilador exigir isto; o
      // teste trava que nenhum grupo caia num padrao silencioso em runtime.
      expect(GRUPOS_TROCA).toHaveLength(11);
      for (const g of GRUPOS_TROCA) {
        expect(NUTRIENTE_DO_GRUPO[g]).toBeTruthy();
        expect(ROTULO_NUTRIENTE[NUTRIENTE_DO_GRUPO[g]]).toBeTruthy();
      }
    });

    it('fonte de proteina nao se iguala por carboidrato', () => {
      for (const g of ['Proteínas magras', 'Proteínas gordas', 'Leites e iogurtes', 'Queijos'] as const) {
        expect(NUTRIENTE_DO_GRUPO[g]).toBe('proteinasG');
      }
    });

    it('hortalica se iguala por energia, nao por carboidrato', () => {
      // Igualar carboidrato entre alface e beterraba pede ~400 g de alface.
      expect(NUTRIENTE_DO_GRUPO['Hortaliças e vegetais']).toBe('energiaKcal');
    });

    it('os limiares sao constantes nomeadas, nao numeros soltos', () => {
      expect(LIPIDIO_PURO).toBe(60);
      expect(LIPIDIO_MAGRO).toBe(35);
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

  describe('a medida caseira na sugestao', () => {
    // A lista vai para a mao do paciente: "235 g de batata" exige balanca,
    // e a troca correta vira troca nao feita.

    const BATATA_COM_MEDIDA = {
      ...BATATA,
      medidas: [
        { medida: 'colher de servir', gramas: 60, padrao: true },
        { medida: 'unidade media', gramas: 120, padrao: false },
      ],
    };

    it('traduz a quantidade equivalente para medida caseira', () => {
      // 100 g de arroz = 28 g de carboidrato = 235,3 g de batata.
      // 2 unidades medias pesam 240 g: 2% de desvio, dentro do aceitavel.
      const s = montarSubstituicoes(ARROZ, 100, [BATATA_COM_MEDIDA]).substituicoes[0];
      expect(s.medidaCaseira).not.toBeNull();
      expect(s.medidaTexto).toBe('2 unidades medias');
      expect(s.medidaCaseira!.gramasReais).toBe(240);
    });

    it('o peso REAL da medida vem junto, nao o alvo', () => {
      // Sem isto a aproximacao viraria afirmacao falsa: a tela diria
      // "2 unidades" como se pesassem os 235,3 g que a conta pediu.
      const s = montarSubstituicoes(ARROZ, 100, [BATATA_COM_MEDIDA]).substituicoes[0];
      expect(s.medidaCaseira!.gramasReais).not.toBe(s.quantidadeG);
      expect(s.medidaCaseira!.desvioG).toBeGreaterThan(0);
    });

    it('alimento sem medida devolve null, e a tela mostra gramas', () => {
      // E o caso de toda a TACO, que nao publica medida caseira.
      const s = montarSubstituicoes(ARROZ, 100, [BATATA]).substituicoes[0];
      expect(s.medidaCaseira).toBeNull();
      expect(s.medidaTexto).toBeNull();
      expect(s.quantidadeG).toBeGreaterThan(0);
    });

    it('recusa a medida quando nenhuma chega perto, em vez de forcar', () => {
      const soConcha = { ...BATATA, medidas: [{ medida: 'concha', gramas: 500, padrao: true }] };
      const s = montarSubstituicoes(ARROZ, 100, [soConcha]).substituicoes[0];
      // 235 g contra uma concha de 500: metade sao 250, 6% de desvio -> cabe.
      // Entao o caso de recusa precisa de uma medida ainda mais distante.
      const soEnorme = { ...BATATA, medidas: [{ medida: 'saco', gramas: 5000, padrao: true }] };
      const t = montarSubstituicoes(ARROZ, 100, [soEnorme]).substituicoes[0];
      expect(t.medidaCaseira).toBeNull();
      expect(s.medidaCaseira).not.toBeNull();
    });
  });
});
