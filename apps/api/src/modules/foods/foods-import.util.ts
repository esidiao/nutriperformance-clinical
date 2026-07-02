/**
 * Lógica pura de importação de alimentos (testável, sem I/O).
 * Usada pelo runner scripts/import-foods-csv.js (via dist) e pelos testes.
 *
 * Mapeia uma linha "crua" (header→valor) de uma planilha TACO/TBCA/USDA exportada
 * em CSV para o formato da tabela `foods`, validando coerência antes do upsert.
 */

export interface RawFoodRow {
  [header: string]: string | undefined;
}

export interface MappedFood {
  nome_padronizado: string;
  grupo_alimentar: string | null;
  energia_kcal: number | null;
  carboidratos_g: number | null;
  proteinas_g: number | null;
  lipidios_g: number | null;
  fibras_g: number | null;
  sodio_mg: number | null;
  calcio_mg: number | null;
  ferro_mg: number | null;
  potassio_mg: number | null;
  magnesio_mg: number | null;
  zinco_mg: number | null;
  fonte: string;
  fonte_id_externo: string | null;
  fonte_versao: string | null;
  confiabilidade: 'alta' | 'media' | 'baixa' | 'pendente';
  licenca: string | null;
}

/** Converte texto numérico tolerando vírgula decimal, "NA", "Tr", "*" e vazio. */
export function parseNum(v: string | undefined | null): number | null {
  if (v === undefined || v === null) return null;
  const s = String(v).trim().toLowerCase();
  if (s === '' || s === 'na' || s === 'tr' || s === '*' || s === '-' || s === 'nd') return null;
  const n = Number(s.replace(/\./g, '').includes(',') ? s.replace(/\./g, '').replace(',', '.') : s.replace(',', '.'));
  return isNaN(n) ? null : n;
}

/** Normaliza para comparação: minúsculas, sem acentos, sem espaços nas pontas. */
function norm(s: string): string {
  return s.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

/** Lê um campo da linha por qualquer um dos nomes de cabeçalho aceitos (sem acento/case). */
export function pick(row: RawFoodRow, names: string[]): string | undefined {
  for (const n of names) {
    if (row[n] !== undefined) return row[n];
    const target = norm(n);
    const key = Object.keys(row).find((k) => norm(k) === target);
    if (key) return row[key];
  }
  return undefined;
}

export function mapRow(
  row: RawFoodRow,
  opts: { fonte: string; fonteVersao: string; licenca: string; confiabilidade: MappedFood['confiabilidade'] },
): MappedFood {
  // Aliases incluem os cabeçalhos exatos da TACO (formatados/alimentos.csv),
  // normalizados por `pick` (sem acento/case): "Energia..kcal." → "energia..kcal." etc.
  return {
    nome_padronizado: (pick(row, ['nome', 'descricao', 'description', 'alimento', 'descricao dos alimentos']) ?? '').trim(),
    grupo_alimentar: (pick(row, ['grupo', 'categoria', 'food_group', 'categoria do alimento']) ?? '').trim() || null,
    energia_kcal: parseNum(pick(row, ['energia_kcal', 'energia', 'kcal', 'energy', 'energia (kcal)', 'energia..kcal.'])),
    carboidratos_g: parseNum(pick(row, ['carboidratos', 'carboidrato', 'carbohydrate', 'carbo_g', 'carboidrato..g.'])),
    proteinas_g: parseNum(pick(row, ['proteina', 'proteinas', 'protein', 'proteina..g.'])),
    lipidios_g: parseNum(pick(row, ['lipidios', 'lipideos', 'gordura', 'lipid', 'total_fat', 'lipideos..g.'])),
    fibras_g: parseNum(pick(row, ['fibra', 'fibras', 'fiber', 'fibra.alimentar..g.'])),
    sodio_mg: parseNum(pick(row, ['sodio', 'sodium', 'sodio..mg.'])),
    calcio_mg: parseNum(pick(row, ['calcio', 'calcium', 'calcio..mg.'])),
    ferro_mg: parseNum(pick(row, ['ferro', 'iron', 'ferro..mg.'])),
    potassio_mg: parseNum(pick(row, ['potassio', 'potassium', 'potassio..mg.'])),
    magnesio_mg: parseNum(pick(row, ['magnesio', 'magnesium', 'magnesio..mg.'])),
    zinco_mg: parseNum(pick(row, ['zinco', 'zinc', 'zinco..mg.'])),
    fonte: opts.fonte,
    fonte_id_externo: (pick(row, ['id', 'codigo', 'fdc_id', 'numero', 'numero do alimento']) ?? '').trim() || null,
    fonte_versao: opts.fonteVersao,
    confiabilidade: opts.confiabilidade,
    licenca: opts.licenca,
  };
}

/**
 * Valida coerência. Regra-chave: kcal informada ≈ 4*carb + 4*prot + 9*lip (Atwater),
 * com tolerância de 30% (alimentos têm álcool/poliois/arredondamentos).
 */
export function validateFood(
  f: MappedFood,
  opts: { strictKcal?: boolean } = {},
): { ok: boolean; errors: string[]; warnings: string[] } {
  const strictKcal = opts.strictKcal !== false; // default estrito
  const errors: string[] = [];
  const warnings: string[] = [];
  if (!f.nome_padronizado) errors.push('nome ausente');

  // valores negativos são sempre inválidos (erro)
  for (const [k, v] of Object.entries(f)) {
    if (typeof v === 'number' && v < 0) errors.push(`${k} negativo`);
  }

  // Coerência energética (Atwater). Para fontes autoritativas (TACO/USDA), trate
  // como AVISO — alimentos têm fibra/álcool/poliois/ácidos orgânicos que desviam.
  const hasAllMacros = [f.carboidratos_g, f.proteinas_g, f.lipidios_g].every((m) => m !== null);
  if (f.energia_kcal != null && hasAllMacros) {
    const estimado = 4 * (f.carboidratos_g ?? 0) + 4 * (f.proteinas_g ?? 0) + 9 * (f.lipidios_g ?? 0);
    if (estimado > 0) {
      const desvio = Math.abs(f.energia_kcal - estimado) / estimado;
      if (desvio > 0.3) {
        const msg = `kcal incoerente (informado ${f.energia_kcal}, estimado ${estimado.toFixed(0)})`;
        if (strictKcal) errors.push(msg); else warnings.push(msg);
      }
    }
  }
  return { ok: errors.length === 0, errors, warnings };
}
