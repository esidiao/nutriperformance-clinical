/**
 * Lista de substituições — lacuna 8 do benchmark.
 *
 * O QUE É UMA SUBSTITUIÇÃO EQUIVALENTE
 *
 * Trocar 50 g de arroz por 50 g de batata não é substituir: é mudar a
 * prescrição. O que torna a troca equivalente é a quantidade ser recalculada
 * para entregar a mesma coisa que o alimento original entregava NAQUELA
 * refeição — e o que ele entregava depende do grupo a que pertence.
 *
 * Então a conta tem duas partes, e as duas ficam visíveis na tela:
 *
 *   1. o nutriente de referência do grupo (declarado em NUTRIENTE_DO_GRUPO);
 *   2. a regra de três sobre ele:
 *
 *        quantidade_equivalente = quantidade_original
 *                                 × (referência_original / referência_substituto)
 *
 * POR QUE A DIVERGÊNCIA DOS OUTROS MACROS APARECE
 *
 * Igualar o carboidrato de duas fontes de carboidrato não iguala o resto.
 * 100 g de arroz cozido e o equivalente em carboidrato de batata não têm a
 * mesma proteína nem as mesmas calorias. Omitir isso faria a lista parecer
 * uma tabela de trocas livres, e ela não é. Cada sugestão carrega o desvio
 * calculado, e quem decide se o desvio é aceitável é a profissional.
 *
 * O QUE ESTA LISTA NÃO FAZ
 *
 * Não considera alergia, intolerância, preferência, aversão, custo nem
 * cultura alimentar — nada disso está na tabela de composição. A troca
 * proposta é aritmética sobre a composição; a indicação clínica é da
 * nutricionista.
 */

import {
  classificarGrupoTroca, NUTRIENTE_DO_GRUPO, ROTULO_NUTRIENTE,
  type GrupoTroca, type Nutriente, type ParaClassificar,
} from './grupos-troca';

export type { GrupoTroca, Nutriente };

/** O subconjunto da tabela de alimentos que a conta usa. */
export interface AlimentoComposicao extends ParaClassificar {
  id: string;
  fibrasG: number | null;
}

export interface Divergencia {
  /** Diferença absoluta na porção equivalente, não por 100 g. */
  kcal: number;
  proteinasG: number;
  carboidratosG: number;
  lipidiosG: number;
  fibrasG: number;
}

export interface Substituicao {
  foodId: string;
  nome: string;
  /** Gramas que entregam o mesmo tanto do nutriente de referência. */
  quantidadeG: number;
  /** A conta, em texto, para a profissional conferir. */
  calculo: string;
  divergencia: Divergencia;
  /**
   * Soma dos desvios relativos dos macros que NÃO são a referência.
   * Serve só para ordenar: quanto menor, mais parecida é a troca.
   */
  distancia: number;
  /** Porção fora do que se come numa refeição — some, não é erro. */
  porcaoImplausivel: boolean;
}

export interface ListaSubstituicoes {
  origem: {
    foodId: string; nome: string; quantidadeG: number;
    grupo: GrupoTroca | null;
    /** A composicao contrariou a taxonomia da TACO. */
    reclassificado: boolean;
  };
  nutrienteReferencia: Nutriente | null;
  rotuloReferencia: string | null;
  /** Quanto do nutriente de referência a porção original entrega. */
  referenciaOriginal: number | null;
  substituicoes: Substituicao[];
  /** Por que a lista está vazia, quando está. Nunca silencioso. */
  indisponivel: string | null;
}

const num = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

/** Composição por 100 g escalada para a porção. */
const escalar = (porCem: unknown, gramas: number) => (num(porCem) * gramas) / 100;

const arred1 = (n: number) => Math.round(n * 10) / 10;

/**
 * Porção que ninguém serve.
 *
 * Fora desta faixa a troca é aritmeticamente correta e clinicamente
 * inútil — 900 g de alface para igualar uma beterraba. Some da lista, mas é
 * contada, porque "nenhuma sugestão" e "só sugestões absurdas" são situações
 * diferentes.
 */
const MIN_G = 1;
const MAX_G = 600;

/**
 * Monta a lista para UM item do plano.
 *
 * `candidatos` pode vir com a base inteira: a filtragem pelo grupo de troca
 * acontece AQUI, porque o grupo é derivado da composição e não existe como
 * coluna para consultar. Passar uma lista já filtrada por grupo da TACO
 * deixaria de fora justamente as reclassificações — o abacate não estaria
 * entre os candidatos de uma castanha.
 */
export function montarSubstituicoes(
  origem: AlimentoComposicao,
  quantidadeG: number,
  candidatos: AlimentoComposicao[],
  limite = 8,
): ListaSubstituicoes {
  const classificacao = classificarGrupoTroca(origem);
  const grupo = classificacao.grupo;
  const cabecalho = {
    origem: {
      foodId: origem.id,
      nome: origem.nomePadronizado,
      quantidadeG: arred1(quantidadeG),
      grupo,
      /** Quando a composição contrariou a taxonomia da TACO. */
      reclassificado: classificacao.reclassificado ?? false,
    },
  };

  const vazio = {
    nutrienteReferencia: null, rotuloReferencia: null, referenciaOriginal: null,
    substituicoes: [],
  };

  if (!grupo) {
    return { ...cabecalho, ...vazio, indisponivel: classificacao.motivo ?? null };
  }

  const nutriente = NUTRIENTE_DO_GRUPO[grupo];

  const rotulo = ROTULO_NUTRIENTE[nutriente];
  const refOrigem = escalar(origem[nutriente], quantidadeG);

  // Referência zero ou ausente: a regra de três não tem o que igualar.
  if (refOrigem <= 0) {
    return {
      ...cabecalho,
      nutrienteReferencia: nutriente, rotuloReferencia: rotulo, referenciaOriginal: 0,
      substituicoes: [],
      indisponivel: `A porção de origem não registra ${rotulo}, que é o nutriente de referência deste grupo — não há valor a igualar.`,
    };
  }

  const alvo = {
    kcal: escalar(origem.energiaKcal, quantidadeG),
    proteinasG: escalar(origem.proteinasG, quantidadeG),
    carboidratosG: escalar(origem.carboidratosG, quantidadeG),
    lipidiosG: escalar(origem.lipidiosG, quantidadeG),
    fibrasG: escalar(origem.fibrasG, quantidadeG),
  };

  const brutas: Substituicao[] = [];

  for (const c of candidatos) {
    if (c.id === origem.id) continue;
    // O grupo de troca é derivado, não consultável: filtra aqui.
    if (classificarGrupoTroca(c).grupo !== grupo) continue;

    const porCem = num(c[nutriente]);
    // Divisão por zero devolveria Infinity, e Infinity formatado vira uma
    // porção plausível de tão grande. Fora da lista.
    if (porCem <= 0) continue;

    const gramas = (refOrigem * 100) / porCem;

    const atual = {
      kcal: escalar(c.energiaKcal, gramas),
      proteinasG: escalar(c.proteinasG, gramas),
      carboidratosG: escalar(c.carboidratosG, gramas),
      lipidiosG: escalar(c.lipidiosG, gramas),
      fibrasG: escalar(c.fibrasG, gramas),
    };

    // Distância usa só os macros que NÃO são a referência: a referência está
    // igualada por construção, incluí-la não distinguiria candidato nenhum.
    const comparar: Array<keyof typeof atual> = (
      ['kcal', 'proteinasG', 'carboidratosG', 'lipidiosG'] as Array<keyof typeof atual>
    ).filter((k) => !mesmoNutriente(k, nutriente));

    let distancia = 0;
    for (const k of comparar) {
      const base = alvo[k];
      distancia += base > 0
        ? Math.abs(atual[k] - base) / base
        // Alvo zero: qualquer quantidade é desvio infinito em termos
        // relativos. Usa o valor absoluto normalizado para não descartar.
        : Math.min(Math.abs(atual[k]) / 10, 3);
    }

    brutas.push({
      foodId: c.id,
      nome: c.nomePadronizado,
      quantidadeG: arred1(gramas),
      calculo:
        `${arred1(quantidadeG)} g × (${arred1(num(origem[nutriente]))} ÷ ${arred1(porCem)}) = ` +
        `${arred1(gramas)} g — iguala ${arred1(refOrigem)} de ${rotulo}`,
      divergencia: {
        kcal: Math.round(atual.kcal - alvo.kcal),
        proteinasG: arred1(atual.proteinasG - alvo.proteinasG),
        carboidratosG: arred1(atual.carboidratosG - alvo.carboidratosG),
        lipidiosG: arred1(atual.lipidiosG - alvo.lipidiosG),
        fibrasG: arred1(atual.fibrasG - alvo.fibrasG),
      },
      distancia: Math.round(distancia * 1000) / 1000,
      porcaoImplausivel: gramas < MIN_G || gramas > MAX_G,
    });
  }

  const viaveis = brutas.filter((s) => !s.porcaoImplausivel);
  const ordenadas = viaveis.sort((a, b) => a.distancia - b.distancia).slice(0, limite);

  let indisponivel: string | null = null;
  if (!ordenadas.length) {
    indisponivel = brutas.length
      ? `Os ${brutas.length} alimento(s) do grupo "${grupo}" exigiriam porções fora do que se serve numa refeição (abaixo de ${MIN_G} g ou acima de ${MAX_G} g) para igualar ${arred1(refOrigem)} de ${rotulo}.`
      : `Nenhum outro alimento do grupo "${grupo}" registra ${rotulo} na base.`;
  }

  return {
    ...cabecalho,
    nutrienteReferencia: nutriente,
    rotuloReferencia: rotulo,
    referenciaOriginal: arred1(refOrigem),
    substituicoes: ordenadas,
    indisponivel,
  };
}

/** `energiaKcal` no alimento é `kcal` na divergência — os nomes diferem. */
function mesmoNutriente(chaveDivergencia: string, nutriente: Nutriente): boolean {
  return nutriente === 'energiaKcal'
    ? chaveDivergencia === 'kcal'
    : chaveDivergencia === nutriente;
}

/** Grupos que a lista cobre. A tela usa para explicar a cobertura. */
export const GRUPOS_COBERTOS = Object.keys(NUTRIENTE_DO_GRUPO);

export { classificarGrupoTroca, NUTRIENTE_DO_GRUPO, ROTULO_NUTRIENTE };
