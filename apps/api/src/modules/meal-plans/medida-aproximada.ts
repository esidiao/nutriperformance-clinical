/**
 * Traduz gramas para a medida caseira mais próxima.
 *
 * POR QUE A LISTA DE TROCAS PRECISA DISTO
 *
 * A lista vai para a mão do paciente. "235,3 g de batata" exige balança, e
 * ninguém tem balança na cozinha — a troca correta vira troca não feita. "2
 * colheres de servir" é o que ele consegue seguir.
 *
 * O QUE ESTA FUNÇÃO NÃO PODE FAZER
 *
 * Não pode mentir sobre a conta. A medida caseira é uma APROXIMAÇÃO: duas
 * colheres de servir de batata não pesam exatamente os 235,3 g que a
 * equivalência pediu. Então o resultado carrega o peso real da medida
 * sugerida e o desvio em relação ao alvo, e a tela mostra os dois. Esconder
 * o desvio transformaria uma aproximação declarada numa afirmação falsa.
 *
 * E quando nenhuma medida chega perto, ela devolve `null` em vez de forçar:
 * "0,3 concha" não é instrução que alguém execute.
 */

export interface MedidaDisponivel {
  medida: string;
  gramas: number;
  padrao: boolean;
}

export interface MedidaAproximada {
  /** Quantas unidades, em passos de meio. */
  quantidade: number;
  medida: string;
  /** O que a medida sugerida realmente pesa. */
  gramasReais: number;
  /** Diferença para o alvo da equivalência, em gramas. */
  desvioG: number;
  /** O mesmo desvio em percentual do alvo. */
  desvioPct: number;
}

/**
 * Até onde a aproximação é aceitável, em percentual do alvo.
 *
 * Acima disso a medida caseira deixa de representar a prescrição. 10% de
 * 235 g são 23 g — pouco numa batata, e é por isso que o limite é relativo e
 * não absoluto: 10% de uma colher de azeite são menos de 1 g.
 */
export const DESVIO_MAXIMO_PCT = 10;

/**
 * Passos de meia unidade.
 *
 * Um quarto de concha não é instrução executável, e "2,37 colheres" menos
 * ainda. Meio é o menor passo que alguém mede na cozinha sem balança.
 */
const PASSOS = [0.5, 1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10];

const arred1 = (n: number) => Math.round(n * 10) / 10;

export function aproximarEmMedida(
  gramasAlvo: number,
  medidas: MedidaDisponivel[],
): MedidaAproximada | null {
  if (!Number.isFinite(gramasAlvo) || gramasAlvo <= 0) return null;
  if (!medidas?.length) return null;

  let melhor: MedidaAproximada | null = null;

  for (const m of medidas) {
    const gramasUnidade = Number(m.gramas);
    if (!(gramasUnidade > 0)) continue;

    for (const passo of PASSOS) {
      const gramasReais = gramasUnidade * passo;
      const desvioG = gramasReais - gramasAlvo;
      const desvioPct = Math.abs(desvioG / gramasAlvo) * 100;
      if (desvioPct > DESVIO_MAXIMO_PCT) continue;

      const candidata: MedidaAproximada = {
        quantidade: passo,
        medida: m.medida,
        gramasReais: arred1(gramasReais),
        desvioG: arred1(desvioG),
        desvioPct: arred1(desvioPct),
      };

      // Entre duas que cabem no limite, vence a mais próxima. Empatando,
      // vence a mais FÁCIL DE EXECUTAR — e aí "menos unidades" é critério
      // ruim: meia travessa nao e mais simples que uma concha. A ordem e:
      // unidade inteira antes de fracionada, depois a de menor contagem.
      if (melhor === null || melhorQue(candidata, melhor)) melhor = candidata;
    }
  }

  return melhor;
}

/** Dentro do limite de desvio, qual das duas e a melhor instrucao. */
function melhorQue(a: MedidaAproximada, b: MedidaAproximada): boolean {
  const EMPATE = 0.05;
  if (a.desvioPct < b.desvioPct - EMPATE) return true;
  if (a.desvioPct > b.desvioPct - EMPATE) {
    if (Math.abs(a.desvioPct - b.desvioPct) > EMPATE) return false;
  }
  // Desvio empatado: inteira ganha de fracionada.
  const aInteira = Number.isInteger(a.quantidade);
  const bInteira = Number.isInteger(b.quantidade);
  if (aInteira !== bInteira) return aInteira;
  return a.quantidade < b.quantidade;
}

/**
 * "2 colheres de sopa", "1 concha", "1,5 fatia".
 *
 * ⚠️ ESTA REGRA EXISTE DUAS VEZES, DE PROPÓSITO.
 *
 * A outra cópia é `apps/web/lib/medida-caseira.ts`, que a TELA usa. Eu tentei
 * unificar importando a da web daqui, e o deploy do Render quebrou de duas
 * maneiras ao mesmo tempo: o Dockerfile copia só `apps/api` (então
 * `apps/web/lib` não existe na imagem), e o `tsc`, ao incluir um arquivo fora
 * de `apps/api`, re-enraizou a saída em `dist/api/src/main.js` enquanto o
 * `CMD` aponta para `dist/src/main.js`. Local passava: `tsc --noEmit` limpo e
 * 1062 testes verdes.
 *
 * Então código de PRODUÇÃO da API não importa de `apps/web` — só spec importa,
 * porque spec não entra na imagem. Há um teste que proíbe isso
 * (`sem-import-de-web.spec.ts`), e outro que compara as duas cópias caso a
 * caso (`medida-caseira-na-tela.spec.ts`): divergir passa a quebrar a suíte,
 * que é a garantia que a unificação ia dar.
 */
export function descreverMedida(m: MedidaAproximada): string {
  const q = m.quantidade.toLocaleString('pt-BR', { maximumFractionDigits: 1 });
  const plural = m.quantidade > 1 && !/s$/i.test(m.medida);
  return `${q} ${plural ? pluralizar(m.medida) : m.medida}`;
}

/**
 * Plural da primeira palavra, que é o substantivo: "colheres de sopa", não
 * "colher de sopas".
 *
 * COBRE O QUE A BASE TEM, E SÓ
 *
 * As 87 medidas do IBGE terminam em vogal (55), em ")" (29, como
 * "lata (n. e.)"), em "r" (2) ou em "s" (1). Não há nenhuma terminada em
 * "l" nem em "ão" — os dados vêm sem acento, então é "porcao", não "porção".
 *
 * Uma versão anterior tinha regras para "ão" e "l". Eram código morto
 * fingindo cobrir casos que não existem, e a de "l" produzia "pasteis" em
 * vez de "pastéis" — errado se um dia ocorresse. O que não se sabe
 * flexionar fica no singular, que é feio e honesto, em vez de inventado.
 */
/** Onde a flexão para: depois da preposição vem locução, que não concorda. */
const PREPOSICAO = /^(de|da|do|das|dos|em|com|para|a|ao)$/i;

/** Exportada para `scripts/conferir-plurais-das-medidas.ts` rodar a regra
 *  sobre a base inteira. O conferidor precisa exercitar ESTA copia: e a que
 *  escreve a lista que o paciente le. */
export function pluralizar(medida: string): string {
  const palavras = medida.split(' ');

  // "lata (n. e.)" e parentéticos: qualquer flexão vira disparate.
  if (palavras.some((p) => /[)(]/.test(p))) return medida;

  const saida: string[] = [];
  let parou = false;

  for (const palavra of palavras) {
    // "colher de sopa" vira "colheres de sopa", nunca "colheres de sopas":
    // depois da preposição está a locução, que fica no singular. Mas
    // "unidade media" vira "unidades medias", porque ali "media" é
    // adjetivo e concorda. É a preposição que separa os dois casos.
    if (PREPOSICAO.test(palavra)) parou = true;
    saida.push(parou ? palavra : flexionar(palavra));
  }

  return saida.join(' ');
}

/**
 * Plurais que a regra não deriva e a base exige.
 *
 * Igual à cópia da tela. `porcao` está entre as 99 medidas da base (conferido
 * em 22/10/2026 com `scripts/conferir-plurais-das-medidas.ts`) e caía na regra
 * de vogal, virando "porcaos" — na frase que o PACIENTE lê na lista de trocas.
 * A base vem sem acento, então o guarda de "ão" nunca disparava.
 */
const PLURAIS_CONHECIDOS: Record<string, string> = {
  porcao: 'porcoes',
  porção: 'porções',
};

function flexionar(p: string): string {
  if (/s$/i.test(p)) return p;                 // já plural: "gomos"

  const conhecido = PLURAIS_CONHECIDOS[p.toLowerCase()];
  if (conhecido) return conhecido;

  // "ão" fica no SINGULAR, e não é preguiça: o plural não é derivável da
  // palavra. São três padrões — pão/pães, limão/limões, irmão/irmãos — e
  // nada na forma escrita diz qual. Eu cheguei a escrever a regra "ões",
  // que acerta limão e erra pão. Sem a regra, "2 pão" é feio; com ela,
  // "2 pões" é errado, e errado com cara de certo.
  //
  // O "ao" sem acento entra no mesmo guarda: a base do IBGE vem sem acentos, e
  // era por isso que "porcao" escapava para a regra de vogal.
  if (/(ão|ao)$/i.test(p)) return p;
  if (/[aeiou]$/i.test(p)) return `${p}s`;
  if (/r$|z$/i.test(p)) return `${p}es`;
  return p;                                     // não sei: não invento
}
