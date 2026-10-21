/**
 * Fórmulas de gasto energético.
 *
 * ESCOPO, e por que ele não é o da lista completa
 *
 * A nutricionista mostrou a lista do software que usa: 15 opções para adulto,
 * mais protocolos infantil, gestante e lactante. Aqui entram só as equações
 * cujos coeficientes eu posso declarar, pelo mesmo motivo dos protocolos de
 * dobras: coeficiente errado não dá erro, devolve um valor calórico plausível
 * que vira prescrição.
 *
 * Cada fórmula carrega `verificacao`, e a tela mostra isso:
 *
 *   'fonte_lida'  — os coeficientes foram transcritos da publicação original,
 *                   lida nesta máquina. A FAO/WHO/UNU 2004 está assim (tabelas
 *                   5.2, 5.3 e 4.1 do relatório, lidas em fao.org), e as duas
 *                   EER 2023 também (PDF oficial do Highlights).
 *
 *   'pendente'    — os coeficientes são os de uso corrente, que conferem entre
 *                   si em várias reproduções, mas eu não li o artigo original.
 *                   Mifflin, Harris-Benedict, Katch-McArdle e Cunningham estão
 *                   assim. A conta aparece na tela justamente para que a
 *                   profissional confira contra a referência dela.
 *
 * AS DUAS ENTRADAS MANUAIS SÃO O PISO
 *
 * `tmb_manual` e `get_manual` existem para que a profissional nunca fique
 * bloqueada: se a equação que ela usa ainda não está aqui, ela calcula fora e
 * digita. É a opção mais importante do conjunto, e a única que não depende de
 * verificar coeficiente nenhum.
 *
 * TMB x GET, E POR QUE CADA FÓRMULA TRAZ A SUA ESCALA
 *
 * Quase todas estimam TMB e precisam de um fator de atividade para virar GET.
 * Algumas dão GET direto. E as escalas NÃO são intercambiáveis: a FAO publica
 * 1,40–2,40; a escala de uso corrente com Harris-Benedict vai de 1,2 a 1,9.
 * Aplicar o fator de um sistema à TMB de outro produz um GET plausível e
 * errado. Por isso `escalaAtividade` é uma propriedade da fórmula, e a tela
 * só oferece os fatores daquela escala.
 */

export type Sexo = 'male' | 'female';

export type Verificacao = 'fonte_lida' | 'pendente';

/** Qual conjunto de fatores a fórmula aceita. */
export type EscalaAtividade = 'generica' | 'fao_adulto' | 'fao_crianca' | 'eer_2023' | 'nenhuma';

/**
 * Como a atividade entra na conta. Explícito porque errar aqui dobra o GET.
 *
 * `seleciona_equacao` é o caso do EER 2023: a categoria de atividade não é um
 * multiplicador, ela escolhe uma equação inteira, com intercepto e
 * coeficientes próprios. Tratá-la como fator — multiplicar o resultado de uma
 * categoria pelo número de outra — produziria um disparate plausível.
 */
export type AjusteAtividade =
  | 'multiplica_tmb' | 'multiplica_get' | 'seleciona_equacao' | 'nenhum';

export interface Entrada {
  pesoKg?: number | null;
  alturaCm?: number | null;
  idade?: number | null;
  sexo?: Sexo | null;
  /** Massa livre de gordura, em kg. Vem da avaliação física. */
  mlgKg?: number | null;
  /** Para a fórmula de bolso e para as entradas manuais. */
  valorInformado?: number | null;
  /**
   * Categoria de atividade, quando ela ESCOLHE a equação em vez de
   * multiplicá-la. Só o EER 2023 usa.
   */
  categoriaAtividade?: string | null;
}

export interface Formula {
  id: string;
  nome: string;
  /** O que a equação devolve. */
  estima: 'tmb' | 'get';
  escalaAtividade: EscalaAtividade;
  ajuste: AjusteAtividade;
  verificacao: Verificacao;
  /** De onde vieram os coeficientes. Aparece na tela. */
  fonte: string;
  /** Campos sem os quais não calcula. */
  exige: Array<'peso' | 'altura' | 'idade' | 'sexo' | 'mlg' | 'valor'>;
  /** A conta, em texto, para conferência contra a referência da profissional. */
  constantes: string[];
  nota?: string;
  /**
   * Faixa de idade em que a equação se aplica, quando ela tem uma.
   * Fora da faixa, `calcular` em `calcularGasto` recusa em vez de extrapolar.
   */
  idadeMin?: number;
  idadeMax?: number;
  /** Sexos a que se aplica, quando a fonte lida cobre só um. */
  aplicaA?: Sexo[];
  calcular: (e: Entrada) => number | null;
}

const ok = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v > 0;
const arred = (n: number) => Math.round(n);

// ── entradas manuais ────────────────────────────────────────────────────────

const TMB_MANUAL: Formula = {
  id: 'tmb_manual',
  nome: 'Informar TMB manualmente',
  estima: 'tmb',
  escalaAtividade: 'generica',
  ajuste: 'multiplica_tmb',
  verificacao: 'fonte_lida',
  fonte: 'Valor fornecido pela profissional — nenhum coeficiente envolvido.',
  exige: ['valor'],
  constantes: ['Usa o valor digitado como TMB. O fator de atividade ainda se aplica.'],
  nota: 'Para calorimetria indireta ou equação ainda não disponível aqui.',
  calcular: (e) => (ok(e.valorInformado) ? arred(e.valorInformado) : null),
};

const GET_MANUAL: Formula = {
  id: 'get_manual',
  nome: 'Informar GET manualmente',
  estima: 'get',
  escalaAtividade: 'nenhuma',
  ajuste: 'nenhum',
  verificacao: 'fonte_lida',
  fonte: 'Valor fornecido pela profissional — nenhum coeficiente envolvido.',
  exige: ['valor'],
  constantes: [
    'Usa o valor digitado como GET.',
    'O fator de atividade NÃO se aplica — já está embutido no valor informado.',
  ],
  nota: 'Para quando o gasto total já foi determinado por outro método.',
  calcular: (e) => (ok(e.valorInformado) ? arred(e.valorInformado) : null),
};

const BOLSO: Formula = {
  id: 'bolso',
  nome: 'GET por fórmula de bolso (kcal/kg)',
  estima: 'get',
  escalaAtividade: 'nenhuma',
  ajuste: 'nenhum',
  verificacao: 'fonte_lida',
  fonte: 'A faixa de kcal/kg é escolha clínica — não há coeficiente publicado a conferir.',
  exige: ['peso', 'valor'],
  constantes: [
    'GET = peso (kg) × kcal/kg informado.',
  ],
  nota: 'Quem define quantas kcal por quilo é a profissional, conforme o objetivo.',
  calcular: (e) => (ok(e.pesoKg) && ok(e.valorInformado)
    ? arred(e.pesoKg * e.valorInformado) : null),
};

// ── FAO/WHO/UNU 2004 — lidas da fonte ───────────────────────────────────────

/**
 * Tabela 5.2 do relatório FAO/WHO/UNU 2004, em kcal/dia.
 *
 * Transcrita de fao.org/4/y5686e/y5686e07.htm (capítulo 5, seção 5.2). A
 * fonte primária dos coeficientes é Schofield (1985), que o relatório cita.
 *
 * As faixas são as da tabela, e o limite de cada uma é EXCLUSIVO no topo:
 * "18-30" vai de 18 até antes de 30. Quem tem 30 cai em "30-60". Inventar
 * arredondamento aqui mudaria a TMB de uma pessoa de 30 anos em ~100 kcal.
 */
const SCHOFIELD: Record<Sexo, Array<{ de: number; ate: number; a: number; b: number }>> = {
  male: [
    { de: 0,  ate: 3,   a: 59.512, b: -30.4 },
    { de: 3,  ate: 10,  a: 22.706, b: 504.3 },
    { de: 10, ate: 18,  a: 17.686, b: 658.2 },
    { de: 18, ate: 30,  a: 15.057, b: 692.2 },
    { de: 30, ate: 60,  a: 11.472, b: 873.1 },
    { de: 60, ate: 200, a: 11.711, b: 587.7 },
  ],
  female: [
    { de: 0,  ate: 3,   a: 58.317, b: -31.1 },
    { de: 3,  ate: 10,  a: 20.315, b: 485.9 },
    { de: 10, ate: 18,  a: 13.384, b: 692.6 },
    { de: 18, ate: 30,  a: 14.818, b: 486.6 },
    { de: 30, ate: 60,  a: 8.126,  b: 845.6 },
    { de: 60, ate: 200, a: 9.082,  b: 658.5 },
  ],
};

export function faixaSchofield(sexo: Sexo, idade: number) {
  return SCHOFIELD[sexo].find((f) => idade >= f.de && idade < f.ate) ?? null;
}

const FAO_2004: Formula = {
  id: 'fao_who_unu_2004',
  nome: 'FAO/WHO/UNU 2004 (Schofield) — TMB por peso e faixa etária',
  estima: 'tmb',
  escalaAtividade: 'fao_adulto',
  ajuste: 'multiplica_tmb',
  verificacao: 'fonte_lida',
  fonte: 'FAO/WHO/UNU 2004, Human energy requirements, Tabela 5.2 (após Schofield, 1985). Lida em fao.org.',
  exige: ['peso', 'idade', 'sexo'],
  constantes: [
    'Não é uma equação só: é uma por faixa de idade e sexo (kcal/dia).',
    'Homens   <3a: 59,512×kg − 30,4   · 3–10a: 22,706×kg + 504,3 · 10–18a: 17,686×kg + 658,2',
    'Homens  18–30a: 15,057×kg + 692,2 · 30–60a: 11,472×kg + 873,1 · ≥60a: 11,711×kg + 587,7',
    'Mulheres <3a: 58,317×kg − 31,1   · 3–10a: 20,315×kg + 485,9 · 10–18a: 13,384×kg + 692,6',
    'Mulheres 18–30a: 14,818×kg + 486,6 · 30–60a: 8,126×kg + 845,6  · ≥60a: 9,082×kg + 658,5',
    'A faixa é fechada embaixo e aberta em cima: 30 anos cai em "30–60".',
  ],
  nota: 'Usa a escala PAL da própria FAO (1,40 a 2,40), não a de 1,2 a 1,9.',
  calcular: (e) => {
    if (!ok(e.pesoKg) || !ok(e.idade) || !e.sexo) return null;
    const f = faixaSchofield(e.sexo, e.idade);
    return f ? arred(f.a * e.pesoKg + f.b) : null;
  },
};

/**
 * Tabela 4.1 — ganho de peso médio, em g/dia, por faixa de idade.
 *
 * Entra no cálculo infantil porque o requerimento da criança é TEE mais a
 * energia depositada no crescimento. Omitir essa parcela subestima a
 * necessidade de uma criança em fase de estirão em até ~30 kcal/dia.
 */
const GANHO_PESO_G_DIA: Record<Sexo, Array<{ de: number; ate: number; gDia: number }>> = {
  male: [
    { de: 1, ate: 2, gDia: 6.6 }, { de: 2, ate: 3, gDia: 5.5 },
    { de: 3, ate: 4, gDia: 5.8 }, { de: 4, ate: 5, gDia: 5.5 },
    { de: 5, ate: 6, gDia: 5.5 }, { de: 6, ate: 7, gDia: 6.0 },
    { de: 7, ate: 8, gDia: 6.6 }, { de: 8, ate: 9, gDia: 7.7 },
    { de: 9, ate: 10, gDia: 9.0 }, { de: 10, ate: 11, gDia: 10.7 },
    { de: 11, ate: 12, gDia: 12.3 }, { de: 12, ate: 13, gDia: 14.2 },
    { de: 13, ate: 14, gDia: 15.9 }, { de: 14, ate: 15, gDia: 16.2 },
    { de: 15, ate: 16, gDia: 14.8 }, { de: 16, ate: 17, gDia: 11.5 },
    { de: 17, ate: 18, gDia: 7.1 },
  ],
  female: [
    { de: 1, ate: 2, gDia: 6.6 }, { de: 2, ate: 3, gDia: 6.0 },
    { de: 3, ate: 4, gDia: 5.2 }, { de: 4, ate: 5, gDia: 4.7 },
    { de: 5, ate: 6, gDia: 4.9 }, { de: 6, ate: 7, gDia: 6.3 },
    { de: 7, ate: 8, gDia: 8.2 }, { de: 8, ate: 9, gDia: 10.1 },
    { de: 9, ate: 10, gDia: 11.0 }, { de: 10, ate: 11, gDia: 12.3 },
    { de: 11, ate: 12, gDia: 12.3 }, { de: 12, ate: 13, gDia: 12.6 },
    { de: 13, ate: 14, gDia: 11.5 }, { de: 14, ate: 15, gDia: 9.3 },
    { de: 15, ate: 16, gDia: 6.0 }, { de: 16, ate: 17, gDia: 2.2 },
    { de: 17, ate: 18, gDia: 0 },
  ],
};

export function ganhoPesoGDia(sexo: Sexo, idade: number): number | null {
  const f = GANHO_PESO_G_DIA[sexo].find((x) => idade >= x.de && idade < x.ate);
  return f ? f.gDia : null;
}

/** Energia depositada por grama de peso ganho — seção 4.3 do relatório. */
export const KCAL_POR_GRAMA_DE_CRESCIMENTO = 2;

/**
 * Redução de 7% na faixa de 1 a 2 anos.
 *
 * O relatório diz, na seção 4.4: os requerimentos de 1 a 2 anos "foram
 * reduzidos em 7 por cento" para costurar com os requerimentos de lactente.
 * Sem isso, a equação devolve ~1017 kcal para um menino de 11,5 kg onde a
 * Tabela 4.2 publica 948 — 7% acima, e eu só descobri porque testei a
 * equação CONTRA a tabela da própria fonte em vez de só conferir o
 * coeficiente.
 */
export const REDUCAO_1_A_2_ANOS = 0.93;

const FAO_CRIANCA: Formula = {
  id: 'fao_2004_crianca',
  nome: 'FAO/WHO/UNU 2004 — criança e adolescente (1 a 17 anos)',
  estima: 'get',
  escalaAtividade: 'fao_crianca',
  ajuste: 'multiplica_get',
  verificacao: 'fonte_lida',
  fonte: 'FAO/WHO/UNU 2004, Tabelas 4.1 a 4.6 (após Torun, 2001). Lida em fao.org.',
  exige: ['peso', 'idade', 'sexo'],
  idadeMin: 1,
  idadeMax: 18,
  constantes: [
    'Meninos: TEE (kcal/dia) = 310,2 + 63,3×kg − 0,263×kg²',
    'Meninas: TEE (kcal/dia) = 263,4 + 65,3×kg − 0,454×kg²',
    `Requerimento = TEE + (ganho de peso g/dia × ${KCAL_POR_GRAMA_DE_CRESCIMENTO} kcal/g).`,
    'O ganho de peso vem da Tabela 4.1 por idade e sexo — não é digitado.',
    'De 1 a 2 anos o TEE leva redução de 7%, como manda a seção 4.4 do relatório.',
    'O valor já corresponde a atividade MODERADA. Leve é −15%, vigorosa +15%.',
    'O ajuste de ±15% só se aplica a partir dos 6 anos (a tabela deixa as colunas em branco antes).',
  ],
  nota: 'O relatório adverte que a abordagem por PAL deve ser evitada em lactentes e crianças pequenas.',
  calcular: (e) => {
    if (!ok(e.pesoKg) || !ok(e.idade) || !e.sexo) return null;
    const kg = e.pesoKg;
    let tee = e.sexo === 'male'
      ? 310.2 + 63.3 * kg - 0.263 * kg * kg
      : 263.4 + 65.3 * kg - 0.454 * kg * kg;
    if (e.idade < 2) tee *= REDUCAO_1_A_2_ANOS;
    const ganho = ganhoPesoGDia(e.sexo, e.idade);
    if (ganho === null) return null;
    return arred(tee + ganho * KCAL_POR_GRAMA_DE_CRESCIMENTO);
  },
};

// ── EER/DRI 2023 — conjunto completo, lido da fonte ─────────────────────────

/**
 * NASEM 2023, Dietary Reference Intakes for Energy, capítulo 5.
 *
 * Transcrito das Tabelas 5-15 (criança e adolescente) e 5-16 (adulto), lidas
 * em nationalacademies.org/read/26818/chapter/7.
 *
 * DUAS COISAS QUE SE ERRA NESTA FAMÍLIA DE EQUAÇÕES
 *
 * 1. ALTURA EM CENTÍMETROS. A nota das tabelas é explícita: "Age is in years,
 *    weight is in kilograms, and height is in centimeters." Usar metros erra
 *    por um fator de 100 no termo da altura — e como os outros termos
 *    continuam certos, o total sai baixo e plausível, não absurdo.
 *
 * 2. A CATEGORIA DE ATIVIDADE NÃO É UM FATOR. Diferente do IOM 2005, aqui
 *    cada categoria é uma EQUAÇÃO INTEIRA, com intercepto e coeficientes
 *    próprios. Repare: para homem, o coeficiente da altura vai de 6,50
 *    (inativo) a 15,61 (muito ativo), e o intercepto de +1.004,82 (ativo) a
 *    −517,88 (muito ativo). Multiplicar o resultado de uma categoria pelo
 *    número de outra não tem significado nenhum.
 */

interface CoefEer {
  intercepto: number;
  idade: number;
  altura: number;
  peso: number;
}

export type CategoriaEer = 'inativo' | 'pouco_ativo' | 'ativo' | 'muito_ativo';

/** Tabela 5-16 — adultos, 19 anos ou mais. */
const EER_ADULTO: Record<Sexo, Record<CategoriaEer, CoefEer>> = {
  male: {
    inativo:      { intercepto:  753.07, idade: -10.83, altura:  6.50, peso: 14.10 },
    pouco_ativo:  { intercepto:  581.47, idade: -10.83, altura:  8.30, peso: 14.94 },
    ativo:        { intercepto: 1004.82, idade: -10.83, altura:  6.52, peso: 15.91 },
    muito_ativo:  { intercepto: -517.88, idade: -10.83, altura: 15.61, peso: 19.11 },
  },
  female: {
    inativo:      { intercepto:  584.90, idade: -7.01, altura: 5.72, peso: 11.71 },
    pouco_ativo:  { intercepto:  575.77, idade: -7.01, altura: 6.60, peso: 12.14 },
    ativo:        { intercepto:  710.25, idade: -7.01, altura: 6.54, peso: 12.34 },
    muito_ativo:  { intercepto:  511.83, idade: -7.01, altura: 9.07, peso: 12.56 },
  },
};

/**
 * Tabela 5-15 — crianças e adolescentes de 3 a 18,99 anos.
 *
 * Os coeficientes são os MESMOS dos 3 aos 18,99 anos dentro de cada sexo; o
 * que muda com a idade é só a parcela de energia de crescimento.
 */
const EER_JOVEM: Record<Sexo, Record<CategoriaEer, CoefEer>> = {
  male: {
    inativo:      { intercepto: -447.51, idade: 3.68, altura: 13.01, peso: 13.15 },
    pouco_ativo:  { intercepto:   19.12, idade: 3.68, altura:  8.62, peso: 20.28 },
    ativo:        { intercepto: -388.19, idade: 3.68, altura: 12.66, peso: 20.46 },
    muito_ativo:  { intercepto: -671.75, idade: 3.68, altura: 15.38, peso: 23.25 },
  },
  female: {
    inativo:      { intercepto:   55.59, idade: -22.25, altura:  8.43, peso: 17.07 },
    pouco_ativo:  { intercepto: -297.54, idade: -22.25, altura: 12.77, peso: 14.73 },
    ativo:        { intercepto: -189.55, idade: -22.25, altura: 11.74, peso: 18.34 },
    muito_ativo:  { intercepto: -709.59, idade: -22.25, altura: 18.22, peso: 14.25 },
  },
};

/** Faixa de 0 a 2,99 anos: equação única, SEM categoria de atividade. */
const EER_BEBE: Record<Sexo, CoefEer> = {
  male:   { intercepto: -716.45, idade:  -1.00, altura: 17.82, peso: 15.06 },
  female: { intercepto:  -69.15, idade:  80.00, altura:  2.65, peso: 54.15 },
};

/**
 * Energia de crescimento, em kcal/dia, pelas notas de rodapé da Tabela 5-15.
 *
 * Esta parcela é pequena e é justamente por isso que some: 15 kcal a mais ou
 * a menos não chamam atenção em lugar nenhum. Fica explícita e testada.
 */
export function crescimentoEer(sexo: Sexo, idade: number): number | null {
  if (idade < 0) return null;
  if (idade < 0.25) return sexo === 'male' ? 200 : 180;   // 0 a 2,99 meses
  if (idade < 0.5) return sexo === 'male' ? 50 : 60;      // 3 a 5,99 meses
  if (idade < 1) return 20;                                // 6 a 11,99 meses
  if (idade < 3) return sexo === 'male' ? 20 : 15;         // 12 a 35,99 meses
  if (idade < 4) return sexo === 'male' ? 20 : 15;         // 3 anos
  if (idade < 9) return 15;                                // 4 a 8 anos
  if (idade < 14) return sexo === 'male' ? 25 : 30;        // 9 a 13 anos
  if (idade < 19) return 20;                               // 14 a 18 anos
  return 0;                                                // adulto: não cresce
}

const EER_2023: Formula = {
  id: 'eer_dri_2023',
  nome: 'EER / DRI 2023 — por categoria de atividade',
  estima: 'get',
  escalaAtividade: 'eer_2023',
  ajuste: 'seleciona_equacao',
  verificacao: 'fonte_lida',
  fonte: 'NASEM 2023, Dietary Reference Intakes for Energy, Tabelas 5-15 e 5-16. Lidas em nationalacademies.org.',
  exige: ['peso', 'altura', 'idade', 'sexo'],
  constantes: [
    'ALTURA EM CENTÍMETROS — a nota da tabela é explícita. Em metros, erra por 100 no termo da altura.',
    'A categoria de atividade ESCOLHE a equação; não é um fator que multiplica.',
    'Homem 19+  inativo: 753,07 − 10,83·idade + 6,50·alt + 14,10·peso',
    'Homem 19+  pouco ativo: 581,47 − 10,83·idade + 8,30·alt + 14,94·peso',
    'Homem 19+  ativo: 1.004,82 − 10,83·idade + 6,52·alt + 15,91·peso',
    'Homem 19+  muito ativo: −517,88 − 10,83·idade + 15,61·alt + 19,11·peso',
    'Mulher 19+ inativa: 584,90 − 7,01·idade + 5,72·alt + 11,71·peso',
    'Mulher 19+ pouco ativa: 575,77 − 7,01·idade + 6,60·alt + 12,14·peso',
    'Mulher 19+ ativa: 710,25 − 7,01·idade + 6,54·alt + 12,34·peso',
    'Mulher 19+ muito ativa: 511,83 − 7,01·idade + 9,07·alt + 12,56·peso',
    'De 3 a 18,99 anos há outro conjunto, mais a energia de crescimento (15 a 30 kcal/dia).',
    'Abaixo de 3 anos a equação é única e NÃO tem categoria de atividade.',
    'Erro padrão da predição: 241 kcal/dia em mulheres e 342 em homens adultos.',
  ],
  nota: 'É a família que a tabela do IOM 2005 não traz: aquela publica valores no peso de referência, não uma equação para o peso da paciente.',
  calcular: (e) => {
    if (!ok(e.pesoKg) || !ok(e.alturaCm) || e.idade === null || e.idade === undefined || !e.sexo) {
      return null;
    }
    const { pesoKg: p, alturaCm: a, idade: i, sexo: s } = e;
    const crescimento = crescimentoEer(s, i);
    if (crescimento === null) return null;

    const aplicar = (c: CoefEer) =>
      c.intercepto + c.idade * i + c.altura * a + c.peso * p + crescimento;

    // Abaixo de 3 anos a fonte não usa categoria de atividade.
    if (i < 3) return arred(aplicar(EER_BEBE[s]));

    const cat = e.categoriaAtividade as CategoriaEer | null | undefined;
    if (!cat) return null;
    const tabela = i < 19 ? EER_JOVEM : EER_ADULTO;
    const coef = tabela[s][cat];
    if (!coef) return null;
    return arred(aplicar(coef));
  },
};
// ── equações de artigo, coeficientes de uso corrente ────────────────────────

const MIFFLIN: Formula = {
  id: 'mifflin_1990',
  nome: 'Mifflin-St Jeor (1990)',
  estima: 'tmb',
  escalaAtividade: 'generica',
  ajuste: 'multiplica_tmb',
  verificacao: 'pendente',
  fonte: 'Coeficientes de uso corrente; o artigo original (Am J Clin Nutr, 1990) não foi lido aqui.',
  exige: ['peso', 'altura', 'idade', 'sexo'],
  constantes: [
    'Homens:   TMB = 10×peso(kg) + 6,25×altura(cm) − 5×idade + 5',
    'Mulheres: TMB = 10×peso(kg) + 6,25×altura(cm) − 5×idade − 161',
  ],
  calcular: (e) => {
    if (!ok(e.pesoKg) || !ok(e.alturaCm) || !ok(e.idade) || !e.sexo) return null;
    const base = 10 * e.pesoKg + 6.25 * e.alturaCm - 5 * e.idade;
    return arred(e.sexo === 'male' ? base + 5 : base - 161);
  },
};

const HB_1984: Formula = {
  id: 'harris_benedict_1984',
  nome: 'Harris-Benedict revisada (Roza & Shizgal, 1984)',
  estima: 'tmb',
  escalaAtividade: 'generica',
  ajuste: 'multiplica_tmb',
  verificacao: 'pendente',
  fonte: 'Coeficientes de uso corrente; a revisão de 1984 não foi lida aqui.',
  exige: ['peso', 'altura', 'idade', 'sexo'],
  constantes: [
    'Homens:   TMB = 88,362 + 13,397×peso + 4,799×altura(cm) − 5,677×idade',
    'Mulheres: TMB = 447,593 + 9,247×peso + 3,098×altura(cm) − 4,330×idade',
  ],
  nota: 'É a REVISÃO de 1984, não a original de 1919 — os coeficientes diferem.',
  calcular: (e) => {
    if (!ok(e.pesoKg) || !ok(e.alturaCm) || !ok(e.idade) || !e.sexo) return null;
    return arred(e.sexo === 'male'
      ? 88.362 + 13.397 * e.pesoKg + 4.799 * e.alturaCm - 5.677 * e.idade
      : 447.593 + 9.247 * e.pesoKg + 3.098 * e.alturaCm - 4.330 * e.idade);
  },
};

const KATCH: Formula = {
  id: 'katch_mcardle',
  nome: 'Katch-McArdle',
  estima: 'tmb',
  escalaAtividade: 'generica',
  ajuste: 'multiplica_tmb',
  verificacao: 'pendente',
  fonte: 'Coeficientes de uso corrente; a publicação original não foi lida aqui.',
  exige: ['mlg'],
  constantes: ['TMB = 370 + 21,6 × massa livre de gordura (kg)'],
  nota: 'Não distingue sexo: a diferença já está na composição corporal.',
  calcular: (e) => (ok(e.mlgKg) ? arred(370 + 21.6 * e.mlgKg) : null),
};

const CUNNINGHAM: Formula = {
  id: 'cunningham_1980',
  nome: 'Cunningham (1980)',
  estima: 'tmb',
  escalaAtividade: 'generica',
  ajuste: 'multiplica_tmb',
  verificacao: 'pendente',
  fonte: 'Coeficientes de uso corrente; o artigo original não foi lido aqui.',
  exige: ['mlg'],
  constantes: ['TMB = 500 + 22 × massa livre de gordura (kg)'],
  nota: 'Não distingue sexo, pelo mesmo motivo da Katch-McArdle.',
  calcular: (e) => (ok(e.mlgKg) ? arred(500 + 22 * e.mlgKg) : null),
};

export const FORMULAS: Formula[] = [
  TMB_MANUAL, GET_MANUAL, BOLSO,
  EER_2023,
  FAO_2004, FAO_CRIANCA,
  MIFFLIN, HB_1984,
  KATCH, CUNNINGHAM,
];

export const formulaPorId = (id: string) => FORMULAS.find((f) => f.id === id);

/**
 * Pedidas e ainda NÃO disponíveis, com o motivo.
 *
 * Enquanto não entram, `tmb_manual` e `get_manual` cobrem o uso: a
 * profissional calcula pela referência dela e digita o valor.
 */
export const PENDENTES = [
  { nome: 'Harris-Benedict original (1919)', motivo: 'coeficientes diferentes da revisão de 1984; preciso confirmar na fonte' },
  {
    nome: 'EER/IOM 2005',
    motivo: 'o capítulo 5 do relatório de 2005 está publicado só como imagem digitalizada, sem camada de texto — não consegui transcrever nem as equações nem os coeficientes de atividade. Use o EER 2023, que é a atualização desse mesmo sistema',
  },
  { nome: 'Mifflin-St Jeor por MLG (1990)', motivo: 'variante diferente da equação por peso' },
  { nome: 'Henry & Rees (1991)', motivo: 'preciso confirmar os coeficientes' },
  { nome: 'Tinsley (2018), por peso e por MLG', motivo: 'duas variantes; preciso confirmar as duas' },
  {
    nome: 'EER 2023 para gestante e lactante',
    motivo: 'as equações JÁ estão verificadas (Tabelas 5-17 a 5-19); falta a tela pedir semana gestacional, IMC pré-gestacional e tempo de pós-parto, que nenhuma outra fórmula usa',
  },
  { nome: 'Lactente (0 a 12 meses)', motivo: 'a FAO 2004 traz as equações de Butte; ainda não transcritas' },
];

// ── escalas de fator de atividade ───────────────────────────────────────────

export interface FatorAtividade {
  id: string;
  label: string;
  valor: number;
  detalhe?: string;
}

/**
 * Escala de uso corrente, usada com Harris-Benedict e Mifflin.
 *
 * ⚠️ Não é publicada pela FAO nem pelo IOM. É a escala que circula na prática
 * clínica e que a maioria dos softwares aplica a essas duas equações.
 */
const GENERICA: FatorAtividade[] = [
  { id: 'sedentary', label: 'Sedentário', valor: 1.2 },
  { id: 'lightly_active', label: 'Levemente ativo', valor: 1.375 },
  { id: 'moderately_active', label: 'Moderadamente ativo', valor: 1.55 },
  { id: 'very_active', label: 'Muito ativo', valor: 1.725 },
  { id: 'extremely_active', label: 'Extremamente ativo', valor: 1.9 },
];

/**
 * Tabela 5.3 do relatório FAO/WHO/UNU 2004 — classificação por PAL.
 *
 * A tabela publica FAIXAS, não valores pontuais. O ponto médio de cada faixa
 * é escolha nossa, e está dito no `detalhe` para que a profissional possa
 * discordar e usar outro valor da faixa.
 */
const FAO_ADULTO: FatorAtividade[] = [
  { id: 'fao_leve', label: 'Sedentário ou atividade leve', valor: 1.55, detalhe: 'faixa publicada 1,40–1,69' },
  { id: 'fao_moderado', label: 'Ativo ou moderadamente ativo', valor: 1.85, detalhe: 'faixa publicada 1,70–1,99' },
  { id: 'fao_vigoroso', label: 'Vigoroso ou vigorosamente ativo', valor: 2.20, detalhe: 'faixa publicada 2,00–2,40; acima de 2,40 é difícil sustentar' },
];

/**
 * Ajuste infantil da FAO: as tabelas 4.5/4.6 publicam leve, moderada e
 * vigorosa, com leve 15% abaixo e vigorosa 15% acima da moderada. O valor
 * calculado pela equação JÁ é a moderada, então o fator aqui é multiplicador
 * do GET, não da TMB.
 */
const FAO_CRIANCA_FATORES: FatorAtividade[] = [
  { id: 'fao_inf_leve', label: 'Atividade leve', valor: 0.85, detalhe: '15% abaixo da moderada; só a partir dos 6 anos' },
  { id: 'fao_inf_moderada', label: 'Atividade moderada', valor: 1.0, detalhe: 'é o valor que a equação devolve' },
  { id: 'fao_inf_vigorosa', label: 'Atividade vigorosa', valor: 1.15, detalhe: '15% acima da moderada; só a partir dos 6 anos' },
];

/**
 * Categorias do EER 2023.
 *
 * `valor` aqui NÃO é multiplicador — é só um número de ordenação. A escolha
 * seleciona a equação inteira; o `id` é o que importa, e ele é lido em
 * `Entrada.categoriaAtividade`. Deixar `valor` como 1 seria convidar alguém
 * a multiplicar por ele.
 *
 * As faixas de PAL são as da Tabela 7-1 do relatório, que publica também os
 * pontos representativos (1,4 / 1,6 / 1,75 / 2,05). O relatório adverte que
 * NÃO existe instrumento validado para classificar o PAL de um indivíduo, e
 * que estas categorias não correspondem às diretrizes de atividade física —
 * por isso o detalhe aparece na tela, e a escolha é clínica.
 */
const EER_CATEGORIAS: FatorAtividade[] = [
  { id: 'inativo', label: 'Inativo', valor: 1.40, detalhe: 'PAL de 1,00 a 1,53 — minimamente ativo, sem atividade ocupacional' },
  { id: 'pouco_ativo', label: 'Pouco ativo', valor: 1.60, detalhe: 'PAL de 1,53 a 1,68' },
  { id: 'ativo', label: 'Ativo', valor: 1.75, detalhe: 'PAL de 1,68 a 1,85' },
  { id: 'muito_ativo', label: 'Muito ativo', valor: 2.05, detalhe: 'PAL de 1,85 a 2,50' },
];

export const ESCALAS: Record<EscalaAtividade, FatorAtividade[]> = {
  generica: GENERICA,
  fao_adulto: FAO_ADULTO,
  fao_crianca: FAO_CRIANCA_FATORES,
  eer_2023: EER_CATEGORIAS,
  nenhuma: [],
};

/** Idade a partir da qual o ±15% infantil da FAO existe na tabela. */
export const IDADE_MINIMA_AJUSTE_INFANTIL = 6;

/** Idade a partir da qual o EER 2023 usa categoria de atividade. */
export const IDADE_MINIMA_CATEGORIA_EER = 3;

export function fatoresDe(formula: Formula, idade?: number | null): FatorAtividade[] {
  const base = ESCALAS[formula.escalaAtividade];

  if (formula.escalaAtividade === 'fao_crianca') {
    // Antes dos 6 anos a FAO não publica leve nem vigorosa: só moderada.
    if (!ok(idade) || idade < IDADE_MINIMA_AJUSTE_INFANTIL) {
      return base.filter((f) => f.id === 'fao_inf_moderada');
    }
    return base;
  }

  if (formula.escalaAtividade === 'eer_2023') {
    // Abaixo de 3 anos a fonte usa uma equação única, sem categoria. Oferecer
    // as quatro faria a profissional escolher algo que não entra na conta.
    if (ok(idade) && idade < IDADE_MINIMA_CATEGORIA_EER) return [];
    return base;
  }

  return base;
}

export function fatorPorId(formula: Formula, id: string): number | null {
  return ESCALAS[formula.escalaAtividade].find((f) => f.id === id)?.valor ?? null;
}

/** Mantido para compatibilidade com telas que ainda usam a escala genérica. */
export const FATORES_ATIVIDADE = GENERICA;

// ── cálculo ─────────────────────────────────────────────────────────────────

export interface Resultado {
  tmb: number | null;
  get: number | null;
  /** O que falta para calcular, em palavras. */
  faltando: string[];
  /** Por que a fórmula não se aplica a este paciente. Não é o mesmo que faltar dado. */
  naoSeAplica: string | null;
}

const ROTULO_CAMPO: Record<string, string> = {
  peso: 'peso', altura: 'altura', idade: 'idade', sexo: 'sexo',
  mlg: 'massa livre de gordura', valor: 'o valor informado',
};

const ROTULO_SEXO: Record<Sexo, string> = { male: 'homens', female: 'mulheres' };

/**
 * Aplica a fórmula e o fator de atividade.
 *
 * Três recusas distintas, e a tela mostra qual delas é:
 *
 *   - falta dado   → a profissional preenche e segue;
 *   - não se aplica → a equação é de outra faixa de idade ou de outro sexo;
 *                     extrapolar devolveria um número plausível e inválido;
 *   - sem fator    → há TMB, falta a escolha da atividade para chegar ao GET.
 */
export function calcular(
  formula: Formula,
  entrada: Entrada,
  fatorAtividade: number | null,
): Resultado {
  const vazio = { tmb: null, get: null };

  if (formula.aplicaA && entrada.sexo && !formula.aplicaA.includes(entrada.sexo)) {
    return {
      ...vazio, faltando: [],
      naoSeAplica: `Esta equação, na fonte lida, cobre apenas ${formula.aplicaA.map((s) => ROTULO_SEXO[s]).join(' e ')}.`,
    };
  }

  if (ok(entrada.idade)) {
    if (formula.idadeMin !== undefined && entrada.idade < formula.idadeMin) {
      return {
        ...vazio, faltando: [],
        naoSeAplica: `Esta equação vale a partir de ${formula.idadeMin} anos. Para ${entrada.idade}, use outra.`,
      };
    }
    if (formula.idadeMax !== undefined && entrada.idade >= formula.idadeMax) {
      return {
        ...vazio, faltando: [],
        naoSeAplica: `Esta equação vale até ${formula.idadeMax} anos (exclusive). Para ${entrada.idade}, use outra.`,
      };
    }
  }

  const faltando = formula.exige
    .filter((campo) => {
      if (campo === 'peso') return !ok(entrada.pesoKg);
      if (campo === 'altura') return !ok(entrada.alturaCm);
      if (campo === 'idade') return !ok(entrada.idade);
      if (campo === 'sexo') return !entrada.sexo;
      if (campo === 'mlg') return !ok(entrada.mlgKg);
      return !ok(entrada.valorInformado);
    })
    .map((c) => ROTULO_CAMPO[c]);

  if (faltando.length) return { ...vazio, faltando, naoSeAplica: null };

  // Quando a categoria ESCOLHE a equação, ela é dado obrigatório, não ajuste
  // opcional: sem ela não há equação para aplicar. Isto precisa aparecer como
  // "falta a categoria", e não como um resultado calculado por omissão.
  if (formula.ajuste === 'seleciona_equacao' && fatoresDe(formula, entrada.idade).length) {
    if (!entrada.categoriaAtividade) {
      return { ...vazio, faltando: ['a categoria de atividade'], naoSeAplica: null };
    }
  }

  const valor = formula.calcular(entrada);
  if (valor === null) {
    return {
      ...vazio, faltando: [],
      naoSeAplica: 'A fonte não publica coeficiente para esta combinação de idade e sexo.',
    };
  }

  // A categoria já entrou escolhendo a equação; multiplicar aqui seria contar
  // a atividade duas vezes.
  if (formula.ajuste === 'nenhum' || formula.ajuste === 'seleciona_equacao') {
    return { tmb: null, get: valor, faltando: [], naoSeAplica: null };
  }

  if (formula.ajuste === 'multiplica_get') {
    // O valor JÁ é GET (atividade moderada). O fator ajusta, não converte.
    return {
      tmb: null,
      get: arred(valor * (fatorAtividade ?? 1)),
      faltando: [],
      naoSeAplica: null,
    };
  }

  return {
    tmb: valor,
    get: fatorAtividade ? arred(valor * fatorAtividade) : null,
    faltando: fatorAtividade ? [] : ['o fator de atividade'],
    naoSeAplica: null,
  };
}
