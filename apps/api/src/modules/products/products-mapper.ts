/**
 * Mapeamento puro de um produto Open Food Facts → formato interno, e cálculo
 * de alertas nutricionais (ANVISA RDC 429/2020, limiares "alto em" por 100g).
 * Lógica sem I/O → testável.
 */

export interface MappedProduct {
  codigo_barras: string;
  marca: string | null;
  nome_comercial: string | null;
  ingredientes: string | null;
  alergenos: string[];
  tabela_nutricional: Record<string, number>; // por 100g
  aditivos: string[];
  nutri_score: string | null;
  nova_classificacao: number | null;
  pais: string | null;
  imagem_rotulo_url: string | null;
  alerta_nutricional: string[];
}

function num(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return isNaN(n) ? null : n;
}

/** Limpa tags do OFF: "en:gluten" → "gluten", "pt:leite" → "leite". */
function cleanTags(tags: unknown): string[] {
  if (!Array.isArray(tags)) return [];
  return tags
    .map((t) => String(t).replace(/^[a-z]{2}:/, '').replace(/-/g, ' ').trim())
    .filter(Boolean);
}

/**
 * ANVISA RDC 429/2020 — rotulagem nutricional frontal "ALTO EM" (alimentos sólidos, por 100g):
 *   sódio ≥ 600 mg | açúcares adicionados ≥ 15 g | gordura saturada ≥ 6 g
 * (usamos açúcares totais como proxy; sinalizado como apoio).
 */
export function computeAlerts(nutr: Record<string, number>, nova: number | null): string[] {
  const alerts: string[] = [];
  if ((nutr.sodio_mg ?? 0) >= 600) alerts.push('Alto em sódio');
  if ((nutr.acucares_g ?? 0) >= 15) alerts.push('Alto em açúcares');
  if ((nutr.gordura_saturada_g ?? 0) >= 6) alerts.push('Alto em gordura saturada');
  if (nova === 4) alerts.push('Ultraprocessado (NOVA 4)');
  return alerts;
}

export function mapOpenFoodFactsProduct(barcode: string, p: any): MappedProduct {
  const n = p?.nutriments ?? {};
  // OFF expõe sódio em g/100g; convertemos para mg. Fallback: sal/2.5.
  const sodioG = num(n['sodium_100g']) ?? (num(n['salt_100g']) != null ? (num(n['salt_100g']) as number) / 2.5 : null);
  const tabela: Record<string, number> = {};
  const set = (k: string, v: number | null) => { if (v != null) tabela[k] = v; };
  set('energia_kcal', num(n['energy-kcal_100g']));
  set('proteinas_g', num(n['proteins_100g']));
  set('carboidratos_g', num(n['carbohydrates_100g']));
  set('lipidios_g', num(n['fat_100g']));
  set('gordura_saturada_g', num(n['saturated-fat_100g']));
  set('acucares_g', num(n['sugars_100g']));
  set('fibras_g', num(n['fiber_100g']));
  set('sodio_mg', sodioG != null ? Math.round(sodioG * 1000) : null);

  const nova = num(p?.nova_group);
  const nutriScore = typeof p?.nutriscore_grade === 'string' ? p.nutriscore_grade.toUpperCase() : null;

  return {
    codigo_barras: barcode,
    marca: (p?.brands ?? '').toString().trim() || null,
    nome_comercial: (p?.product_name ?? '').toString().trim() || null,
    ingredientes: (p?.ingredients_text ?? '').toString().trim() || null,
    alergenos: cleanTags(p?.allergens_tags),
    tabela_nutricional: tabela,
    aditivos: cleanTags(p?.additives_tags),
    nutri_score: nutriScore && /^[A-E]$/.test(nutriScore) ? nutriScore : null,
    nova_classificacao: nova,
    pais: (p?.countries ?? '').toString().split(',')[0].trim() || null,
    imagem_rotulo_url: (p?.image_url ?? '').toString().trim() || null,
    alerta_nutricional: computeAlerts(tabela, nova),
  };
}
