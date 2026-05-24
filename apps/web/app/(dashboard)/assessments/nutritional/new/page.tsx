'use client';

import { useState, useEffect } from 'react';
import { useStreamingText } from '@/hooks/useStreamingText';
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
import { ShieldAlert, Coins, Calculator, Brain, TrendingUp, Activity } from 'lucide-react';
import { toast } from 'sonner';

const schema = z.object({
  patientId: z.string().optional(),
  mainComplaint: z.string().optional(),
  dietaryRestrictions: z.string().optional(),
  mealFrequency: z.coerce.number().min(1).max(10).optional(),
  waterIntakeMl: z.coerce.number().min(0).optional(),
  alcoholConsumption: z.string().optional(),
  bowelHabits: z.string().optional(),
  weight: z.coerce.number().min(20).max(300, 'Peso inválido'),
  heightCm: z.coerce.number().min(100).max(250, 'Altura inválida'),
  age: z.coerce.number().min(1).max(120),
  gender: z.enum(['male', 'female']),
  activityLevel: z.enum(['sedentary','lightly_active','moderately_active','very_active','extremely_active']),
  bmrFormula: z.enum(['mifflin', 'harris_benedict', 'who']).default('mifflin'),
  caloricTarget: z.coerce.number().min(500).max(10000).optional(),
  proteinTargetG: z.coerce.number().min(0).optional(),
  carbTargetG: z.coerce.number().min(0).optional(),
  fatTargetG: z.coerce.number().min(0).optional(),
  nutritionalDiagnosis: z.string().optional(),
  dietaryStrategy: z.string().optional(),
  professionalNotes: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

const PAL_FACTORS: Record<string, number> = {
  sedentary: 1.2,
  lightly_active: 1.375,
  moderately_active: 1.55,
  very_active: 1.725,
  extremely_active: 1.9,
};

function calcMifflin(w: number, h: number, a: number, g: string) {
  const base = 10 * w + 6.25 * h - 5 * a;
  return g === 'male' ? base + 5 : base - 161;
}
function calcHarrisBenedict(w: number, h: number, a: number, g: string) {
  return g === 'male'
    ? 88.36 + 13.4 * w + 4.8 * h - 5.7 * a
    : 447.6 + 9.2 * w + 3.1 * h - 4.3 * a;
}
function bmiClass(bmi: number) {
  if (bmi < 18.5) return { label: 'Abaixo do peso', color: 'text-blue-600' };
  if (bmi < 25)   return { label: 'Peso normal', color: 'text-green-600' };
  if (bmi < 30)   return { label: 'Sobrepeso', color: 'text-yellow-600' };
  if (bmi < 35)   return { label: 'Obesidade I', color: 'text-orange-600' };
  return             { label: 'Obesidade II+', color: 'text-red-600' };
}

export default function NutritionalAssessmentNewPage() {
  const [liveCalc, setLiveCalc] = useState<{ bmi: number; bmr: number; tee: number; protein: number } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { text: streamedAnalysis, isStreaming, simulateStream } = useStreamingText();

  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { bmrFormula: 'mifflin', gender: 'female', activityLevel: 'moderately_active' },
  });

  const w = watch('weight');
  const h = watch('heightCm');
  const a = watch('age');
  const g = watch('gender');
  const formula = watch('bmrFormula');
  const activity = watch('activityLevel');

  // ─── Real-time calculation ────────────────────────────────────────────────
  useEffect(() => {
    const wN = Number(w), hN = Number(h), aN = Number(a);
    if (!wN || !hN || !aN || wN < 20 || hN < 100 || aN < 1) {
      setLiveCalc(null);
      return;
    }
    const bmr = formula === 'mifflin' ? calcMifflin(wN, hN, aN, g) : calcHarrisBenedict(wN, hN, aN, g);
    const pal = PAL_FACTORS[activity] ?? 1.55;
    const tee = Math.round(bmr * pal);
    const bmiVal = Math.round((wN / ((hN / 100) ** 2)) * 10) / 10;
    const protein = Math.round(wN * 1.8);
    setLiveCalc({ bmi: bmiVal, bmr: Math.round(bmr), tee, protein });
    setValue('caloricTarget', tee);
  }, [w, h, a, g, formula, activity]);

  const onSubmit = async (data: FormData) => {
    setIsSubmitting(true);
    try {
      await new Promise((r) => setTimeout(r, 400));
      const aiText =
        `Síntese nutricional de apoio (IA):\n\n` +
        `GET estimado: ${liveCalc?.tee ?? '—'} kcal/dia · TMB: ${liveCalc?.bmr ?? '—'} kcal/dia · IMC: ${liveCalc?.bmi ?? '—'}\n\n` +
        `Proteína estimada: ${liveCalc?.protein ?? '—'} g/dia (referência 1,8 g/kg).\n\n` +
        `Avaliação da anamnese: verifique ingestão hídrica declarada e frequência de refeições para adequação ao protocolo.\n\n` +
        `Recomendações gerais: considere solicitar exames laboratoriais recentes (hemograma, ferritina, vitamina D, B12) para complementar a avaliação nutricional.\n\n` +
        `Nível de confiança: moderado. Qualidade da evidência: equações populacionais validadas (Mifflin-St Jeor).\n\n` +
        `⚠️ Esta síntese é ferramenta de apoio. Diagnóstico nutricional e prescrição dietética são responsabilidade exclusiva do Nutricionista habilitado (CFN 599/2018).`;
      simulateStream(aiText, 15);
      toast.success('Avaliação salva com sucesso!');
    } finally {
      setIsSubmitting(false);
    }
  };

  const bmi = liveCalc?.bmi;
  const bmiInfo = bmi ? bmiClass(bmi) : null;

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">

      {/* ─── Header ───────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Nova Avaliação Nutricional</h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">Exclusivo para Nutricionistas (CRN)</p>
        </div>
        <Badge variant="outline" className="text-blue-700 border-blue-300 flex items-center gap-1">
          <Coins className="h-3 w-3" /> 10 tokens
        </Badge>
      </div>

      {/* ─── Real-time sticky panel ───────────────────────────────── */}
      {liveCalc && (
        <div className="sticky top-0 z-20 -mx-6 px-6 py-3 bg-blue-600 shadow-lg">
          <div className="flex items-center gap-6 flex-wrap">
            <div className="flex items-center gap-1.5">
              <TrendingUp className="h-4 w-4 text-blue-200" />
              <span className="text-blue-200 text-xs">IMC</span>
              <span className="text-white font-bold text-lg leading-none">{liveCalc.bmi}</span>
              {bmiInfo && <span className={`text-xs font-medium text-blue-100`}>{bmiInfo.label}</span>}
            </div>
            <div className="w-px h-8 bg-blue-500" />
            <div className="flex items-center gap-1.5">
              <Calculator className="h-4 w-4 text-blue-200" />
              <span className="text-blue-200 text-xs">TMB</span>
              <span className="text-white font-bold text-lg leading-none">{liveCalc.bmr}</span>
              <span className="text-blue-300 text-xs">kcal</span>
            </div>
            <div className="w-px h-8 bg-blue-500" />
            <div className="flex items-center gap-1.5">
              <Activity className="h-4 w-4 text-blue-200" />
              <span className="text-blue-200 text-xs">GET</span>
              <span className="text-white font-bold text-xl leading-none">{liveCalc.tee}</span>
              <span className="text-blue-300 text-xs">kcal/dia</span>
            </div>
            <div className="w-px h-8 bg-blue-500" />
            <div className="flex items-center gap-1.5">
              <span className="text-blue-200 text-xs">Proteína</span>
              <span className="text-white font-bold text-lg leading-none">{liveCalc.protein}g</span>
              <span className="text-blue-300 text-xs">/dia (1,8 g/kg)</span>
            </div>
            <span className="ml-auto text-blue-300 text-xs italic hidden sm:block">Atualização em tempo real</span>
          </div>
        </div>
      )}

      <Alert className="border-amber-300 bg-amber-50 dark:bg-amber-950 dark:border-amber-800">
        <ShieldAlert className="h-4 w-4 text-amber-600" />
        <AlertDescription className="text-amber-800 dark:text-amber-300 text-xs">
          <strong>Diagnóstico nutricional e prescrição dietética são atribuições exclusivas do Nutricionista habilitado.</strong>{' '}
          Conforme Resolução CFN 599/2018 e CFN 600/2018.
        </AlertDescription>
      </Alert>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">

        {/* ANAMNESE */}
        <Card>
          <CardHeader><CardTitle className="text-base">Anamnese Alimentar</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <Label>Queixa principal</Label>
              <Textarea {...register('mainComplaint')} placeholder="Descreva a queixa ou objetivo do paciente" rows={2} />
            </div>
            <div>
              <Label>Restrições alimentares</Label>
              <Input {...register('dietaryRestrictions')} placeholder="Ex: vegetariano, sem glúten, alergia à nozes" />
            </div>
            <div>
              <Label>Frequência de refeições/dia</Label>
              <Input {...register('mealFrequency')} type="number" min={1} max={10} placeholder="Ex: 5" />
            </div>
            <div>
              <Label>Ingestão hídrica (mL/dia)</Label>
              <Input {...register('waterIntakeMl')} type="number" placeholder="Ex: 2000" />
            </div>
            <div>
              <Label>Hábitos intestinais</Label>
              <Input {...register('bowelHabits')} placeholder="Ex: regular, obstipado, diarreia ocasional" />
            </div>
            <div className="md:col-span-2">
              <Label>Consumo de álcool</Label>
              <Input {...register('alcoholConsumption')} placeholder="Ex: não consome / socialmente (1x/semana)" />
            </div>
          </CardContent>
        </Card>

        {/* CÁLCULO ENERGÉTICO */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Calculator className="h-4 w-4 text-blue-600" />
              Cálculo Energético
              <span className="ml-2 text-xs font-normal text-gray-400">— painel acima atualiza automaticamente</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <Label>Peso (kg) *</Label>
                <Input {...register('weight')} type="number" step="0.1" placeholder="65.5" />
                {errors.weight && <p className="text-xs text-red-500 mt-1">{errors.weight.message}</p>}
              </div>
              <div>
                <Label>Altura (cm) *</Label>
                <Input {...register('heightCm')} type="number" step="0.1" placeholder="165" />
                {errors.heightCm && <p className="text-xs text-red-500 mt-1">{errors.heightCm.message}</p>}
              </div>
              <div>
                <Label>Idade *</Label>
                <Input {...register('age')} type="number" placeholder="30" />
              </div>
              <div>
                <Label>Sexo *</Label>
                <select {...register('gender')} className="w-full h-10 rounded-md border px-3 text-sm dark:bg-gray-800 dark:border-gray-700">
                  <option value="female">Feminino</option>
                  <option value="male">Masculino</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>Nível de atividade física</Label>
                <select {...register('activityLevel')} className="w-full h-10 rounded-md border px-3 text-sm dark:bg-gray-800 dark:border-gray-700">
                  <option value="sedentary">Sedentário (PAL 1,2)</option>
                  <option value="lightly_active">Levemente ativo (PAL 1,375)</option>
                  <option value="moderately_active">Moderadamente ativo (PAL 1,55)</option>
                  <option value="very_active">Muito ativo (PAL 1,725)</option>
                  <option value="extremely_active">Extremamente ativo (PAL 1,9)</option>
                </select>
              </div>
              <div>
                <Label>Fórmula de TMB</Label>
                <select {...register('bmrFormula')} className="w-full h-10 rounded-md border px-3 text-sm dark:bg-gray-800 dark:border-gray-700">
                  <option value="mifflin">Mifflin-St Jeor (recomendada)</option>
                  <option value="harris_benedict">Harris-Benedict revisada</option>
                </select>
              </div>
            </div>

            {/* Live result card */}
            {liveCalc ? (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 p-4 bg-blue-50 dark:bg-blue-950 rounded-xl border border-blue-100 dark:border-blue-800">
                <div className="text-center">
                  <p className="text-xs text-gray-500 dark:text-gray-400">IMC</p>
                  <p className={`text-2xl font-bold ${bmiInfo?.color ?? 'text-blue-700'}`}>{liveCalc.bmi}</p>
                  <p className="text-xs text-gray-400">{bmiInfo?.label}</p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-gray-500 dark:text-gray-400">TMB</p>
                  <p className="text-2xl font-bold text-blue-700 dark:text-blue-400">{liveCalc.bmr}</p>
                  <p className="text-xs text-gray-400">kcal/dia</p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-gray-500 dark:text-gray-400">GET</p>
                  <p className="text-2xl font-bold text-blue-700 dark:text-blue-400">{liveCalc.tee}</p>
                  <p className="text-xs text-gray-400">kcal/dia</p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-gray-500 dark:text-gray-400">Proteína</p>
                  <p className="text-2xl font-bold text-green-700 dark:text-green-400">{liveCalc.protein}g</p>
                  <p className="text-xs text-gray-400">1,8 g/kg/dia</p>
                </div>
              </div>
            ) : (
              <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-xl border border-dashed border-gray-200 dark:border-gray-700 text-center text-sm text-gray-400">
                Preencha peso, altura, idade e sexo para calcular automaticamente
              </div>
            )}

            <p className="text-xs text-gray-400 italic">
              * Valores são estimativas populacionais. Ajuste conforme avaliação individual e resposta clínica.
            </p>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-2 border-t dark:border-gray-700">
              <div>
                <Label>Meta calórica (kcal)</Label>
                <Input {...register('caloricTarget')} type="number" />
              </div>
              <div>
                <Label>Proteína alvo (g)</Label>
                <Input {...register('proteinTargetG')} type="number" step="0.1" />
              </div>
              <div>
                <Label>Carboidrato alvo (g)</Label>
                <Input {...register('carbTargetG')} type="number" step="0.1" />
              </div>
              <div>
                <Label>Gordura alvo (g)</Label>
                <Input {...register('fatTargetG')} type="number" step="0.1" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* DIAGNÓSTICO E ESTRATÉGIA */}
        <Card className="border-green-200 dark:border-green-800">
          <CardHeader>
            <CardTitle className="text-base text-green-800 dark:text-green-300">
              Diagnóstico e Estratégia Nutricional
              <span className="ml-2 text-xs font-normal text-green-600">(Exclusivo do Nutricionista)</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Diagnóstico nutricional</Label>
              <Textarea {...register('nutritionalDiagnosis')}
                placeholder="Diagnóstico nutricional — responsabilidade exclusiva do nutricionista" rows={3} />
            </div>
            <div>
              <Label>Estratégia alimentar proposta</Label>
              <Textarea {...register('dietaryStrategy')} placeholder="Descreva a estratégia alimentar planejada" rows={3} />
            </div>
            <div>
              <Label>Observações profissionais</Label>
              <Textarea {...register('professionalNotes')} rows={2} />
            </div>
          </CardContent>
        </Card>

        {(streamedAnalysis || isStreaming) && (
          <Card className="border-blue-200 bg-blue-50 dark:bg-blue-950 dark:border-blue-800">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2 text-blue-800 dark:text-blue-300">
                <Brain className="h-4 w-4" />
                Síntese de Apoio (IA)
                {isStreaming && (
                  <span className="flex items-center gap-1 text-xs font-normal text-blue-500">
                    <span className="inline-block w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
                    gerando...
                  </span>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <pre className="text-xs text-blue-900 dark:text-blue-200 whitespace-pre-wrap leading-relaxed">
                {streamedAnalysis}
                {isStreaming && <span className="inline-block w-0.5 h-3.5 bg-blue-600 animate-pulse ml-0.5 align-text-bottom" />}
              </pre>
              {!isStreaming && (
                <p className="text-xs text-gray-400 italic mt-3 border-t pt-2">
                  Nível de confiança: Moderado · Requer validação profissional
                </p>
              )}
            </CardContent>
          </Card>
        )}

        <div className="flex justify-end gap-3">
          <Button type="button" variant="outline">Salvar rascunho</Button>
          <Button type="submit" disabled={isSubmitting} className="flex items-center gap-2">
            {isSubmitting ? 'Processando...' : <><Coins className="h-4 w-4" /> Finalizar avaliação (10 tokens)</>}
          </Button>
        </div>
      </form>
    </div>
  );
}
