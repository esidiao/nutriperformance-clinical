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
import { ShieldAlert, Coins, Activity, TrendingUp, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api-client';
import { AudioIntakeRecorder } from '@/components/AudioIntakeRecorder';
import {
  PENDENTES, protocolosPara, protocoloPorId, ROTULO_SITIO, classificarGordura,
  foraDaFaixa,
  composicao, type Sitio,
} from '@/lib/protocolos-dobras';

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

// As equações de dobras saíram daqui para `lib/protocolos-dobras.ts`: lá são
// funções puras e TESTADAS (apps/api/src/modules/assessments/protocolos-dobras.spec.ts).
// Coeficiente errado não dá erro — devolve percentual plausível. Isso não pode
// morar solto numa página sem teste.

export default function PhysicalAssessmentNewPage() {
  const [bmi, setBmi] = useState<number | null>(null);
  const [whr, setWhr] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { register, handleSubmit, watch, setValue } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { activityLevel: 'moderately_active', primaryGoal: 'general_health' },
  });

  // Paciente alvo via ?patient= (vindo do perfil). Leitura client-side.
  const [patientId] = useState<string | null>(() =>
    typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('patient') : null,
  );

  /**
   * Sexo e idade vêm do CADASTRO, não de campo digitado na tela.
   *
   * Antes não havia campo `gender` nenhum no formulário, e o código lia
   * `watch('gender') ?? 'female'` — ou seja, TODO paciente era tratado como
   * mulher. Isso não ficava só na aparência:
   *
   *  - a equação de Jackson & Pollock usava os coeficientes femininos;
   *  - os rótulos pediam tríceps/supra-ilíaca/coxa, que é o protocolo
   *    feminino, mesmo para homem;
   *  - e o que foi medido era GRAVADO nas colunas erradas — peitoral de um
   *    homem ia para `skinfoldTricepsMm`.
   *
   * A idade tinha defeito parecido: `Number(watch('age') ?? 30)` devolve 0
   * para campo vazio, porque `??` não captura string vazia. Com idade 0 a
   * função devolve null e o percentual simplesmente não calcula — era o
   * "Idade: 0 anos" do relatório de testes.
   */
  const pacienteQ = useQuery({
    queryKey: ['paciente-avaliacao', patientId],
    queryFn: () => api.patients.get(patientId!),
    enabled: !!patientId,
  });
  const paciente: any = pacienteQ.data ?? null;

  // Dobras guardadas por SÍTIO, não por posição.
  //
  // Antes eram `s1/s2/s3` e o significado de cada uma dependia do sexo. Como
  // o sexo estava sempre errado, a medida ia para a coluna errada no banco.
  // Com a chave sendo o próprio sítio, não há como trocar.
  const [medidas, setMedidas] = useState<Partial<Record<Sitio, string>>>({});
  const [protocoloId, setProtocoloId] = useState('jackson_pollock_3');

  // Preenche apenas os campos do schema que a transcrição extraiu; o resto do
  // formulário e o que o profissional já digitou permanecem intactos.
  const applyExtractedFields = (fields: Record<string, unknown>) => {
    for (const [key, value] of Object.entries(fields)) {
      if (key in schema.shape) {
        setValue(key as keyof FormData, value as never, { shouldValidate: true });
      }
    }
  };

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

  const onSubmit = async (data: FormData) => {
    if (!patientId) {
      toast.error('Selecione um paciente: abra esta avaliação pelo perfil do paciente (botão "Física").');
      return;
    }
    setIsSubmitting(true);
    const t = toast.loading('Salvando avaliação física...');
    try {
      const n = (v: unknown) => {
        if (v === '' || v == null) return undefined;
        const x = Number(v);
        return isFinite(x) ? x : undefined;
      };
      // Mesmo cuidado na GRAVAÇÃO: sem sexo conhecido, as dobras não são
      // mapeadas para coluna nenhuma. Chutar aqui grava peitoral de homem em
      // `skinfoldTricepsMm` — e o erro fica no prontuário.
      // Cada sítio vai para a SUA coluna. Não há mais mapeamento por posição,
      // que era o que permitia gravar peitoral em `skinfoldTricepsMm`.
      const COLUNA_DO_SITIO: Record<Sitio, string> = {
        triceps: 'skinfoldTricepsMm',
        subscapular: 'skinfoldSubscapularMm',
        suprailiac: 'skinfoldSuprailiacMm',
        abdominal: 'skinfoldAbdominalMm',
        thigh: 'skinfoldThighMm',
        chest: 'skinfoldChestMm',
        midaxillary: 'skinfoldMidaxillaryMm',
        biceps: 'skinfoldBicepsMm',
        calf: 'skinfoldCalfMm',
      };
      const sfMap: Record<string, number> = {};
      for (const [sitio, valor] of Object.entries(medidasNum)) {
        sfMap[COLUNA_DO_SITIO[sitio as Sitio]] = valor as number;
      }
      const dto: Record<string, unknown> = {
        patientId,
        weightKg: n(data.weightKg), heightCm: n(data.heightCm),
        bmi: bmi ?? undefined, whr: whr ?? undefined,
        bodyFatPct: n(data.bodyFatPct) ?? (sfFat ?? undefined),
        leanMassKg: n(data.leanMassKg) ?? (sfLeanMass ?? undefined),
        muscleMassKg: n(data.muscleMassKg), boneMassKg: n(data.boneMassKg),
        bodyCompositionMethod: data.assessmentMethod || undefined,
        waistCm: n(data.waistCm), hipCm: n(data.hipCm), neckCm: n(data.neckCm), chestCm: n(data.chestCm),
        rightArmRelaxedCm: n(data.rightArmCm), rightThighCm: n(data.rightThighCm), rightCalfCm: n(data.rightCalfCm),
        physicalActivityLevel: data.activityLevel,
        trainingFrequencyPerWeek: n(data.weeklyFrequency), trainingDurationMin: n(data.sessionDurationMin),
        mainSportActivity: data.sportModality || undefined,
        primaryGoal: data.primaryGoal,
        // Qual protocolo gerou os valores. Sem isto os milímetros não se
        // interpretam depois: o mesmo sítio entra em equações diferentes.
        skinfoldProtocol: Object.keys(sfMap).length ? protocolo.id : undefined,
        ...sfMap,
        professionalNotes: data.professionalNotes || undefined,
      };
      Object.keys(dto).forEach((k) => dto[k] === undefined && delete dto[k]);
      await api.assessments.createPhysical(dto);
      toast.success('Avaliação física salva com sucesso!', { id: t });
      window.location.href = `/patients/${patientId}`;
    } catch (err: any) {
      toast.error(err?.message ?? 'Erro ao salvar a avaliação.', { id: t });
      setIsSubmitting(false);
    }
  };

  // Do cadastro. `null` quando não se sabe — e aí nada é calculado, em vez de
  // assumir um valor e produzir número que parece medida.
  const formGender: 'male' | 'female' | null =
    paciente?.gender === 'male' || paciente?.gender === 'female' ? paciente.gender : null;

  const idadeDigitada = Number(String((watch as any)('age') ?? '').replace(',', '.'));
  const formAge: number | null = paciente?.age && paciente.age > 0
    ? Number(paciente.age)
    : (Number.isFinite(idadeDigitada) && idadeDigitada > 0 ? idadeDigitada : null);

  const faltaParaCalcular = [
    formGender === null ? 'sexo' : null,
    formAge === null ? 'idade' : null,
  ].filter(Boolean) as string[];

  // ─── Calculadora de % de gordura por dobras cutâneas ───────────────────────
  // Só os protocolos válidos para o sexo do paciente. Petroski e Guedes têm
  // apenas versão feminina verificada; oferecê-los para homem seria aplicar a
  // equação fora da população em que foi validada.
  const protocolosDisponiveis = protocolosPara(formGender);
  const escolhido = protocoloPorId(protocoloId);
  const protocolo = escolhido && protocolosDisponiveis.includes(escolhido)
    ? escolhido
    : protocolosDisponiveis[0];
  const sitiosExigidos: Sitio[] = protocolo.sitios(formGender ?? 'female');
  const avisoFaixa = foraDaFaixa(protocolo, formAge, formGender);

  const medidasNum: Partial<Record<Sitio, number>> = {};
  for (const [k, v] of Object.entries(medidas)) {
    const n = Number(String(v).replace(',', '.'));
    if (Number.isFinite(n) && n > 0) medidasNum[k as Sitio] = n;
  }
  const sfSum = sitiosExigidos.reduce((a, s) => a + (medidasNum[s] ?? 0), 0);

  const sfFat = formGender && formAge
    ? protocolo.calcular(medidasNum, formAge, formGender, {
        pesoKg: Number(wW) || null,
        estaturaCm: Number(wH) || null,
      })
    : null;
  const sfFatCls = sfFat !== null && formGender ? classificarGordura(sfFat, formGender) : null;
  const weightNum = Number(wW) || 0;
  const { massaGordaKg: sfFatMass, massaMagraKg: sfLeanMass } =
    composicao(sfFat, weightNum || null);

  // Circumference table rows
  const waistVal = Number(wWaist);
  const bmiCls = bmi ? classifyBmi(bmi) : null;
  // Os pontos de corte de cintura e RCQ também são por sexo (94/102 cm para
  // homem, 80/88 para mulher). Classificar sem saber seria inventar risco.
  const waistCls = waistVal > 0 && formGender ? classifyWaist(waistVal, formGender) : null;
  const whrCls = whr && formGender && formAge ? classifyRCQ(whr, formGender, formAge) : null;

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

      <AudioIntakeRecorder kind="physical" onFieldsExtracted={applyExtractedFields} />

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">

        {/* MEDIDAS BÁSICAS */}
        <Card>
          <CardHeader><CardTitle className="text-base">Medidas Básicas</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <Label htmlFor="weightKg">Peso (kg) *</Label>
                <Input id="weightKg" {...register('weightKg')} type="number" step="0.1" placeholder="70.0" />
              </div>
              <div>
                <Label htmlFor="heightCm">Altura (cm) *</Label>
                <Input id="heightCm" {...register('heightCm')} type="number" step="0.1" placeholder="170" />
              </div>
              <div>
                <Label htmlFor="age">Idade (anos)</Label>
                {paciente?.age ? (
                  // Vindo do cadastro, a idade é mostrada e não editada: dois
                  // lugares para o mesmo dado divergem, e aqui a divergência
                  // trocaria a equação sem ninguém notar.
                  <div className="h-10 flex items-center gap-2 text-sm">
                    <strong>{paciente.age}</strong>
                    <span className="text-xs text-muted-foreground">
                      · do cadastro {paciente.gender === 'male' ? '· Masculino' : paciente.gender === 'female' ? '· Feminino' : ''}
                    </span>
                  </div>
                ) : (
                  <Input id="age" {...register('age')} type="number" min={1} max={120} placeholder="30" />
                )}
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
                <Label htmlFor="bodyFatPct">% Gordura corporal</Label>
                <Input id="bodyFatPct" {...register('bodyFatPct')} type="number" step="0.1" placeholder="22.0" />
              </div>
              <div>
                <Label htmlFor="leanMassKg">Massa magra (kg)</Label>
                <Input id="leanMassKg" {...register('leanMassKg')} type="number" step="0.1" />
              </div>
              <div>
                <Label htmlFor="muscleMassKg">Massa muscular (kg)</Label>
                <Input id="muscleMassKg" {...register('muscleMassKg')} type="number" step="0.1" />
              </div>
              <div>
                <Label htmlFor="boneMassKg">Massa óssea (kg)</Label>
                <Input id="boneMassKg" {...register('boneMassKg')} type="number" step="0.1" />
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
              {protocolo.nome}.{' '}
              {formGender && formAge
                ? <>Sexo: {formGender === 'male' ? 'Masculino' : 'Feminino'} · Idade: {formAge} anos
                    {paciente ? ' (do cadastro do paciente)' : ''}.</>
                : <span className="text-orange-700">
                    Faltam dados do paciente — ver abaixo.
                  </span>}
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Sem sexo e idade não há cálculo. Dizer isso é melhor que exibir
                nada e deixar a pessoa achar que a calculadora está quebrada —
                foi assim que o "Idade: 0 anos" passou despercebido. */}
            {faltaParaCalcular.length > 0 && (
              <div className="rounded-lg border border-orange-200 bg-orange-50 p-3 text-xs text-orange-900 space-y-1">
                <p>
                  <strong>Não dá para calcular o percentual de gordura sem {faltaParaCalcular.join(' e ')}.</strong>
                </p>
                <p>
                  Os sítios de dobra e a equação de Jackson &amp; Pollock mudam conforme o
                  sexo, e a equação usa a idade. Chutar qualquer um dos dois produziria um
                  número que parece medida e não é.
                </p>
                <p>
                  {patientId
                    ? 'Complete o sexo e a data de nascimento no cadastro do paciente.'
                    : 'Abra esta avaliação pela ficha do paciente para que os dados venham do cadastro.'}
                </p>
              </div>
            )}

            <div>
              <Label htmlFor="protocolo">Protocolo</Label>
              <select
                id="protocolo"
                value={protocoloId}
                onChange={(e) => setProtocoloId(e.target.value)}
                className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
              >
                {protocolosDisponiveis.map((p) => (
                  <option key={p.id} value={p.id}>{p.nome}</option>
                ))}
              </select>
              <p className="text-[11px] text-muted-foreground mt-1">{protocolo.nota}</p>

              {/* A equacao fora da faixa em que foi construida devolve um
                  numero com a mesma cara de sempre. O aviso existe para que
                  isso nao passe calado -- mas nao bloqueia: usar ou nao e
                  decisao clinica. */}
              {avisoFaixa && (
                <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded p-2 mt-1 flex items-start gap-1.5">
                  <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0 text-amber-600" />
                  <span>{avisoFaixa}</span>
                </p>
              )}

              {/* As constantes ficam à vista para conferência contra a
                  referência da profissional. Coeficiente errado não dá erro:
                  devolve percentual plausível. Caixa-preta aqui seria o pior
                  arranjo possível. */}
              <details className="mt-2 text-[11px] text-muted-foreground">
                <summary className="cursor-pointer">Ver a equação e as constantes usadas</summary>
                <pre className="mt-1 whitespace-pre-wrap font-mono text-[10px] leading-relaxed bg-muted rounded p-2">
{protocolo.constantes.join('\n')}
                </pre>
                <p className="mt-1">
                  Confira contra a edição que você adota antes de usar clinicamente.
                </p>
              </details>
            </div>

            {/* Um campo por sítio que ESTE protocolo exige. Mudando o
                protocolo, mudam os campos — e o que já foi medido continua
                guardado pelo nome do sítio, não se perde. */}
            {protocolo.exigeAntropometria && !(Number(wW) > 0 && Number(wH) > 0) && (
              <p className="rounded-lg border border-orange-200 bg-orange-50 p-2.5 text-[11px] text-orange-900">
                Este protocolo usa <strong>peso e estatura</strong> na equação, além das
                dobras. Preencha os dois acima para o cálculo sair.
              </p>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {sitiosExigidos.map((sitio) => (
                <div key={sitio}>
                  <Label htmlFor={`dobra-${sitio}`}>{ROTULO_SITIO[sitio]} (mm)</Label>
                  <Input
                    id={`dobra-${sitio}`}
                    type="number" step="0.1" min={0} placeholder="0"
                    value={medidas[sitio] ?? ''}
                    onChange={(e) => setMedidas((p) => ({ ...p, [sitio]: e.target.value }))}
                  />
                </div>
              ))}
            </div>

            {/* O que foi pedido e ainda não entrou, com o motivo. Omitir
                faria parecer que o pedido se perdeu. */}
            <details className="text-[11px] text-muted-foreground">
              <summary className="cursor-pointer">Outros protocolos ainda não disponíveis</summary>
              <ul className="mt-1 space-y-0.5 pl-4 list-disc">
                {PENDENTES.map((p) => (
                  <li key={p.nome}><strong>{p.nome}</strong> — {p.motivo}.</li>
                ))}
              </ul>
            </details>

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
                Preencha {sitiosExigidos.length === 1 ? 'a dobra' : `as ${sitiosExigidos.length} dobras`} (mm) do protocolo escolhido. Somatório atual: {sfSum > 0 ? `${sfSum} mm` : '—'}.
              </p>
            )}

            {sfFat && (
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-[11px] text-gray-500 italic">
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
                <Label htmlFor="waistCm">Cintura</Label>
                <Input id="waistCm" {...register('waistCm')} type="number" step="0.1" />
              </div>
              <div>
                <Label htmlFor="hipCm">Quadril</Label>
                <Input id="hipCm" {...register('hipCm')} type="number" step="0.1" />
              </div>
              <div>
                <Label htmlFor="neckCm">Pescoço</Label>
                <Input id="neckCm" {...register('neckCm')} type="number" step="0.1" />
              </div>
              <div>
                <Label htmlFor="chestCm">Tórax</Label>
                <Input id="chestCm" {...register('chestCm')} type="number" step="0.1" />
              </div>
              <div>
                <Label htmlFor="rightArmCm">Braço D (relaxado)</Label>
                <Input id="rightArmCm" {...register('rightArmCm')} type="number" step="0.1" />
              </div>
              <div>
                <Label htmlFor="rightThighCm">Coxa D</Label>
                <Input id="rightThighCm" {...register('rightThighCm')} type="number" step="0.1" />
              </div>
              <div>
                <Label htmlFor="rightCalfCm">Panturrilha D</Label>
                <Input id="rightCalfCm" {...register('rightCalfCm')} type="number" step="0.1" />
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
              <Label htmlFor="weeklyFrequency">Frequência semanal</Label>
              <Input id="weeklyFrequency" {...register('weeklyFrequency')} type="number" min={0} max={14} placeholder="5" />
            </div>
            <div>
              <Label htmlFor="sessionDurationMin">Duração da sessão (min)</Label>
              <Input id="sessionDurationMin" {...register('sessionDurationMin')} type="number" placeholder="60" />
            </div>
            <div>
              <Label htmlFor="sportModality">Modalidade esportiva</Label>
              <Input id="sportModality" {...register('sportModality')} placeholder="Ex: Musculação, Corrida, Natação" />
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
              <Label htmlFor="restingHeartRate">FC repouso (bpm)</Label>
              <Input id="restingHeartRate" {...register('restingHeartRate')} type="number" placeholder="62" />
            </div>
            <div>
              <Label htmlFor="bloodPressure">Pressão arterial</Label>
              <Input id="bloodPressure" {...register('bloodPressure')} placeholder="120/80 mmHg" />
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
              <Label htmlFor="targetWeightKg">Peso alvo (kg)</Label>
              <Input id="targetWeightKg" {...register('targetWeightKg')} type="number" step="0.1" />
            </div>
            <div>
              <Label htmlFor="targetBodyFatPct">% Gordura alvo</Label>
              <Input id="targetBodyFatPct" {...register('targetBodyFatPct')} type="number" step="0.1" />
            </div>
            <div>
              <Label htmlFor="targetDate">Data alvo</Label>
              <Input id="targetDate" {...register('targetDate')} type="date" />
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
