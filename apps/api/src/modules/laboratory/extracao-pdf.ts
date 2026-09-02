/**
 * Leitura de exame laboratorial em PDF — lacuna 12 do benchmark.
 *
 * A extração é feita por IA, e o resultado NUNCA é gravado direto. Ele vira um
 * rascunho que a profissional confere campo a campo antes de salvar. A razão é
 * concreta: um modelo que leia "TSH 4,5" como "45" produz um valor dez vezes
 * maior dentro de um prontuário, e ninguém perceberia — não há nada no número
 * 45 que denuncie o erro. Extração automática economiza digitação; ela não
 * substitui a conferência de quem assina.
 *
 * Por isso cada valor extraído volta acompanhado do TRECHO LITERAL do laudo de
 * onde saiu. A profissional confere olhando a linha, não relendo o PDF inteiro.
 */

export interface Marcador {
  /** Propriedade da entidade LaboratoryExam. */
  campo: string;
  /** Como o marcador aparece nos laudos brasileiros. */
  nomes: string[];
  unidade: string;
  /**
   * Faixa fisiologicamente possível — larga de propósito.
   *
   * Não serve para julgar o resultado (isso é ato clínico), e sim para pegar
   * erro de leitura: casa decimal perdida, unidade trocada, dois marcadores
   * colados numa linha. Valor fora da faixa é MARCADO, nunca descartado.
   */
  min: number;
  max: number;
}

export const MARCADORES: Marcador[] = [
  // Hemograma
  { campo: 'hemoglobinGDl', nomes: ['hemoglobina', 'hb'], unidade: 'g/dL', min: 2, max: 25 },
  { campo: 'hematocritPct', nomes: ['hematócrito', 'hematocrito', 'ht'], unidade: '%', min: 10, max: 70 },
  { campo: 'mcvFl', nomes: ['vcm', 'volume corpuscular médio'], unidade: 'fL', min: 50, max: 130 },
  { campo: 'mchcGDl', nomes: ['chcm'], unidade: 'g/dL', min: 20, max: 40 },
  { campo: 'leukocytesUl', nomes: ['leucócitos', 'leucocitos', 'global de leucócitos'], unidade: '/µL', min: 500, max: 100000 },
  { campo: 'plateletsUl', nomes: ['plaquetas'], unidade: '/µL', min: 5000, max: 1500000 },

  // Ferro
  { campo: 'ferritinNgMl', nomes: ['ferritina'], unidade: 'ng/mL', min: 1, max: 5000 },
  { campo: 'serumIronUgDl', nomes: ['ferro sérico', 'ferro serico', 'ferro'], unidade: 'µg/dL', min: 5, max: 500 },
  { campo: 'tibcUgDl', nomes: ['tibc', 'capacidade total de ligação do ferro', 'ctlf'], unidade: 'µg/dL', min: 50, max: 800 },
  { campo: 'transferrinSaturationPct', nomes: ['saturação de transferrina', 'saturacao de transferrina', 'ist'], unidade: '%', min: 1, max: 100 },

  // Vitaminas
  { campo: 'vitaminDNgMl', nomes: ['vitamina d', '25-hidroxivitamina d', '25(oh)d', 'calcidiol'], unidade: 'ng/mL', min: 1, max: 200 },
  { campo: 'vitaminB12PgMl', nomes: ['vitamina b12', 'b12', 'cobalamina'], unidade: 'pg/mL', min: 20, max: 5000 },
  { campo: 'folicAcidNgMl', nomes: ['ácido fólico', 'acido folico', 'folato'], unidade: 'ng/mL', min: 0.2, max: 50 },

  // Minerais
  { campo: 'zincUgDl', nomes: ['zinco'], unidade: 'µg/dL', min: 10, max: 300 },
  { campo: 'magnesiumMgDl', nomes: ['magnésio', 'magnesio'], unidade: 'mg/dL', min: 0.5, max: 6 },
  { campo: 'calciumMgDl', nomes: ['cálcio', 'calcio', 'cálcio total'], unidade: 'mg/dL', min: 4, max: 16 },

  // Glicemia
  { campo: 'fastingGlucoseMgDl', nomes: ['glicose', 'glicemia de jejum', 'glicemia'], unidade: 'mg/dL', min: 20, max: 800 },
  { campo: 'hba1cPct', nomes: ['hemoglobina glicada', 'hba1c', 'a1c'], unidade: '%', min: 2, max: 20 },
  { campo: 'insulinUuiMl', nomes: ['insulina'], unidade: 'µUI/mL', min: 0.2, max: 400 },
  { campo: 'homaIr', nomes: ['homa-ir', 'homa ir', 'homa'], unidade: '', min: 0.1, max: 50 },

  // Lipídios
  { campo: 'totalCholesterolMgDl', nomes: ['colesterol total'], unidade: 'mg/dL', min: 50, max: 700 },
  { campo: 'hdlMgDl', nomes: ['hdl', 'colesterol hdl'], unidade: 'mg/dL', min: 5, max: 150 },
  { campo: 'ldlMgDl', nomes: ['ldl', 'colesterol ldl'], unidade: 'mg/dL', min: 10, max: 500 },
  { campo: 'vldlMgDl', nomes: ['vldl', 'colesterol vldl'], unidade: 'mg/dL', min: 1, max: 200 },
  { campo: 'triglyceridesMgDl', nomes: ['triglicerídeos', 'triglicerides', 'triglicérides'], unidade: 'mg/dL', min: 10, max: 3000 },

  // Renal
  { campo: 'creatinineMgDl', nomes: ['creatinina'], unidade: 'mg/dL', min: 0.1, max: 20 },
  { campo: 'ureaMgDl', nomes: ['ureia', 'uréia'], unidade: 'mg/dL', min: 3, max: 300 },
  { campo: 'uricAcidMgDl', nomes: ['ácido úrico', 'acido urico'], unidade: 'mg/dL', min: 0.5, max: 20 },
  { campo: 'egfrMlMin', nomes: ['tfg', 'taxa de filtração glomerular', 'egfr', 'clearance'], unidade: 'mL/min', min: 1, max: 200 },

  // Hepático
  { campo: 'altUL', nomes: ['tgp', 'alt', 'alanina aminotransferase'], unidade: 'U/L', min: 1, max: 5000 },
  { campo: 'astUL', nomes: ['tgo', 'ast', 'aspartato aminotransferase'], unidade: 'U/L', min: 1, max: 5000 },
  { campo: 'ggtUL', nomes: ['gama gt', 'ggt', 'gama glutamil'], unidade: 'U/L', min: 1, max: 3000 },
  { campo: 'albuminGDl', nomes: ['albumina'], unidade: 'g/dL', min: 1, max: 7 },

  // Hormônios
  { campo: 'tshUuiMl', nomes: ['tsh', 'hormônio tireoestimulante'], unidade: 'µUI/mL', min: 0.001, max: 150 },
  { campo: 'freeT4NgDl', nomes: ['t4 livre', 't4l', 'tiroxina livre'], unidade: 'ng/dL', min: 0.05, max: 12 },
  { campo: 'testosteroneNgDl', nomes: ['testosterona', 'testosterona total'], unidade: 'ng/dL', min: 1, max: 3000 },
  { campo: 'cortisolUgDl', nomes: ['cortisol'], unidade: 'µg/dL', min: 0.1, max: 80 },

  // Inflamação
  { campo: 'crpMgL', nomes: ['pcr', 'proteína c reativa', 'proteina c reativa'], unidade: 'mg/L', min: 0.01, max: 500 },
];

export const CAMPOS_VALIDOS = new Set(MARCADORES.map((m) => m.campo));

/** Lista para o prompt: campo, nomes aceitos e unidade esperada. */
export function catalogoParaPrompt(): string {
  return MARCADORES.map(
    (m) => `- ${m.campo} (${m.unidade || 'sem unidade'}): ${m.nomes.join(', ')}`,
  ).join('\n');
}

export interface ValorExtraido {
  campo: string;
  valor: number;
  unidadeNoLaudo: string | null;
  /** Linha literal do laudo. É como a profissional confere sem reler o PDF. */
  trecho: string;
  /** Fora da faixa fisiológica: provável erro de leitura, não de saúde. */
  suspeito: boolean;
  motivoSuspeita?: string;
}

export interface RascunhoExame {
  valores: ValorExtraido[];
  collectionDate: string | null;
  laboratoryName: string | null;
  /** Marcadores que a IA viu mas não soube mapear. Nunca some em silêncio. */
  naoMapeados: { nome: string; valor: string; trecho: string }[];
  avisos: string[];
}

const semAcento = (s: string) =>
  String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

/**
 * Converte número em formato brasileiro. "1.234,56" e "4,5" são o normal em
 * laudo daqui; tratar como formato americano viraria 1.23456 e 45.
 */
export function paraNumero(bruto: unknown): number | null {
  if (typeof bruto === 'number') return Number.isFinite(bruto) ? bruto : null;
  if (typeof bruto !== 'string') return null;

  const limpo = bruto.replace(/[^\d.,-]/g, '').trim();
  if (!/\d/.test(limpo) || limpo === '-') return null;

  const temVirgula = limpo.includes(',');
  const temPonto = limpo.includes('.');

  let normalizado = limpo;
  if (temVirgula && temPonto) {
    // "1.234,56" — ponto é milhar, vírgula é decimal.
    normalizado = limpo.replace(/\./g, '').replace(',', '.');
  } else if (temVirgula) {
    normalizado = limpo.replace(',', '.');
  } else if (temPonto) {
    // Só ponto é ambíguo em laudo brasileiro: "4.5" é decimal à americana,
    // mas "7.500" (leucócitos) é sete mil e quinhentos, não sete e meio.
    //
    // Regra: exatamente três dígitos após o ponto E parte inteira diferente de
    // zero => separador de milhar. A ressalva do zero importa — "0.500" só
    // pode ser meio, porque não existe milhar começando em zero.
    const milhar = /^-?([1-9]\d{0,2})(\.\d{3})+$/.test(limpo);
    normalizado = milhar ? limpo.replace(/\./g, '') : limpo;
  }

  const n = Number(normalizado);
  return Number.isFinite(n) ? n : null;
}

/**
 * Normaliza e valida o que a IA devolveu.
 *
 * Descarta campo desconhecido, converte número em formato brasileiro e MARCA
 * (sem descartar) o que caiu fora da faixa fisiológica. Descartar seria pior:
 * a profissional não veria que o laudo tinha aquele marcador e não saberia que
 * precisa digitar à mão.
 */
export function normalizarRascunho(bruto: any): RascunhoExame {
  const avisos: string[] = [];
  const valores: ValorExtraido[] = [];
  const vistos = new Set<string>();

  const porCampo = new Map(MARCADORES.map((m) => [m.campo, m]));

  for (const item of Array.isArray(bruto?.valores) ? bruto.valores : []) {
    const campo = String(item?.campo ?? '');
    const marcador = porCampo.get(campo);

    if (!marcador) {
      // Campo que não existe na entidade não pode entrar: viraria coluna
      // fantasma ou erro de escrita no banco.
      if (campo) {
        avisos.push(`Campo desconhecido ignorado: "${campo}"`);
      }
      continue;
    }

    // Marcador repetido: laudo às vezes traz o mesmo exame em duas páginas.
    // Fica com o primeiro e avisa, em vez de sobrescrever sem dizer nada.
    if (vistos.has(campo)) {
      avisos.push(`"${marcador.nomes[0]}" apareceu mais de uma vez — usei a primeira ocorrência.`);
      continue;
    }

    const valor = paraNumero(item?.valor);
    if (valor === null) {
      avisos.push(`Não consegui ler o valor de "${marcador.nomes[0]}".`);
      continue;
    }

    const foraDaFaixa = valor < marcador.min || valor > marcador.max;
    vistos.add(campo);
    valores.push({
      campo,
      valor,
      unidadeNoLaudo: item?.unidade ? String(item.unidade) : null,
      trecho: String(item?.trecho ?? '').slice(0, 300),
      suspeito: foraDaFaixa,
      ...(foraDaFaixa && {
        motivoSuspeita:
          `Valor fora da faixa possível para ${marcador.nomes[0]} `
          + `(${marcador.min}–${marcador.max} ${marcador.unidade}). `
          + 'Provável erro de leitura — confira no laudo.',
      }),
    });
  }

  const naoMapeados = (Array.isArray(bruto?.naoMapeados) ? bruto.naoMapeados : [])
    .slice(0, 50)
    .map((n: any) => ({
      nome: String(n?.nome ?? '').slice(0, 120),
      valor: String(n?.valor ?? '').slice(0, 60),
      trecho: String(n?.trecho ?? '').slice(0, 300),
    }))
    .filter((n: any) => n.nome);

  // Data em formato brasileiro é o normal no laudo; converte para ISO, que é
  // o que a entidade espera.
  let collectionDate: string | null = null;
  const dataBruta = String(bruto?.collectionDate ?? '').trim();
  const br = dataBruta.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (br) collectionDate = `${br[3]}-${br[2]}-${br[1]}`;
  else if (/^\d{4}-\d{2}-\d{2}$/.test(dataBruta)) collectionDate = dataBruta;
  else if (dataBruta) avisos.push(`Data de coleta não reconhecida: "${dataBruta}"`);

  if (!valores.length) {
    avisos.push('Nenhum marcador conhecido foi encontrado. Confira se o arquivo é um laudo laboratorial.');
  }

  return {
    valores,
    collectionDate,
    laboratoryName: bruto?.laboratoryName ? String(bruto.laboratoryName).slice(0, 160) : null,
    naoMapeados,
    avisos,
  };
}

export { semAcento };
