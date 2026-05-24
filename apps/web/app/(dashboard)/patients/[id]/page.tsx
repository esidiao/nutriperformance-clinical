'use client';

import { useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Input } from '@/components/ui/input';
import { PageHeader } from '@/components/PageHeader';
import {
  AlertTriangle, Activity, Pill, FlaskConical, Target, FileText,
  ShieldAlert, User, Calendar, GitMerge, Plus, ArrowRight,
  Coins, Clock, Brain,
} from 'lucide-react';

function EthicsDisclaimer() {
  return (
    <Alert className="mb-4 border-amber-200 bg-amber-50 dark:bg-amber-950 dark:border-amber-900">
      <ShieldAlert className="h-4 w-4 text-amber-600 flex-shrink-0" />
      <AlertDescription className="text-amber-800 dark:text-amber-300 text-xs leading-relaxed">
        <strong>Ferramenta de apoio profissional.</strong> Análises devem ser validadas pelo profissional responsável.
        Não substitui avaliação clínica, diagnóstico ou prescrição. CFN · CONFEF · LGPD.
      </AlertDescription>
    </Alert>
  );
}

const MOCK = {
  internalCode: 'PAC-SEED-001',
  age: 28, gender: 'Feminino', primaryGoal: 'Hipertrofia',
  activeAlerts: 2, activeSupplements: 4, lastAssessment: '22/05/2026',
  professional: 'Dra. Ana Costa',
  overview: { weight: 64.2, heightCm: 165, bmi: 23.6, fatPct: 27.1, leanMass: 44.3 },
  assessments: [
    { date: '22/05/2026', type: 'Nutricional', tmb: 1448, get: 2244, bmi: 23.6,
      diagnosis: 'Eutrofia com massa muscular em ganho progressivo.',
      strategy: 'Dieta hipercalórica moderada +300 kcal, foco em proteínas magras.' },
    { date: '01/05/2026', type: 'Nutricional', tmb: 1440, get: 2232, bmi: 23.4,
      diagnosis: 'Eutrofia. Ingestão proteica adequada.',
      strategy: 'Manter distribuição de macros. Ajustar timing pós-treino.' },
    { date: '01/04/2026', type: 'Física', tmb: null, get: null, bmi: 23.1,
      diagnosis: 'Composição corporal dentro da faixa desejada.',
      strategy: 'Aumentar carga progressiva. Foco em hipertrofia funcional.' },
  ],
  supplements: [
    { name: 'Creatina Monoidratada', brand: 'Optimum Nutrition', dose: '5g', freq: 'Diária', risk: 'low' as const },
    { name: 'Whey Protein', brand: 'Growth', dose: '30g', freq: 'Pós-treino', risk: 'low' as const },
    { name: 'Sulfato Ferroso', brand: 'Farmácia', dose: '40mg', freq: 'Diária', risk: 'moderate' as const },
    { name: 'Vitamina D3 5000 UI', brand: 'Sundown', dose: '5000 UI', freq: 'Diária', risk: 'low' as const },
  ],
  interactions: [
    { a: 'Ferro', b: 'Omeprazol', risk: 'moderate' as const, rec: 'Preferir ferro quelato. Administrar com vitamina C.', medical: false },
    { a: 'Creatina', b: 'Função renal', risk: 'low' as const, rec: 'Monitorar creatinina em exames periódicos.', medical: false },
  ],
  goals: [
    { id: 'G1', label: 'Massa muscular', baseline: 43.2, current: 44.3, target: 47.0, unit: 'kg', deadline: '01/10/2026' },
    { id: 'G2', label: 'Gordura corporal', baseline: 28.5, current: 27.1, target: 23.0, unit: '%', deadline: '01/10/2026' },
    { id: 'G3', label: 'Ferritina sérica', baseline: 8.2, current: 14.0, target: 30.0, unit: 'ng/mL', deadline: '15/09/2026' },
  ],
  timeline: [
    { date: '22/05/2026', event: 'Avaliação nutricional', tokens: 10 },
    { date: '21/05/2026', event: 'Exame laboratorial registrado', tokens: 0 },
    { date: '15/05/2026', event: 'Análise de interações', tokens: 15 },
    { date: '01/05/2026', event: 'Avaliação nutricional', tokens: 10 },
    { date: '01/04/2026', event: 'Avaliação física', tokens: 5 },
  ],
};

const RISK = {
  low:             { bar: 'border-l-green-400',  bg: 'bg-green-50',   badge: 'bg-green-100 text-green-800',  label: 'Baixo' },
  moderate:        { bar: 'border-l-yellow-400', bg: 'bg-yellow-50',  badge: 'bg-yellow-100 text-yellow-800', label: 'Moderado' },
  high:            { bar: 'border-l-red-500',    bg: 'bg-red-50',     badge: 'bg-red-100 text-red-800',     label: 'Alto' },
  contraindicated: { bar: 'border-l-red-700',    bg: 'bg-red-100',    badge: 'bg-red-200 text-red-900',     label: 'Contraindicado' },
  insufficient_data: { bar: 'border-l-gray-300', bg: 'bg-gray-50',    badge: 'bg-gray-100 text-gray-600',   label: 'Não avaliado' },
};

function GoalBar({ baseline, current, target, unit }: { baseline: number; current: number; target: number; unit: string }) {
  const range = Math.abs(target - baseline);
  const progress = range > 0 ? Math.min(100, Math.round((Math.abs(current - baseline) / range) * 100)) : 0;
  const color = progress >= 100 ? 'bg-green-500' : progress >= 50 ? 'bg-blue-500' : 'bg-blue-300';
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs text-gray-500">
        <span>{baseline} {unit}</span>
        <span className="font-semibold text-blue-700">{progress}% — atual: {current} {unit}</span>
        <span>{target} {unit}</span>
      </div>
      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${progress}%` }} />
      </div>
    </div>
  );
}

export default function PatientPage({ params }: { params: { id: string } }) {
  const [activeTab, setActiveTab] = useState('overview');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [checkpointVals, setCheckpointVals] = useState<Record<string, string>>({});

  const handleAnalyze = async () => {
    setIsAnalyzing(true);
    const t = toast.loading('Analisando interações com IA...');
    await new Promise((r) => setTimeout(r, 2000));
    toast.dismiss(t);
    toast.success('Análise concluída', { description: '15 tokens consumidos · 2 interações identificadas' });
    setIsAnalyzing(false);
  };

  const handleReport = () => {
    toast.promise(new Promise((r) => setTimeout(r, 2500)), {
      loading: 'Gerando relatório PDF...',
      success: 'Relatório gerado — 5 tokens consumidos',
      error: 'Erro ao gerar relatório',
    });
  };

  return (
    <div className="flex flex-col min-h-full">
      <PageHeader
        title={`Paciente ${MOCK.internalCode}`}
        description={`${MOCK.age} anos · ${MOCK.gender} · Objetivo: ${MOCK.primaryGoal}`}
        breadcrumbs={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Pacientes', href: '/patients' },
          { label: MOCK.internalCode },
        ]}
        action={
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleReport} className="flex items-center gap-2">
              <FileText className="h-4 w-4" /> Relatório
            </Button>
            <Link href="/assessments/nutritional/new">
              <Button size="sm" className="flex items-center gap-2">
                <Plus className="h-4 w-4" /> Nova Avaliação
              </Button>
            </Link>
          </div>
        }
      />

      <div className="px-4 py-5 sm:p-6 max-w-5xl mx-auto w-full flex-1">
        {/* Patient card */}
        <div className="flex items-center gap-4 mb-6 p-4 bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm">
          <div className="w-12 h-12 rounded-full bg-blue-600 flex items-center justify-center flex-shrink-0">
            <span className="text-white font-bold">MS</span>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-bold text-gray-900 dark:text-white">{MOCK.internalCode}</span>
              <Badge variant="outline" className="text-xs">{MOCK.age} anos · {MOCK.gender}</Badge>
              {MOCK.activeAlerts > 0 && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-red-50 text-red-700 border border-red-200 flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3" />{MOCK.activeAlerts} alertas
                </span>
              )}
            </div>
            <div className="flex gap-3 mt-1 text-xs text-gray-500 flex-wrap">
              <span className="flex items-center gap-1"><Target className="h-3 w-3" />{MOCK.primaryGoal}</span>
              <span className="flex items-center gap-1"><Pill className="h-3 w-3" />{MOCK.activeSupplements} suplementos</span>
              <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />{MOCK.lastAssessment}</span>
              <span className="flex items-center gap-1"><User className="h-3 w-3" />{MOCK.professional}</span>
            </div>
          </div>
          <div className="hidden sm:grid grid-cols-3 gap-2 flex-shrink-0">
            {[
              { label: 'Peso', value: `${MOCK.overview.weight}kg` },
              { label: 'IMC', value: MOCK.overview.bmi },
              { label: 'Gordura', value: `${MOCK.overview.fatPct}%` },
            ].map((m) => (
              <div key={m.label} className="text-center px-3 py-2 bg-gray-50 dark:bg-gray-800 rounded-xl">
                <p className="text-[10px] text-gray-400">{m.label}</p>
                <p className="text-sm font-bold text-gray-900 dark:text-white">{m.value}</p>
              </div>
            ))}
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-6 bg-gray-100 dark:bg-gray-800 p-1 rounded-xl flex-wrap h-auto gap-1">
            {[
              { value: 'overview',      label: 'Visão Geral',  icon: Activity },
              { value: 'assessments',   label: 'Avaliações',   icon: FlaskConical },
              { value: 'supplements',   label: 'Suplementação',icon: Pill },
              { value: 'interactions',  label: 'Interações',   icon: GitMerge },
              { value: 'goals',         label: 'Metas',        icon: Target },
            ].map((tab) => (
              <TabsTrigger key={tab.value} value={tab.value} className="flex items-center gap-1.5 text-xs rounded-lg">
                <tab.icon className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">{tab.label}</span>
              </TabsTrigger>
            ))}
          </TabsList>

          {/* OVERVIEW */}
          <TabsContent value="overview" className="space-y-5">
            <EthicsDisclaimer />
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: 'Alertas Ativos', value: MOCK.activeAlerts, color: 'text-red-600', bg: 'bg-red-50' },
                { label: 'Suplementos', value: MOCK.activeSupplements, color: 'text-blue-600', bg: 'bg-blue-50' },
                { label: 'Massa Magra', value: `${MOCK.overview.leanMass}kg`, color: 'text-green-600', bg: 'bg-green-50' },
                { label: 'Avaliações', value: MOCK.assessments.length, color: 'text-purple-600', bg: 'bg-purple-50' },
              ].map((s) => (
                <div key={s.label} className={`rounded-xl border px-4 py-3 ${s.bg}`}>
                  <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{s.label}</p>
                </div>
              ))}
            </div>
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Activity className="h-4 w-4 text-gray-400" /> Timeline Clínica
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="relative pl-5 border-l-2 border-gray-100 dark:border-gray-800 space-y-4">
                  {MOCK.timeline.map((item, i) => (
                    <div key={i} className="relative">
                      <div className="absolute -left-[21px] w-3 h-3 rounded-full bg-blue-500 border-2 border-white dark:border-gray-900" />
                      <div className="flex items-center justify-between gap-4">
                        <div>
                          <p className="text-sm font-medium text-gray-800 dark:text-gray-200">{item.event}</p>
                          <p className="text-xs text-gray-400">{item.date}</p>
                        </div>
                        {item.tokens > 0 && (
                          <span className="text-xs text-gray-400 flex items-center gap-1 flex-shrink-0">
                            <Coins className="h-3 w-3" />{item.tokens} tk
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ASSESSMENTS */}
          <TabsContent value="assessments" className="space-y-4">
            <EthicsDisclaimer />
            <div className="flex justify-end">
              <Link href="/assessments/nutritional/new">
                <Button size="sm" className="flex items-center gap-2"><Plus className="h-4 w-4" /> Nova Avaliação</Button>
              </Link>
            </div>
            {MOCK.assessments.map((a, i) => (
              <Card key={i} className="overflow-hidden">
                <div className="flex items-center gap-3 px-5 py-3 bg-gray-50 dark:bg-gray-800 border-b dark:border-gray-700">
                  <FlaskConical className="h-4 w-4 text-blue-600" />
                  <span className="font-semibold text-sm text-gray-900 dark:text-white">{a.type}</span>
                  <Badge variant="outline" className="text-xs ml-auto">{a.date}</Badge>
                </div>
                <CardContent className="pt-4 grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <div><p className="text-xs text-gray-400">IMC</p><p className="font-bold">{a.bmi}</p></div>
                  {a.tmb && <div><p className="text-xs text-gray-400">TMB</p><p className="font-bold">{a.tmb} kcal</p></div>}
                  {a.get && <div><p className="text-xs text-gray-400">GET</p><p className="font-bold">{a.get} kcal</p></div>}
                  <div className="col-span-2 sm:col-span-4 pt-2 border-t dark:border-gray-700">
                    <p className="text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wide">Diagnóstico</p>
                    <p className="text-sm text-gray-700 dark:text-gray-300">{a.diagnosis}</p>
                    <p className="text-xs font-semibold text-gray-500 mt-2 mb-1 uppercase tracking-wide">Estratégia</p>
                    <p className="text-sm text-gray-700 dark:text-gray-300">{a.strategy}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </TabsContent>

          {/* SUPPLEMENTS */}
          <TabsContent value="supplements" className="space-y-3">
            <EthicsDisclaimer />
            {MOCK.supplements.map((s, i) => {
              const cfg = RISK[s.risk];
              return (
                <Card key={i} className={`border-l-4 ${cfg.bar}`}>
                  <CardContent className="py-3 px-4 flex items-center justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <Pill className="h-4 w-4 text-gray-400" />
                        <span className="font-semibold text-sm">{s.name}</span>
                        <span className="text-xs text-gray-400">{s.brand}</span>
                      </div>
                      <p className="text-xs text-gray-500 mt-1">{s.dose} · {s.freq}</p>
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-full flex-shrink-0 ${cfg.badge}`}>{cfg.label}</span>
                  </CardContent>
                </Card>
              );
            })}
            <Link href="/supplementation">
              <Button variant="outline" size="sm" className="w-full flex items-center gap-2">
                <ArrowRight className="h-4 w-4" /> Gerenciar suplementação completa
              </Button>
            </Link>
          </TabsContent>

          {/* INTERACTIONS */}
          <TabsContent value="interactions" className="space-y-4">
            <EthicsDisclaimer />
            <div className="flex justify-end">
              <Button size="sm" onClick={handleAnalyze} disabled={isAnalyzing} className="flex items-center gap-2">
                {isAnalyzing
                  ? <><span className="animate-spin mr-1">⟳</span>Analisando…</>
                  : <><Brain className="h-4 w-4" />Nova análise<span className="text-xs opacity-70 ml-1">(15 tk)</span></>
                }
              </Button>
            </div>
            {MOCK.interactions.map((inter, i) => {
              const cfg = RISK[inter.risk];
              return (
                <Card key={i} className={`border-l-4 ${cfg.bar} ${cfg.bg}`}>
                  <CardContent className="py-3 px-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-sm">{inter.a} × {inter.b}</span>
                          <span className={`text-xs px-2 py-0.5 rounded-full ${cfg.badge}`}>{cfg.label}</span>
                          {inter.medical && <span className="text-xs text-red-600 flex items-center gap-1"><AlertTriangle className="h-3 w-3" />Rev. médica</span>}
                        </div>
                        <p className="text-xs text-gray-600 mt-1.5 flex items-start gap-1">
                          <span className="text-blue-600">→</span>{inter.rec}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </TabsContent>

          {/* GOALS */}
          <TabsContent value="goals" className="space-y-4">
            <EthicsDisclaimer />
            {MOCK.goals.map((goal) => (
              <Card key={goal.id}>
                <CardContent className="py-4 px-5">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Target className="h-4 w-4 text-blue-600" />
                      <span className="font-semibold text-sm">{goal.label}</span>
                    </div>
                    <span className="text-xs text-gray-400 flex items-center gap-1">
                      <Clock className="h-3 w-3" />{goal.deadline}
                    </span>
                  </div>
                  <GoalBar baseline={goal.baseline} current={goal.current} target={goal.target} unit={goal.unit} />
                  <div className="flex gap-2 mt-3">
                    <Input
                      type="number" step="0.1" className="h-8 text-xs w-32"
                      placeholder={`Novo valor (${goal.unit})`}
                      value={checkpointVals[goal.id] ?? ''}
                      onChange={(e) => setCheckpointVals((p) => ({ ...p, [goal.id]: e.target.value }))}
                    />
                    <Button size="sm" className="h-8 text-xs" onClick={() => {
                      if (!checkpointVals[goal.id]) return;
                      toast.success(`Checkpoint registrado: ${checkpointVals[goal.id]} ${goal.unit}`);
                      setCheckpointVals((p) => ({ ...p, [goal.id]: '' }));
                    }}>
                      Registrar
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
