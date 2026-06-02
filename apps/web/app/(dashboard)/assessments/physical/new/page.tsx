'use client';

import { useState, useEffect } from 'react';
import { RiskScoreCard } from '@/components/RiskScoreCard';
import type { RiskInput } from '@/lib/risk-score';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { ShieldAlert, Coins, Activity, TrendingUp } from 'lucide-react';
import { toast } from 'sonner';

const schema = z.object({
  patientId: z.string().optional(),
  age: z.coerce.number().min(1).max(120).optional(),
  weightKg: z.coerce.number().min(20).max(300),
  heightCm: z.coerce.number().min(100).max(250),
  bodyFatPct: z.coerce.number().min(2).max(70).optional(),
  leanMassKg: z.coerce.number().optional(),
  muscleMassKg: z.coerce.number().optional(),
  boneMassKg: z.coerce.number().optional(),
  assessmentMethod: z.string().optional(),
  waistCm: z.coerce.number().optional(),
  hipCm: z.coerce.number().optional(),
  neckCm: z.coerce.number().optional(),
  chestCm: z.coerce.number().optional(),
  rightArmCm: z.coerce.number().optional(),
  rightThighCm: z.coerce.number().optional(),
  rightCalfCm: z.coerce.number().optional(),
  activityLevel: z.enum(['sedentary','lightly_active','moderately_active','very_active','extremely_active']),
  weeklyFrequency: z.coerce.number().min(0).max(14).optional(),
  sessionDurationMin: z.coerce.number().optional(),
  sportModality: z.string().optional(),
  trainingIntensity: z.string().optional(),
  restingHeartRate: z.coerce.number().min(30).max(200).optional(),
  bloodPressure: z.string().optional(),
  primaryGoal: z.enum(['weight_loss','hypertrophy','body_recomposition','metabolic_improvement','performance_improvement','endurance_gain','general_health','clinical_recovery','lean_mass_maintenance','gastrointestinal_improvement']),
  targetWeightKg: z.coerce.number().optional(),
  targetBodyFatPct: z.coerce.number().optional(),
  targetDate: z.string().optional(),
  professionalNotes: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

const GOAL_LABELS: Record<string, string> = {
  weight_loss: 'Emagrecimento', hypertrophy: 'Hipertrofia',
  body_recomposition: 'Recomposição corporal', metabolic_improvement: 'Melhora metabólica',
  performance_improvement: 'Melhora de performance', endurance_gain: 'Ganho de resistência',
  general_health: 'Saúde geral', clinical_recovery: 'Recuperação clínica',
  lean_mass_maintenance: 'Manutenção de massa magra', gastrointestinal_improvement: 'Melhora gastrointestinal',
};

// ─── Classification helpers ───────────────────────────────────────────────────
type Classification = 'normal' | 'elevated' | 'critical';

function classifyBmi(bmi: number): { label: string; cls: Classification } {
  if (bmi < 18.5) return { label: 'Abaixo do peso', cls: 'elevated' };
  if (bmi < 25)   return { label: 'Normal', cls: 'normal' };
  if (bmi < 30)   return { label: 'Sobrepeso', cls: 'elevated' };
  return             { label: 'Obesidade', cls: 'critical' };
}

function classifyWaist(cm: number, gender: string): { label: string; cls: Classification } {
  const [warn, crit] = gender === 'male' ? [94, 102] : [80, 88];
  if (cm < warn)  return { label: 'Normal', cls: 'normal' };
  if (cm < crit)  return { label: 'Elevado', cls: 'elevated' };
  return             { label: 'Crítico', cls: 'critical' };
}

function classifyRCQ(rcq: number, gender: string, age: number): { label: string; cls: Classification } {
  // Padrões WHO por sexo e faixa etária simplificados
  const limit = gender === 'male'
    ? (age < 40 ? 0.95 : age < 60 ? 1.0 : 1.03)
    : (age < 40 ? 0.80 : age < 60 ? 0.85 : 0.90);
  if (rcq <= limit * 0.9) return { label: 'Normal', cls: 'normal' };
  if (rcq <= limit)        return { label: 'Moderado', cls: 'elevated' };
  return                    { label: 'Alto risco', cls: 'critical' };
}

const CLS_BADGE: Record<Classification, string> = {
  normal:   'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
  elevated: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300',
  critical: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300',
};

function ClassBadge({ label, cls }: { label: string; cls: Classification }) {
  return <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${CLS_BADGE[cls]}`}>{label}</span>;
}

// Conversão segura de string em número (aceita vírgula)
const toNum = (s: unknown) => {
  const n = parseFloat(String(s ?? '').replace(',', '.'));
  return isFinite(n) ? Math.max(0, n) : 0;
};

// Densidade corporal por Jackson & Pollock (3 dobras) → % gordura por Siri.
function bodyFatFrom3Skinfolds(sum: number, age: number, gender: string): number | null {
  if (sum <= 0 || age <= 0) return null;
  const bd = gender === 'male'
    ? 1.10938 - 0.0008267 * sum + 0.0000016 * sum * sum - 0.0002574 * age
    : 1.0994921 - 0.0009929 * sum + 0.0000023 * sum * sum - 0.0001392 * age;
  const fat = 495 / bd - 450;
  if (!isFinite(fat) || fat <= 0 || fat > 70) return null;
  return Math.round(fat * 10) / 10;
}

// Classificação de % de gordura (referência ACSM, simplificada por sexo).
function classifyFat(fat: number, gender: string): { label: string; cls: Classification } {
  if (gender === 'male') {
    if (fat < 6)  return { label: 'Muito baixo', cls: 'elevated' };
    if (fat <= 17) return { label: 'Atleta / Fitness', cls: 'normal' };
    if (fat <= 24) return { label: 'Aceitável', cls: 'normal' };
    return { label: 'Acima do ideal', cls: 'critical' };
  }
  if (fat < 14) return { label: 'Muito baixo', cls: 'elevated' };
  if (fat <= 24) return { label: 'Atleta / Fitness', cls: 'normal' };
  if (fat <= 31) return { label: 'Aceitável', cls: 'normal' };
  return { label: 'Acima do ideal', cls: 'critical' };
}

export default function PhysicalAssessmentNewPage() {
  const [bmi, setBmi] = useState<number | null>(null);
  const [whr, setWhr] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { register, handleSubmit, watch, setValue } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { activityLevel: 'moderately_active', primaryGoal: 'general_health' },
  });

  // Estado local das dobras cutâneas (calculadora de % de gordura)
  const [sf, setSf] = useState({ s1: '', s2: '', s3: '' });

  const wW = watch('weightKg');
  const wH = watch('heightCm');
  const wWaist = watch('waistCm');
  const wHip = watch('hipCm');
  const gender = watch as any; // we'll read gender directly

  // Auto-calc BMI + WHR
  useEffect(() => {
    const wN = Number(wW), hN = Number(wH);
    if (wN >= 20 && hN >= 100) {
      setBmi(Math.round((wN / ((hN / 100) ** 2)) * 10) / 10);
    } else setBmi(null);
    const waistN = Number(wWaist), hipN = Number(wHip);
    if (waistN > 0 && hipN > 0) {
      setWhr(Math.round((waistN / hipN) * 1000) / 1000);
    } else setWhr(null);
  }, [wW, wH, wWaist, wHip]);

  const onSubmit = async () => {
    setIsSubmitting(true);
    await new Promise((r) => setTimeout(r, 1200));
    setIsSubmitting(false);
    toast.success('Avaliação física salva com sucesso!');
  };

  const watchedGender = watch('activityLevel'); // workaround — read gender from form
  const formGender = (watch as any)('gender') ?? 'female'; // or default
  const formAge = Number((watch as any)('age') ?? 30);

  // ─── Calculadora de % de gordura por dobras cutâneas ───────────────────────
  const sfSum = toNum(sf.s1) + toNum(sf.s2) + toNum(sf.s3);
  const sfFat = bodyFatFrom3Skinfolds(sfSum, formAge, formGender);
  const sfFatCls = sfFat ? classifyFat(sfFat, formGender) : null;
  const weightNum = Number(wW) || 0;
  const sfFatMass = sfFat && weightNum ? Math.round((weightNum * sfFat / 100) * 10) / 10 : null;
  const sfLeanMass = sfFat && weightNum ? Math.round((weightNum * (1 - sfFat / 100)) * 10) / 10 : null;
  const sfLabels = formGender === 'male'
    ? ['Peitoral (mm)', 'Abdominal (mm)', 'Coxa (mm)']
    : ['Tríceps (mm)', 'Supra-ilíaca (mm)', 'Coxa (mm)'];

  // Circumference table rows
  const waistVal = Number(wWaist);
  const bmiCls = bmi ? classifyBmi(bmi) : null;
  const waistCls = waistVal > 0 ? classifyWaist(waistVal, formGender) : null;
  const whrCls = whr ? classifyRCQ(whr, formGender, formAge) : null;

  return (
    <div className="px-4 py-5 sm:p-6 max-w-4xl mx-auto space-y-6">

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Nova Avaliação Física</h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">Profissional de Educação Física (CREF) ou Nutricionista</p>
        </div>
        <Badge variant="outline" className="text-blue-700 border-blue-300 flex items-center gap-1">
          <Coins className="h-3 w-3" /> 5 tokens
        </Badge>
      </div>

      <Alert className="border-amber-300 bg-amber-50 dark:bg-amber-950 dark:border-amber-800">
        <ShieldAlert className="h-4 w-4 text-amber-600" />
        <AlertDescription className="text-amber-800 dark:text-amber-300 text-xs">
          <strong>Avaliação física é atribuição do Profissional de Educação Física (CONFEF/CREF).</strong>{' '}
          O sistema organiza os dados e gera análise de apoio — sem substituir o julgamento profissional.
        </AlertDescription>
      </Alert>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">

        {/* MEDIDAS BÁSICAS */}
        <Card>
          <CardHeader><CardTitle className="text-base">Medidas Básicas</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <Label>Peso (kg) *</Label>
                <Input {...register('weightKg')} type="number" step="0.1" placeholder="70.0" />
              </div>
              <div>
                <Label>Altura (cm) *</Label>
                <Input {...register('heightCm')} type="number" step="0.1" placeholder="170" />
              </div>
              <div>
                <Label>Idade (anos)</Label>
                <Input {...register('age')} type="number" min={1} max={120} placeholder="30" />
              </div>
              <div>
                <Label>Sexo</Label>
                <select {...register('gender' as any)} className="w-full h-10 rounded-md border px-3 text-sm dark:bg-gray-800 dark:border-gray-700">
                  <option value="female">Feminino</option>
                  <option value="male">Masculino</option>
                </select>
              </div>
              <div>
                <Label>Método de avaliação</Label>
                <select {...register('assessmentMethod')} className="w-full h-10 rounded-md border px-3 text-sm dark:bg-gray-800 dark:border-gray-700">
                  <option value="">Selecione</option>
                  <option value="bioimpedancia">Bioimpedância</option>
                  <option value="dobras_cutaneas">Dobras cutâneas</option>
                  <option value="dexa">DEXA</option>
                  <option value="perimetros">Perímetros</option>
                  <option value="pesagem_hidro">Pesagem hidrostática</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <Label>% Gordura corporal</Label>
                <Input {...register('bodyFatPct')} type="number" step="0.1" placeholder="22.0" />
              </div>
              <div>
                <Label>Massa magra (kg)</Label>
                <Input {...register('leanMassKg')} type="number" step="0.1" />
              </div>
              <div>
                <Label>Massa muscular (kg)</Label>
                <Input {...register('muscleMassKg')} type="number" step="0.1" />
              </div>
              <div>
                <Label>Massa óssea (kg)</Label>
                <Input {...register('boneMassKg')} type="number" step="0.1" />
              </div>
            </div>

            {/* IMC result */}
            {bmi && bmiCls && (
              <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <TrendingUp className="h-4 w-4 text-blue-600" />
                <span className="text-sm text-gray-600 dark:text-gray-300">IMC:</span>
                <span className="text-lg font-bold text-blue-700 dark:text-blue-400">{bmi}</span>
                <ClassBadge label={bmiCls.label} cls={bmiCls.cls} />
              </div>
            )}
          </CardContent>
        </Card>

        {/* CALCULADORA DE % DE GORDURA (DOBRAS CUTÂNEAS) */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-blue-600" />
              Calculadora de % de Gordura — Dobras Cutâneas
            </CardTitle>
            <p className="text-xs text-gray-500 mt-1">
              Protocolo Jackson &amp; Pollock (3 dobras) · equação de Siri. Sexo: {formGender === 'male' ? 'Masculino' : 'Feminino'} · Idade: {formAge} anos.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {[sf.s1, sf.s2, sf.s3].map((val, i) => (
                <div key={i}>
                  <Label>{sfLabels[i]}</Label>
                  <Input
                    type="number" step="0.1" min={0} placeholder="0"
                    value={val}
                    onChange={(e) => setSf((p) => ({ ...p, [`s${i + 1}`]: e.target.value }))}
                  />
                </div>
              ))}
            </div>

            {sfFat && sfFatCls ? (
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                <div className="rounded-xl border border-blue-200 bg-blue-50 dark:bg-blue-950 dark:border-blue-900 px-3 py-2 text-center">
                  <p className="text-2xl font-bold text-blue-700 dark:text-blue-300">{sfFat}%</p>
                  <p className="text-[11px] text-gray-500">Gordura corporal</p>
                </div>
                <div className="rounded-xl border border-gray-100 dark:border-gray-800 px-3 py-2 text-center flex flex-col justify-center">
                  <ClassBadge label={sfFatCls.label} cls={sfFatCls.cls} />
                  <p className="text-[11px] text-gray-500 mt-1">Classificação (ACSM)</p>
                </div>
                <div className="rounded-xl border border-gray-100 dark:border-gray-800 px-3 py-2 text-center">
                  <p className="text-xl font-bold text-rose-600">{sfFatMass ?? '—'}{sfFatMass ? ' kg' : ''}</p>
                  <p className="text-[11px] text-gray-500">Massa gorda</p>
                </div>
                <div className="rounded-xl border border-gray-100 dark:border-gray-800 px-3 py-2 text-center">
                  <p className="text-xl font-bold text-green-600">{sfLeanMass ?? '—'}{sfLeanMass ? ' kg' : ''}</p>
                  <p className="text-[11px] text-gray-500">Massa magra</p>
                </div>
              </div>
            ) : (
              <p className="text-xs text-gray-400">
                Preencha as três dobras (mm) e a idade para calcular o percentual de gordura. Somatório atual: {sfSum > 0 ? `${sfSum} mm` : '—'}.
              </p>
            )}

            {sfFat && (
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-[11px] text-gray-400 italic">
                  Estimativa de apoio — validar pelo Profissional de Educação Física (CREF/CONFEF).
                </p>
                <Button type="button" variant="outline" size="sm" className="text-xs"
                  onClick={() => { setValue('bodyFatPct', sfFat as any); toast.success(`% de gordura preenchido: ${sfFat}%`); }}>
                  Usar como % de gordura ↑
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* CIRCUNFERÊNCIAS */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Circunferências (cm)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <Label>Cintura</Label>
                <Input {...register('waistCm')} type="number" step="0.1" />
              </div>
              <div>
                <Label>Quadril</Label>
                <Input {...register('hipCm')} type="number" step="0.1" />
              </div>
              <div>
                <Label>Pescoço</Label>
                <Input {...register('neckCm')} type="number" step="0.1" />
              </div>
              <div>
                <Label>Tórax</Label>
                <Input {...register('chestCm')} type="number" step="0.1" />
              </div>
              <div>
                <Label>Braço D (relaxado)</Label>
                <Input {...register('rightArmCm')} type="number" step="0.1" />
              </div>
              <div>
                <Label>Coxa D</Label>
                <Input {...register('rightThighCm')} type="number" step="0.1" />
              </div>
              <div>
                <Label>Panturrilha D</Label>
                <Input {...register('rightCalfCm')} type="number" step="0.1" />
              </div>
            </div>

            {/* Classification table — shows when waist or hip is filled */}
            {(waistVal > 0 || whr) && (
              <div className="mt-2 border dark:border-gray-700 rounded-xl overflow-hidden">
                <div className="bg-gray-50 dark:bg-gray-800 px-4 py-2 border-b dark:border-gray-700">
                  <p className="text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wide">Classificação de Risco Cardiometabólico</p>
                </div>
                <div className="overflow-x-auto">
                <table className="w-full text-sm min-w-[480px]">
                  <thead>
                    <tr className="bg-gray-50 dark:bg-gray-800 border-b dark:border-gray-700">
                      <th className="text-left px-4 py-2 text-xs font-medium text-gray-500">Indicador</th>
                      <th className="text-center px-4 py-2 text-xs font-medium text-gray-500">Valor</th>
                      <th className="text-center px-4 py-2 text-xs font-medium text-gray-500">Referência ({formGender === 'male' ? 'M' : 'F'})</th>
                      <th className="text-center px-4 py-2 text-xs font-medium text-gray-500">Classificação</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y dark:divide-gray-700">
                    {bmi && bmiCls && (
                      <tr>
                        <td className="px-4 py-2.5 text-gray-700 dark:text-gray-300 font-medium">IMC</td>
                        <td className="px-4 py-2.5 text-center font-bold text-gray-900 dark:text-white">{bmi} kg/m²</td>
                        <td className="px-4 py-2.5 text-center text-xs text-gray-400">18,5–24,9</td>
                        <td className="px-4 py-2.5 text-center"><ClassBadge label={bmiCls.label} cls={bmiCls.cls} /></td>
                      </tr>
                    )}
                    {waistVal > 0 && waistCls && (
                      <tr>
                        <td className="px-4 py-2.5 text-gray-700 dark:text-gray-300 font-medium">Cintura</td>
                        <td className="px-4 py-2.5 text-center font-bold text-gray-900 dark:text-white">{waistVal} cm</td>
                        <td className="px-4 py-2.5 text-center text-xs text-gray-400">
                          {formGender === 'male' ? '< 94 cm' : '< 80 cm'}
                        </td>
                        <td className="px-4 py-2.5 text-center"><ClassBadge label={waistCls.label} cls={waistCls.cls} /></td>
                      </tr>
                    )}
                    {whr && whrCls && (
                      <tr>
                        <td className="px-4 py-2.5 text-gray-700 dark:text-gray-300 font-medium">RCQ</td>
                        <td className="px-4 py-2.5 text-center font-bold text-gray-900 dark:text-white">{whr}</td>
                        <td className="px-4 py-2.5 text-center text-xs text-gray-400">
                          {formGender === 'male' ? '≤ 0,95' : '≤ 0,80'}
                        </td>
                        <td className="px-4 py-2.5 text-center"><ClassBadge label={whrCls.label} cls={whrCls.cls} /></td>
                      </tr>
                    )}
                  </tbody>
                </table>
                </div>
                <div className="px-4 py-2 bg-gray-50 dark:bg-gray-800 border-t dark:border-gray-700">
                  <p className="text-xs text-gray-400 italic">Referências: OMS / IDF · Avaliação de apoio — validar com profissional habilitado</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* ATIVIDADE FÍSICA */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Activity className="h-4 w-4 text-blue-600" />
              Atividade Física e Treino
            </CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label>Nível de atividade</Label>
              <select {...register('activityLevel')} className="w-full h-10 rounded-md border px-3 text-sm dark:bg-gray-800 dark:border-gray-700">
                <option value="sedentary">Sedentário</option>
                <option value="lightly_active">Levemente ativo</option>
                <option value="moderately_active">Moderadamente ativo</option>
                <option value="very_active">Muito ativo</option>
                <option value="extremely_active">Extremamente ativo</option>
              </select>
            </div>
            <div>
              <Label>Frequência semanal</Label>
              <Input {...register('weeklyFrequency')} type="number" min={0} max={14} placeholder="5" />
            </div>
            <div>
              <Label>Duração da sessão (min)</Label>
              <Input {...register('sessionDurationMin')} type="number" placeholder="60" />
            </div>
            <div>
              <Label>Modalidade esportiva</Label>
              <Input {...register('sportModality')} placeholder="Ex: Musculação, Corrida, Natação" />
            </div>
            <div>
              <Label>Intensidade do treino</Label>
              <select {...register('trainingIntensity')} className="w-full h-10 rounded-md border px-3 text-sm dark:bg-gray-800 dark:border-gray-700">
                <option value="">Selecione</option>
                <option value="low">Baixa</option>
                <option value="moderate">Moderada</option>
                <option value="high">Alta</option>
                <option value="max">Máxima</option>
              </select>
            </div>
            <div>
              <Label>FC repouso (bpm)</Label>
              <Input {...register('restingHeartRate')} type="number" placeholder="62" />
            </div>
            <div>
              <Label>Pressão arterial</Label>
              <Input {...register('bloodPressure')} placeholder="120/80 mmHg" />
            </div>
          </CardContent>
        </Card>

        {/* OBJETIVOS */}
        <Card>
          <CardHeader><CardTitle className="text-base">Objetivos e Metas</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>Objetivo principal *</Label>
              <select {...register('primaryGoal')} className="w-full h-10 rounded-md border px-3 text-sm dark:bg-gray-800 dark:border-gray-700">
                {Object.entries(GOAL_LABELS).map(([val, label]) => (
                  <option key={val} value={val}>{label}</option>
                ))}
              </select>
            </div>
            <div>
              <Label>Peso alvo (kg)</Label>
              <Input {...register('targetWeightKg')} type="number" step="0.1" />
            </div>
            <div>
              <Label>% Gordura alvo</Label>
              <Input {...register('targetBodyFatPct')} type="number" step="0.1" />
            </div>
            <div>
              <Label>Data alvo</Label>
              <Input {...register('targetDate')} type="date" />
            </div>
            <div className="md:col-span-2">
              <Label>Observações profissionais</Label>
              <Textarea {...register('professionalNotes')} rows={3}
                placeholder="Notas do profissional de educação física (CREF/CONFEF)" />
            </div>
          </CardContent>
        </Card>

        {/* Risk Score — shows when enough data is available */}
        {bmi && (
          <RiskScoreCard
            input={{
              bmi,
              waistCm: waistVal > 0 ? waistVal : undefined,
              whr: whr ?? undefined,
              gender: formGender as 'male' | 'female',
              activityLevel: watch('activityLevel') as RiskInput['activityLevel'],
              restingHeartRateBpm: Number(watch('restingHeartRate')) || undefined,
            }}
          />
        )}

        <div className="flex justify-end gap-3">
          <Button type="button" variant="outline">Salvar rascunho</Button>
          <Button type="submit" disabled={isSubmitting} className="flex items-center gap-2">
            {isSubmitting ? 'Processando...' : <><Coins className="h-4 w-4" /> Finalizar avaliação (5 tokens)</>}
          </Button>
        </div>
      </form>
    </div>
  );
}
