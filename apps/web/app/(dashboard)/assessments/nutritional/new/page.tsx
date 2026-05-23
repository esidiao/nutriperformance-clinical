'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { ShieldAlert, Coins, Calculator, Brain } from 'lucide-react';

// Schema de validação
const schema = z.object({
  patientId: z.string().uuid('Selecione um paciente'),
  // Anamnese
  mainComplaint: z.string().optional(),
  dietaryRestrictions: z.string().optional(),
  mealFrequency: z.coerce.number().min(1).max(10).optional(),
  waterIntakeMl: z.coerce.number().min(0).optional(),
  alcoholConsumption: z.string().optional(),
  bowelHabits: z.string().optional(),
  // Cálculo energético
  weight: z.coerce.number().min(20).max(300, 'Peso inválido'),
  heightCm: z.coerce.number().min(100).max(250, 'Altura inválida'),
  age: z.coerce.number().min(1).max(120),
  gender: z.enum(['male', 'female']),
  activityLevel: z.enum(['sedentary','lightly_active','moderately_active','very_active','extremely_active']),
  bmrFormula: z.enum(['mifflin', 'harris_benedict', 'who']).default('mifflin'),
  // Metas
  caloricTarget: z.coerce.number().min(500).max(10000).optional(),
  proteinTargetG: z.coerce.number().min(0).optional(),
  carbTargetG: z.coerce.number().min(0).optional(),
  fatTargetG: z.coerce.number().min(0).optional(),
  // Diagnóstico e estratégia (exclusivo do profissional)
  nutritionalDiagnosis: z.string().optional(),
  dietaryStrategy: z.string().optional(),
  professionalNotes: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

const PAL_FACTORS = {
  sedentary: 1.2,
  lightly_active: 1.375,
  moderately_active: 1.55,
  very_active: 1.725,
  extremely_active: 1.9,
};

function calcMifflin(weight: number, height: number, age: number, gender: string): number {
  const base = 10 * weight + 6.25 * height - 5 * age;
  return gender === 'male' ? base + 5 : base - 161;
}

function calcHarrisBenedict(weight: number, height: number, age: number, gender: string): number {
  return gender === 'male'
    ? 88.36 + 13.4 * weight + 4.8 * height - 5.7 * age
    : 447.6 + 9.2 * weight + 3.1 * height - 4.3 * age;
}

export default function NutritionalAssessmentNewPage() {
  const [bmr, setBmr] = useState<number | null>(null);
  const [tee, setTee] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [aiAnalysis, setAiAnalysis] = useState<string | null>(null);

  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { bmrFormula: 'mifflin', gender: 'female', activityLevel: 'moderately_active' },
  });

  const watchedWeight = watch('weight');
  const watchedHeight = watch('heightCm');
  const watchedAge = watch('age');
  const watchedGender = watch('gender');
  const watchedFormula = watch('bmrFormula');
  const watchedActivity = watch('activityLevel');

  const calculateEnergy = () => {
    if (!watchedWeight || !watchedHeight || !watchedAge) return;
    const w = Number(watchedWeight), h = Number(watchedHeight), a = Number(watchedAge);
    const g = watchedGender;
    const calculatedBmr = watchedFormula === 'mifflin'
      ? calcMifflin(w, h, a, g)
      : calcHarrisBenedict(w, h, a, g);
    const pal = PAL_FACTORS[watchedActivity] ?? 1.55;
    const calculatedTee = Math.round(calculatedBmr * pal);
    setBmr(Math.round(calculatedBmr));
    setTee(calculatedTee);
    setValue('caloricTarget', calculatedTee);
  };

  const onSubmit = async (data: FormData) => {
    setIsSubmitting(true);
    try {
      // Em produção: POST /assessments/nutritional com consumo de 10 tokens
      await new Promise((r) => setTimeout(r, 1500));
      setAiAnalysis(
        'Resumo gerado pela IA: Paciente apresenta GET estimado de ' +
        tee + ' kcal/dia. Avalie ingestão hídrica e frequência alimentar declarada. ' +
        'Dados insuficientes para análise completa — considere solicitar exames laboratoriais recentes. ' +
        '\n\n⚠️ Esta síntese é ferramenta de apoio. Diagnóstico nutricional é responsabilidade exclusiva do nutricionista.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Nova Avaliação Nutricional</h1>
          <p className="text-gray-500 text-sm mt-1">Exclusivo para Nutricionistas (CRN)</p>
        </div>
        <Badge variant="outline" className="text-blue-700 border-blue-300 flex items-center gap-1">
          <Coins className="h-3 w-3" />
          10 tokens
        </Badge>
      </div>

      <Alert className="border-amber-300 bg-amber-50">
        <ShieldAlert className="h-4 w-4 text-amber-600" />
        <AlertDescription className="text-amber-800 text-xs">
          <strong>Diagnóstico nutricional e prescrição dietética são atribuições exclusivas do Nutricionista habilitado.</strong>{' '}
          O sistema auxilia na organização e cálculo, mas o julgamento clínico é responsabilidade do profissional.
          Conforme Resolução CFN 599/2018 e CFN 600/2018.
        </AlertDescription>
      </Alert>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">

        {/* ANAMNESE */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Anamnese Alimentar</CardTitle>
          </CardHeader>
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
                <select {...register('gender')} className="w-full h-10 rounded-md border px-3 text-sm">
                  <option value="female">Feminino</option>
                  <option value="male">Masculino</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>Nível de atividade física</Label>
                <select {...register('activityLevel')} className="w-full h-10 rounded-md border px-3 text-sm">
                  <option value="sedentary">Sedentário (PAL 1,2)</option>
                  <option value="lightly_active">Levemente ativo (PAL 1,375)</option>
                  <option value="moderately_active">Moderadamente ativo (PAL 1,55)</option>
                  <option value="very_active">Muito ativo (PAL 1,725)</option>
                  <option value="extremely_active">Extremamente ativo (PAL 1,9)</option>
                </select>
              </div>
              <div>
                <Label>Fórmula de TMB</Label>
                <select {...register('bmrFormula')} className="w-full h-10 rounded-md border px-3 text-sm">
                  <option value="mifflin">Mifflin-St Jeor (recomendada)</option>
                  <option value="harris_benedict">Harris-Benedict revisada</option>
                </select>
              </div>
            </div>

            <Button type="button" variant="outline" onClick={calculateEnergy} className="flex items-center gap-2">
              <Calculator className="h-4 w-4" />
              Calcular GET
            </Button>

            {bmr && tee && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 p-4 bg-blue-50 rounded-lg">
                <div className="text-center">
                  <p className="text-xs text-gray-500">TMB</p>
                  <p className="text-xl font-bold text-blue-700">{bmr}</p>
                  <p className="text-xs text-gray-400">kcal/dia</p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-gray-500">GET</p>
                  <p className="text-xl font-bold text-blue-700">{tee}</p>
                  <p className="text-xs text-gray-400">kcal/dia</p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-gray-500">Proteína sugerida</p>
                  <p className="text-xl font-bold text-green-700">{Math.round((watch('weight') ?? 65) * 1.8)}</p>
                  <p className="text-xs text-gray-400">g/dia (1,8 g/kg)</p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-gray-500">Fator atividade</p>
                  <p className="text-xl font-bold text-gray-700">{PAL_FACTORS[watchedActivity]}</p>
                  <p className="text-xs text-gray-400">PAL</p>
                </div>
              </div>
            )}

            <p className="text-xs text-gray-400 italic">
              * Valores calculados são estimativas baseadas em equações populacionais.
              O nutricionista deve ajustar conforme avaliação individual, exames e resposta clínica.
            </p>

            {/* Macros alvo */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-2 border-t">
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

        {/* DIAGNÓSTICO E ESTRATÉGIA — exclusivo do nutricionista */}
        <Card className="border-green-200">
          <CardHeader>
            <CardTitle className="text-base text-green-800">
              Diagnóstico e Estratégia Nutricional
              <span className="ml-2 text-xs font-normal text-green-600">(Exclusivo do Nutricionista)</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Diagnóstico nutricional</Label>
              <Textarea
                {...register('nutritionalDiagnosis')}
                placeholder="Registro do diagnóstico nutricional — responsabilidade exclusiva do nutricionista habilitado"
                rows={3}
              />
            </div>
            <div>
              <Label>Estratégia alimentar proposta</Label>
              <Textarea
                {...register('dietaryStrategy')}
                placeholder="Descreva a estratégia alimentar planejada"
                rows={3}
              />
            </div>
            <div>
              <Label>Observações profissionais</Label>
              <Textarea {...register('professionalNotes')} rows={2} />
            </div>
          </CardContent>
        </Card>

        {/* Resultado da IA */}
        {aiAnalysis && (
          <Card className="border-blue-200 bg-blue-50">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2 text-blue-800">
                <Brain className="h-4 w-4" />
                Síntese de Apoio (IA)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <pre className="text-xs text-blue-900 whitespace-pre-wrap leading-relaxed">{aiAnalysis}</pre>
              <p className="text-xs text-gray-400 italic mt-3 border-t pt-2">
                Nível de confiança: Moderado · Fonte: análise assistida · Requer validação profissional
              </p>
            </CardContent>
          </Card>
        )}

        <div className="flex justify-end gap-3">
          <Button type="button" variant="outline">Salvar rascunho</Button>
          <Button type="submit" disabled={isSubmitting} className="flex items-center gap-2">
            {isSubmitting ? (
              <>Processando...</>
            ) : (
              <>
                <Coins className="h-4 w-4" />
                Finalizar avaliação (10 tokens)
              </>
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}
