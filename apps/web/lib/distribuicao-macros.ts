/**
 * Distribuição dos macronutrientes no valor energético, em percentual.
 *
 * Pedido da nutricionista (29/10/2026): ver, por refeição e no dia, "quanto
 * que tem das porcentagens dos macros". É o número com que ela confere se o
 * plano fecha dentro da faixa aceitável de distribuição.
 *
 * ===================== POR QUE O DENOMINADOR É CALCULADO ===================
 *
 * O percentual sai da energia DOS MACROS (Atwater: 4 kcal/g para proteína e
 * carboidrato, 9 para lipídio), não da energia registrada no alimento.
 *
 * Os dois quase nunca batem: a tabela de composição traz a energia medida (ou
 * calculada com fatores específicos do alimento), e ela difere da soma 4/4/9
 * por alguns por cento. Se eu dividisse pela energia registrada, os três
 * percentuais somariam 97% ou 104% — e a profissional, com razão, leria isso
 * como defeito da tela.
 *
 * Com Atwater os três somam 100 por construção. O custo é que o percentual
 * descreve a energia DOS MACROS, não a energia da tabela. Para distribuição
 * é o que se quer; `divergenciaKcal` existe para quem precisar saber o
 * tamanho da diferença, em vez de ela ficar escondida.
 */

export const KCAL_POR_GRAMA = { proteina: 4, carboidrato: 4, lipidio: 9 } as const;

export interface MacrosEmGramas {
  /** Energia registrada na base, para comparação. Opcional. */
  kcal?: number | null;
  proteinasG?: number | null;
  carboidratosG?: number | null;
  lipidiosG?: number | null;
}

export interface Distribuicao {
  proteinas: number;
  carboidratos: number;
  lipidios: number;
  /** Energia pelos macros (Atwater), que é o denominador usado. */
  kcalPorMacros: number;
  /**
   * `kcal registrada − kcal por macros`, quando há energia registrada.
   *
   * Diferença pequena é normal. Grande costuma significar macro faltando na
   * base — e aí a distribuição está descrevendo menos comida do que o prato
   * tem. Melhor poder olhar do que supor.
   */
  divergenciaKcal: number | null;
}

const num = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : 0;
};

/**
 * `null` quando não há macro nenhum — e `null` é a resposta certa, não zero.
 *
 * "0% de proteína" afirma que a refeição não tem proteína. Uma refeição vazia,
 * ou feita só de alimentos sem composição na base, não afirma nada: a tela
 * precisa poder calar em vez de inventar um número redondo.
 */
export function distribuicaoMacros(m: MacrosEmGramas): Distribuicao | null {
  const p = num(m.proteinasG) * KCAL_POR_GRAMA.proteina;
  const c = num(m.carboidratosG) * KCAL_POR_GRAMA.carboidrato;
  const l = num(m.lipidiosG) * KCAL_POR_GRAMA.lipidio;
  const total = p + c + l;
  if (total <= 0) return null;

  // Arredonda os dois primeiros e dá o resto ao terceiro: três arredondamentos
  // independentes somam 99% ou 101%, e a soma diferente de 100 é justamente o
  // que faria a profissional desconfiar da conta.
  const pctP = Math.round((p / total) * 100);
  const pctC = Math.round((c / total) * 100);
  const pctL = 100 - pctP - pctC;

  const kcalRegistrada = num(m.kcal);
  return {
    proteinas: pctP,
    carboidratos: pctC,
    lipidios: pctL,
    kcalPorMacros: Math.round(total),
    divergenciaKcal: kcalRegistrada > 0 ? Math.round(kcalRegistrada - total) : null,
  };
}
