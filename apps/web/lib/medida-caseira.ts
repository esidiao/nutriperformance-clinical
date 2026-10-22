/**
 * Como se escreve uma quantidade em medida caseira, em português.
 *
 * POR QUE ESTÁ EM `apps/web/lib`
 *
 * A regra nasceu dentro de `apps/api/.../medida-aproximada.ts`, que a usava
 * para descrever a troca sugerida na lista do paciente. Só que a TELA também
 * escreve essa frase — e escrevia sozinha, sem flexionar: o seletor de medida
 * caseira mostrava "3 colher de sopa" e gravava essa descrição no registro,
 * enquanto a API, no mesmo monorepo, tinha o plural certo.
 *
 * Achado em 22/10/2026 abrindo a tela na bancada de verificação. Os 1054
 * testes passavam: todos exercitavam a função da API, e nenhum exercitava a
 * frase que a tela monta. Duas implementações da mesma frase é uma a mais, e
 * a que ninguém testou foi a que o paciente ia ler.
 *
 * Agora há UMA regra, aqui, e a API a importa — a mesma direção dos outros
 * cruzamentos do monorepo (`apps/api` já importa `apps/web/lib`).
 */

/** Onde a flexão para: depois da preposição vem locução, que não concorda. */
const PREPOSICAO = /^(de|da|do|das|dos|em|com|para|a|ao)$/i;

/**
 * Plurais que a regra não deriva e a base exige.
 *
 * `porcao` está na base (99 medidas distintas, conferidas em 22/10/2026 com
 * `apps/api/scripts/conferir-plurais-das-medidas.mjs`) e caía na regra de
 * vogal, virando **"porcaos"** — que não é palavra, na frase que o PACIENTE lê
 * na lista de trocas. A base vem sem acento, então o guarda de "ão" nunca
 * disparava.
 *
 * Aqui não há regra inventada: há a palavra que existe, com o plural escrito à
 * mão. O que não estiver nesta tabela e terminar em ao/ão fica no singular.
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
export function pluralizarMedida(medida: string): string {
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

/** "2 colheres de sopa", "1 concha", "1,5 fatia". */
export function descreverQuantidade(quantidade: number, medida: string): string {
  const q = quantidade.toLocaleString('pt-BR', { maximumFractionDigits: 1 });
  const plural = quantidade > 1 && !/s$/i.test(medida);
  return `${q} ${plural ? pluralizarMedida(medida) : medida}`;
}
