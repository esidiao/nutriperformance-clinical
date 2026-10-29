/**
 * Classificação por NOME, para o alimento que não tem grupo da TACO.
 *
 * ================================ POR QUE ==================================
 *
 * A importação do IBGE grava `grupo_alimentar: null` — o IBGE não publica
 * grupo alimentar — com o comentário "a classificação de troca é derivada da
 * composição, então isto não impede substituição". A segunda frase era falsa:
 * quase todo ramo de `classificarGrupoTroca` testa a string do grupo TACO.
 *
 * Medido na base em 22/10/2026: **1971 dos 2568 alimentos sem grupo (77%)**, e
 * **todos os 1967 que têm medida caseira estavam entre eles**. As duas entregas
 * do ciclo não se encontravam: a medida caseira existia só para os alimentos
 * que não podiam ser substituídos — e a lista de trocas é justamente onde "2
 * colheres de servir" importa para o paciente.
 *
 * Pior que a lacuna: o que PASSAVA passava errado. Sem origem declarada,
 * "CARNE SECA" (65% da energia em gordura) caía na regra de gordura quase pura
 * e era oferecida como troca de azeite e castanha.
 *
 * ========================= POR NOME, NÃO POR MACRO =========================
 *
 * Macro sozinho não distingue origem: leite desnatado e peito de frango têm
 * perfil parecido, e trocar um pelo outro não é equivalência — é outra
 * refeição. Então a origem vem do NOME, e o macro só refina DENTRO do grupo
 * (magra/gorda, leite/queijo), igual ao caminho da TACO.
 *
 * ============================== E O FREIO ==================================
 *
 * Nome que não casa com nenhuma família **não recebe grupo**. Recusar é melhor
 * que arriscar: a lista vai para a mão do paciente, e uma troca arbitrária numa
 * prescrição é pior que a ausência de troca, que ele percebe e pergunta.
 *
 * Isto foi medido, não suposto. A primeira versão caía na regra de lipídio
 * quase puro quando nenhuma família casava; conferindo os 87 nomes que isso
 * produziu em "Gorduras e oleaginosas", **mais da metade estava errada** —
 * bisteca, cupim, rabada, paio, chouriço, patê e pé de galinha viravam troca
 * de azeite, muçarela também, e pavê e biscoito de polvilho entravam como
 * gordura em vez de doce.
 *
 * ======================== AS LISTAS VÊM DA BASE =============================
 *
 * Cada família foi escrita lendo os 940 nomes-base distintos que ficavam sem
 * grupo, não de imaginação. Já me queimei supondo o que a base tem: um
 * comentário meu afirmava que nenhuma medida terminava em "ão", e havia duas —
 * uma delas virava "porcaos" na lista do paciente.
 *
 * `scripts/medir-classificacao-ibge.ts` mede a cobertura contra a base real e
 * é para rodar DE NOVO a cada mexida aqui. A pergunta "quantos ficam de fora"
 * não se responde de memória.
 */

import type { GrupoTroca } from './grupos-troca';

/** O que a família decide. */
export type DecisaoDaFamilia =
  | { tipo: 'grupo'; grupo: GrupoTroca }
  /** Carne/ave/peixe: o grupo sai do percentual de lipídio, como na TACO. */
  | { tipo: 'proteina' }
  /** Leite × queijo: sai da densidade energética, como na TACO. */
  | { tipo: 'lacteo' }
  /** Reconhecido, mas não é porção de nada: tempero, pó, suplemento. */
  | { tipo: 'sem_porcao'; motivo: string };

export interface Familia {
  /** Por que esta família existe, quando não é óbvio. */
  nota?: string;
  /** Começos de nome que esta família reivindica. Ver `casa()`. */
  prefixos: string[];
  decisao: DecisaoDaFamilia;
}

/**
 * O nome-base: o que vem antes da primeira vírgula.
 *
 * O IBGE nomeia como `ALIMENTO, preparação` ("BATATA-INGLESA, cozido(a)").
 * A preparação não muda o grupo de troca — batata cozida e batata frita são
 * as duas tubérculo —, então ela sai antes de comparar. Acentos também saem,
 * porque a base é inconsistente ("ABA DE FILÉ" e "FILE DE FRANGO").
 */
export function nomeBase(nome: string): string {
  return (nome ?? '')
    .split(',')[0]
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
    .toUpperCase();
}

/**
 * O prefixo precisa TERMINAR onde a palavra termina.
 *
 * ESTE ERRO EU JÁ COMETI DUAS VEZES, DE DOIS JEITOS.
 *
 * Na primeira versão as famílias eram expressões regulares cruas com
 * `^(SAL|PIMENTA|...)`. Casamento por prefixo puro, e aí:
 *
 *   - `SAL` engolia **SALSICHA**, **SALSÃO** e **SALSA** — a salsicha virava
 *     "é tempero, não é porção de alimento", e os 12 registros de "SALSICHA NO
 *     VAREJO" ficavam sem troca nenhuma;
 *   - `PIMENTA` engolia **PIMENTÃO**, que é hortaliça e porção de comida.
 *
 * Não achei isso lendo o código: achei medindo quem ficou sem grupo e
 * perguntando por quê. O remendo caso a caso (`PIMENTA(?!O)`) deixaria a
 * armadilha montada para o próximo prefixo da lista.
 *
 * A outra vez foi com `\b`, em `grupos-troca.ts`: em JavaScript ele só conhece
 * letras ASCII, então `cará\b` nunca casa. Por isso o limite aqui é
 * `(?!\p{L})` com a flag `u`, que trata "cará" e "cara" igual.
 *
 * O prefixo continua sendo prefixo: "CARNE" casa com "CARNE SECA" porque o
 * caractere seguinte é espaço, e não casa com "CARNEIRO". Quando a família
 * precisa de "CARNEIRO", ela o lista.
 */
function casa(base: string, prefixo: string): boolean {
  if (!base.startsWith(prefixo)) return false;
  const seguinte = base.slice(prefixo.length);
  if (seguinte === '') return true;
  return !/^\p{L}/u.test(seguinte);
}

/**
 * A ORDEM É A REGRA.
 *
 * "DOCE DE LEITE" é açúcar, não lácteo. "ERVILHA EM VAGEM" é hortaliça, não
 * leguminosa. "CARNE DE SOJA" é leguminosa, não carne. "CANA DE ACUCAR" é
 * açúcar, não bebida. Cada um desses só sai certo porque a família que o
 * reivindica vem ANTES da que o roubaria.
 */
export const FAMILIAS: Familia[] = [
  // ── 1. Não é porção de nada ───────────────────────────────────────────────
  {
    nota: 'Tempero, sal e pó para preparo: 61 kcal de shoyu não se trocam por '
      + '61 kcal de arroz. Mesma recusa que "Miscelâneas" no caminho da TACO.',
    prefixos: [
      'SHOYU', 'MOLHO DE SOJA', 'SAL', 'TEMPERO',
      'VINAGRE', 'ACAFRAO', 'OREGANO', 'ERVA DOCE', 'COLORAU', 'PIMENTA',
      'MOSTARDA MOLHO', 'KETCHUP', 'MAIONESE',
      'CALDO DE CARNE', 'CALDO DE GALINHA', 'FERMENTO', 'ADOCANTE', 'CAFE',
      'CAPUCCINO', 'CHA', 'GELATINA', 'ALHO', 'CACAU', 'HORTELA', 'ALCAPARRA',
      'ACHOCOLATADO EM PO',
    ],
    decisao: {
      tipo: 'sem_porcao',
      motivo: 'É tempero, pó para preparo ou condimento, não uma porção de alimento.',
    },
  },
  {
    nota: 'Suplemento e fórmula infantil não se trocam por comida: a indicação '
      + 'é de quem prescreveu, e sugerir equivalência aqui passa por cima dela.',
    prefixos: [
      'SUSTAGEM', 'COMPLEMENTO ALIMENTAR', 'DIET SHAKE', 'CONCENTRADO ALIMENTAR',
      'PROTEINA DE SOJA', 'PROTEINA VEGETAL', 'MUCILON', 'FARINHA LACTEA',
      'NESTON', 'CREMOGEMA', 'ARROZINA', 'VITAFLOCOS', 'VITAMILHO', 'MINGAU',
    ],
    decisao: {
      tipo: 'sem_porcao',
      motivo: 'É suplemento ou fórmula: a equivalência depende da indicação de quem prescreveu.',
    },
  },

  // ── 2. Açúcares e ultraprocessados ───────────────────────────────────────
  {
    nota: 'Doce, bala, chocolate, sobremesa e geleia. "DOCE DE LEITE" e '
      + '"LEITE GELEIFICADO" entram aqui, antes da família de lácteo.',
    prefixos: [
      'ACUCAR', 'DEMERARA', 'MASCAVO', 'RAPADURA', 'MELADO', 'MEL', 'SCHIMIER',
      'CANA DE ACUCAR', 'BALA', 'DROPS', 'PASTILHA', 'PIRULITO', 'JUJUBA',
      'GOMA DE MASCAR', 'CHICLETE', 'CARAMELO', 'CONFETE', 'CHOCOLATE',
      'TABLETE DE CHOCOLATE', 'BARRA DE CHOCOLATE', 'BOMBOM', 'OVOMALTINE',
      'TODDYNHO', 'GELEIA', 'DOCE', 'PESSEGADA', 'MARMELADA', 'GOIABADA',
      'FIGADA', 'MARIOLA', 'MERENGUE', 'SUSPIRO', 'PUDIM', 'DANETTE', 'MANJAR',
      'MARIA MOLE', 'COCADA', 'QUEBRA QUEIXO', 'PE DE MOLEQUE', 'PACOCA',
      'PACOQUINHA', 'TORRAO', 'TORRONE', 'BRIGADEIRO', 'MIL FOLHAS',
      'QUEIJADINHA', 'QUINDIM', 'FIOS DE OVOS', 'AMBROSIA', 'CHANDELE', 'MUMU',
      'CANUDINHO', 'SAROLHO', 'BEIJO DE MOCA', 'PICOLE', 'GELADINHO', 'SORVETE',
      'CHURRO', 'OVO DE PASCOA', 'KINDER OVO', 'ARROZ-DOCE', 'MILK SHAKE',
      'BARRA DE CEREAIS', 'SOBREMESA', 'RABANADA', 'PASTEIS DE SANTA CLARA',
      'ALGODAO-DOCE', 'SEQUILHO', 'TARECO', 'ALFENIM', 'BATIDA',
      'AMENDOIM CARAMELIZADO', 'AMENDOIM ACHOCOLATADO', 'LEITE GELEIFICADO',
      'CACAROLA ITALIANA', 'IOIO CREME', 'BEIJU', 'MOUSSE', 'BOMBA DE', 'PAVE',
      'ROCAMBOLE', 'TRUFA', 'CHANTILLY', 'TORTA',
    ],
    decisao: { tipo: 'grupo', grupo: 'Açúcares e ultraprocessados' },
  },
  {
    nota: 'Ultraprocessado salgado. Pela mesma decisão que tirou biscoito dos '
      + 'cereais: oferecer nuggets como troca de peito de frango é dar '
      + 'permissão. CONFIRMADO pela nutricionista em 29/10/2026 — eu havia '
      + 'estendido por conta própria a decisão dela de 21/10, que falava de '
      + 'biscoito e bolo, e perguntei antes de dar por certo. É escolha '
      + 'clínica: mudar aqui é decisão dela, não de quem mexe no código.',
    prefixos: [
      'NUGGETS', 'HAMBURGUER', 'MINI PIZZA', 'MINI PASTEL', 'MINI CHICKEN',
      'MIOJO', 'MACARRAO INSTANTANEO', 'SALSICHA', 'LINGUICA', 'MORTADELA',
      'PRESUNTO', 'SALAME', 'APRESUNTADO', 'EMPANADO', 'STEAK DE FRANGO',
      'CROQUINHOS', 'BACONZITOS', 'SALGADINHO', 'CHIPS', 'BISCOITO',
      'BOLACHA RECHEADA', 'WAFER', 'BOLO',
    ],
    decisao: { tipo: 'grupo', grupo: 'Açúcares e ultraprocessados' },
  },

  // ── 3. Bebidas ────────────────────────────────────────────────────────────
  {
    prefixos: [
      'REFRIGERANTE', 'COCA COLA', 'FANTA', 'SPRIT', 'MINUANO', 'GUARANA',
      'SUCO', 'Q-SUCO', 'CAJUINA', 'NECTAR', 'CERVEJA', 'CHOPP', 'VINHO',
      'CONHAQUE', 'LICOR', 'DRINK', 'CACHACA', 'AGUARDENTE', 'CANA', 'CAXIRI',
      'VODKA', 'WHISKY', 'RUM', 'TEQUILA', 'AGUA', 'CHIMARRAO',
      'MATE',
    ],
    decisao: { tipo: 'grupo', grupo: 'Bebidas' },
  },

  // ── 4. Leguminosas (antes de carne, por causa da soja) ───────────────────
  {
    nota: 'Feijão é leguminosa por decisão da profissional, não cereal. A soja '
      + 'texturizada ("CARNE DE SOJA", "BIFE VEGETAL") entra aqui e NÃO na '
      + 'família de carne — por isso esta família vem antes.',
    prefixos: [
      'FEIJAO', 'LENTILHA', 'GRAO DE BICO', 'FAVA', 'ANDU', 'MANGALO', 'SOJA',
      'CARNE DE SOJA', 'CARNE VEGETAL', 'BIFE VEGETAL', 'PASTA DE SOJA',
      'FIBRA DE SOJA', 'TREMOCO', 'GUANDU', 'BROTO DE FEIJAO',
      'ERVILHA EM GRAO', 'ERVILHA SECA',
    ],
    decisao: { tipo: 'grupo', grupo: 'Leguminosas' },
  },

  // ── 5. Carnes, aves, peixes, ovos e vísceras ─────────────────────────────
  {
    nota: 'Lista longa de propósito: são os cortes como o IBGE os nomeia. '
      + 'Origem manda sobre percentual — foi a falta disto que fez "CARNE '
      + 'SECA" ser oferecida como troca de azeite.',
    prefixos: [
      'CARNE', 'CARNEIRO', 'BIFE', 'FILE', 'ALCATRA', 'PATINHO', 'CONTRAFILE',
      'PICANHA', 'MAMINHA', 'FRALDINHA', 'ACEM', 'AGULHA', 'PALETA', 'PAULISTA',
      'LOMBO', 'CABECA DE LOMBO', 'MUSCULO', 'LAGARTO', 'TATU', 'CHULETA',
      'COSTELA', 'COSTELINHA', 'VAZIO', 'PEITO', 'PA COM OSSO', 'CHAMBARIL',
      'ABA DE FILE', 'MOCOTO', 'OSSADA', 'TRIPA', 'VISCERA', 'PANELADA',
      'FATO BOVINO', 'BOFE', 'FIGADO', 'CORACAO', 'MOELA', 'MIUDO', 'CARCACA',
      'DRUMETE', 'ASA', 'DOBRADINHA', 'RABO', 'RABADA', 'LINGUA', 'FRANGO',
      'GALINHA', 'PARTE DE GALINHA', 'PERU', 'PATO', 'CHESTER', 'CAPOTE',
      'CODORNA', 'COXA', 'SOBRECOXA', 'PEIXE', 'BACALHAU', 'POSTA', 'SARDINHA',
      'ATUM', 'SALMAO', 'TILAPIA', 'PESCADA', 'MERLUZA', 'TAINHA', 'TAMBAQUI',
      'PACU', 'PIRARUCU', 'CAMARAO', 'MARISCO', 'SIRI', 'CARANGUEJO', 'SURURU',
      'OSTRA', 'LULA', 'POLVO', 'OVAS', 'FIAMBRE', 'OVO', 'OVOS', 'PE SUINO',
      'PERNIL', 'BARRIGA SUINA', 'TOUCINHO', 'BACON', 'BISTECA', 'CUPIM',
      'MIOLO DE BOI', 'CARRE', 'QUARTO SUINO', 'SUA SUINA', 'PESCOCO',
      'PE DE GALINHA', 'PE E ASA', 'JABA', 'COPA DE PORCO', 'CHOURICO',
      'MORCELA', 'MORCILHA', 'PAIO', 'PATE', 'PASTA DE CARNE',
      'PASTA DE PRESUNTO', 'PASTA DE GALINHA', 'CHARQUE',
    ],
    decisao: { tipo: 'proteina' },
  },

  // ── 6. Lácteos ────────────────────────────────────────────────────────────
  {
    nota: 'Leite × queijo se separa por densidade, não por gordura: leite '
      + 'integral tem ~50% da energia em gordura e continua leite. '
      + 'MANTEIGA, NATA e CREME DE LEITE ficam FORA: são lácteos de origem, '
      + 'mas o papel na refeição é gordura. Pela densidade eles cairiam em '
      + '"Queijos" e a manteiga apareceria como troca de muçarela.',
    prefixos: [
      'LEITE', 'IOGURTE', 'QUEIJO', 'REQUEIJAO', 'RICOTA', 'COALHADA',
      'MUSSARELA', 'MUZARELLA', 'CREME DE QUEIJO', 'PARMESAO', 'PROVOLONE',
      'CATUPIRY',
    ],
    decisao: { tipo: 'lacteo' },
  },

  // ── 7. Cereais, pães e tubérculos ────────────────────────────────────────
  {
    nota: 'Tubérculo junto com cereal, por decisão da profissional: batata e '
      + 'mandioca trocam com arroz no almoço, não com alface. CASTANHA '
      + 'PORTUGUESA entra aqui, antes da família de gorduras: é amido, não '
      + 'oleaginosa, apesar do nome.',
    prefixos: [
      'ARROZ', 'MILHO', 'FUBA', 'CANJIQUINHA', 'XEREM', 'QUIRERA', 'PUBA',
      'AVEIA', 'TRIGO', 'GERME DE TRIGO', 'FIBRA DE TRIGO', 'FIBRA DE CEREAL',
      'MACARRAO', 'MASSA', 'PAO', 'TORRADA', 'BATATA', 'MANDIOCA', 'AIPIM',
      'MACAXEIRA', 'MANDIOQUINHA', 'CARA', 'INHAME', 'QUINOA', 'TAPIOCA',
      'SAGU', 'GOMA', 'FARINHA', 'CRUERA', 'CUSCUZ',
      'PAMONHA', 'AMIDO', 'CREME DE ARROZ', 'CREME DE MILHO', 'PURE DE BATATA',
      'PIPOCA', 'CENTEIO', 'CEVADA', 'CEVADINHA', 'GRANOLA', 'MUSLI',
      'MIX DE CEREAIS', 'FLOCOS DE CEREAIS', 'SUCRILHOS', 'CEREAL MATINAL',
      'POLENTA', 'ANGU', 'CASSAVA', 'CASTANHA PORTUGUESA', 'FRUTA PAO',
    ],
    decisao: { tipo: 'grupo', grupo: 'Cereais, pães e tubérculos' },
  },

  // ── 8. Frutas ─────────────────────────────────────────────────────────────
  {
    nota: 'Fruta gordurosa (abacate, coco, açaí, pequi) NÃO entra aqui: por '
      + 'decisão da profissional ela troca com castanha, e está nomeada na '
      + 'família de gorduras.',
    prefixos: [
      'LARANJA', 'LIMA', 'LIMAO', 'TANGERINA', 'MEXERICA', 'BERGAMOTA',
      'MIMOSA', 'TANJA', 'MARICOTA', 'LARANJINHA JAPONESA', 'ABACAXI', 'ANANAS',
      'CAQUI', 'FIGO', 'MACA', 'MAMAO', 'PAPAIA', 'MANGA', 'MANGUITO',
      'MARACUJA', 'MELANCIA', 'MELAO', 'PERA', 'PESSEGO', 'NECTARINA', 'AMEIXA',
      'UVA', 'JENIPAPO', 'JACA', 'GOIABA', 'ARACA', 'UXI', 'CAJU',
      'CEREJA', 'CAJA', 'CAJARANA', 'TAPEREBA', 'ACAJA', 'CARAMBOLA',
      'JABOTICABA', 'GRAVIOLA', 'MORANGO', 'JAMBO', 'MURICI', 'ATEMOIA', 'ATA',
      'PINHA', 'MANGABA', 'NESPERA', 'SAPOTI', 'TAMARINDO',
      'PITOMBA', 'BACURI', 'INGA', 'PITANGA', 'CIRIGUELA', 'BIRIBA', 'CUPUACU',
      'ROMA', 'ACEROLA', 'KIWI', 'ABIU', 'AMORA', 'JAMELAO', 'UMBU', 'IMBU',
      'QUICARE', 'BUTIA', 'FRUTA', 'PASSA', 'BANANA', 'JURUBEBA',
    ],
    decisao: { tipo: 'grupo', grupo: 'Frutas' },
  },

  // ── 9. Hortaliças e vegetais ─────────────────────────────────────────────
  {
    prefixos: [
      'CENOURA', 'COUVE', 'REPOLHO', 'CEBOLA', 'CEBOLINHA',
      'ABOBORA', 'MORANGA', 'JERIMUM', 'CHUCHU', 'BERINJELA', 'ABOBRINHA',
      'JILO', 'BROCOLIS', 'QUIABO', 'BETERRABA', 'VAGEM', 'ERVILHA EM VAGEM',
      'ESPINAFRE', 'ALFACE', 'RUCULA', 'AGRIAO', 'ALMEIRAO', 'CHICORIA',
      'ESCAROLA', 'CATALONHA', 'ACELGA', 'TAIOBA', 'RADITE', 'SERRALHA',
      'MOSTARDA', 'BERTALHA', 'CARURU', 'CARIRU', 'JAMBU', 'CUXA', 'VINAGREIRA',
      'BREDO', 'LINGUA DE VACA', 'FOLHA DE AIPIM', 'FOLHA DE MACAXEIRA',
      'SALSAO', 'AIPO', 'ALCACHOFRA', 'PEPINO', 'PEPININHO', 'MAXIXE',
      'PIMENTAO', 'TOMATE', 'COGUMELO', 'BROTO DE ALFAFA', 'PALMITO',
      'GUARIROBA', 'GUEIROBA', 'NABO', 'RABANETE', 'JARDINEIRA', 'SELETA',
      'ALHO PORO', 'SALSA', 'COENTRO', 'MILHO VERDE COM ERVILHA', 'PACOVA',
    ],
    decisao: { tipo: 'grupo', grupo: 'Hortaliças e vegetais' },
  },

  // ── 10. Gorduras e oleaginosas ───────────────────────────────────────────
  {
    nota: 'Óleo, castanha e as frutas gordurosas, por decisão da profissional. '
      + 'A lista é explícita porque aqui NÃO há regra de composição de reserva: '
      + 'ver o freio no cabeçalho.',
    prefixos: [
      'OLEO', 'AZEITE', 'AZEITONA', 'MARGARINA', 'MANTEIGA', 'NATA',
      'CREME DE LEITE', 'GORDURA', 'BANHA', 'CASTANHA', 'AMENDOA', 'AVELA',
      'NOZ', 'NOZES', 'PISTACHE', 'MACADAMIA', 'AMENDOIM', 'PASTA DE AMENDOIM',
      'SEMENTE', 'LINHACA', 'CHIA', 'GERGELIM', 'GIRASSOL', 'COCO', 'PINHAO',
      'BABACU', 'ABACATE', 'PEQUI', 'TUCUMA', 'BACABA', 'BACABUCU', 'BURITI',
      'MARI', 'MUCAJA', 'PATAUA', 'ACAI', 'JUCARA', 'JUSSARA', 'PUPUNHA',
      'UACAI', 'DENDE', 'MACAUBA', 'POLPA DE COCO',
    ],
    decisao: { tipo: 'grupo', grupo: 'Gorduras e oleaginosas' },
  },
];

/** A primeira família que reivindica o nome-base. */
export function familiaDoNome(nome: string): Familia | null {
  const base = nomeBase(nome);
  if (!base) return null;
  return FAMILIAS.find((f) => f.prefixos.some((p) => casa(base, p))) ?? null;
}
