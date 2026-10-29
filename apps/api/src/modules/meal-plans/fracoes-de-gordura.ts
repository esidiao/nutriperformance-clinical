import type { Food } from '../foods/food.entity';

/**
 * Gordura saturada, trans e insaturada de um plano.
 *
 * Pedido da nutricionista (29/10/2026): ver os lipídios separados, "porque a
 * gente também tem referência para esses".
 *
 * ========================= O QUE A BASE TEM, DE FATO =======================
 *
 * Medido em 29/10/2026:
 *
 *            alimentos   com saturada   com trans
 *   TACO         597          **0**         0
 *   IBGE        1971         1814        1202
 *
 * A coluna existe desde sempre; a importação da TACO nunca a preencheu. Então
 * um plano montado só com TACO não tem o dado — e é por isso que este módulo
 * nunca soma ausência como zero. "Gordura saturada: 0 g" AFIRMA que o plano
 * não tem gordura saturada, e um plano de queijo e carne afirmando isso é o
 * pior resultado possível: a profissional aprova confiando num número que não
 * existe.
 *
 * Cada total vem com a cobertura junto (quantos itens tinham o dado), igual
 * ao que já se faz com os micronutrientes.
 *
 * ========================== A INSATURADA É DEDUZIDA ========================
 *
 * Nenhuma das duas bases traz mono ou poli-insaturada. O que dá para fazer é
 * a subtração: `insaturada = lipídio total − saturada − trans`.
 *
 * Ela é EXATA quando as três parcelas são conhecidas — não é estimativa
 * estatística, é aritmética. Mas junta mono com poli, e some inteira quando a
 * saturada falta. Por isso vem marcada como derivada, e o item que não tem
 * saturada fica de fora da soma em vez de entrar com o lipídio inteiro (o que
 * contaria todo o lipídio como insaturado).
 *
 * ======================= POR QUE MORA NO JSONB DOS MICROS ==================
 *
 * As frações são guardadas no mesmo `micronutrientes` do item, sob chaves que
 * NÃO estão em `MICRONUTRIENTES`. Consequência deliberada: `somarMicro-
 * nutrientes` itera aquela lista e portanto IGNORA estas chaves — gordura não
 * aparece no relatório de micronutrientes, onde não faz sentido.
 *
 * Alternativa seria coluna nova, e coluna nova é migração manual em produção.
 * O preço desta escolha é um campo com nome de uma coisa guardando outra, e é
 * por isso que ele está documentado aqui e tem teste provando que não vaza.
 */

export const FRACOES_DE_GORDURA = ['gorduraSaturadaG', 'gorduraTransG'] as const;
export type FracaoDeGordura = (typeof FRACOES_DE_GORDURA)[number];

const COLUNA: Record<FracaoDeGordura, keyof Food> = {
  gorduraSaturadaG: 'gorduraSaturadaG' as keyof Food,
  gorduraTransG: 'gorduraTransG' as keyof Food,
};

function finito(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/** Escala as frações conhecidas do alimento para a quantidade do item. */
export function extrairFracoesDeGordura(
  food: Food, quantidadeG: number,
): Record<string, number> {
  const fator = quantidadeG / 100;
  const out: Record<string, number> = {};
  for (const chave of FRACOES_DE_GORDURA) {
    const v = finito((food as any)[COLUNA[chave]]);
    if (v !== null) out[chave] = Math.round(v * fator * 1000) / 1000;
  }
  return out;
}

export interface TotalDeGordura {
  valor: number;
  itensComDado: number;
  itensTotal: number;
  /** false quando algum item do plano não tinha o dado. */
  completo: boolean;
  /** Obtida por subtração, não medida na base. */
  derivada?: boolean;
}

export interface GordurasDoPlano {
  saturadaG: TotalDeGordura | null;
  transG: TotalDeGordura | null;
  /** `lipídio − saturada − trans`, só com os itens que têm as três parcelas. */
  insaturadaG: TotalDeGordura | null;
}

interface ItemDeGordura {
  lipidiosG?: number | string | null;
  micronutrientes?: Record<string, number> | null;
}

/**
 * Soma as frações do plano, com a cobertura.
 *
 * `null` quando NENHUM item tem o dado — e null não é zero: a tela mostra
 * "sem dado na base" em vez de um total que parece medido.
 */
export function somarFracoesDeGordura(itens: ItemDeGordura[]): GordurasDoPlano {
  const total = itens.length;

  const somar = (chave: FracaoDeGordura): TotalDeGordura | null => {
    let soma = 0;
    let com = 0;
    for (const i of itens) {
      const v = finito(i.micronutrientes?.[chave]);
      if (v === null) continue;
      soma += v;
      com++;
    }
    if (com === 0) return null;
    return {
      valor: Math.round(soma * 100) / 100,
      itensComDado: com,
      itensTotal: total,
      completo: com === total,
    };
  };

  const saturadaG = somar('gorduraSaturadaG');
  const transG = somar('gorduraTransG');

  // A insaturada só conta o item que tem lipídio E saturada. Sem saturada,
  // entrar com o lipídio inteiro contaria tudo como insaturado — numero
  // plausivel e falso.
  let somaInsat = 0;
  let comInsat = 0;
  for (const i of itens) {
    const lip = finito(i.lipidiosG);
    const sat = finito(i.micronutrientes?.gorduraSaturadaG);
    if (lip === null || sat === null) continue;
    const trans = finito(i.micronutrientes?.gorduraTransG) ?? 0;
    // Arredondamento da base pode deixar a conta levemente negativa; o chão
    // em zero evita "−0,3 g de insaturada", que nao existe.
    somaInsat += Math.max(0, lip - sat - trans);
    comInsat++;
  }

  const insaturadaG: TotalDeGordura | null = comInsat === 0 ? null : {
    valor: Math.round(somaInsat * 100) / 100,
    itensComDado: comInsat,
    itensTotal: total,
    completo: comInsat === total,
    derivada: true,
  };

  return { saturadaG, transG, insaturadaG };
}
