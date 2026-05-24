// ─── Evidence Base — NutriPerformance Clinical ───────────────────────────────
// Base de evidências local para interações suplemento × medicamento × condição
// Sincronizada com supabase/migrations/003_evidence_base_seed.sql
// ─────────────────────────────────────────────────────────────────────────────

export type RiskLevel = 'low' | 'moderate' | 'high' | 'contraindicated' | 'insufficient_data';
export type EntityType = 'supplement' | 'medication' | 'condition' | 'nutrient';
export type Confidence = 'high' | 'moderate' | 'low';

export interface EvidenceEntry {
  id: string;
  entityA: string;
  entityAType: EntityType;
  entityB: string;
  entityBType: EntityType;
  riskLevel: RiskLevel;
  mechanism: string;
  recommendation: string;
  confidence: Confidence;
  evidenceType: string;
  references: string;
}

export const EVIDENCE_BASE: EvidenceEntry[] = [
  // ── Ferro ──────────────────────────────────────────────────────────────────
  { id:'fe-01', entityA:'ferro', entityAType:'supplement', entityB:'omeprazol', entityBType:'medication',
    riskLevel:'moderate', confidence:'high', evidenceType:'observational',
    mechanism:'IBPs reduzem produção de ácido gástrico; o ferro não-heme necessita de pH ácido para conversão Fe3+→Fe2+ absorvível',
    recommendation:'Preferir ferro quelato (bisglicinato). Administrar 2h antes do omeprazol com vitamina C. Monitorar ferritina em 60 dias.',
    references:'Lam JR et al. JAMA 2013' },

  { id:'fe-02', entityA:'ferro', entityAType:'supplement', entityB:'pantoprazol', entityBType:'medication',
    riskLevel:'moderate', confidence:'high', evidenceType:'observational',
    mechanism:'Mesmo mecanismo dos IBPs — redução de acidez gástrica comprometendo absorção de ferro não-heme',
    recommendation:'Preferir ferro bisglicinato. Separar horários. Monitorar hemograma e ferritina.',
    references:'Lam JR et al. JAMA 2013' },

  { id:'fe-03', entityA:'ferro', entityAType:'supplement', entityB:'lansoprazol', entityBType:'medication',
    riskLevel:'moderate', confidence:'high', evidenceType:'observational',
    mechanism:'IBP reduz acidez gástrica, prejudicando absorção de ferro não-heme',
    recommendation:'Separar administração em 2h. Preferir quelato. Avaliar status de ferro em 90 dias.',
    references:'Lam JR et al. JAMA 2013' },

  { id:'fe-04', entityA:'ferro', entityAType:'supplement', entityB:'tetraciclina', entityBType:'medication',
    riskLevel:'high', confidence:'high', evidenceType:'rct',
    mechanism:'Ferro quelata tetraciclinas reduzindo absorção de ambos em até 80%',
    recommendation:'Separar administração em mínimo 3 horas.',
    references:'Neuvonen PJ. Drugs 1976' },

  { id:'fe-05', entityA:'ferro', entityAType:'supplement', entityB:'doença celíaca', entityBType:'condition',
    riskLevel:'high', confidence:'high', evidenceType:'observational',
    mechanism:'Enteropatia compromete a mucosa duodenal, local primário de absorção de ferro',
    recommendation:'Tratar a doença base. Preferir ferro parenteral em má absorção grave. Monitorar ferritina.',
    references:'Halfdanarson TR et al. Ann Med 2007' },

  { id:'fe-06', entityA:'ferro', entityAType:'supplement', entityB:'cálcio', entityBType:'supplement',
    riskLevel:'moderate', confidence:'high', evidenceType:'rct',
    mechanism:'Cálcio compete com ferro pelos mesmos transportadores intestinais (DMT-1)',
    recommendation:'Separar administração em pelo menos 2 horas. Não tomar com leite.',
    references:'Hallberg L et al. Am J Clin Nutr 1991' },

  // ── Vitamina D ─────────────────────────────────────────────────────────────
  { id:'vd-01', entityA:'vitamina d3', entityAType:'supplement', entityB:'orlistat', entityBType:'medication',
    riskLevel:'high', confidence:'high', evidenceType:'rct',
    mechanism:'Orlistat reduz absorção de vitaminas lipossolúveis ao inibir lipases intestinais',
    recommendation:'Monitorar 25-OH vitamina D. Suplementar em doses mais elevadas. Administrar 2h após orlistat.',
    references:'Gotfredsen A et al. Int J Obes 2001' },

  { id:'vd-02', entityA:'vitamina d3', entityAType:'supplement', entityB:'rifampicina', entityBType:'medication',
    riskLevel:'moderate', confidence:'high', evidenceType:'observational',
    mechanism:'Rifampicina é indutor enzimático (CYP3A4), acelerando catabolismo da vitamina D',
    recommendation:'Monitorar 25-OH vitamina D regularmente. Pode necessitar de doses mais elevadas de D3.',
    references:'Brodie MJ et al. Lancet 1980' },

  { id:'vd-03', entityA:'vitamina d3', entityAType:'supplement', entityB:'obesidade', entityBType:'condition',
    riskLevel:'moderate', confidence:'high', evidenceType:'observational',
    mechanism:'Vitamina D3 é lipossolúvel; em obesos, sequestra-se no tecido adiposo reduzindo concentração sérica',
    recommendation:'Doses maiores de D3 podem ser necessárias. Monitorar 25-OH vitamina D a cada 3 meses.',
    references:'Wortsman J et al. Am J Clin Nutr 2000' },

  // ── Zinco ──────────────────────────────────────────────────────────────────
  { id:'zn-01', entityA:'zinco', entityAType:'supplement', entityB:'ciprofloxacino', entityBType:'medication',
    riskLevel:'high', confidence:'high', evidenceType:'rct',
    mechanism:'Zinco quelata fluoroquinolonas, reduzindo absorção do antibiótico em até 50%',
    recommendation:'Administrar zinco 2h antes ou 6h após o antibiótico.',
    references:'Polk RE et al. Antimicrob Agents Chemother 1989' },

  { id:'zn-02', entityA:'zinco', entityAType:'supplement', entityB:'cobre', entityBType:'supplement',
    riskLevel:'high', confidence:'high', evidenceType:'rct',
    mechanism:'Zinco em doses elevadas induz metalotioneína intestinal que sequestra cobre',
    recommendation:'Em suplementação de zinco >25mg/dia, monitorar cobre sérico. Relação Zn:Cu recomendada 8-15:1.',
    references:'Fischer PW et al. Am J Clin Nutr 1984' },

  { id:'zn-03', entityA:'zinco', entityAType:'supplement', entityB:'ferro', entityBType:'supplement',
    riskLevel:'moderate', confidence:'high', evidenceType:'rct',
    mechanism:'Zinco e ferro competem pelo mesmo transportador intestinal DMT-1 em doses farmacológicas',
    recommendation:'Não administrar simultaneamente. Separar por pelo menos 2 horas.',
    references:'Olivares M et al. Am J Clin Nutr 1996' },

  // ── Magnésio ───────────────────────────────────────────────────────────────
  { id:'mg-01', entityA:'magnésio', entityAType:'supplement', entityB:'tetraciclina', entityBType:'medication',
    riskLevel:'high', confidence:'high', evidenceType:'rct',
    mechanism:'Magnésio forma quelatos insolúveis com tetraciclinas, reduzindo absorção de ambos',
    recommendation:'Separar administração em pelo menos 3 horas.',
    references:'Neuvonen PJ. Drugs 1976' },

  { id:'mg-02', entityA:'magnésio', entityAType:'supplement', entityB:'furosemida', entityBType:'medication',
    riskLevel:'high', confidence:'high', evidenceType:'observational',
    mechanism:'Diuréticos de alça aumentam excreção renal de magnésio',
    recommendation:'Monitorar magnésio sérico. Suplementação profilática pode ser indicada.',
    references:'Ryan MP. Am J Cardiol 1990' },

  // ── Creatina ───────────────────────────────────────────────────────────────
  { id:'cr-01', entityA:'creatina', entityAType:'supplement', entityB:'doença renal crônica', entityBType:'condition',
    riskLevel:'high', confidence:'high', evidenceType:'rct',
    mechanism:'Creatina eleva creatinina sérica, podendo mascarar função renal ou sobrecarregar rins comprometidos',
    recommendation:'Avaliar com nefrologista antes de iniciar. Monitorar creatinina e TFG. Contraindicado em TFG < 30 mL/min.',
    references:'Greenhaff PL. Kidney Int 1998' },

  { id:'cr-02', entityA:'creatina', entityAType:'supplement', entityB:'ibuprofeno', entityBType:'medication',
    riskLevel:'moderate', confidence:'low', evidenceType:'observational',
    mechanism:'AINEs reduzem fluxo sanguíneo renal; creatina pode adicionar stress renal em uso crônico',
    recommendation:'Evitar uso crônico combinado. Monitorar função renal se uso necessário.',
    references:'Poortmans JR. Sports Med 1999' },

  // ── Ômega-3 ────────────────────────────────────────────────────────────────
  { id:'o3-01', entityA:'ômega-3', entityAType:'supplement', entityB:'varfarina', entityBType:'medication',
    riskLevel:'high', confidence:'high', evidenceType:'rct',
    mechanism:'Ômega-3 (EPA/DHA) tem efeito antiagregante e pode potencializar anticoagulação; INR pode aumentar',
    recommendation:'Monitorar INR com mais frequência. Comunicar médico prescritor antes de iniciar.',
    references:'Hau MF et al. Thromb Res 1998' },

  { id:'o3-02', entityA:'ômega-3', entityAType:'supplement', entityB:'ácido acetilsalicílico', entityBType:'medication',
    riskLevel:'moderate', confidence:'moderate', evidenceType:'observational',
    mechanism:'Sinergia antiagregante plaquetária — risco aumentado de sangramento em doses altas',
    recommendation:'Usar com cautela. Informar profissional prescritor. Monitorar sinais de sangramento.',
    references:'Larson MK et al. Prostaglandins 2008' },

  // ── Vitamina K2 ────────────────────────────────────────────────────────────
  { id:'k2-01', entityA:'vitamina k2', entityAType:'supplement', entityB:'varfarina', entityBType:'medication',
    riskLevel:'contraindicated', confidence:'high', evidenceType:'rct',
    mechanism:'Vitamina K antagoniza diretamente o mecanismo de ação da varfarina (inibição da vitamina K epóxido redutase)',
    recommendation:'CONTRAINDICADO. Avaliar com médico prescritor antes de qualquer suplementação de K2.',
    references:'Schurgers LJ et al. Blood 2004' },

  // ── Whey Protein ───────────────────────────────────────────────────────────
  { id:'wp-01', entityA:'whey protein', entityAType:'supplement', entityB:'doença renal crônica', entityBType:'condition',
    riskLevel:'high', confidence:'high', evidenceType:'rct',
    mechanism:'Elevado aporte proteico pode acelerar declínio da TFG em nefropatas',
    recommendation:'Restringir ingestão proteica a 0,6–0,8g/kg/dia. Consultar nefrologista.',
    references:'Kalantar-Zadeh K et al. NEJM 2017' },

  // ── Cálcio ─────────────────────────────────────────────────────────────────
  { id:'ca-01', entityA:'cálcio', entityAType:'supplement', entityB:'levotiroxina', entityBType:'medication',
    riskLevel:'high', confidence:'high', evidenceType:'rct',
    mechanism:'Cálcio forma complexos insolúveis com levotiroxina, reduzindo absorção do hormônio em até 40%',
    recommendation:'Administrar levotiroxina em jejum. Separar cálcio por no mínimo 4h.',
    references:'Singh N et al. Ann Intern Med 2000' },

  { id:'ca-02', entityA:'cálcio', entityAType:'supplement', entityB:'tetraciclina', entityBType:'medication',
    riskLevel:'high', confidence:'high', evidenceType:'rct',
    mechanism:'Cálcio quelata tetraciclinas, reduzindo absorção do antibiótico',
    recommendation:'Separar administração em pelo menos 3 horas.',
    references:'Neuvonen PJ. Drugs 1976' },

  // ── Vitamina B12 ───────────────────────────────────────────────────────────
  { id:'b12-01', entityA:'vitamina b12', entityAType:'supplement', entityB:'metformina', entityBType:'medication',
    riskLevel:'moderate', confidence:'high', evidenceType:'rct',
    mechanism:'Metformina reduz absorção de B12 ao inibir fator intrínseco; deficiência comum após > 2 anos',
    recommendation:'Monitorar B12 anualmente em uso de metformina. Suplementação preventiva em vegetarianos.',
    references:'De Jager J et al. BMJ 2010' },

  { id:'b12-02', entityA:'vitamina b12', entityAType:'supplement', entityB:'omeprazol', entityBType:'medication',
    riskLevel:'moderate', confidence:'high', evidenceType:'observational',
    mechanism:'IBPs reduzem acidez gástrica necessária para liberação de B12 ligada às proteínas alimentares',
    recommendation:'Monitorar B12 em uso prolongado de IBP (> 2 anos). Preferir cianocobalamina sublingual.',
    references:'Lam JR et al. JAMA 2013' },

  // ── CoQ10 ──────────────────────────────────────────────────────────────────
  { id:'cq-01', entityA:'coenzima q10', entityAType:'supplement', entityB:'estatinas', entityBType:'medication',
    riskLevel:'low', confidence:'moderate', evidenceType:'rct',
    mechanism:'Estatinas inibem HMG-CoA redutase, reduzindo síntese endógena de CoQ10; suplementação pode ser benéfica',
    recommendation:'Efeito potencialmente BENÉFICO. Considerar 100-200mg/dia em uso de estatinas. Monitorar miopatia.',
    references:'Caso G et al. Am J Cardiol 2007' },

  // ── Vitamina C ─────────────────────────────────────────────────────────────
  { id:'vc-01', entityA:'vitamina c', entityAType:'supplement', entityB:'ferro', entityBType:'supplement',
    riskLevel:'low', confidence:'high', evidenceType:'rct',
    mechanism:'Vitamina C AUMENTA absorção de ferro não-heme ao reduzir Fe3+→Fe2+ e prevenir precipitação',
    recommendation:'Efeito BENÉFICO — administrar vitamina C junto com ferro para potencializar absorção.',
    references:'Hallberg L et al. Am J Clin Nutr 1986' },

  // ── Cafeína ────────────────────────────────────────────────────────────────
  { id:'cf-01', entityA:'cafeína', entityAType:'supplement', entityB:'hipertensão arterial', entityBType:'condition',
    riskLevel:'moderate', confidence:'high', evidenceType:'rct',
    mechanism:'Cafeína provoca elevação aguda da pressão arterial, especialmente em não-habituados',
    recommendation:'Limitar ingestão. Monitorar PA. Preferir doses menores (até 200mg).',
    references:'Palatini P et al. J Hypertens 2009' },

  { id:'cf-02', entityA:'cafeína', entityAType:'supplement', entityB:'gravidez', entityBType:'condition',
    riskLevel:'high', confidence:'high', evidenceType:'systematic_review',
    mechanism:'Cafeína atravessa barreira placentária; associada a restrição de crescimento fetal > 200mg/dia',
    recommendation:'Limitar a < 200mg/dia. Evitar pré-treinos com cafeína. Consultar obstetra.',
    references:'ACOG Committee Opinion 2020' },

  // ── Melatonina ─────────────────────────────────────────────────────────────
  { id:'ml-01', entityA:'melatonina', entityAType:'supplement', entityB:'imunossupressores', entityBType:'medication',
    riskLevel:'moderate', confidence:'low', evidenceType:'observational',
    mechanism:'Melatonina tem efeito imunomodulador que pode interferir com imunossupressão',
    recommendation:'Evitar em transplantados sem avaliação médica.',
    references:'Maestroni GJ. J Pineal Res 1993' },

  // ── Probióticos ────────────────────────────────────────────────────────────
  { id:'pb-01', entityA:'probiótico', entityAType:'supplement', entityB:'imunossupressão grave', entityBType:'condition',
    riskLevel:'high', confidence:'high', evidenceType:'case_report',
    mechanism:'Probióticos com bactérias vivas representam risco de sepse em imunossuprimidos',
    recommendation:'CONTRAINDICADO em imunossupressão grave (quimioterapia, transplantados, HIV avançado).',
    references:'Munoz P et al. Clin Infect Dis 2005' },

  { id:'pb-02', entityA:'probiótico', entityAType:'supplement', entityB:'antibióticos', entityBType:'medication',
    riskLevel:'moderate', confidence:'high', evidenceType:'rct',
    mechanism:'Antibióticos podem inativar cepas probióticas se administrados simultaneamente',
    recommendation:'Administrar probiótico pelo menos 2h após o antibiótico. Manter uso durante e após o ciclo.',
    references:'McFarland LV. Am J Gastroenterol 2006' },

  // ── Ashwagandha ────────────────────────────────────────────────────────────
  { id:'aw-01', entityA:'ashwagandha', entityAType:'supplement', entityB:'antidepressivos', entityBType:'medication',
    riskLevel:'high', confidence:'moderate', evidenceType:'case_report',
    mechanism:'Ashwagandha pode inibir MAO e atuar sobre serotonina; risco de síndrome serotoninérgica com ISRS',
    recommendation:'Evitar combinação. Consultar médico psiquiatra antes de qualquer uso.',
    references:'Brinker F. Herb Contraindications 2010' },

  { id:'aw-02', entityA:'ashwagandha', entityAType:'supplement', entityB:'hipotireoidismo', entityBType:'condition',
    riskLevel:'moderate', confidence:'moderate', evidenceType:'rct',
    mechanism:'Ashwagandha pode estimular produção de hormônio tireoidiano — pode exigir ajuste de levotiroxina',
    recommendation:'Monitorar TSH e T4L. Comunicar médico endocrinologista.',
    references:'Sharma AK et al. IJAH 2018' },

  // ── Curcumina ──────────────────────────────────────────────────────────────
  { id:'cu-01', entityA:'curcumina', entityAType:'supplement', entityB:'varfarina', entityBType:'medication',
    riskLevel:'moderate', confidence:'moderate', evidenceType:'case_report',
    mechanism:'Curcumina tem efeito anticoagulante e antiagregante; pode potencializar varfarina',
    recommendation:'Monitorar INR. Comunicar médico prescritor. Evitar doses > 500mg/dia.',
    references:'Jayaprakasha GK et al. Trends Food Sci 2006' },

  { id:'cu-02', entityA:'curcumina', entityAType:'supplement', entityB:'ferro', entityBType:'supplement',
    riskLevel:'moderate', confidence:'moderate', evidenceType:'in_vitro',
    mechanism:'Curcumina pode quelar ferro, reduzindo sua absorção em uso simultâneo',
    recommendation:'Separar administração de curcumina e ferro em pelo menos 3 horas.',
    references:'Tuntipopipat S et al. J Nutr 2006' },

  // ── Rhodiola ───────────────────────────────────────────────────────────────
  { id:'rh-01', entityA:'rhodiola rosea', entityAType:'supplement', entityB:'antidepressivos', entityBType:'medication',
    riskLevel:'high', confidence:'moderate', evidenceType:'case_report',
    mechanism:'Rhodiola pode inibir MAO e atuar sobre serotonina; risco de síndrome serotoninérgica com ISRS',
    recommendation:'Evitar combinação. Consultar médico psiquiatra.',
    references:'Brinker F. Herb Contraindications 2010' },
];

// ─── Query functions ──────────────────────────────────────────────────────────

/** Normalize text for matching (lowercase, remove accents) */
function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim();
}

/** Find all interactions involving a list of entities */
export function queryInteractions(entities: string[]): EvidenceEntry[] {
  const normalized = entities.map(normalize);
  const seen = new Set<string>();
  const results: EvidenceEntry[] = [];

  for (const entry of EVIDENCE_BASE) {
    if (seen.has(entry.id)) continue;
    const normA = normalize(entry.entityA);
    const normB = normalize(entry.entityB);
    // Match if any entity partially matches entityA or entityB
    const matchA = normalized.some((n) => normA.includes(n) || n.includes(normA));
    const matchB = normalized.some((n) => normB.includes(n) || n.includes(normB));
    // Need both sides matched to be a real interaction
    if (matchA && matchB) {
      results.push(entry);
      seen.add(entry.id);
    }
  }

  // Sort by risk level severity
  const ORDER: Record<RiskLevel, number> = {
    contraindicated: 0, high: 1, moderate: 2, low: 3, insufficient_data: 4,
  };
  return results.sort((a, b) => ORDER[a.riskLevel] - ORDER[b.riskLevel]);
}

/** Get overall risk from a list of results */
export function getOverallRisk(results: EvidenceEntry[]): RiskLevel {
  if (!results.length) return 'insufficient_data';
  const ORDER: Record<RiskLevel, number> = {
    contraindicated: 0, high: 1, moderate: 2, low: 3, insufficient_data: 4,
  };
  return results.reduce((worst, r) =>
    ORDER[r.riskLevel] < ORDER[worst] ? r.riskLevel : worst,
    'insufficient_data' as RiskLevel,
  );
}
