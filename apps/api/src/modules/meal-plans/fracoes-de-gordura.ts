import type { Food } from '../foods/food.entity';

/**
 * Gordura saturada, trans, mono, poli e insaturada total de um plano.
 *
 * Pedido da nutricionista (29/10/2026): ver os lipídios separados, "porque a
 * gente também tem referência para esses".
 *
 * ========================= O QUE A BASE TEM, DE FATO =======================
 *
 * Medido em 29/10/2026, depois da importação da planilha oficial do NEPA:
 *
 *            alimentos   saturada   trans   mono   poli
 *   TACO         597        417      417     423    423
 *   IBGE        1971       1814     1202      0      0
 *
 * Até esta data a TACO tinha **zero** alimentos com saturada: a coluna
 * existia e a importação original nunca a preencheu, porque a Tabela 1 da
 * TACO não traz ácidos graxos. Daí a regra que organiza este módulo inteiro:
 * ausência NUNCA soma como zero. "Gordura saturada: 0 g" AFIRMA que o plano
 * não tem gordura saturada, e um plano de queijo e carne afirmando isso é o
 * pior resultado possível — a profissional aprova confiando num número que
 * não existe.
 *
 * Cada total vem com a cobertura junto (quantos itens tinham o dado), igual
 * ao que já se faz com os micronutrientes.
 *
 * ==================== MEDIDO GANHA DE DEDUZIDO, ITEM A ITEM ================
 *
 * A insaturada total pode vir de dois caminhos:
 *
 *   MEDIDO    mono + poli, quando a fonte publica as DUAS.
 *   DEDUZIDO  lipídio total − saturada − trans.
 *
 * A dedução é exata quando as três parcelas são conhecidas (é aritmética, não
 * estimativa estatística), mas junta mono com poli e some inteira quando a
 * saturada falta. Então, por item: se houver mono e poli, usa a soma medida;
 * senão cai na subtração; senão o item fica de fora.
 *
 * Por que exigir as DUAS e não aceitar só uma: mono sozinha somada como
 * "insaturada" subestimaria o valor sem avisar, e subestimar caladamente é o
 * mesmo defeito do zero.
 *
 * `itensDeduzidos` conta quantos vieram pela subtração, para a tela poder
 * dizer qual parte do número é medida e qual é conta.
 *
 * ======================= POR QUE MORA NO JSONB DOS MICROS ==================
 *
 * As frações são guardadas no mesmo `micronutrientes` do item, sob chaves que
 * NÃO estão em `MICRONUTRIENTES`. Consequência deliberada: `somarMicro-
 * nutrientes` itera aquela lista e portanto IGNORA estas chaves — gordura não
 * aparece no relatório de micronutrientes, onde não faz sentido.
 *
 * O preço desta escolha é um campo com nome de uma coisa guardando outra, e é
 * por isso que ele está documentado aqui e tem teste provando que não vaza.
 */

export const FRACOES_DE_GORDURA = [
  'gorduraSaturadaG',
  'gorduraTransG',
  'gorduraMonoinsaturadaG',
  'gorduraPoliinsaturadaG',
] as const;
export type FracaoDeGordura = (typeof FRACOES_DE_GORDURA)[number];

const COLUNA: Record<FracaoDeGordura, keyof Food> = {
  gorduraSaturadaG: 'gorduraSaturadaG' as keyof Food,
  gorduraTransG: 'gorduraTransG' as keyof Food,
  gorduraMonoinsaturadaG: 'gorduraMonoinsaturadaG' as keyof Food,
  gorduraPoliinsaturadaG: 'gorduraPoliinsaturadaG' as keyof Food,
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
  /** Algum item entrou por subtração, não medido na base. */
  derivada?: boolean;
  /** Quantos dos `itensComDado` vieram da subtração. */
  itensDeduzidos?: number;
}

export interface GordurasDoPlano {
  saturadaG: TotalDeGordura | null;
  transG: TotalDeGordura | null;
  /** Medida pela fonte. A TACO publica; o IBGE não. */
  monoinsaturadaG: TotalDeGordura | null;
  /** Medida pela fonte. A TACO publica; o IBGE não. */
  poliinsaturadaG: TotalDeGordura | null;
  /** Medida (mono + poli) onde houver; deduzida por subtração no resto. */
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
  const monoinsaturadaG = somar('gorduraMonoinsaturadaG');
  const poliinsaturadaG = somar('gorduraPoliinsaturadaG');

  // Insaturada total: medido ganha de deduzido, item a item.
  let somaInsat = 0;
  let comInsat = 0;
  let deduzidos = 0;
  for (const i of itens) {
    const mono = finito(i.micronutrientes?.gorduraMonoinsaturadaG);
    const poli = finito(i.micronutrientes?.gorduraPoliinsaturadaG);
    if (mono !== null && poli !== null) {
      somaInsat += mono + poli;
      comInsat++;
      continue;
    }
    // Sem as duas medidas, cai na subtração — que exige lipídio E saturada.
    // Sem saturada, entrar com o lipídio inteiro contaria tudo como
    // insaturado: número plausível e falso.
    const lip = finito(i.lipidiosG);
    const sat = finito(i.micronutrientes?.gorduraSaturadaG);
    if (lip === null || sat === null) continue;
    const trans = finito(i.micronutrientes?.gorduraTransG) ?? 0;
    // Arredondamento da base pode deixar a conta levemente negativa; o chão
    // em zero evita "−0,3 g de insaturada", que não existe.
    somaInsat += Math.max(0, lip - sat - trans);
    comInsat++;
    deduzidos++;
  }

  const insaturadaG: TotalDeGordura | null = comInsat === 0 ? null : {
    valor: Math.round(somaInsat * 100) / 100,
    itensComDado: comInsat,
    itensTotal: total,
    completo: comInsat === total,
    ...(deduzidos > 0 ? { derivada: true, itensDeduzidos: deduzidos } : {}),
  };

  return { saturadaG, transG, monoinsaturadaG, poliinsaturadaG, insaturadaG };
}
