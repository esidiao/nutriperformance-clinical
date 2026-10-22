/**
 * Grupos de troca: a classificação que decide com o que um alimento pode ser
 * substituído.
 *
 * POR QUE NÃO SÃO OS GRUPOS DA TACO
 *
 * Os 15 grupos da TACO são taxonômicos: separam por origem botânica e
 * culinária. Para substituir, o que importa é o PAPEL NUTRICIONAL. Os dois
 * critérios discordam em casos que não são exceções raras:
 *
 *   - abacate, coco e açaí são "frutas" com mais de 60% da energia em
 *     gordura — trocam com castanha, não com maçã;
 *   - batata-doce e mandioca são "verduras" com 77 e 125 kcal/100 g —
 *     trocam com arroz no almoço, não com alface;
 *   - biscoito recheado é "cereal" — e oferecê-lo como troca de arroz numa
 *     lista que vai para a mão do paciente é dar permissão;
 *   - costela e linguiça são gordura por percentual e continuam sendo carne.
 *
 * DE ONDE VEM CADA REGRA
 *
 * As decisões de agrupamento são da nutricionista, tomadas em 21/10/2026, e
 * estão anotadas uma a uma abaixo. Não são inferência minha: cada uma muda o
 * que o paciente lê como autorizado, e isso é escolha clínica.
 *
 * A classificação é DERIVADA, não armazenada: depende só dos campos do
 * próprio alimento. Guardá-la numa coluna criaria duas verdades, e a coluna
 * envelheceria em silêncio quando a composição fosse corrigida.
 */

import { familiaDoNome } from './familias-por-nome';

export type GrupoTroca =
  | 'Cereais, pães e tubérculos'
  | 'Frutas'
  | 'Hortaliças e vegetais'
  | 'Leguminosas'
  | 'Proteínas magras'
  | 'Proteínas gordas'
  | 'Leites e iogurtes'
  | 'Queijos'
  | 'Gorduras e oleaginosas'
  | 'Açúcares e ultraprocessados'
  | 'Bebidas';

export type Nutriente = 'carboidratosG' | 'proteinasG' | 'lipidiosG' | 'energiaKcal';

/** O que o alimento precisa ter para ser classificado. */
export interface ParaClassificar {
  nomePadronizado: string;
  grupoAlimentar: string | null;
  energiaKcal: number | null;
  proteinasG: number | null;
  carboidratosG: number | null;
  lipidiosG: number | null;
}

export interface Classificacao {
  grupo: GrupoTroca | null;
  /** Quando não há grupo, por quê. A tela mostra isto em vez de omitir. */
  motivo?: string;
  /** Marca os casos em que a composição contrariou a taxonomia da TACO. */
  reclassificado?: boolean;
  /**
   * O grupo saiu do NOME, porque o alimento não tem grupo da TACO.
   *
   * A tela mostra isto: é uma dedução minha sobre a origem do alimento, não
   * um dado da base. A profissional precisa poder desconfiar da troca antes
   * de mandá-la para o paciente.
   */
  derivadoDoNome?: boolean;
}

// ── limiares ────────────────────────────────────────────────────────────────

/** Acima disto, a energia do alimento é predominantemente gordura. */
export const LIPIDIO_PURO = 60;

/** Corte entre proteína magra e gorda, em % da energia. */
export const LIPIDIO_MAGRO = 35;

/** Proteína mínima para uma preparação contar como fonte de proteína. */
export const PROTEINA_RELEVANTE = 20;

/**
 * Densidade que separa leite e iogurte de queijo, em kcal/100 g.
 *
 * A separação NÃO é por percentual de gordura: leite integral tem ~50% da
 * energia em gordura e continua sendo leite. O que distingue queijo é a
 * concentração — e foi essa a decisão da profissional.
 */
export const DENSIDADE_LACTEO = 100;

/**
 * Tubérculos que a TACO guarda em "Verduras e hortaliças".
 *
 * Casar por nome é frágil, e por isso esta lista é explícita e curta em vez
 * de uma heurística: um alimento novo que não casar aqui fica em hortaliças,
 * que é o comportamento anterior, não um erro novo.
 *
 * O LIMITE DE PALAVRA É `(?!\p{L})`, NÃO `\b`
 *
 * Em JavaScript, `\b` só conhece letras ASCII. Depois do "á" de "cará" não
 * existe limite de palavra para a engine, porque "á" não é caractere de
 * palavra — então `cará\b` NUNCA casa. Com `\b`, batata e inhame eram
 * reclassificados e o cará caía calado em hortaliças: metade da regra
 * funcionando é pior que a regra inteira ausente, porque ninguém desconfia.
 *
 * O lookahead por letra Unicode trata os dois casos igual, e continua
 * impedindo que "caramelo" e "caranguejo" casem com "cará".
 */
const TUBERCULO = /^(batata|mandioca|aipim|macaxeira|inhame|cará|mandioquinha)(?!\p{L})/iu;

/**
 * Produtos de cereal que não são alimento básico.
 *
 * Decisão da profissional: biscoito e bolo não podem aparecer como troca de
 * arroz ou pão. A lista vai para a mão do paciente, e o que estiver nela é
 * permissão — se ela quiser oferecer, escolhe de propósito.
 */
const ULTRAPROCESSADO =
  /biscoito|bolo\b|wafer|salgadinho|chips|mistura para|cereal matinal|achocolatado em p/i;

const ORIGEM_PROTEICA = /^(Carnes|Pescados|Ovos)/i;

const num = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

/** Reparte a energia entre os macros, em percentual. Atwater. */
export function perfilEnergetico(a: ParaClassificar) {
  const kp = num(a.proteinasG) * 4;
  const kc = num(a.carboidratosG) * 4;
  const kl = num(a.lipidiosG) * 9;
  const total = kp + kc + kl;
  if (total <= 0) return null;
  return { p: (kp / total) * 100, c: (kc / total) * 100, l: (kl / total) * 100 };
}

/**
 * Classifica um alimento no grupo de troca.
 *
 * A ORDEM das regras é a regra: origem antes de percentual, senão a costela
 * vira azeite. Mexer na ordem muda o resultado mesmo sem mexer em limiar
 * nenhum.
 */
export function classificarGrupoTroca(a: ParaClassificar): Classificacao {
  const taco = a.grupoAlimentar ?? '';
  const nome = a.nomePadronizado ?? '';
  const kcal = num(a.energiaKcal);

  const perfil = perfilEnergetico(a);
  if (!perfil) {
    return {
      grupo: null,
      motivo: 'A base não registra macronutrientes para este alimento, então não há como calcular equivalência.',
    };
  }
  const magra = perfil.l < LIPIDIO_MAGRO;

  // Condimento não é porção de nada: 61 kcal de shoyu não se trocam por
  // 61 kcal de arroz.
  if (/^Miscel/i.test(taco)) {
    return { grupo: null, motivo: 'É condimento ou tempero, não uma porção de alimento.' };
  }

  // ── Sem grupo da TACO: a origem vem do NOME ───────────────────────────────
  //
  // O IBGE não publica grupo alimentar, e eram 1971 de 2568 alimentos assim.
  // Todo o resto desta função decide a partir de `taco`, então sem ele o
  // alimento caía no `return` final sem grupo — e os poucos que escapavam
  // escapavam ERRADO, pela regra de lipídio: "CARNE SECA", 65% da energia em
  // gordura, era oferecida como troca de azeite e castanha.
  //
  // A classificação por nome vem ANTES das regras de composição justamente
  // por isso: origem manda sobre percentual, igual ao caminho da TACO. Ver
  // `familias-por-nome.ts` para as famílias e para o freio.
  if (!taco) {
    const familia = familiaDoNome(nome);
    if (familia) {
      switch (familia.decisao.tipo) {
        case 'sem_porcao':
          return { grupo: null, motivo: familia.decisao.motivo };
        case 'proteina':
          return { grupo: magra ? 'Proteínas magras' : 'Proteínas gordas', derivadoDoNome: true };
        case 'lacteo':
          return {
            grupo: kcal < DENSIDADE_LACTEO ? 'Leites e iogurtes' : 'Queijos',
            derivadoDoNome: true,
          };
        case 'grupo':
          return { grupo: familia.decisao.grupo, derivadoDoNome: true };
      }
    }
    // AQUI NÃO ENTRA REGRA DE COMPOSIÇÃO, E ISSO FOI MEDIDO.
    //
    // Minha primeira versão caía na regra de lipídio quase puro quando nenhuma
    // família casava. Conferindo os 87 nomes que isso produziu em
    // "Gorduras e oleaginosas", **mais da metade estava errada**: bisteca,
    // cupim, rabada, paio, chouriço, morcela, patê e pé de galinha viravam
    // troca de azeite; muçarela e creme de queijo também; e bomba, pavê,
    // rocambole e biscoito de polvilho entravam como gordura em vez de doce.
    //
    // Era o mesmo defeito do "CARNE SECA" que motivou este arquivo, só mais
    // adiante na função. Percentual de gordura não diz origem, e sem origem a
    // troca é arbitrária. Então o que não tem família declarada fica sem
    // grupo: óleo, azeite, castanha, amendoim e as frutas gordurosas estão
    // nomeados na família de gorduras, de propósito.
    return {
      grupo: null,
      motivo: 'O nome deste alimento não casa com nenhuma família conhecida, e '
        + 'a composição sozinha não diz a origem. Propor troca aqui seria '
        + 'arbitrário.',
    };
  }

  // 1. ORIGEM manda sobre percentual. Carne gorda continua carne; feijão
  //    continua leguminosa, por decisão da profissional.
  if (ORIGEM_PROTEICA.test(taco)) {
    return { grupo: magra ? 'Proteínas magras' : 'Proteínas gordas' };
  }
  if (/^Leguminosas/i.test(taco)) return { grupo: 'Leguminosas' };

  // 2. Lácteo: leite se separa de queijo por concentração, não por gordura.
  if (/^Leite/i.test(taco)) {
    return { grupo: kcal < DENSIDADE_LACTEO ? 'Leites e iogurtes' : 'Queijos' };
  }

  // 3. Discricionários, antes das regras de composição: biscoito é gordo e
  //    doce, e nenhum dos dois grupos é onde ele deve estar.
  if (/açucarados$/i.test(taco) || ULTRAPROCESSADO.test(nome)) {
    return {
      grupo: 'Açúcares e ultraprocessados',
      reclassificado: !/açucarados$/i.test(taco),
    };
  }

  // 4. Gordura quase pura, fora das origens acima: azeite, manteiga, e as
  //    frutas oleaginosas (abacate, coco, açaí, pequi, macaúba).
  if (perfil.l >= LIPIDIO_PURO) {
    return { grupo: 'Gorduras e oleaginosas', reclassificado: !/^(Gorduras|Nozes)/i.test(taco) };
  }
  if (/^Nozes/i.test(taco)) return { grupo: 'Gorduras e oleaginosas' };

  // 5. Tubérculo sai de Verduras e vai para os cereais.
  if (/^Verduras/i.test(taco) && TUBERCULO.test(nome)) {
    return { grupo: 'Cereais, pães e tubérculos', reclassificado: true };
  }

  // 6. Preparação pronta pelo macro dominante, por decisão da profissional.
  //    Feijoada vira proteína gorda; tabule vira cereal.
  if (/^(Alimentos preparados|Outros)/i.test(taco)) {
    if (perfil.p >= PROTEINA_RELEVANTE) {
      return { grupo: magra ? 'Proteínas magras' : 'Proteínas gordas', reclassificado: true };
    }
    if (perfil.c >= 50) return { grupo: 'Cereais, pães e tubérculos', reclassificado: true };
    return { grupo: 'Hortaliças e vegetais', reclassificado: true };
  }

  if (/^Frutas/i.test(taco)) return { grupo: 'Frutas' };
  if (/^Verduras/i.test(taco)) return { grupo: 'Hortaliças e vegetais' };
  if (/^Bebidas/i.test(taco)) return { grupo: 'Bebidas' };
  if (/^Cereais/i.test(taco)) return { grupo: 'Cereais, pães e tubérculos' };

  return {
    grupo: null,
    motivo: `O grupo "${taco || 'não informado'}" ainda não tem regra de classificação. `
      + 'Sem ela, qualquer troca proposta seria arbitrária.',
  };
}

/**
 * Qual nutriente define a equivalência dentro de cada grupo.
 *
 * É o papel que o grupo cumpre na refeição. Mapa EXAUSTIVO sobre GrupoTroca:
 * o TypeScript recusa compilar se um grupo novo entrar sem nutriente, o que
 * impede exatamente o acidente de um grupo cair num padrão silencioso.
 */
export const NUTRIENTE_DO_GRUPO: Record<GrupoTroca, Nutriente> = {
  'Cereais, pães e tubérculos': 'carboidratosG',
  'Frutas': 'carboidratosG',
  'Leguminosas': 'carboidratosG',
  'Açúcares e ultraprocessados': 'carboidratosG',

  'Proteínas magras': 'proteinasG',
  'Proteínas gordas': 'proteinasG',
  'Leites e iogurtes': 'proteinasG',
  'Queijos': 'proteinasG',

  'Gorduras e oleaginosas': 'lipidiosG',

  // Hortaliça e bebida se trocam por energia: igualar carboidrato entre uma
  // alface e uma beterraba pede 400 g de alface, que ninguém come.
  'Hortaliças e vegetais': 'energiaKcal',
  'Bebidas': 'energiaKcal',
};

export const ROTULO_NUTRIENTE: Record<Nutriente, string> = {
  carboidratosG: 'carboidratos',
  proteinasG: 'proteínas',
  lipidiosG: 'lipídios',
  energiaKcal: 'energia',
};

export const GRUPOS_TROCA = Object.keys(NUTRIENTE_DO_GRUPO) as GrupoTroca[];
