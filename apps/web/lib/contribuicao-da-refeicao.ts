import { REFERENCIAS, faixaDaIdade, type Sexo } from './referencia-dri';

/**
 * Quanto uma REFEIÇÃO contribui para a recomendação do DIA.
 *
 * Pedido da nutricionista (29/10/2026): ver os minerais e vitaminas por
 * refeição, além do fechamento do dia.
 *
 * ================= POR QUE AQUI NÃO HÁ VEREDICTO =========================
 *
 * O relatório do dia diz "adequado", "abaixo" ou "acima do limite". Esta
 * função NÃO diz nenhuma dessas coisas, e a diferença é clínica, não de
 * desenho.
 *
 * RDA e UL são referências DIÁRIAS. Um café da manhã com 15% do cálcio do dia
 * não está "abaixo" — está sendo um café da manhã. Carimbar cada refeição com
 * o veredicto do dia produziria oito "abaixo do recomendado" num plano
 * perfeitamente adequado, e a profissional aprenderia a ignorar o aviso — que
 * é o pior resultado possível, porque o mesmo aviso precisa funcionar no dia
 * em que o plano estiver mesmo errado.
 *
 * O que a refeição responde é OUTRA pergunta, e é a útil aqui: de onde vem
 * cada nutriente ao longo do dia. "O ferro todo está no almoço" é informação
 * de planejamento; "o almoço tem pouco ferro para um dia" não é.
 *
 * ========================= O LIMITE É A EXCEÇÃO ===========================
 *
 * Com uma ressalva que vale sinalizar: se UMA refeição já passa do UL do dia,
 * o dia passou também, e isso é fato, não extrapolação. Esse caso sai
 * marcado — é o único juízo que uma refeição sozinha sustenta.
 */

export interface ContribuicaoDeNutriente {
  nutriente: string;
  rotulo: string;
  grupo: string;
  unidade: string;
  ofertado: number;
  /** Percentual da recomendação DIÁRIA que esta refeição entrega. */
  pctDoDia: number | null;
  /** A refeição sozinha já ultrapassa o limite diário. */
  acimaDoLimiteDiario: boolean;
}

const arred = (n: number) => Math.round(n * 10) / 10;

function numero(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  const n = typeof v === 'object' && v !== null && 'valor' in (v as any)
    ? Number((v as any).valor)
    : Number(v);
  return Number.isFinite(n) ? n : null;
}

function valorDaFaixa(v: unknown, faixa: string): number | null {
  if (v === null || v === undefined) return null;
  if (typeof v === 'number') return v;
  const n = (v as Record<string, number>)[faixa];
  return Number.isFinite(n) ? n : null;
}

/**
 * `null` em `pctDoDia` quando não há referência para a faixa — e null não é
 * zero: "0% da recomendação" afirmaria que a refeição não entrega nada.
 */
export function contribuicaoDaRefeicao(
  totais: Partial<Record<string, unknown>>,
  idade: number,
  sexo: Sexo,
): { linhas: ContribuicaoDeNutriente[]; faixa: string | null } {
  const faixa = faixaDaIdade(idade);
  if (faixa === null) return { linhas: [], faixa: null };

  const linhas: ContribuicaoDeNutriente[] = [];

  for (const ref of REFERENCIAS) {
    const ofertado = numero(totais[ref.nutriente]);
    // Nutriente que a refeição não entrega não vira linha: a lista existe para
    // mostrar de onde o nutriente VEM, e dezenove zeros escondem os três
    // valores que interessam.
    if (ofertado === null || ofertado <= 0) continue;

    // `valores` e indexado por sexo e depois por faixa; `ul` pode ser numero
    // unico ou mapa por faixa. Ler errado aqui daria percentual plausivel e
    // errado, que e o pior resultado possivel numa tela clinica.
    const recomendado = ref.valores?.[sexo]?.[faixa as keyof typeof ref.valores[typeof sexo]] ?? null;
    const ul = valorDaFaixa(ref.ul, faixa);

    linhas.push({
      nutriente: ref.nutriente,
      rotulo: ref.rotulo,
      grupo: ref.grupo,
      unidade: ref.unidade,
      ofertado: arred(ofertado),
      pctDoDia: recomendado && recomendado > 0
        ? Math.round((ofertado / recomendado) * 100)
        : null,
      acimaDoLimiteDiario: ul !== null && ofertado > ul,
    });
  }

  // Maior contribuição primeiro: é a leitura que a profissional faz, "de onde
  // vem o ferro deste plano".
  linhas.sort((a, b) => (b.pctDoDia ?? -1) - (a.pctDoDia ?? -1));
  return { linhas, faixa };
}
