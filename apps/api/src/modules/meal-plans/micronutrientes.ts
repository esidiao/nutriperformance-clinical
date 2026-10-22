import { Food } from '../foods/food.entity';

/**
 * Extração e soma de micronutrientes dos itens do plano.
 *
 * Fica separado do serviço porque tem uma regra que não é óbvia e precisa de
 * teste próprio: COBERTURA.
 *
 * Se um plano tem dez alimentos e três não têm cálcio na base, somar os sete
 * que têm produz um total menor que PARECE um número real. O relatório leria
 * esse total contra a RDA e diria "abaixo da recomendação" — afirmação sobre a
 * dieta que o dado não sustenta. O que acontece é que não se sabe.
 *
 * Por isso a soma devolve, junto com o valor, quantos itens tinham o dado.
 */

/** Chaves usadas no plano, iguais às de `referencia-dri.ts`. */
export const MICRONUTRIENTES = [
  'calcioMg', 'ferroMg', 'potassioMg', 'magnesioMg', 'zincoMg',
  'tiaminaMg', 'riboflavinaMg', 'niacinaMg', 'piridoxinaMg',
  'vitaminaCMg', 'vitaminaAMcg',
  // Acrescentados com a importacao do IBGE: a TACO nao traz a composicao
  // deles, entao antes apareciam no relatorio como lacuna declarada. A
  // cobertura medida na tabela do IBGE: selenio 89%, cobre 96%, manganes
  // 94%, fosforo 96%, vitamina E 86%, folato 86%, B12 58%.
  'fosforoMg', 'selenioMcg', 'cobreMg', 'manganesMg',
  'vitaminaEMg', 'cobalaminaMcg', 'folatoMcg', 'vitaminaDMcg',
] as const;

export type Micronutriente = (typeof MICRONUTRIENTES)[number];

/** De onde cada um sai no registro de alimento. */
const COLUNA_DO_ALIMENTO: Partial<Record<Micronutriente, keyof Food>> = {
  calcioMg: 'calcioMg',
  ferroMg: 'ferroMg',
  potassioMg: 'potassioMg',
  magnesioMg: 'magnesioMg',
  zincoMg: 'zincoMg',
};

/**
 * As vitaminas moram num jsonb cuja forma é `{ chave: { valor, unidade } }`.
 * A vitamina A usa RAE porque é a unidade da DRI — a base também traz RE e
 * retinol, que não são equivalentes e não servem para comparar.
 */
const CHAVE_NO_JSONB: Partial<Record<Micronutriente, string>> = {
  fosforoMg: 'fosforo_mg',
  selenioMcg: 'selenio_mcg',
  // A DRI publica o cobre em µg e a tabela de alimentos traz em mg. A
  // conversao esta feita UMA vez, em referencia-dri.ts, onde a RDA esta
  // gravada como 0,9 mg. Aqui a chave e a do alimento, em mg: as duas
  // pontas falam mg, e nenhum fator 1.000 circula pelo codigo.
  cobreMg: 'cobre_mg',
  manganesMg: 'manganes_mg',
  vitaminaEMg: 'vitamina_e_mg',
  vitaminaDMcg: 'vitamina_d_mcg',
  cobalaminaMcg: 'cobalamina_mcg',
  folatoMcg: 'folato_dfe_mcg',
  tiaminaMg: 'tiamina_mg',
  riboflavinaMg: 'riboflavina_mg',
  niacinaMg: 'niacina_mg',
  piridoxinaMg: 'piridoxina_mg',
  vitaminaCMg: 'vitamina_c_mg',
  vitaminaAMcg: 'vitamina_a_rae_mcg',
};

const finito = (v: unknown): number | null => {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

/**
 * Micronutrientes de um alimento, escalados para `quantidadeG`.
 *
 * Só entram as chaves que a base REALMENTE tem. Nutriente sem dado fica de
 * fora do objeto — não vira zero.
 */
export function extrairDoAlimento(
  food: Food,
  quantidadeG: number,
): Record<string, number> {
  const fator = quantidadeG / 100; // a base é por 100 g, como todo o resto
  const out: Record<string, number> = {};

  for (const chave of MICRONUTRIENTES) {
    const coluna = COLUNA_DO_ALIMENTO[chave];
    if (coluna) {
      const v = finito((food as any)[coluna]);
      if (v !== null) out[chave] = Math.round(v * fator * 1000) / 1000;
      continue;
    }

    const noJson = CHAVE_NO_JSONB[chave];
    if (!noJson) continue;
    const bruto = (food as any).vitaminas?.[noJson];
    // O jsonb guarda `{ valor, unidade }`; aceita número solto por robustez.
    const v = finito(typeof bruto === 'object' && bruto !== null ? bruto.valor : bruto);
    if (v !== null) out[chave] = Math.round(v * fator * 1000) / 1000;
  }

  return out;
}

export interface TotalMicronutriente {
  valor: number;
  /** Quantos itens do plano tinham esse dado. */
  itensComDado: number;
  /** Quantos itens o plano tem ao todo. */
  itensTotal: number;
  /** false quando algum item ficou de fora — o total está subestimado. */
  completo: boolean;
}

/**
 * Soma por nutriente, com a cobertura junto.
 *
 * Nutriente que NENHUM item tem não aparece no resultado: para o relatório,
 * ausente e zero precisam continuar diferentes.
 */
export function somarMicronutrientes(
  itens: Array<{ micronutrientes?: Record<string, number> | null }>,
): Record<string, TotalMicronutriente> {
  const out: Record<string, TotalMicronutriente> = {};
  const total = itens.length;

  for (const chave of MICRONUTRIENTES) {
    let soma = 0;
    let com = 0;
    for (const item of itens) {
      const v = finito(item.micronutrientes?.[chave]);
      if (v === null) continue;
      soma += v;
      com++;
    }
    if (com === 0) continue; // nenhum item tem o dado: fica fora
    out[chave] = {
      valor: Math.round(soma * 100) / 100,
      itensComDado: com,
      itensTotal: total,
      completo: com === total,
    };
  }

  return out;
}
