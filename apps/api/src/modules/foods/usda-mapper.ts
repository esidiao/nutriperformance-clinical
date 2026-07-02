/**
 * Mapeamento puro de um alimento USDA FoodData Central → schema interno `foods`.
 * Valores são por 100g (dataType SR Legacy / Foundation). Sem I/O → testável.
 */

export interface MappedUsdaFood {
  nome_padronizado: string;
  grupo_alimentar: string | null;
  energia_kcal: number | null;
  proteinas_g: number | null;
  carboidratos_g: number | null;
  lipidios_g: number | null;
  gordura_saturada_g: number | null;
  fibras_g: number | null;
  acucares_g: number | null;
  sodio_mg: number | null;
  calcio_mg: number | null;
  ferro_mg: number | null;
  potassio_mg: number | null;
  magnesio_mg: number | null;
  zinco_mg: number | null;
  vitaminas: Record<string, number>;
  fonte_id_externo: string | null;
}

// nutrientName (USDA) → campo interno
const MACRO_MAP: Record<string, keyof MappedUsdaFood> = {
  'Protein': 'proteinas_g',
  'Carbohydrate, by difference': 'carboidratos_g',
  'Total lipid (fat)': 'lipidios_g',
  'Fatty acids, total saturated': 'gordura_saturada_g',
  'Fiber, total dietary': 'fibras_g',
  'Sugars, total including NLEA': 'acucares_g',
  'Sodium, Na': 'sodio_mg',
  'Calcium, Ca': 'calcio_mg',
  'Iron, Fe': 'ferro_mg',
  'Potassium, K': 'potassio_mg',
  'Magnesium, Mg': 'magnesio_mg',
  'Zinc, Zn': 'zinco_mg',
};
// vitaminas → rótulo legível
const VIT_MAP: Record<string, string> = {
  'Vitamin C, total ascorbic acid': 'Vitamina C (mg)',
  'Vitamin D (D2 + D3)': 'Vitamina D (µg)',
  'Vitamin A, RAE': 'Vitamina A (µg)',
  'Vitamin E (alpha-tocopherol)': 'Vitamina E (mg)',
  'Vitamin B-12': 'Vitamina B12 (µg)',
  'Vitamin B-6': 'Vitamina B6 (mg)',
  'Folate, total': 'Folato (µg)',
  'Thiamin': 'Tiamina (mg)',
  'Riboflavin': 'Riboflavina (mg)',
  'Niacin': 'Niacina (mg)',
};

function num(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  const n = Number(v);
  return isNaN(n) ? null : n;
}

export function mapUsdaFood(food: any): MappedUsdaFood {
  const out: MappedUsdaFood = {
    nome_padronizado: (food?.description ?? '').toString().trim(),
    grupo_alimentar: (food?.foodCategory ?? '').toString().trim() || null,
    energia_kcal: null, proteinas_g: null, carboidratos_g: null, lipidios_g: null,
    gordura_saturada_g: null, fibras_g: null, acucares_g: null, sodio_mg: null,
    calcio_mg: null, ferro_mg: null, potassio_mg: null, magnesio_mg: null, zinco_mg: null,
    vitaminas: {},
    fonte_id_externo: food?.fdcId != null ? String(food.fdcId) : null,
  };

  for (const n of food?.foodNutrients ?? []) {
    const name = n?.nutrientName;
    const unit = (n?.unitName ?? '').toString().toUpperCase();
    const value = num(n?.value);
    if (!name || value === null) continue;

    if (name === 'Energy' && unit === 'KCAL') { out.energia_kcal = value; continue; }
    const field = MACRO_MAP[name];
    if (field) { (out as any)[field] = value; continue; }
    const vit = VIT_MAP[name];
    if (vit) { out.vitaminas[vit] = value; }
  }
  return out;
}
