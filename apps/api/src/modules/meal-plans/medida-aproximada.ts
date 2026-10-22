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

import { descreverQuantidade } from '../../../../web/lib/medida-caseira';

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
 * A regra de plural mora em `apps/web/lib/medida-caseira.ts`, porque a TELA
 * escreve a mesma frase e escrevia sem flexionar ("3 colher de sopa"). Uma
 * regra, dois chamadores.
 */
export function descreverMedida(m: MedidaAproximada): string {
  return descreverQuantidade(m.quantidade, m.medida);
}
