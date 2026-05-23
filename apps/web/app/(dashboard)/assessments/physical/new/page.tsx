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
import { Badge } from '@/components/ui/badge';
import { ShieldAlert, Coins, Activity } from 'lucide-react';

const schema = z.object({
  patientId: z.string().uuid(),
  // Medidas básicas
  weightKg: z.coerce.number().min(20).max(300),
  heightCm: z.coerce.number().min(100).max(250),
  // Composição corporal
  bodyFatPct: z.coerce.number().min(2).max(70).optional(),
  leanMassKg: z.coerce.number().optional(),
  muscleMassKg: z.coerce.number().optional(),
  boneMassKg: z.coerce.number().optional(),
  assessmentMethod: z.string().optional(),
  // Circunferências
  waistCm: z.coerce.number().optional(),
  hipCm: z.coerce.number().optional(),
  neckCm: z.coerce.number().optional(),
  chestCm: z.coerce.number().optional(),
  rightArmCm: z.coerce.number().optional(),
  rightThighCm: z.coerce.number().optional(),
  rightCalfCm: z.coerce.number().optional(),
  // Atividade
  activityLevel: z.enum(['sedentary','lightly_active','moderately_active','very_active','extremely_active']),
  weeklyFrequency: z.coerce.number().min(0).max(14).optional(),
  sessionDurationMin: z.coerce.number().optional(),
  sportModality: z.string().optional(),
  trainingIntensity: z.string().optional(),
  // Cardiorrespiratório
  restingHeartRate: z.coerce.number().min(30).max(200).optional(),
  bloodPressure: z.string().optional(),
  // Objetivo
  primaryGoal: z.enum(['weight_loss','hypertrophy','body_recomposition','metabolic_improvement','performance_improvement','endurance_gain','general_health','clinical_recovery','lean_mass_maintenance','gastrointestinal_improvement']),
  targetWeightKg: z.coerce.number().optional(),
  targetBodyFatPct: z.coerce.number().optional(),
  targetDate: z.string().optional(),
  professionalNotes: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

const GOAL_LABELS: Record<string, string> = {
  weight_loss: 'Emagrecimento',
  hypertrophy: 'Hipertrofia',
  body_recomposition: 'Recomposição corporal',
  metabolic_improvement: 'Melhora metabólica',
  performance_improvement: 'Melhora de performance',
  endurance_gain: 'Ganho de resistência',
  general_health: 'Saúde geral',
  clinical_recovery: 'Recuperação clínica',
  lean_mass_maintenance: 'Manutenção de massa magra',
  gastrointestinal_improvement: 'Melhora gastrointestinal',
};

export default function PhysicalAssessmentNewPage() {
  const [bmi, setBmi] = useState<number | null>(null);
  const [whr, setWhr] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { register, handleSubmit, watch, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { activityLevel: 'moderately_active', primaryGoal: 'general_health' },
  });

  const watchWeight = watch('weightKg');
  const watchHeight = watch('heightCm');
  const watchWaist = watch('waistCm');
  const watchHip = watch('hipCm');

  const recalculate = () => {
    if (watchWeight && watchHeight) {
      const h = Number(watchHeight) / 100;
      setBmi(Math.round((Number(watchWeight) / (h * h)) * 10) / 10);
    }
    if (watchWaist && watchHip) {
      setWhr(Math.round((Number(watchWaist) / Number(watchHip)) * 1000) / 1000);
    }
  };

  const onSubmit = async (data: FormData) => {
    setIsSubmitting(true);
    await new Promise((r) => setTimeout(r, 1200));
    setIsSubmitting(false);
  };

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Nova Avaliação Física</h1>
          <p className="text-gray-500 text-sm mt-1">Profissional de Educação Física (CREF) ou Nutricionista</p>
        </div>
        <Badge variant="outline" className="text-blue-700 border-blue-300 flex items-center gap-1">
          <Coins className="h-3 w-3" /> 5 tokens
        </Badge>
      </div>

      <Alert className="border-amber-300 bg-amber-50">
        <ShieldAlert className="h-4 w-4 text-amber-600" />
        <AlertDescription className="text-amber-800 text-xs">
          <strong>Avaliação física é atribuição do Profissional de Educação Física (CONFEF/CREF).</strong>{' '}
          O sistema organiza os dados e gera análise de apoio — sem substituir o julgamento profissional.
          Diagnóstico clínico, prescrição médica e dietoterapia não são atribuições deste módulo.
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
                <Input {...register('weightKg')} type="number" step="0.1" onChange={recalculate} placeholder="70.0" />
                {errors.weightKg && <p className="text-xs text-red-500 mt-1">{errors.weightKg.message}</p>}
              </div>
              <div>
                <Label>Altura (cm) *</Label>
                <Input {...register('heightCm')} type="number" step="0.1" onChange={recalculate} placeholder="170" />
              </div>
              <div>
                <Label>IMC (calculado)</Label>
                <div className="h-10 flex items-center px-3 bg-gray-50 rounded-md border text-sm font-semibold text-blue-700">
                  {bmi ?? '—'}
                </div>
              </div>
              <div>
                <Label>Método de avaliação</Label>
                <select {...register('assessmentMethod')} className="w-full h-10 rounded-md border px-3 text-sm">
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
          </CardContent>
        </Card>

        {/* CIRCUNFERÊNCIAS */}
        <Card>
          <CardHeader><CardTitle className="text-base">Circunferências (cm)</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <Label>Cintura</Label>
              <Input {...register('waistCm')} type="number" step="0.1" onChange={recalculate} />
            </div>
            <div>
              <Label>Quadril</Label>
              <Input {...register('hipCm')} type="number" step="0.1" onChange={recalculate} />
            </div>
            <div>
              <Label>RCQ (calculada)</Label>
              <div className="h-10 flex items-center px-3 bg-gray-50 rounded-md border text-sm font-semibold text-blue-700">
                {whr ?? '—'}
              </div>
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
              <select {...register('activityLevel')} className="w-full h-10 rounded-md border px-3 text-sm">
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
              <select {...register('trainingIntensity')} className="w-full h-10 rounded-md border px-3 text-sm">
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
              <select {...register('primaryGoal')} className="w-full h-10 rounded-md border px-3 text-sm">
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

        <div className="flex justify-end gap-3">
          <Button type="button" variant="outline">Salvar rascunho</Button>
          <Button type="submit" disabled={isSubmitting} className="flex items-center gap-2">
            {isSubmitting ? 'Processando...' : (
              <><Coins className="h-4 w-4" /> Finalizar avaliação (5 tokens)</>
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}
