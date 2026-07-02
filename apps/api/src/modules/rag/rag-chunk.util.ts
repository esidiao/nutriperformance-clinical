/**
 * Lógica pura do RAG (sem I/O → testável):
 *  - normaliza vetores (para usar distância de cosseno via dot-product),
 *  - constrói o texto do chunk a partir de um alimento (com a proveniência embutida).
 */

export function normalize(vec: number[]): number[] {
  const norm = Math.sqrt(vec.reduce((s, v) => s + v * v, 0));
  if (norm === 0) return vec;
  return vec.map((v) => v / norm);
}

/** Literal de vetor para pgvector: [0.1,0.2,...] */
export function toVectorLiteral(vec: number[]): string {
  return `[${vec.join(',')}]`;
}

interface FoodLike {
  nomePadronizado: string;
  grupoAlimentar?: string | null;
  porcaoPadraoG?: number | null;
  energiaKcal?: number | null;
  proteinasG?: number | null;
  carboidratosG?: number | null;
  lipidiosG?: number | null;
  fibrasG?: number | null;
  sodioMg?: number | null;
  ferroMg?: number | null;
  calcioMg?: number | null;
  potassioMg?: number | null;
  magnesioMg?: number | null;
  zincoMg?: number | null;
  fonte: string;
}

const n = (v: unknown) => (v == null ? null : Number(v));

/** Frase descritiva, factual, com os números e a fonte — alimenta o embedding e o RAG. */
export function buildFoodChunkText(f: FoodLike): string {
  const porcao = n(f.porcaoPadraoG) ?? 100;
  const parts: string[] = [];
  const add = (label: string, v: number | null, unit: string) => { if (v != null) parts.push(`${label} ${v}${unit}`); };
  add('energia', n(f.energiaKcal), ' kcal');
  add('proteína', n(f.proteinasG), ' g');
  add('carboidrato', n(f.carboidratosG), ' g');
  add('gordura', n(f.lipidiosG), ' g');
  add('fibra', n(f.fibrasG), ' g');
  add('sódio', n(f.sodioMg), ' mg');
  add('ferro', n(f.ferroMg), ' mg');
  add('cálcio', n(f.calcioMg), ' mg');
  add('potássio', n(f.potassioMg), ' mg');
  add('magnésio', n(f.magnesioMg), ' mg');
  add('zinco', n(f.zincoMg), ' mg');
  const grupo = f.grupoAlimentar ? ` (grupo: ${f.grupoAlimentar})` : '';
  return `Alimento: ${f.nomePadronizado}${grupo}. Por ${porcao}g — ${parts.join(', ')}. Fonte: ${f.fonte.toUpperCase()}.`;
}

interface InteractionLike {
  entityA: string;
  entityB: string;
  riskLevel: string;
  mechanism: string;
  recommendation: string;
  evidenceQuality?: string;
  confidenceLevel?: string;
}

/** Chunk de interação (suplemento/nutriente × medicamento/condição). */
export function buildInteractionChunkText(it: InteractionLike): string {
  return `Interação: ${it.entityA} × ${it.entityB}. Risco: ${it.riskLevel}. ` +
    `Mecanismo: ${it.mechanism}. Recomendação: ${it.recommendation}. ` +
    `Evidência: ${it.evidenceQuality ?? 'n/d'} (confiança ${it.confidenceLevel ?? 'n/d'}). Fonte: base de evidências clínicas.`;
}

interface ProductLike {
  nomeComercial?: string | null;
  marca?: string | null;
  nutriScore?: string | null;
  novaClassificacao?: number | null;
  tabelaNutricional?: Record<string, number>;
  alertaNutricional?: string[];
  alergenos?: string[];
}

/** Chunk de produto industrializado (Open Food Facts). */
export function buildProductChunkText(p: ProductLike): string {
  const t = p.tabelaNutricional ?? {};
  const macros: string[] = [];
  const add = (label: string, v: number | undefined, unit: string) => { if (v != null) macros.push(`${label} ${v}${unit}`); };
  add('energia', t.energia_kcal, ' kcal'); add('proteína', t.proteinas_g, ' g');
  add('carboidrato', t.carboidratos_g, ' g'); add('gordura', t.lipidios_g, ' g');
  add('açúcares', t.acucares_g, ' g'); add('sódio', t.sodio_mg, ' mg');
  const alertas = (p.alertaNutricional ?? []).length ? ` Alertas: ${(p.alertaNutricional ?? []).join(', ')}.` : '';
  const aler = (p.alergenos ?? []).length ? ` Alérgenos: ${(p.alergenos ?? []).join(', ')}.` : '';
  return `Produto: ${p.nomeComercial ?? 'sem nome'}${p.marca ? ` (${p.marca})` : ''}. ` +
    `Nutri-Score ${p.nutriScore ?? 'n/d'}, NOVA ${p.novaClassificacao ?? 'n/d'}. Por 100g — ${macros.join(', ')}.${alertas}${aler} Fonte: Open Food Facts.`;
}
