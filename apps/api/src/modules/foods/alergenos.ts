/**
 * Derivação de alérgenos alimentares a partir da identidade do alimento.
 *
 * O campo `alergenos` existia vazio nos 597 itens da TACO, que não traz essa
 * informação. Para quem atende paciente alérgico, é dado de segurança: a
 * conduta muda se o alimento contém leite, glúten ou castanha.
 *
 * A lista segue os alergênicos de declaração obrigatória no Brasil
 * (RDC 26/2015 da ANVISA):
 *   trigo, centeio, cevada, aveia e híbridos (glúten) · crustáceos · ovos ·
 *   peixes · amendoim · soja · leites de mamíferos · castanhas e nozes ·
 *   látex natural
 *
 * REGRA DE INCLUSÃO — errar aqui tem consequência direta sobre um paciente
 * alérgico, e ERRA NOS DOIS SENTIDOS:
 *
 *   - deixar de marcar um alérgeno presente pode levar a uma reação;
 *   - marcar um alérgeno ausente exclui alimento seguro. Marcar glúten na
 *     farinha de mandioca tira do celíaco justamente uma das suas bases —
 *     erro que a primeira versão destas regras cometeu, ao confundir o
 *     particípio "torrada" com a torrada de pão.
 *
 * Ou seja: nem marcar demais é inofensivo. A derivação cobre só o que se
 * conclui do próprio nome do alimento, e cada regra precisa ser específica o
 * bastante para não casar por prefixo — não há inferência sobre receita,
 * processo industrial ou contaminação cruzada.
 *
 * O resultado NÃO substitui a leitura do rótulo. Produto industrializado pode
 * conter alérgeno que o nome não revela, e a checagem final é sempre do rótulo.
 */
export interface RegraAlergeno {
  /** Trecho que precisa aparecer no nome padronizado (sem acento, minúsculo). */
  contem: string;
  /** Alérgenos a marcar. */
  alergenos: string[];
  /** Trechos que impedem a regra — evita marcar alimento que não contém. */
  exceto?: string[];
}

/** Rótulos usados no campo, em português e no vocabulário da RDC 26/2015. */
export const ALERGENOS = {
  LEITE: 'leite',
  OVO: 'ovo',
  GLUTEN: 'glúten',
  TRIGO: 'trigo',
  SOJA: 'soja',
  AMENDOIM: 'amendoim',
  CASTANHAS: 'castanhas',
  PEIXE: 'peixe',
  CRUSTACEO: 'crustáceo',
} as const;

const { LEITE, OVO, GLUTEN, TRIGO, SOJA, AMENDOIM, CASTANHAS, PEIXE, CRUSTACEO } = ALERGENOS;

export const REGRAS_ALERGENOS: RegraAlergeno[] = [
  // ── Leite ──────────────────────────────────────────────────────────────────
  // "Leite, de coco" e "Leite de soja" NÃO são leite de mamífero.
  { contem: 'leite', alergenos: [LEITE], exceto: ['de coco', 'de soja', 'soja'] },
  { contem: 'queijo', alergenos: [LEITE], exceto: ['(tofu)', 'de soja'] },
  { contem: 'iogurte', alergenos: [LEITE] },
  { contem: 'requeijao', alergenos: [LEITE] },
  { contem: 'manteiga', alergenos: [LEITE], exceto: ['couve'] }, // "Couve, manteiga" é a hortaliça
  { contem: 'creme de leite', alergenos: [LEITE] },
  { contem: 'mozarela', alergenos: [LEITE] },
  { contem: 'ricota', alergenos: [LEITE] },
  { contem: 'bebida lactea', alergenos: [LEITE] },
  { contem: 'farinha, lactea', alergenos: [LEITE, GLUTEN, TRIGO] },
  { contem: 'doce, de leite', alergenos: [LEITE] },
  { contem: 'chocolate, ao leite', alergenos: [LEITE] },
  { contem: 'achocolatado', alergenos: [LEITE] },
  { contem: 'capuccino', alergenos: [LEITE] },
  { contem: 'petit suisse', alergenos: [LEITE] },
  { contem: 'chantilly', alergenos: [LEITE] },
  { contem: 'omelete, de queijo', alergenos: [LEITE, OVO] },
  { contem: 'pao, de queijo', alergenos: [LEITE] },
  { contem: 'curau', alergenos: [LEITE] },
  { contem: 'canjica, com leite', alergenos: [LEITE] },
  { contem: 'mingau', alergenos: [LEITE] },
  { contem: 'estrogonofe', alergenos: [LEITE] },
  { contem: 'quindim', alergenos: [OVO] },
  { contem: 'cocada', alergenos: [] },

  // ── Ovo ────────────────────────────────────────────────────────────────────
  { contem: 'ovo', alergenos: [OVO] },
  { contem: 'maionese', alergenos: [OVO] },
  { contem: 'com ovos', alergenos: [OVO] },
  { contem: 'bolinho de arroz', alergenos: [OVO] },
  { contem: 'a milanesa', alergenos: [OVO, GLUTEN, TRIGO] },
  { contem: 'empanad', alergenos: [OVO, GLUTEN, TRIGO] },

  // ── Glúten (trigo, centeio, cevada, aveia) ────────────────────────────────
  { contem: 'trigo', alergenos: [GLUTEN, TRIGO] },
  { contem: 'centeio', alergenos: [GLUTEN] },
  { contem: 'cevada', alergenos: [GLUTEN] },
  { contem: 'aveia', alergenos: [GLUTEN] },
  { contem: 'gluten', alergenos: [GLUTEN, TRIGO] },
  { contem: 'macarrao', alergenos: [GLUTEN, TRIGO] },
  { contem: 'lasanha', alergenos: [GLUTEN, TRIGO] },
  { contem: 'yakisoba', alergenos: [GLUTEN, TRIGO, SOJA] },
  { contem: 'biscoito', alergenos: [GLUTEN, TRIGO], exceto: ['polvilho'] },
  { contem: 'bolo', alergenos: [GLUTEN, TRIGO, OVO], exceto: ['aipim'] },
  // "Torrada, pão francês" é o único pão torrado da base. Sem essa precisão,
  // a regra pegava "Amêndoa, torrada", "Castanha-de-caju, torrada" e
  // "Farinha, de mandioca, torrada" — o particípio, não o alimento.
  { contem: 'torrada, pao', alergenos: [GLUTEN, TRIGO] },
  { contem: 'farinha, de rosca', alergenos: [GLUTEN, TRIGO] },
  { contem: 'cerveja', alergenos: [GLUTEN] },
  { contem: 'cereal matinal', alergenos: [GLUTEN] },
  { contem: 'cereais, mistura', alergenos: [GLUTEN, TRIGO] },
  { contem: 'pastel', alergenos: [GLUTEN, TRIGO] },
  { contem: 'empada', alergenos: [GLUTEN, TRIGO] },
  // "Quibebe" é prato de abóbora — "quibe" casa como prefixo.
  { contem: 'quibe', alergenos: [GLUTEN, TRIGO], exceto: ['quibebe'] },
  { contem: 'tabule', alergenos: [GLUTEN, TRIGO] },
  { contem: 'croquete', alergenos: [GLUTEN, TRIGO] },
  { contem: 'coxinha', alergenos: [GLUTEN, TRIGO] },
  { contem: 'salgado', alergenos: [], exceto: [] }, // sem inferência: "salgado" é preparo
  { contem: 'shoyu', alergenos: [SOJA, GLUTEN, TRIGO] },
  // "Pão" cobre os de trigo; os de milho e soja são marcados pelas suas regras
  { contem: 'pao, aveia', alergenos: [GLUTEN] },
  { contem: 'pao, trigo', alergenos: [GLUTEN, TRIGO] },
  { contem: 'pao, gluten', alergenos: [GLUTEN, TRIGO] },
  { contem: 'pao, milho', alergenos: [GLUTEN, TRIGO] }, // pão de milho leva trigo na formulação

  // ── Soja ───────────────────────────────────────────────────────────────────
  { contem: 'soja', alergenos: [SOJA] },
  { contem: 'tofu', alergenos: [SOJA] },
  { contem: 'oleo, de soja', alergenos: [SOJA] },
  { contem: 'pipoca, com oleo de soja', alergenos: [SOJA] },

  // ── Amendoim ───────────────────────────────────────────────────────────────
  { contem: 'amendoim', alergenos: [AMENDOIM] },
  { contem: 'pacoca', alergenos: [AMENDOIM] },
  { contem: 'pe-de-moleque', alergenos: [AMENDOIM] },

  // ── Castanhas e nozes ──────────────────────────────────────────────────────
  { contem: 'castanha', alergenos: [CASTANHAS] },
  { contem: 'amendoa', alergenos: [CASTANHAS] },
  { contem: 'noz', alergenos: [CASTANHAS] },
  { contem: 'nozes', alergenos: [CASTANHAS] },
  { contem: 'pistache', alergenos: [CASTANHAS] },
  { contem: 'avela', alergenos: [CASTANHAS] },
  { contem: 'macadamia', alergenos: [CASTANHAS] },
  { contem: 'pinhao', alergenos: [CASTANHAS] },

  // ── Peixes e crustáceos ────────────────────────────────────────────────────
  { contem: 'camarao', alergenos: [CRUSTACEO] },
  { contem: 'caranguejo', alergenos: [CRUSTACEO] },
  { contem: 'lagosta', alergenos: [CRUSTACEO] },
  { contem: 'atum', alergenos: [PEIXE] },
  { contem: 'sardinha', alergenos: [PEIXE] },
  { contem: 'bacalhau', alergenos: [PEIXE] },
  { contem: 'salmao', alergenos: [PEIXE] },
  { contem: 'merluza', alergenos: [PEIXE] },
  { contem: 'pescada', alergenos: [PEIXE] },
  { contem: 'pescadinha', alergenos: [PEIXE] },
  { contem: 'abadejo', alergenos: [PEIXE] },
  { contem: 'cacao', alergenos: [PEIXE] },
  { contem: 'corvina', alergenos: [PEIXE] },
  { contem: 'corimba', alergenos: [PEIXE] },
  { contem: 'lambari', alergenos: [PEIXE] },
  { contem: 'manjuba', alergenos: [PEIXE] },
  { contem: 'pintado', alergenos: [PEIXE] },
  { contem: 'tucunare', alergenos: [PEIXE] },
  { contem: 'dourada', alergenos: [PEIXE] },
  { contem: 'porquinho, cru', alergenos: [PEIXE] }, // peixe, não suíno
  { contem: 'geleia, mocoto', alergenos: [] },
];

const semAcento = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '');
const normalizar = (s: string) => semAcento(s).toLowerCase();

/** Alérgenos de um alimento, sem repetição e em ordem estável. */
export function alergenosPara(nomePadronizado: string): string[] {
  const nome = normalizar(nomePadronizado);
  const achados = new Set<string>();

  for (const regra of REGRAS_ALERGENOS) {
    if (!nome.includes(normalizar(regra.contem))) continue;
    if (regra.exceto?.some((e) => nome.includes(normalizar(e)))) continue;
    for (const a of regra.alergenos) achados.add(a);
  }

  return [...achados].sort();
}
