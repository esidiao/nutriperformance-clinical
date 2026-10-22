/**
 * Micronutrientes de um alimento da base, escalados para a quantidade.
 *
 * Gêmeo de `apps/api/src/modules/meal-plans/micronutrientes.ts`. Existem dois
 * porque as formas diferem — lá entra a entidade do TypeORM, aqui entra o DTO
 * que a API devolve — e porque a API não consegue importar de `apps/web` sem
 * quebrar o build do Nest (o `tsc` emitiria caminho fora do `rootDir`).
 *
 * Duplicação reconhecida, não acidental: um teste
 * (`micronutrientes-chaves.spec.ts`) compara os dois mapeamentos e falha se
 * divergirem. Sem ele, acrescentar um nutriente de um lado só produziria um
 * relatório que some com o nutriente sem avisar.
 */

/** As mesmas chaves de `referencia-dri.ts`. */
export const MICRONUTRIENTES = [
  'calcioMg', 'ferroMg', 'potassioMg', 'magnesioMg', 'zincoMg',
  'tiaminaMg', 'riboflavinaMg', 'niacinaMg', 'piridoxinaMg',
  'vitaminaCMg', 'vitaminaAMcg',
  // Acrescentados com a importacao do IBGE, que traz a composicao que a
  // TACO nao tem. A ordem precisa bater com a lista do backend: ha um teste
  // que compara as duas, porque divergir aqui faz o relatorio somar um
  // nutriente e cobrar outro.
  'fosforoMg', 'selenioMcg', 'cobreMg', 'manganesMg',
  'vitaminaEMg', 'cobalaminaMcg', 'folatoMcg', 'vitaminaDMcg',
] as const;

export type Micronutriente = (typeof MICRONUTRIENTES)[number];

/** Minerais vêm em campo próprio no DTO, com o mesmo nome. */
export const CAMPO_DIRETO: Partial<Record<Micronutriente, string>> = {
  calcioMg: 'calcioMg',
  ferroMg: 'ferroMg',
  potassioMg: 'potassioMg',
  magnesioMg: 'magnesioMg',
  zincoMg: 'zincoMg',
};

/**
 * Vitaminas moram no jsonb `vitaminas`, como `{ chave: { valor, unidade } }`.
 * Vitamina A usa RAE porque é a unidade da DRI — a base também traz RE e
 * retinol, que não são equivalentes e não servem para comparar.
 */
export const CHAVE_NO_JSONB: Partial<Record<Micronutriente, string>> = {
  fosforoMg: 'fosforo_mg',
  selenioMcg: 'selenio_mcg',
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
 * Valores POR 100 G do alimento. Só entram as chaves que a base realmente
 * tem — nutriente sem dado fica FORA do objeto, não vira zero.
 */
export function micronutrientesPor100(alimento: any): Record<string, number> {
  const out: Record<string, number> = {};
  for (const chave of MICRONUTRIENTES) {
    const direto = CAMPO_DIRETO[chave];
    if (direto) {
      const v = finito(alimento?.[direto]);
      if (v !== null) out[chave] = v;
      continue;
    }
    const noJson = CHAVE_NO_JSONB[chave];
    if (!noJson) continue;
    const bruto = alimento?.vitaminas?.[noJson];
    const v = finito(typeof bruto === 'object' && bruto !== null ? bruto.valor : bruto);
    if (v !== null) out[chave] = v;
  }
  return out;
}

/** Escala para `gramas`, preservando a ausência. */
export function escalarMicros(
  por100: Record<string, number> | null | undefined,
  gramas: number | null,
): Record<string, number> {
  if (!por100 || gramas === null || !(gramas > 0)) return {};
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(por100)) {
    out[k] = Math.round(((v * gramas) / 100) * 1000) / 1000;
  }
  return out;
}

export interface TotalComCobertura {
  valor: number;
  itensComDado: number;
  itensTotal: number;
  completo: boolean;
}

/**
 * Soma com COBERTURA, igual ao backend.
 *
 * Somar 7 de 10 alimentos produz um total menor que parece real; lido contra a
 * RDA, viraria "abaixo da recomendação" que o dado não sustenta.
 */
export function somarMicros(
  itens: Array<Record<string, number> | null | undefined>,
): Record<string, TotalComCobertura> {
  const out: Record<string, TotalComCobertura> = {};
  const total = itens.length;
  if (total === 0) return out;

  // Soma os 11 micronutrientes MAIS qualquer chave que os itens tragam. A tela
  // de prescricao acrescenta fibra e sodio, que no plano alimentar vivem em
  // coluna propria e nao fazem parte do jsonb — somar so a lista fixa deixaria
  // os dois de fora do relatorio sem avisar.
  const chaves = new Set<string>(MICRONUTRIENTES as readonly string[]);
  for (const item of itens) for (const k of Object.keys(item ?? {})) chaves.add(k);

  for (const chave of Array.from(chaves)) {
    let soma = 0;
    let com = 0;
    for (const item of itens) {
      const v = finito(item?.[chave]);
      if (v === null) continue;
      soma += v;
      com++;
    }
    if (com === 0) continue;
    out[chave] = {
      valor: Math.round(soma * 100) / 100,
      itensComDado: com,
      itensTotal: total,
      completo: com === total,
    };
  }
  return out;
}
