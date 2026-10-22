/**
 * Valores de referência de ingestão (DRI) para o relatório de adequação.
 *
 * POR QUE DRI E NÃO ANVISA
 *
 * A escolha inicial foi a RDC 269/2005 da ANVISA. Ela não serve ao que foi
 * pedido: publica um valor único de IDR para adultos, sem distinguir sexo nem
 * faixa etária. A nutricionista pediu explicitamente a recomendação "de acordo
 * com a faixa etária, de acordo com o sexo". A DRI estratifica assim; a RDC
 * não. Decisão registrada em 10/10/2026.
 *
 * PROCEDÊNCIA
 *
 * Nenhum número aqui foi escrito de memória. Cada um foi lido das tabelas-
 * resumo oficiais e carrega a fonte no campo `fonte`:
 *
 *  - 12 nutrientes: IOM (2011), Summary Tables, pp. 1103–1116.
 *  - sódio e potássio: NASEM (2019), Tables S-1 e S-2. Este relatório
 *    SUBSTITUIU os valores de 2005 que o livro de 2011 ainda reproduzia
 *    (potássio era 4.700 mg; sódio tinha UL de 2.300 mg). Usar os de 2011
 *    para esses dois seria usar recomendação revogada.
 *
 * O QUE AINDA PRECISA DE CONFERÊNCIA
 *
 * Sourced não é o mesmo que conferido. A tela mostra a fonte de cada valor
 * para que a profissional possa discordar de forma informada — e é ela quem
 * assina o plano, não esta tabela.
 */

export type Sexo = 'male' | 'female';

/** Faixas etárias adultas das tabelas DRI. */
export type FaixaEtaria = '19-30' | '31-50' | '51-70' | '70+';

export function faixaDaIdade(idade: number): FaixaEtaria | null {
  if (!Number.isFinite(idade) || idade < 19) return null; // crianças e adolescentes têm outras tabelas
  if (idade <= 30) return '19-30';
  if (idade <= 50) return '31-50';
  if (idade <= 70) return '51-70';
  return '70+';
}

/**
 * RDA x AI não são a mesma coisa, e a diferença é clínica:
 *
 *  - RDA cobre a necessidade de 97–98% da população. Ingestão abaixo dela
 *    sugere inadequação.
 *  - AI é usada quando não há evidência para calcular RDA. Ingestão abaixo de
 *    um AI NÃO permite concluir inadequação — só que não dá para concluir.
 *
 * Tratar os dois como "a meta" produziria alertas de inadequação que a própria
 * fonte não sustenta.
 */
export type TipoReferencia = 'RDA' | 'AI';

/**
 * Agrupamento para a tela.
 *
 * Com 19 nutrientes, a tabela unica vira uma parede de numeros em que o que
 * importa -- o que esta fora da faixa -- se perde no meio do que esta certo.
 * O grupo e declarado aqui, e nao deduzido do nome no componente, porque
 * deduzir erraria em "vitaminaAMcg" vs "vitaminaCMg" no dia em que alguem
 * acrescentasse um nutriente com nome parecido e papel diferente.
 */
export type GrupoNutriente = 'macro' | 'mineral' | 'vitamina';

export interface ValorReferencia {
  nutriente: string;
  rotulo: string;
  grupo: GrupoNutriente;
  unidade: string;
  tipo: TipoReferencia;
  /** Por sexo e faixa etária. */
  valores: Record<Sexo, Record<FaixaEtaria, number>>;
  /** Limite superior tolerável, quando estabelecido. */
  ul?: Record<FaixaEtaria, number> | number | null;
  ulNota?: string;
  fonte: string;
  nota?: string;
}

const IOM2011 = 'IOM (2011), Summary Tables, pp. 1103–1116';
const NASEM2019 = 'NASEM (2019), DRIs for Sodium and Potassium, Tables S-1 e S-2';

/**
 * A compilação brasileira das DRI do IOM.
 *
 * Reúne os valores publicados pelo IOM entre 1997 e 2005. Para cálcio e
 * vitamina D ela está SUPERADA pela revisão do IOM de 2011 — e é por isso que
 * esses dois citam IOM2011 acima. Para os demais nutrientes, que a revisão de
 * 2011 não tocou, continua sendo a referência vigente.
 */
/**
 * Lido nas Tabelas-Resumo do relatorio do IOM de 2011, no NCBI Bookshelf.
 *
 * Os valores destes nutrientes foram primeiro lidos no fac-simile da
 * compilacao brasileira (Padovani et al., Rev. Nutr. 2006) e DEPOIS
 * confirmados, um a um, nestas tabelas. As duas leituras batem em todos.
 *
 * A dupla conferencia nao foi zelo excessivo: ela resolveu o UL do fosforo,
 * que a compilacao de 2006 imprime como "4" sob um cabecalho dizendo mg --
 * o que seria menor que a propria RDA de 700 mg. A tabela do IOM rotula a
 * coluna como g/d, confirmando que sao gramas.
 */
const IOM2011_TABELAS = 'IOM (2011), DRIs for Calcium and Vitamin D, '
  + 'Summary Tables (NCBI Bookshelf NBK56068)';

/** Atalho: mesmo valor nas quatro faixas. */
const todas = (v: number): Record<FaixaEtaria, number> =>
  ({ '19-30': v, '31-50': v, '51-70': v, '70+': v });

export const REFERENCIAS: ValorReferencia[] = [
  {
    nutriente: 'proteinasG', rotulo: 'Proteína', grupo: 'macro', unidade: 'g', tipo: 'RDA',
    valores: { male: todas(56), female: todas(46) },
    ul: null, fonte: IOM2011,
    nota: 'Baseado em 0,8 g/kg de peso para o peso de referência. Para peso fora da referência, calcular pelo peso do paciente.',
  },
  {
    nutriente: 'fibrasG', rotulo: 'Fibra total', grupo: 'macro', unidade: 'g', tipo: 'AI',
    valores: {
      male: { '19-30': 38, '31-50': 38, '51-70': 30, '70+': 30 },
      female: { '19-30': 25, '31-50': 25, '51-70': 21, '70+': 21 },
    },
    ul: null, fonte: IOM2011,
  },
  {
    nutriente: 'calcioMg', rotulo: 'Cálcio', grupo: 'mineral', unidade: 'mg', tipo: 'RDA',
    valores: {
      male: { '19-30': 1000, '31-50': 1000, '51-70': 1000, '70+': 1200 },
      female: { '19-30': 1000, '31-50': 1000, '51-70': 1200, '70+': 1200 },
    },
    ul: { '19-30': 2500, '31-50': 2500, '51-70': 2000, '70+': 2000 },
    fonte: IOM2011,
  },
  {
    nutriente: 'ferroMg', rotulo: 'Ferro', grupo: 'mineral', unidade: 'mg', tipo: 'RDA',
    valores: {
      male: todas(8),
      female: { '19-30': 18, '31-50': 18, '51-70': 8, '70+': 8 },
    },
    ul: 45, fonte: IOM2011,
    nota: 'A queda de 18 para 8 mg nas mulheres acompanha a menopausa, não a idade em si.',
  },
  {
    nutriente: 'magnesioMg', rotulo: 'Magnésio', grupo: 'mineral', unidade: 'mg', tipo: 'RDA',
    valores: {
      male: { '19-30': 400, '31-50': 420, '51-70': 420, '70+': 420 },
      female: { '19-30': 310, '31-50': 320, '51-70': 320, '70+': 320 },
    },
    ul: 350, ulNota: 'O UL de magnésio vale só para agente farmacológico; não inclui o magnésio de alimentos e água.',
    fonte: IOM2011,
  },
  {
    nutriente: 'zincoMg', rotulo: 'Zinco', grupo: 'mineral', unidade: 'mg', tipo: 'RDA',
    valores: { male: todas(11), female: todas(8) },
    ul: 40, fonte: IOM2011,
  },
  {
    nutriente: 'potassioMg', rotulo: 'Potássio', grupo: 'mineral', unidade: 'mg', tipo: 'AI',
    valores: { male: todas(3400), female: todas(2600) },
    ul: null, fonte: NASEM2019,
    nota: 'Valor de 2019. Substitui o AI de 4.700 mg de 2005, que ainda circula em tabelas antigas.',
  },
  {
    nutriente: 'sodioMg', rotulo: 'Sódio', grupo: 'mineral', unidade: 'mg', tipo: 'AI',
    valores: { male: todas(1500), female: todas(1500) },
    ul: null, fonte: NASEM2019,
    nota: 'Em 2019 o sódio DEIXOU de ter UL. No lugar entrou o CDRR: reduzir a ingestão se acima de 2.300 mg/dia. São categorias diferentes — o CDRR vem de risco de doença crônica, o UL vinha de toxicidade.',
  },
  {
    nutriente: 'tiaminaMg', rotulo: 'Tiamina (B1)', grupo: 'vitamina', unidade: 'mg', tipo: 'RDA',
    valores: { male: todas(1.2), female: todas(1.1) },
    ul: null, ulNota: 'UL não determinável por falta de dados de efeito adverso.',
    fonte: IOM2011,
  },
  {
    nutriente: 'riboflavinaMg', rotulo: 'Riboflavina (B2)', grupo: 'vitamina', unidade: 'mg', tipo: 'RDA',
    valores: { male: todas(1.3), female: todas(1.1) },
    ul: null, ulNota: 'UL não determinável por falta de dados de efeito adverso.',
    fonte: IOM2011,
  },
  {
    nutriente: 'niacinaMg', rotulo: 'Niacina (B3)', grupo: 'vitamina', unidade: 'mg NE', tipo: 'RDA',
    valores: { male: todas(16), female: todas(14) },
    ul: 35, ulNota: 'O UL vale só para formas sintéticas (suplemento ou alimento fortificado).',
    fonte: IOM2011,
    nota: 'Em equivalentes de niacina (NE). 1 mg de niacina = 60 mg de triptofano.',
  },
  {
    nutriente: 'piridoxinaMg', rotulo: 'Piridoxina (B6)', grupo: 'vitamina', unidade: 'mg', tipo: 'RDA',
    valores: {
      male: { '19-30': 1.3, '31-50': 1.3, '51-70': 1.7, '70+': 1.7 },
      female: { '19-30': 1.3, '31-50': 1.3, '51-70': 1.5, '70+': 1.5 },
    },
    ul: 100, fonte: IOM2011,
  },
  {
    nutriente: 'vitaminaCMg', rotulo: 'Vitamina C', grupo: 'vitamina', unidade: 'mg', tipo: 'RDA',
    valores: { male: todas(90), female: todas(75) },
    ul: 2000, fonte: IOM2011,
  },
  {
    nutriente: 'vitaminaAMcg', rotulo: 'Vitamina A', grupo: 'vitamina', unidade: 'µg RAE', tipo: 'RDA',
    valores: { male: todas(900), female: todas(700) },
    ul: 3000, ulNota: 'O UL vale só para vitamina A pré-formada (retinol).',
    fonte: IOM2011,
    nota: 'Em equivalentes de atividade de retinol (RAE). 1 RAE = 1 µg de retinol ou 12 µg de betacaroteno.',
  },

  // ── acrescentados quando a base passou a ter o dado ──────────────────────
  //
  // Estes sete existiam na DRI e NÃO no relatório, porque a TACO não traz a
  // composição deles. A importação do IBGE (POF 2008-2009) mudou isso, com
  // cobertura medida: selênio em 89% dos alimentos, cobre 96%, manganês 94%,
  // fósforo 96%, vitamina E 86%, folato 86%, B12 58%.
  //
  // Os valores foram LIDOS no fac-símile das Tabelas 1 e 2 de Padovani et
  // al., não transcritos de memória nem do extrator automático: o extrator
  // acerta os números e erra o rótulo da linha, e número certo com rótulo
  // errado é pior que número ausente ("60% do EAR" quando aquilo era o UL
  // inverte a leitura clínica).
  //
  // A revisão do IOM de 2011 cobriu APENAS cálcio e vitamina D. Para estes
  // sete, a compilação de 2006 continua sendo a referência vigente.
  {
    nutriente: 'fosforoMg', rotulo: 'Fósforo', grupo: 'mineral', unidade: 'mg', tipo: 'RDA',
    valores: { male: todas(700), female: todas(700) },
    ul: { '19-30': 4000, '31-50': 4000, '51-70': 4000, '70+': 3000 },
    ulNota:
      'A compilação de 2006 imprime "4" e "3" sob um cabeçalho que diz mg, '
      + 'o que seria menor que a própria RDA. A tabela do IOM rotula a coluna '
      + 'como g/d: são gramas. Registrado aqui em mg (4.000 e 3.000).',
    fonte: IOM2011_TABELAS,
  },
  {
    nutriente: 'selenioMcg', rotulo: 'Selênio', grupo: 'mineral', unidade: 'µg', tipo: 'RDA',
    valores: { male: todas(55), female: todas(55) },
    ul: 400, fonte: IOM2011_TABELAS,
  },
  {
    nutriente: 'cobreMg', rotulo: 'Cobre', grupo: 'mineral', unidade: 'mg', tipo: 'RDA',
    // A fonte publica 900 µg e UL 10.000 µg. Convertido UMA vez, aqui, para
    // a unidade em que a tabela de alimentos traz o cobre — converter na
    // comparação espalharia o fator 1.000 por vários pontos do código, e
    // basta esquecê-lo num deles para a adequação sair mil vezes errada.
    valores: { male: todas(0.9), female: todas(0.9) },
    ul: 10, fonte: IOM2011_TABELAS,
    nota: 'A fonte publica em µg (RDA 900, UL 10.000). Aqui em mg, que é a unidade da tabela de alimentos.',
  },
  {
    nutriente: 'manganesMg', rotulo: 'Manganês', grupo: 'mineral', unidade: 'mg', tipo: 'AI',
    valores: {
      male: todas(2.3),
      female: todas(1.8),
    },
    ul: 11, fonte: IOM2011_TABELAS,
    nota: 'É AI, não RDA: ingestão abaixo dela não permite concluir inadequação.',
  },
  {
    nutriente: 'vitaminaEMg', rotulo: 'Vitamina E', grupo: 'vitamina', unidade: 'mg', tipo: 'RDA',
    valores: { male: todas(15), female: todas(15) },
    ul: 1000, ulNota: 'O UL vale só para formas sintéticas (suplemento ou alimento fortificado), não para o nutriente do alimento.',
    fonte: IOM2011_TABELAS,
    nota: 'Em α-tocoferol equivalentes, que é a forma que a tabela do IBGE traz.',
  },
  {
    nutriente: 'cobalaminaMcg', rotulo: 'Vitamina B12', grupo: 'vitamina', unidade: 'µg', tipo: 'RDA',
    valores: { male: todas(2.4), female: todas(2.4) },
    ul: null, ulNota: 'UL não determinável por falta de dados de efeito adverso.',
    fonte: IOM2011_TABELAS,
  },
  {
    nutriente: 'folatoMcg', rotulo: 'Folato', grupo: 'vitamina', unidade: 'µg DFE', tipo: 'RDA',
    valores: { male: todas(400), female: todas(400) },
    ul: 1000, ulNota: 'O UL vale só para formas sintéticas (suplemento ou alimento fortificado), não para o nutriente do alimento.',
    fonte: IOM2011_TABELAS,
    nota: 'Em equivalentes dietéticos de folato (DFE), que é a forma da tabela do IBGE.',
  },

  {
    nutriente: 'vitaminaDMcg', rotulo: 'Vitamina D', grupo: 'vitamina', unidade: 'µg', tipo: 'RDA',
    // A compilação de 2006 traz AI de 5 µg (19–50), 10 (51–70) e 15 (>70),
    // com UL 50. São valores do IOM de 1997, SUPERADOS pela revisão de 2011:
    // a referência triplicou, virou RDA em vez de AI, e o UL dobrou. Usar os
    // de 1997 faria o relatório aprovar como adequada uma ingestão que a
    // recomendação vigente considera um terço do necessário.
    valores: {
      male: { '19-30': 15, '31-50': 15, '51-70': 15, '70+': 20 },
      female: { '19-30': 15, '31-50': 15, '51-70': 15, '70+': 20 },
    },
    ul: 100,
    fonte: IOM2011_TABELAS,
    nota: 'Como colecalciferol: 1 µg = 40 UI. A recomendação pressupõe '
      + 'exposição solar mínima — quem se expõe ao sol sintetiza parte, e a '
      + 'tabela não desconta isso.',
  },
];

/** Limiar de redução de risco de doença crônica. Só o sódio tem. */
export const CDRR_SODIO = {
  nutriente: 'sodioMg',
  limiteMg: 2300,
  texto: 'Reduzir a ingestão se acima de 2.300 mg/dia',
  fonte: NASEM2019,
};

/**
 * Nutrientes que a nutricionista acompanha e que a BASE DE ALIMENTOS não tem.
 *
 * Aparecem no relatório como lacuna declarada, nunca como zero: zero afirmaria
 * que a dieta não fornece o nutriente, quando o que não existe é o dado.
 */
export const SEM_DADO_NA_BASE = [
  // A importacao do IBGE resolveu selenio, fosforo, cobre, manganes,
  // vitamina E, B12 e folato. Sobraram estes:
  'Vitamina K',  // nenhuma das duas tabelas de composicao traz
  'Iodo',        // tem DRI (RDA 150 µg), mas nem a TACO nem o IBGE trazem
  'Enxofre',     // a nutricionista pediu; o IOM nunca estabeleceu DRI
];

export const referenciaDe = (nutriente: string) =>
  REFERENCIAS.find((r) => r.nutriente === nutriente);
