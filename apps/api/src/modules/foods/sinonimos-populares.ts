/**
 * Sinônimos populares e regionais para a base TACO.
 *
 * A TACO usa o nome técnico ("Mandioca, crua"), mas metade do Brasil chama de
 * aipim e a outra metade de macaxeira. Sem isso, a busca só encontra quem
 * digita o termo da tabela — e o campo `nomes_populares` existia vazio nos 597
 * alimentos, com a busca já consultando ele.
 *
 * REGRA DE INCLUSÃO — este é dado clínico: um sinônimo errado leva a
 * profissional a prescrever outro alimento. Só entram aqui:
 *
 *   1. nomes regionais do MESMO alimento (mandioca = aipim = macaxeira);
 *   2. grafias alternativas correntes (mozarela = muçarela = mussarela);
 *   3. correções de erro de digitação da própria TACO (filé mingnon);
 *   4. o nome usual quando a tabela usa o técnico (batata inglesa = batata).
 *
 * NÃO entram: alimentos parecidos porém distintos (inhame e cará são plantas
 * diferentes e a composição difere), nem cortes que o mercado às vezes
 * confunde. Na dúvida, fica de fora — não encontrar é um incômodo, encontrar
 * o alimento errado é um erro clínico.
 *
 * A chave é casada contra o nome padronizado, sem acento e sem caixa.
 */
export interface RegraSinonimo {
  /** Trecho que precisa aparecer no nome padronizado (sem acento, minúsculo). */
  contem: string;
  /** Termos populares a acrescentar. */
  sinonimos: string[];
  /** Trechos que, se presentes, impedem a regra — evita casar alimento errado. */
  exceto?: string[];
}

export const REGRAS_SINONIMOS: RegraSinonimo[] = [
  // ── Raízes e tubérculos ────────────────────────────────────────────────────
  { contem: 'mandioca', sinonimos: ['aipim', 'macaxeira'] },
  { contem: 'batata, baroa', sinonimos: ['mandioquinha', 'batata salsa', 'cenoura amarela'] },
  { contem: 'batata, inglesa', sinonimos: ['batata'] },
  { contem: 'batata, doce', sinonimos: ['jetica'] },

  // ── Hortaliças ─────────────────────────────────────────────────────────────
  { contem: 'abobora', sinonimos: ['jerimum'] },
  { contem: 'abobrinha', sinonimos: ['abobrinha verde'] },
  { contem: 'couve, manteiga', sinonimos: ['couve'] },
  { contem: 'alho-poro', sinonimos: ['alho porro', 'alho poro'] },
  { contem: 'beterraba', sinonimos: ['betarraba'] },
  { contem: 'pimentao', sinonimos: ['pimenta doce'] },
  // "Ervilha, em vagem" é ervilha-torta, não vagem de feijão.
  { contem: 'vagem', sinonimos: ['feijao verde'], exceto: ['ervilha'] },
  { contem: 'cebolinha', sinonimos: ['cheiro verde', 'cebolinha verde'] },
  { contem: 'coentro', sinonimos: ['cheiro verde'] },
  { contem: 'salsa, crua', sinonimos: ['salsinha', 'cheiro verde'] },
  { contem: 'rucula', sinonimos: ['rucola'] },
  { contem: 'brocolis', sinonimos: ['brocoli'] },

  // ── Frutas ─────────────────────────────────────────────────────────────────
  { contem: 'mexerica', sinonimos: ['bergamota', 'mimosa', 'tangerina'] },
  { contem: 'tangerina', sinonimos: ['bergamota', 'mexerica', 'mimosa'] },
  { contem: 'mamao, papaia', sinonimos: ['mamao papaia', 'papaia'] },
  { contem: 'mamao, formosa', sinonimos: ['mamao formosa'] },
  { contem: 'maracuja', sinonimos: ['maracuja azedo'] },
  { contem: 'graviola', sinonimos: ['jaca de pobre'] },
  // Pinhão é semente de araucária; pinha é fruta-do-conde. "pinha" casa como
  // prefixo de "pinhão", então a exceção é obrigatória — sem ela o pinhão
  // recebia sinônimo de outra fruta.
  { contem: 'pinha', sinonimos: ['fruta do conde', 'ata'], exceto: ['pinhao'] },
  { contem: 'ciriguela', sinonimos: ['seriguela', 'siriguela'] },
  { contem: 'jamelao', sinonimos: ['jambolao', 'azeitona preta do mato'] },
  { contem: 'nespera', sinonimos: ['ameixa amarela'] },
  { contem: 'banana, da terra', sinonimos: ['banana comprida'] },
  { contem: 'banana, nanica', sinonimos: ['banana dagua', 'banana caturra'] },

  // ── Leguminosas, castanhas e cereais ───────────────────────────────────────
  { contem: 'feijao, fradinho', sinonimos: ['feijao de corda', 'feijao macassar'] },
  { contem: 'grao-de-bico', sinonimos: ['grao de bico'] },
  { contem: 'castanha-do-brasil', sinonimos: ['castanha do para', 'castanha do brasil'] },
  { contem: 'castanha-de-caju', sinonimos: ['castanha de caju'] },
  { contem: 'amendoim', sinonimos: ['mendoim'] },
  { contem: 'milho, fuba', sinonimos: ['fuba'] },
  { contem: 'farinha, de mandioca', sinonimos: ['farinha de mesa', 'farinha seca'] },
  { contem: 'pao, trigo, frances', sinonimos: ['pao frances', 'pao de sal', 'cacetinho', 'paozinho', 'filao'] },
  { contem: 'pao, trigo, forma, integral', sinonimos: ['pao integral', 'pao de forma integral'] },
  { contem: 'macarrao', sinonimos: ['massa'] },

  // ── Carnes ─────────────────────────────────────────────────────────────────
  // A TACO grava "mingnon" — erro da própria tabela.
  { contem: 'file mingnon', sinonimos: ['file mignon', 'mignon'] },
  { contem: 'contra-file', sinonimos: ['contra file'] },
  { contem: 'coxao mole', sinonimos: ['chã de dentro'] },
  { contem: 'coxao duro', sinonimos: ['chã de fora', 'lagarto redondo'] },
  { contem: 'bovina, seca', sinonimos: ['carne seca', 'carne de sol', 'jabá'] },
  { contem: 'charque', sinonimos: ['carne seca', 'jabá'] },
  { contem: 'porco, bisteca', sinonimos: ['costeleta de porco', 'bisteca suina'] },
  { contem: 'porco, pernil', sinonimos: ['pernil suino'] },
  { contem: 'linguica', sinonimos: ['linguica'] },
  { contem: 'frango, sobrecoxa', sinonimos: ['sobrecoxa'] },
  { contem: 'frango, peito', sinonimos: ['peito de frango', 'file de frango'] },
  { contem: 'bovina, acem', sinonimos: ['acem'] },
  { contem: 'bovina, patinho', sinonimos: ['patinho'] },

  // ── Laticínios e ovos ──────────────────────────────────────────────────────
  { contem: 'queijo, mozarela', sinonimos: ['mucarela', 'mussarela', 'muzarela'] },
  { contem: 'queijo, minas, frescal', sinonimos: ['queijo branco', 'queijo fresco'] },
  { contem: 'queijo, requeijao', sinonimos: ['requeijao'] },
  { contem: 'soja, queijo (tofu)', sinonimos: ['tofu', 'queijo de soja'] },
  { contem: 'leite, de vaca, integral', sinonimos: ['leite integral'] },
  { contem: 'leite, de vaca, desnatado', sinonimos: ['leite desnatado'] },
  { contem: 'ovo, de galinha', sinonimos: ['ovo de galinha', 'ovo'] },

  // ── Pescados ───────────────────────────────────────────────────────────────
  { contem: 'cacao', sinonimos: ['cacao', 'tubarao'] },
  { contem: 'corimbata', sinonimos: ['curimbata', 'grumatã'] },
  { contem: 'pintado', sinonimos: ['surubim', 'cachara'] },
  { contem: 'tucunare', sinonimos: ['tucunare'] },

  // ── Açúcares e diversos ────────────────────────────────────────────────────
  { contem: 'acucar, mascavo', sinonimos: ['acucar mascavo'] },
  { contem: 'rapadura', sinonimos: ['raspadura'] },
  { contem: 'polvilho, doce', sinonimos: ['goma de tapioca', 'goma'] },
  { contem: 'fecula, de mandioca', sinonimos: ['polvilho', 'goma'] },
  { contem: 'azeite, de dende', sinonimos: ['dende', 'oleo de dende'] },
  { contem: 'shoyu', sinonimos: ['molho de soja', 'shoyo'] },
];

const semAcento = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '');
const normalizar = (s: string) => semAcento(s).toLowerCase();

/**
 * Sinônimos aplicáveis a um alimento, já sem repetição e sem repetir palavra
 * que o próprio nome já contém (não ajudaria a busca).
 */
export function sinonimosPara(nomePadronizado: string): string[] {
  const nome = normalizar(nomePadronizado);
  const fora = new Set<string>();

  for (const regra of REGRAS_SINONIMOS) {
    if (!nome.includes(normalizar(regra.contem))) continue;
    if (regra.exceto?.some((e) => nome.includes(normalizar(e)))) continue;
    for (const s of regra.sinonimos) {
      if (!nome.includes(normalizar(s))) fora.add(s);
    }
  }

  return [...fora].sort();
}
