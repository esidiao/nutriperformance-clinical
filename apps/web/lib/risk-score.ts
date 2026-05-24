// ─── Cardiometabolic Risk Score Calculator ───────────────────────────────────
// Combines physical assessment data + lab markers + supplementation risk
// Output: 0–100 score (0 = minimal risk, 100 = very high risk)
// ─────────────────────────────────────────────────────────────────────────────

export interface RiskInput {
  // Biometrics
  bmi?: number;
  waistCm?: number;
  whr?: number;
  bodyFatPct?: number;
  gender?: 'male' | 'female';
  age?: number;
  // Vitals
  restingHeartRateBpm?: number;
  bloodPressureSystolic?: number;
  // Activity
  activityLevel?: 'sedentary' | 'lightly_active' | 'moderately_active' | 'very_active' | 'extremely_active';
  // Lab markers
  fastingGlucose?: number;   // mg/dL
  totalCholesterol?: number; // mg/dL
  ldl?: number;              // mg/dL
  hdl?: number;              // mg/dL
  triglycerides?: number;    // mg/dL
  // Conditions
  conditions?: string[];
  // Supplements (risk from interaction analysis)
  supplementRiskLevel?: 'none' | 'low' | 'moderate' | 'high' | 'contraindicated';
}

export interface RiskScoreResult {
  score: number;               // 0–100
  level: 'low' | 'moderate' | 'high' | 'very_high';
  label: string;
  color: string;               // Tailwind color class
  bgColor: string;
  trend?: 'improving' | 'stable' | 'worsening';
  contributors: RiskContributor[];
  recommendations: string[];
}

interface RiskContributor {
  factor: string;
  points: number;
  category: 'biometric' | 'metabolic' | 'lifestyle' | 'supplement';
}

export function calculateRiskScore(input: RiskInput): RiskScoreResult {
  const contributors: RiskContributor[] = [];
  let total = 0;

  // ── BMI ────────────────────────────────────────────────────────────────────
  if (input.bmi !== undefined) {
    const pts = input.bmi < 18.5 ? 5 : input.bmi < 25 ? 0 : input.bmi < 30 ? 8 : input.bmi < 35 ? 15 : 20;
    if (pts > 0) contributors.push({ factor: `IMC ${input.bmi}`, points: pts, category: 'biometric' });
    total += pts;
  }

  // ── Waist circumference ────────────────────────────────────────────────────
  if (input.waistCm !== undefined && input.gender) {
    const limit = input.gender === 'male' ? 102 : 88;
    const warn  = input.gender === 'male' ? 94  : 80;
    const pts = input.waistCm > limit ? 15 : input.waistCm > warn ? 8 : 0;
    if (pts > 0) contributors.push({ factor: `Cintura ${input.waistCm}cm`, points: pts, category: 'biometric' });
    total += pts;
  }

  // ── WHR ────────────────────────────────────────────────────────────────────
  if (input.whr !== undefined && input.gender) {
    const limit = input.gender === 'male' ? 1.0 : 0.85;
    const pts = input.whr > limit + 0.1 ? 10 : input.whr > limit ? 6 : 0;
    if (pts > 0) contributors.push({ factor: `RCQ ${input.whr}`, points: pts, category: 'biometric' });
    total += pts;
  }

  // ── Body fat % ─────────────────────────────────────────────────────────────
  if (input.bodyFatPct !== undefined && input.gender) {
    const high = input.gender === 'male' ? 25 : 32;
    const vhigh = input.gender === 'male' ? 30 : 38;
    const pts = input.bodyFatPct > vhigh ? 10 : input.bodyFatPct > high ? 5 : 0;
    if (pts > 0) contributors.push({ factor: `%Gordura ${input.bodyFatPct}%`, points: pts, category: 'biometric' });
    total += pts;
  }

  // ── Age ────────────────────────────────────────────────────────────────────
  if (input.age !== undefined) {
    const pts = input.age >= 65 ? 10 : input.age >= 50 ? 6 : input.age >= 40 ? 3 : 0;
    if (pts > 0) contributors.push({ factor: `Idade ${input.age} anos`, points: pts, category: 'biometric' });
    total += pts;
  }

  // ── Activity level ─────────────────────────────────────────────────────────
  const activityPts: Record<string, number> = {
    sedentary: 12, lightly_active: 6, moderately_active: 0, very_active: 0, extremely_active: 0,
  };
  if (input.activityLevel) {
    const pts = activityPts[input.activityLevel] ?? 0;
    if (pts > 0) contributors.push({ factor: 'Sedentário', points: pts, category: 'lifestyle' });
    total += pts;
  }

  // ── Resting HR ─────────────────────────────────────────────────────────────
  if (input.restingHeartRateBpm !== undefined) {
    const pts = input.restingHeartRateBpm > 100 ? 8 : input.restingHeartRateBpm > 85 ? 4 : 0;
    if (pts > 0) contributors.push({ factor: `FC repouso ${input.restingHeartRateBpm}bpm`, points: pts, category: 'biometric' });
    total += pts;
  }

  // ── Lab markers ────────────────────────────────────────────────────────────
  if (input.fastingGlucose !== undefined) {
    const pts = input.fastingGlucose >= 126 ? 15 : input.fastingGlucose >= 100 ? 8 : 0;
    if (pts > 0) contributors.push({ factor: `Glicemia ${input.fastingGlucose} mg/dL`, points: pts, category: 'metabolic' });
    total += pts;
  }

  if (input.totalCholesterol !== undefined) {
    const pts = input.totalCholesterol >= 240 ? 8 : input.totalCholesterol >= 200 ? 4 : 0;
    if (pts > 0) contributors.push({ factor: `Colesterol ${input.totalCholesterol} mg/dL`, points: pts, category: 'metabolic' });
    total += pts;
  }

  if (input.ldl !== undefined) {
    const pts = input.ldl >= 160 ? 8 : input.ldl >= 130 ? 4 : 0;
    if (pts > 0) contributors.push({ factor: `LDL ${input.ldl} mg/dL`, points: pts, category: 'metabolic' });
    total += pts;
  }

  if (input.hdl !== undefined && input.gender) {
    const low = input.gender === 'male' ? 40 : 50;
    const pts = input.hdl < low ? 8 : 0;
    if (pts > 0) contributors.push({ factor: `HDL baixo ${input.hdl} mg/dL`, points: pts, category: 'metabolic' });
    total += pts;
  }

  if (input.triglycerides !== undefined) {
    const pts = input.triglycerides >= 500 ? 12 : input.triglycerides >= 200 ? 8 : input.triglycerides >= 150 ? 4 : 0;
    if (pts > 0) contributors.push({ factor: `TG ${input.triglycerides} mg/dL`, points: pts, category: 'metabolic' });
    total += pts;
  }

  // ── Clinical conditions ────────────────────────────────────────────────────
  const conditionPts: Record<string, number> = {
    'diabetes': 15, 'hipertensão': 10, 'doença renal': 12, 'doença coronariana': 15,
    'obesidade': 8, 'síndrome metabólica': 15, 'dislipidemia': 8,
  };
  for (const cond of input.conditions ?? []) {
    const key = Object.keys(conditionPts).find((k) => cond.toLowerCase().includes(k));
    if (key) {
      contributors.push({ factor: cond, points: conditionPts[key], category: 'biometric' });
      total += conditionPts[key];
    }
  }

  // ── Supplement risk ────────────────────────────────────────────────────────
  const suppPts: Record<string, number> = {
    none: 0, low: 2, moderate: 6, high: 12, contraindicated: 20,
  };
  if (input.supplementRiskLevel && input.supplementRiskLevel !== 'none') {
    const pts = suppPts[input.supplementRiskLevel] ?? 0;
    contributors.push({ factor: `Risco suplementação (${input.supplementRiskLevel})`, points: pts, category: 'supplement' });
    total += pts;
  }

  // ── Clamp and categorize ───────────────────────────────────────────────────
  const score = Math.min(100, Math.max(0, total));

  const level = score < 20 ? 'low' : score < 40 ? 'moderate' : score < 65 ? 'high' : 'very_high';
  const labels = { low: 'Baixo risco', moderate: 'Risco moderado', high: 'Alto risco', very_high: 'Risco muito alto' };
  const colors = { low: 'text-green-700', moderate: 'text-yellow-700', high: 'text-orange-700', very_high: 'text-red-700' };
  const bgColors = {
    low: 'bg-green-50 border-green-200 dark:bg-green-950 dark:border-green-800',
    moderate: 'bg-yellow-50 border-yellow-200 dark:bg-yellow-950 dark:border-yellow-800',
    high: 'bg-orange-50 border-orange-200 dark:bg-orange-950 dark:border-orange-800',
    very_high: 'bg-red-50 border-red-200 dark:bg-red-950 dark:border-red-800',
  };

  // Recommendations
  const recs: string[] = [];
  if (input.activityLevel === 'sedentary') recs.push('Aumentar atividade física — pelo menos 150 min/semana de intensidade moderada');
  if (input.bmi && input.bmi >= 30) recs.push('Redução de peso — cada 5-10% reduz significativamente risco cardiovascular');
  if (input.fastingGlucose && input.fastingGlucose >= 100) recs.push('Monitorar glicemia — considerar avaliação para pré-diabetes');
  if (input.waistCm && input.gender && input.waistCm > (input.gender === 'male' ? 94 : 80)) {
    recs.push('Redução da circunferência abdominal — associada a menor risco metabólico');
  }
  if (input.supplementRiskLevel === 'high' || input.supplementRiskLevel === 'contraindicated') {
    recs.push('Rever protocolo de suplementação — interações de alto risco identificadas');
  }
  if (recs.length === 0) recs.push('Manter hábitos saudáveis e acompanhamento periódico');

  return {
    score,
    level,
    label: labels[level],
    color: colors[level],
    bgColor: bgColors[level],
    contributors: contributors.sort((a, b) => b.points - a.points),
    recommendations: recs,
  };
}

export function getRiskBarColor(score: number): string {
  if (score < 20) return 'bg-green-500';
  if (score < 40) return 'bg-yellow-500';
  if (score < 65) return 'bg-orange-500';
  return 'bg-red-600';
}
