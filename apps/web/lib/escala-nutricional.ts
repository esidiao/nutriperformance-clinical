/**
 * Converte valores de composição por 100 g para a quantidade prescrita.
 *
 * Toda tabela de composição de alimentos — TACO, USDA, TBCA — publica valores
 * por 100 g, porque vêm de análise centesimal. A tela de prescrição copiava
 * esses números direto para o campo do alimento: "60 g de arroz" exibia os
 * valores de 100 g, e mudar a quantidade não alterava nada, porque não havia
 * cálculo nenhum. A dieta inteira fechava errada.
 *
 * Mora aqui, separado da tela, por dois motivos: a regra é a mesma do backend
 * (`meal-plans.service.ts`, `quantidade / 100`), e função pura pode ser
 * testada no dia em que o front tiver runner de testes — hoje não tem.
 */

export type Por100 = {
  kcal: number | null;
  prot: number | null;
  carb: number | null;
  fat: number | null;
};

/** Aceita vírgula decimal: o teclado brasileiro produz "62,5". */
export function emGramas(texto: string | number): number | null {
  const n = typeof texto === 'number' ? texto : Number(String(texto).replace(',', '.'));
  return Number.isFinite(n) && n > 0 ? n : null;
}

/**
 * Valor para `gramas`, a partir do valor por 100 g.
 *
 * Devolve string porque o destino é um `<input>` controlado — e string vazia,
 * não "0", quando não há o que calcular: um zero ali seria lido como "este
 * alimento não tem proteína", que é afirmação diferente de "não sei ainda".
 */
export function escalar(por100: number | null, gramas: number | null, inteiro = false): string {
  if (por100 === null || por100 === undefined || gramas === null) return '';
  const v = (por100 * gramas) / 100;
  return inteiro ? String(Math.round(v)) : String(Math.round(v * 10) / 10);
}

/** Os quatro de uma vez. kcal sai inteiro, que é como se prescreve. */
export function escalarMacros(por100: Por100, gramas: number | null) {
  return {
    kcal: escalar(por100.kcal, gramas, true),
    prot: escalar(por100.prot, gramas),
    carb: escalar(por100.carb, gramas),
    fat: escalar(por100.fat, gramas),
  };
}
