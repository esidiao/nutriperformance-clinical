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

/** O subconjunto da tabela de alimentos que a conta usa. */
export interface AlimentoComposicao {
  id: string;
  nomePadronizado: string;
  grupoAlimentar: string | null;
  energiaKcal: number | null;
  proteinasG: number | null;
  carboidratosG: number | null;
  lipidiosG: number | null;
  fibrasG: number | null;
}

export type Nutriente = 'carboidratosG' | 'proteinasG' | 'lipidiosG' | 'energiaKcal';

/**
 * Qual nutriente define a equivalência, por grupo da TACO.
 *
 * Esta é uma decisão editorial declarada, não um dado da tabela: é o papel
 * que o grupo cumpre na refeição. Os 15 grupos abaixo são exatamente os que
 * existem na base (597 alimentos, conferidos em produção). Grupo que não
 * esteja aqui NÃO entra na lista — ver `GRUPOS_SEM_EQUIVALENCIA`.
 */
export const NUTRIENTE_DO_GRUPO: Record<string, Nutriente> = {
  'Cereais e derivados': 'carboidratosG',
  'Leguminosas e derivados': 'carboidratosG',
  'Frutas e derivados': 'carboidratosG',
  'Produtos açucarados': 'carboidratosG',

  'Carnes e derivados': 'proteinasG',
  'Pescados e frutos do mar': 'proteinasG',
  'Ovos e derivados': 'proteinasG',
  'Leite e derivados': 'proteinasG',

  'Gorduras e óleos': 'lipidiosG',
  'Nozes e sementes': 'lipidiosG',

  // Hortaliça se troca por volume/caloria: igualar carboidrato entre uma
  // alface e uma beterraba pede 400 g de alface, que ninguém come.
  'Verduras, hortaliças e derivados': 'energiaKcal',
  'Bebidas (alcoólicas e não alcoólicas)': 'energiaKcal',
};

/**
 * Grupos deliberadamente fora, com o motivo que a tela mostra.
 *
 * São grupos cujos integrantes não compartilham papel nutricional: dentro de
 * "Alimentos preparados" convivem lasanha e sopa de legumes. Propor troca
 * entre eles por regra de três daria um número correto e uma orientação
 * errada.
 */
export const GRUPOS_SEM_EQUIVALENCIA: Record<string, string> = {
  'Alimentos preparados':
    'são receitas inteiras, com composição que não representa um papel único na refeição',
  'Outros alimentos industrializados':
    'o grupo reúne produtos sem papel nutricional comum',
  'Miscelâneas':
    'o grupo é residual, por definição sem critério de equivalência',
};

export const ROTULO_NUTRIENTE: Record<Nutriente, string> = {
  carboidratosG: 'carboidratos',
  proteinasG: 'proteínas',
  lipidiosG: 'lipídios',
  energiaKcal: 'energia',
};

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
  origem: { foodId: string; nome: string; quantidadeG: number; grupo: string | null };
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
 * `candidatos` deve vir já filtrado pelo mesmo grupo do alimento de origem —
 * filtrar aqui exigiria carregar os 597 alimentos a cada item.
 */
export function montarSubstituicoes(
  origem: AlimentoComposicao,
  quantidadeG: number,
  candidatos: AlimentoComposicao[],
  limite = 8,
): ListaSubstituicoes {
  const grupo = origem.grupoAlimentar;
  const cabecalho = {
    origem: {
      foodId: origem.id,
      nome: origem.nomePadronizado,
      quantidadeG: arred1(quantidadeG),
      grupo,
    },
  };

  if (!grupo) {
    return {
      ...cabecalho,
      nutrienteReferencia: null, rotuloReferencia: null, referenciaOriginal: null,
      substituicoes: [],
      indisponivel: 'Este alimento não tem grupo alimentar na base, então não há conjunto onde buscar equivalentes.',
    };
  }

  if (GRUPOS_SEM_EQUIVALENCIA[grupo]) {
    return {
      ...cabecalho,
      nutrienteReferencia: null, rotuloReferencia: null, referenciaOriginal: null,
      substituicoes: [],
      indisponivel: `Não há substituição automática para "${grupo}": ${GRUPOS_SEM_EQUIVALENCIA[grupo]}.`,
    };
  }

  const nutriente = NUTRIENTE_DO_GRUPO[grupo];
  if (!nutriente) {
    return {
      ...cabecalho,
      nutrienteReferencia: null, rotuloReferencia: null, referenciaOriginal: null,
      substituicoes: [],
      indisponivel: `O grupo "${grupo}" ainda não tem nutriente de referência definido. Sem ele, qualquer troca proposta seria arbitrária.`,
    };
  }

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
