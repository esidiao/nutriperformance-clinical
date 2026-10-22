import {
  REFERENCIAS, CDRR_SODIO, SEM_DADO_NA_BASE, faixaDaIdade,
  type Sexo, type ValorReferencia, type GrupoNutriente,
} from './referencia-dri';

/**
 * Compara o que a dieta fornece com a recomendação diária.
 *
 * O cuidado central aqui é NÃO transformar tudo em "% da meta". Três situações
 * parecem iguais num percentual e são clinicamente distintas:
 *
 *  1. abaixo de uma RDA   → sugere inadequação
 *  2. abaixo de um AI     → não permite concluir nada; o AI não foi construído
 *                            para avaliar indivíduo
 *  3. acima do UL          → risco, e não "meta superada"
 *
 * E uma quarta, que é a mais perigosa: nutriente SEM DADO na base de
 * alimentos. Exibir zero afirmaria que a dieta não fornece o nutriente. O que
 * não existe é a informação.
 */

export type Situacao =
  | 'abaixo'        // abaixo da RDA
  | 'adequado'
  | 'acima_ul'      // ultrapassou o limite superior
  | 'acima_cdrr'    // sódio acima de 2.300 mg
  | 'indeterminado' // referência é AI: não dá para concluir
  | 'incompleto'    // nem todos os alimentos do plano têm esse dado
  | 'sem_dado';     // nenhum alimento tem o dado

/**
 * Valor com a cobertura junto, como o plano devolve.
 *
 * Aceita número puro para os macros, que vêm de campo próprio e sempre
 * existem em todo item.
 */
export type Oferta = number | {
  valor: number;
  itensComDado: number;
  itensTotal: number;
  completo: boolean;
};

const normalizar = (o: Oferta | undefined | null) => {
  if (o === undefined || o === null) return null;
  if (typeof o === 'number') return { valor: o, completo: true, itensComDado: 0, itensTotal: 0 };
  return o;
};

export interface LinhaAdequacao {
  nutriente: string;
  rotulo: string;
  grupo: GrupoNutriente;
  unidade: string;
  tipo: 'RDA' | 'AI' | '—';
  ofertado: number | null;
  recomendado: number | null;
  percentual: number | null;
  situacao: Situacao;
  /** Frase pronta, porque a leitura de cada situação é diferente. */
  leitura: string;
  fonte: string;
  nota?: string;
}

const arred = (n: number) => Math.round(n * 10) / 10;

function ulDaFaixa(ref: ValorReferencia, faixa: string): number | null {
  if (ref.ul === null || ref.ul === undefined) return null;
  if (typeof ref.ul === 'number') return ref.ul;
  return (ref.ul as Record<string, number>)[faixa] ?? null;
}

/**
 * @param totais  Soma do dia, com as MESMAS chaves de REFERENCIAS. Chave
 *                ausente = a base não tem o dado; valor 0 = a dieta não
 *                fornece. A distinção é proposital.
 */
export function avaliarAdequacao(
  totais: Partial<Record<string, Oferta>>,
  idade: number,
  sexo: Sexo,
): { linhas: LinhaAdequacao[]; faixa: string | null; semDadoNaBase: string[] } {
  const faixa = faixaDaIdade(idade);

  // Fora da faixa adulta não há tabela carregada. Devolver as linhas vazias é
  // melhor que aplicar valor de adulto a um adolescente.
  if (faixa === null) {
    return { linhas: [], faixa: null, semDadoNaBase: SEM_DADO_NA_BASE };
  }

  const linhas = REFERENCIAS.map((ref): LinhaAdequacao => {
    const base = {
      nutriente: ref.nutriente,
      rotulo: ref.rotulo,
      grupo: ref.grupo,
      unidade: ref.unidade,
      fonte: ref.fonte,
      nota: ref.nota,
    };

    const oferta = normalizar(totais[ref.nutriente]);
    if (oferta === null) {
      return {
        ...base, tipo: '—', ofertado: null, recomendado: null, percentual: null,
        situacao: 'sem_dado',
        leitura: 'A base de alimentos não traz este nutriente — não é possível avaliar.',
      };
    }

    const ofertado = oferta.valor;
    const recomendado = ref.valores[sexo][faixa];

    // Cobertura parcial vem ANTES de qualquer juízo sobre adequação. Um total
    // somado sobre parte dos alimentos é menor que o real; lido contra a RDA,
    // produziria um "abaixo da recomendação" que o dado não sustenta.
    if (!oferta.completo) {
      const faltam = oferta.itensTotal - oferta.itensComDado;
      return {
        ...base, tipo: ref.tipo, ofertado: arred(ofertado), recomendado,
        percentual: null,
        situacao: 'incompleto',
        leitura: `${faltam} de ${oferta.itensTotal} alimentos do plano não têm este nutriente na base. O total está subestimado e não dá para comparar com a recomendação.`,
      };
    }
    const percentual = recomendado > 0 ? Math.round((ofertado / recomendado) * 100) : null;
    const ul = ulDaFaixa(ref, faixa);

    // Sódio primeiro: ele não tem UL desde 2019, e sim CDRR.
    if (ref.nutriente === CDRR_SODIO.nutriente && ofertado > CDRR_SODIO.limiteMg) {
      return {
        ...base, tipo: ref.tipo, ofertado: arred(ofertado), recomendado, percentual,
        situacao: 'acima_cdrr',
        leitura: `Acima de ${CDRR_SODIO.limiteMg} mg. ${CDRR_SODIO.texto}.`,
      };
    }

    if (ul !== null && ofertado > ul) {
      return {
        ...base, tipo: ref.tipo, ofertado: arred(ofertado), recomendado, percentual,
        situacao: 'acima_ul',
        leitura: `Acima do limite superior (${ul} ${ref.unidade})${ref.ulNota ? ` — ${ref.ulNota}` : ''}.`,
      };
    }

    if (ref.tipo === 'AI') {
      // O AI não foi construído para avaliar ingestão individual. Dizer
      // "inadequado" aqui seria afirmar o que a fonte não sustenta.
      return {
        ...base, tipo: 'AI', ofertado: arred(ofertado), recomendado, percentual,
        situacao: 'indeterminado',
        leitura: ofertado >= recomendado
          ? 'Igual ou acima do AI — baixa probabilidade de inadequação.'
          : 'Abaixo do AI. O AI não permite concluir inadequação, só que não há base para afirmar adequação.',
      };
    }

    if (ofertado < recomendado) {
      return {
        ...base, tipo: 'RDA', ofertado: arred(ofertado), recomendado, percentual,
        situacao: 'abaixo',
        leitura: `Abaixo da recomendação (${percentual}% da RDA).`,
      };
    }

    return {
      ...base, tipo: 'RDA', ofertado: arred(ofertado), recomendado, percentual,
      situacao: 'adequado',
      leitura: `Atinge a recomendação (${percentual}% da RDA).`,
    };
  });

  return { linhas, faixa, semDadoNaBase: SEM_DADO_NA_BASE };
}

/** Contagem por situação, para o resumo no topo do relatório. */
export function resumir(linhas: LinhaAdequacao[]) {
  const conta = (s: Situacao) => linhas.filter((l) => l.situacao === s).length;
  return {
    adequados: conta('adequado'),
    abaixo: conta('abaixo'),
    acimaDoLimite: conta('acima_ul') + conta('acima_cdrr'),
    indeterminados: conta('indeterminado'),
    incompletos: conta('incompleto'),
    semDado: conta('sem_dado'),
  };
}
