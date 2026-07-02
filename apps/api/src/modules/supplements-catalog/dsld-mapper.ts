/**
 * Mapeamento puro de um item do NIH DSLD (search-filter `_source`) → catálogo interno.
 * Sem I/O → testável. Calcula "flags" clínicas a partir dos ingredientes.
 */

export interface MappedSupplement {
  dsld_id: string;
  nome: string | null;
  marca: string | null;
  forma_farmaceutica: string | null;
  ingredientes_ativos: Array<{ name: string; group?: string; notes?: string }>;
  flags: string[];
  advertencias: string[];
}

// Ingredientes clinicamente relevantes → flag legível (apoio a "contém X?").
const FLAG_RULES: Array<{ re: RegExp; label: string }> = [
  { re: /caffeine|cafe[ií]na|guarana|guaran[aá]/i, label: 'Contém cafeína' },
  { re: /vitamin k|vitamina k|phylloquinone|menaquinone/i, label: 'Contém vitamina K' },
  { re: /\biron\b|ferro|ferrous|ferric/i, label: 'Contém ferro' },
  { re: /calcium|c[aá]lcio/i, label: 'Contém cálcio' },
  { re: /vitamin a\b|retinol|retinyl/i, label: 'Contém vitamina A' },
  { re: /st\.?\s*john'?s wort|hypericum|hiperic/i, label: 'Contém Hipérico (interage com vários fármacos)' },
  { re: /vitamin e\b|tocopherol/i, label: 'Contém vitamina E' },
  { re: /potassium|pot[aá]ssio/i, label: 'Contém potássio' },
];

export function mapDsldItem(src: any): MappedSupplement {
  const id = String(src?._id ?? src?.id ?? '').trim();
  const ingredients: Array<{ name: string; group?: string; notes?: string }> = Array.isArray(src?.allIngredients)
    ? src.allIngredients
        .filter((i: any) => i?.name || i?.ingredientGroup)
        .map((i: any) => ({
          name: String(i.name ?? i.ingredientGroup ?? '').trim(),
          group: i.ingredientGroup ? String(i.ingredientGroup).trim() : undefined,
          notes: i.notes ? String(i.notes).trim() : undefined,
        }))
    : [];

  const haystack = ingredients.map((i) => `${i.name} ${i.group ?? ''} ${i.notes ?? ''}`).join(' ');
  const flags: string[] = [];
  for (const rule of FLAG_RULES) {
    if (rule.re.test(haystack) && !flags.includes(rule.label)) flags.push(rule.label);
  }

  // Advertências: statements do tipo precaução/aviso, quando presentes.
  const advertencias: string[] = Array.isArray(src?.statements)
    ? src.statements
        .filter((s: any) => /precaution|warning|advert/i.test(String(s?.type ?? '')))
        .map((s: any) => String(s?.notes ?? s?.text ?? '').trim())
        .filter(Boolean)
        .slice(0, 5)
    : [];

  return {
    dsld_id: id,
    nome: (src?.fullName ?? src?.bundleName ?? src?.brandName ?? '').toString().trim() || null,
    marca: (src?.brandName ?? '').toString().trim() || null,
    forma_farmaceutica: (src?.physicalState?.langualCodeDescription ?? '').toString().trim() || null,
    ingredientes_ativos: ingredients,
    flags,
    advertencias,
  };
}
