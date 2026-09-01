import { MealPlanItem } from './meal-plan-item.entity';

/**
 * Lista de compras derivada do plano alimentar — lacuna 7 do benchmark.
 *
 * NÃO é uma tabela. A lista é calculada na leitura, de propósito: gravada,
 * ela envelheceria no instante em que a profissional trocasse um alimento do
 * plano, e uma lista que discorda silenciosamente do plano é pior que lista
 * nenhuma — o paciente compra o que não vai comer.
 */

/**
 * Seções de supermercado a partir do grupo alimentar da TACO.
 *
 * Os 15 grupos abaixo são exatamente os que existem na base (597 alimentos,
 * conferidos em produção). O mapa é exaustivo por escolha: qualquer grupo novo
 * cai em OUTROS e aparece rotulado, nunca some da lista.
 */
export const SECOES: Record<string, string> = {
  'Frutas e derivados': 'Hortifrúti',
  'Verduras, hortaliças e derivados': 'Hortifrúti',
  'Carnes e derivados': 'Açougue e peixaria',
  'Pescados e frutos do mar': 'Açougue e peixaria',
  'Ovos e derivados': 'Ovos e laticínios',
  'Leite e derivados': 'Ovos e laticínios',
  'Cereais e derivados': 'Mercearia',
  'Leguminosas e derivados': 'Mercearia',
  'Nozes e sementes': 'Mercearia',
  'Gorduras e óleos': 'Mercearia',
  'Produtos açucarados': 'Mercearia',
  'Alimentos preparados': 'Mercearia',
  'Outros alimentos industrializados': 'Mercearia',
  'Miscelâneas': 'Mercearia',
  'Bebidas (alcoólicas e não alcoólicas)': 'Bebidas',
};

const OUTROS = 'Outros';

/** Ordem de percurso no mercado, não alfabética. */
export const ORDEM_SECOES = [
  'Hortifrúti', 'Açougue e peixaria', 'Ovos e laticínios',
  'Mercearia', 'Bebidas', OUTROS,
];

export interface ItemCompra {
  nome: string;
  totalG: number;
  /** Em quantas refeições do dia o alimento aparece. */
  ocorrencias: number;
  /**
   * Medida caseira só quando TODAS as ocorrências usam a mesma. Somar
   * "2 colheres" com "1 fatia" produziria uma medida que não existe.
   */
  medidaCaseira: string | null;
  quantidadeMedidas: number | null;
  secao: string;
}

export interface ListaCompras {
  dias: number;
  secoes: { secao: string; itens: ItemCompra[] }[];
  totalItens: number;
  /** Itens digitados à mão, sem vínculo com a base. */
  semVinculo: number;
}

const semAcento = (s: string) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

/**
 * Agrupa os itens do plano e multiplica pelos dias.
 *
 * O plano é um cardápio de UM dia (refeições com horário), então comprar para
 * a semana é multiplicar. Se um dia o plano virar semanal de verdade, esta
 * conta muda — e é por isso que ela mora aqui, sozinha, e não espalhada na
 * tela.
 *
 * A chave de agrupamento é o `foodId` quando existe. Só cai no nome
 * normalizado para item digitado à mão: dois alimentos diferentes da base
 * podem ter nomes parecidos, e fundi-los somaria quantidades de coisas
 * distintas.
 */
export function montarListaCompras(
  itens: MealPlanItem[],
  grupoPorFoodId: Map<string, string | null>,
  dias: number,
): ListaCompras {
  const acumulado = new Map<string, {
    nome: string; totalG: number; ocorrencias: number;
    medidas: Set<string>; quantidadeMedidas: number; secao: string;
  }>();

  let semVinculo = 0;

  for (const item of itens) {
    const chave = item.foodId ?? `nome:${semAcento(item.alimentoNome)}`;
    if (!item.foodId) semVinculo++;

    const grupo = item.foodId ? grupoPorFoodId.get(item.foodId) ?? null : null;
    const secao = (grupo && SECOES[grupo]) || OUTROS;

    const atual = acumulado.get(chave) ?? {
      nome: item.alimentoNome, totalG: 0, ocorrencias: 0,
      medidas: new Set<string>(), quantidadeMedidas: 0, secao,
    };

    // quantidade_g vem do Postgres como numeric — string em JavaScript.
    atual.totalG += Number(item.quantidadeG) || 0;
    atual.ocorrencias += 1;
    if (item.medidaCaseira?.trim()) {
      atual.medidas.add(item.medidaCaseira.trim());
      atual.quantidadeMedidas += 1;
    }
    acumulado.set(chave, atual);
  }

  const porSecao = new Map<string, ItemCompra[]>();

  for (const a of acumulado.values()) {
    // Uma medida só, e presente em todas as ocorrências: aí somar faz sentido.
    const unanime = a.medidas.size === 1 && a.quantidadeMedidas === a.ocorrencias;
    const item: ItemCompra = {
      nome: a.nome,
      totalG: Math.round(a.totalG * dias * 100) / 100,
      ocorrencias: a.ocorrencias,
      medidaCaseira: unanime ? [...a.medidas][0] : null,
      quantidadeMedidas: unanime ? a.ocorrencias * dias : null,
      secao: a.secao,
    };
    porSecao.set(a.secao, [...(porSecao.get(a.secao) ?? []), item]);
  }

  const secoes = ORDEM_SECOES
    .filter((s) => porSecao.has(s))
    .map((s) => ({
      secao: s,
      itens: porSecao.get(s)!.sort((x, y) => x.nome.localeCompare(y.nome, 'pt-BR')),
    }));

  return {
    dias,
    secoes,
    totalItens: acumulado.size,
    semVinculo,
  };
}

/** Gramas para leitura humana. Acima de 1 kg, quilo. */
export function formatarQuantidade(gramas: number): string {
  if (gramas >= 1000) {
    const kg = gramas / 1000;
    return `${kg.toLocaleString('pt-BR', { maximumFractionDigits: 2 })} kg`;
  }
  return `${gramas.toLocaleString('pt-BR', { maximumFractionDigits: 0 })} g`;
}
