'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { toast } from 'sonner';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api-client';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Input } from '@/components/ui/input';
import { PageHeader } from '@/components/PageHeader';
import {
  Activity, Pill, FlaskConical, Target,
  ShieldAlert, User, Calendar, GitMerge, Plus, Dumbbell,
  TrendingUp, Loader2, AlertCircle,
} from 'lucide-react';

const GENDER_LABEL: Record<string, string> = { male: 'Masculino', female: 'Feminino', other: 'Outro', not_informed: '—' };

const GOAL_TYPES: [string, string][] = [
  ['weight_loss', 'Emagrecimento'], ['hypertrophy', 'Hipertrofia'], ['body_recomposition', 'Recomposição corporal'],
  ['metabolic_improvement', 'Melhora metabólica'], ['performance_improvement', 'Performance'], ['endurance_gain', 'Resistência'],
  ['general_health', 'Saúde geral'], ['clinical_recovery', 'Recuperação clínica'], ['lean_mass_maintenance', 'Manutenção de massa magra'],
  ['gastrointestinal_improvement', 'Melhora gastrointestinal'],
];
const GOAL_LABEL: Record<string, string> = Object.fromEntries(GOAL_TYPES);
const fmtDate = (iso?: string) => { if (!iso) return '—'; const d = new Date(iso); return isNaN(d.getTime()) ? '—' : d.toLocaleDateString('pt-BR'); };
const num = (v: unknown) => (typeof v === 'number' && isFinite(v) ? v : (v != null && !isNaN(Number(v)) ? Number(v) : null));

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

function Empty({ text }: { text: string }) {
  return <p className="text-xs text-gray-400 text-center py-6">{text}</p>;
}

export default function PatientPage() {
  const params = useParams<{ id: string }>();
  const patientId = params?.id as string;
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState('overview');
  const [quickPhys, setQuickPhys] = useState({ weightKg: '', heightCm: '', bodyFatPct: '', waistCm: '' });
  const [savingPhys, setSavingPhys] = useState(false);
  const [suppForm, setSuppForm] = useState({ supplementName: '', doseAmount: '', doseUnit: 'mg', frequencyPerDay: '1', therapeuticGoal: '' });
  const [savingSupp, setSavingSupp] = useState(false);
  const [goalForm, setGoalForm] = useState({ goalType: 'hypertrophy', baselineValue: '', targetValue: '', targetUnit: 'kg' });
  const [savingGoal, setSavingGoal] = useState(false);

  const patientQ = useQuery({ queryKey: ['patient', patientId], queryFn: () => api.patients.get(patientId), enabled: !!patientId });
  const nutriQ = useQuery({ queryKey: ['assessNutri', patientId], queryFn: () => api.assessments.listNutritional(patientId), enabled: !!patientId });
  const physQ = useQuery({ queryKey: ['assessPhys', patientId], queryFn: () => api.assessments.listPhysical(patientId), enabled: !!patientId });
  const suppQ = useQuery({ queryKey: ['supp', patientId], queryFn: () => api.supplementation.list(patientId), enabled: !!patientId });
  const goalsQ = useQuery({ queryKey: ['goals', patientId], queryFn: () => api.goals.list(patientId), enabled: !!patientId });
  const interQ = useQuery({ queryKey: ['inter', patientId], queryFn: () => api.interactions.listByPatient(patientId), enabled: !!patientId });

  const p: any = patientQ.data ?? {};
  const nutri: any[] = Array.isArray(nutriQ.data) ? nutriQ.data : [];
  const phys: any[] = Array.isArray(physQ.data) ? physQ.data : [];
  const supps: any[] = Array.isArray(suppQ.data) ? suppQ.data : [];
  const goals: any[] = Array.isArray(goalsQ.data) ? goalsQ.data : [];
  const inters: any[] = Array.isArray(interQ.data) ? interQ.data : [];
  const assessments = [
    ...nutri.map((a) => ({ ...a, _type: 'Nutricional' })),
    ...phys.map((a) => ({ ...a, _type: 'Física' })),
  ].sort((a, b) => new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime());

  const quickBmi = (() => {
    const w = parseFloat(quickPhys.weightKg.replace(',', '.'));
    const h = parseFloat(quickPhys.heightCm.replace(',', '.'));
    return w > 0 && h > 0 ? Math.round((w / ((h / 100) ** 2)) * 10) / 10 : null;
  })();

  const handleSaveQuickPhysical = async () => {
    if (!quickPhys.weightKg || !quickPhys.heightCm) { toast.error('Informe ao menos peso e altura.'); return; }
    setSavingPhys(true);
    const t = toast.loading('Salvando avaliação física...');
    try {
      await api.assessments.createPhysical({
        patientId,
        weightKg: Number(quickPhys.weightKg),
        heightCm: Number(quickPhys.heightCm),
        bodyFatPct: quickPhys.bodyFatPct ? Number(quickPhys.bodyFatPct) : undefined,
        waistCm: quickPhys.waistCm ? Number(quickPhys.waistCm) : undefined,
      });
      toast.success('Avaliação física registrada', { id: t });
      setQuickPhys({ weightKg: '', heightCm: '', bodyFatPct: '', waistCm: '' });
      qc.invalidateQueries({ queryKey: ['assessPhys', patientId] });
    } catch (err: any) {
      toast.error(err?.message ?? 'Não foi possível salvar a avaliação.', { id: t });
    } finally {
      setSavingPhys(false);
    }
  };

  const handleAddSupplement = async () => {
    if (!suppForm.supplementName.trim()) { toast.error('Informe o nome do suplemento.'); return; }
    setSavingSupp(true);
    const t = toast.loading('Salvando suplemento...');
    try {
      await api.supplementation.create({
        patientId,
        supplementName: suppForm.supplementName.trim(),
        doseAmount: suppForm.doseAmount ? Number(suppForm.doseAmount) : undefined,
        doseUnit: suppForm.doseUnit || undefined,
        frequencyPerDay: suppForm.frequencyPerDay ? Number(suppForm.frequencyPerDay) : undefined,
        therapeuticGoal: suppForm.therapeuticGoal || undefined,
        isActive: true,
      });
      toast.success('Suplemento adicionado', { id: t });
      setSuppForm({ supplementName: '', doseAmount: '', doseUnit: 'mg', frequencyPerDay: '1', therapeuticGoal: '' });
      qc.invalidateQueries({ queryKey: ['supp', patientId] });
    } catch (err: any) {
      toast.error(err?.message ?? 'Erro ao salvar suplemento.', { id: t });
    } finally {
      setSavingSupp(false);
    }
  };

  const handleAddGoal = async () => {
    if (!goalForm.targetValue) { toast.error('Informe o valor alvo.'); return; }
    setSavingGoal(true);
    const t = toast.loading('Salvando meta...');
    try {
      await api.goals.create({
        patientId,
        goalType: goalForm.goalType,
        baselineValue: goalForm.baselineValue ? Number(goalForm.baselineValue) : undefined,
        targetValue: Number(goalForm.targetValue),
        targetUnit: goalForm.targetUnit || undefined,
      });
      toast.success('Meta criada', { id: t });
      setGoalForm({ goalType: 'hypertrophy', baselineValue: '', targetValue: '', targetUnit: 'kg' });
      qc.invalidateQueries({ queryKey: ['goals', patientId] });
    } catch (err: any) {
      toast.error(err?.message ?? 'Erro ao salvar meta.', { id: t });
    } finally {
      setSavingGoal(false);
    }
  };

  const patientName = p.name || p.internalCode || 'Paciente';
  const initials = patientName.split(' ').map((n: string) => n[0]).slice(0, 2).join('').toUpperCase();

  if (patientQ.isLoading) {
    return <div className="flex items-center justify-center min-h-[60vh]"><Loader2 className="h-8 w-8 animate-spin text-blue-600" /></div>;
  }
  if (patientQ.isError) {
    return (
      <div className="max-w-md mx-auto mt-16 text-center">
        <AlertCircle className="h-7 w-7 text-red-500 mx-auto mb-2" />
        <p className="text-sm font-medium text-red-800">Não foi possível carregar o paciente</p>
        <p className="text-xs text-gray-500 mt-1">{(patientQ.error as Error)?.message}</p>
        <Link href="/patients"><Button variant="outline" size="sm" className="mt-3">Voltar para pacientes</Button></Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-full">
      <PageHeader
        title={patientName}
        description={`${num(p.age) != null ? `${p.age} anos · ` : ''}${GENDER_LABEL[p.gender ?? 'not_informed']}`}
        breadcrumbs={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Pacientes', href: '/patients' },
          { label: patientName },
        ]}
        action={
          <div className="flex gap-2">
            <Link href={`/assessments/nutritional/new?patient=${patientId}`}>
              <Button variant="outline" size="sm" className="flex items-center gap-2"><FlaskConical className="h-4 w-4 text-green-600" /> Nutricional</Button>
            </Link>
            <Link href={`/assessments/physical/new?patient=${patientId}`}>
              <Button size="sm" className="flex items-center gap-2"><Dumbbell className="h-4 w-4" /> Física</Button>
            </Link>
          </div>
        }
      />

      <div className="px-4 py-5 sm:p-6 max-w-5xl mx-auto w-full flex-1">
        {/* Patient card */}
        <div className="flex items-center gap-4 mb-6 p-4 bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm">
          <div className="w-12 h-12 rounded-full bg-blue-600 flex items-center justify-center flex-shrink-0">
            <span className="text-white font-bold">{initials}</span>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-bold text-gray-900 dark:text-white">{patientName}</span>
              {p.internalCode && <Badge variant="outline" className="text-xs">{p.internalCode}</Badge>}
              <span className={`text-[10px] px-2 py-0.5 rounded-full ${p.isActive !== false ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-gray-50 text-gray-500 border border-gray-200'}`}>
                {p.isActive !== false ? 'Ativo' : 'Inativo'}
              </span>
            </div>
            <div className="flex gap-3 mt-1 text-xs text-gray-500 flex-wrap">
              <span className="flex items-center gap-1"><User className="h-3 w-3" />{GENDER_LABEL[p.gender ?? 'not_informed']}</span>
              <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />Cadastro: {fmtDate(p.createdAt)}</span>
              <span className="flex items-center gap-1"><FlaskConical className="h-3 w-3" />{assessments.length} avaliação(ões)</span>
            </div>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-6 bg-gray-100 dark:bg-gray-800 p-1 rounded-xl flex-wrap h-auto gap-1">
            {[
              { value: 'overview', label: 'Visão Geral', icon: Activity },
              { value: 'assessments', label: 'Avaliações', icon: FlaskConical },
              { value: 'supplements', label: 'Suplementação', icon: Pill },
              { value: 'interactions', label: 'Interações', icon: GitMerge },
              { value: 'goals', label: 'Metas', icon: Target },
            ].map((tab) => (
              <TabsTrigger key={tab.value} value={tab.value} className="flex items-center gap-1.5 text-xs rounded-lg">
                <tab.icon className="h-3.5 w-3.5" /><span className="hidden sm:inline">{tab.label}</span>
              </TabsTrigger>
            ))}
          </TabsList>

          {/* OVERVIEW */}
          <TabsContent value="overview" className="space-y-5">
            <EthicsDisclaimer />
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: 'Avaliações', value: assessments.length, color: 'text-purple-600', bg: 'bg-purple-50' },
                { label: 'Suplementos', value: supps.length, color: 'text-blue-600', bg: 'bg-blue-50' },
                { label: 'Metas', value: goals.length, color: 'text-green-600', bg: 'bg-green-50' },
                { label: 'Interações', value: inters.length, color: 'text-amber-600', bg: 'bg-amber-50' },
              ].map((s) => (
                <div key={s.label} className={`rounded-xl border px-4 py-3 ${s.bg}`}>
                  <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{s.label}</p>
                </div>
              ))}
            </div>

            {/* Avaliação física rápida */}
            <Card className="border-blue-200 dark:border-blue-900 bg-blue-50/30 dark:bg-blue-950/20">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2"><Activity className="h-4 w-4 text-blue-600" /> Avaliação Física Rápida</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {([['weightKg', 'Peso (kg)', '70.0'], ['heightCm', 'Altura (cm)', '170'], ['bodyFatPct', '% Gordura', '22.0'], ['waistCm', 'Cintura (cm)', '78']] as const).map(([k, lbl, ph]) => (
                    <div key={k}>
                      <label className="text-[11px] text-gray-500">{lbl}</label>
                      <Input type="number" step="0.1" value={(quickPhys as any)[k]} onChange={(e) => setQuickPhys((s) => ({ ...s, [k]: e.target.value }))} placeholder={ph} className="h-9 text-sm" />
                    </div>
                  ))}
                </div>
                <div className="flex items-center justify-between flex-wrap gap-2">
                  {quickBmi ? <span className="text-xs text-gray-600 dark:text-gray-300 flex items-center gap-1.5"><TrendingUp className="h-3.5 w-3.5 text-blue-600" /> IMC: <strong className="text-blue-700 dark:text-blue-400">{quickBmi}</strong></span> : <span className="text-[11px] text-gray-400">Informe peso e altura para o IMC.</span>}
                  <Button size="sm" disabled={savingPhys} className="h-8 text-xs flex items-center gap-1.5" onClick={handleSaveQuickPhysical}>
                    {savingPhys ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />} Registrar avaliação física
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ASSESSMENTS */}
          <TabsContent value="assessments" className="space-y-4">
            <EthicsDisclaimer />
            {(nutriQ.isLoading || physQ.isLoading) ? <Empty text="Carregando avaliações..." /> :
              assessments.length === 0 ? <Empty text="Nenhuma avaliação registrada. Use os botões Nutricional / Física acima." /> :
              assessments.map((a, i) => (
                <Card key={a.id ?? i} className="overflow-hidden">
                  <div className="flex items-center gap-3 px-5 py-3 bg-gray-50 dark:bg-gray-800 border-b dark:border-gray-700">
                    <FlaskConical className="h-4 w-4 text-blue-600" />
                    <span className="font-semibold text-sm text-gray-900 dark:text-white">{a._type}</span>
                    {a.isDraft && <span className="text-[10px] px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-800">Rascunho</span>}
                    <Badge variant="outline" className="text-xs ml-auto">{fmtDate(a.createdAt)}</Badge>
                  </div>
                  <CardContent className="pt-4 grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
                    {num(a.bmi) != null && <div><p className="text-xs text-gray-400">IMC</p><p className="font-bold">{a.bmi}</p></div>}
                    {num(a.tmb ?? a.bmr) != null && <div><p className="text-xs text-gray-400">TMB</p><p className="font-bold">{a.tmb ?? a.bmr} kcal</p></div>}
                    {num(a.get ?? a.tdee ?? a.caloricTarget) != null && <div><p className="text-xs text-gray-400">GET/Meta</p><p className="font-bold">{a.get ?? a.tdee ?? a.caloricTarget} kcal</p></div>}
                    {num(a.weightKg) != null && <div><p className="text-xs text-gray-400">Peso</p><p className="font-bold">{a.weightKg} kg</p></div>}
                    {num(a.bodyFatPct) != null && <div><p className="text-xs text-gray-400">% Gordura</p><p className="font-bold">{a.bodyFatPct}%</p></div>}
                  </CardContent>
                </Card>
              ))}
          </TabsContent>

          {/* SUPPLEMENTS */}
          <TabsContent value="supplements" className="space-y-3">
            <EthicsDisclaimer />
            <Card className="border-blue-200 dark:border-blue-900 bg-blue-50/30 dark:bg-blue-950/20">
              <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Pill className="h-4 w-4 text-blue-600" /> Adicionar suplemento</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
                  <div className="sm:col-span-5"><label className="text-[11px] text-gray-500">Suplemento</label>
                    <Input value={suppForm.supplementName} onChange={(e) => setSuppForm((s) => ({ ...s, supplementName: e.target.value }))} placeholder="Ex: Creatina monoidratada" className="h-9 text-sm" /></div>
                  <div className="sm:col-span-2"><label className="text-[11px] text-gray-500">Dose</label>
                    <Input type="number" step="0.1" value={suppForm.doseAmount} onChange={(e) => setSuppForm((s) => ({ ...s, doseAmount: e.target.value }))} placeholder="5" className="h-9 text-sm" /></div>
                  <div className="sm:col-span-2"><label className="text-[11px] text-gray-500">Unidade</label>
                    <Input value={suppForm.doseUnit} onChange={(e) => setSuppForm((s) => ({ ...s, doseUnit: e.target.value }))} placeholder="g" className="h-9 text-sm" /></div>
                  <div className="sm:col-span-3"><label className="text-[11px] text-gray-500">Vezes/dia</label>
                    <Input type="number" min={1} value={suppForm.frequencyPerDay} onChange={(e) => setSuppForm((s) => ({ ...s, frequencyPerDay: e.target.value }))} placeholder="1" className="h-9 text-sm" /></div>
                </div>
                <div className="flex justify-end">
                  <Button size="sm" disabled={savingSupp} onClick={handleAddSupplement} className="h-8 text-xs flex items-center gap-1.5">
                    {savingSupp ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />} Adicionar
                  </Button>
                </div>
              </CardContent>
            </Card>
            {suppQ.isLoading ? <Empty text="Carregando..." /> :
              supps.length === 0 ? <Empty text="Nenhuma suplementação ativa." /> :
              supps.map((s, i) => (
                <Card key={s.id ?? i}><CardContent className="py-3 px-4 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2"><Pill className="h-4 w-4 text-gray-400" />
                    <span className="font-semibold text-sm">{s.name ?? s.supplementName ?? 'Suplemento'}</span>
                    <span className="text-xs text-gray-500">{[s.dose, s.frequency].filter(Boolean).join(' · ')}</span>
                  </div>
                  <span className="text-[10px] text-gray-400">{fmtDate(s.createdAt)}</span>
                </CardContent></Card>
              ))}
          </TabsContent>

          {/* INTERACTIONS */}
          <TabsContent value="interactions" className="space-y-4">
            <EthicsDisclaimer />
            {interQ.isLoading ? <Empty text="Carregando..." /> :
              inters.length === 0 ? <Empty text="Nenhuma análise de interação registrada." /> :
              inters.map((it, i) => (
                <Card key={it.id ?? i}><CardContent className="py-3 px-4">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <span className="font-semibold text-sm">{it.title ?? it.summary ?? 'Análise de interações'}</span>
                    <span className="text-[10px] text-gray-400">{fmtDate(it.createdAt)}</span>
                  </div>
                </CardContent></Card>
              ))}
          </TabsContent>

          {/* GOALS */}
          <TabsContent value="goals" className="space-y-4">
            <EthicsDisclaimer />
            <Card className="border-blue-200 dark:border-blue-900 bg-blue-50/30 dark:bg-blue-950/20">
              <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Target className="h-4 w-4 text-blue-600" /> Nova meta</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
                  <div className="sm:col-span-5"><label className="text-[11px] text-gray-500">Tipo de meta</label>
                    <select value={goalForm.goalType} onChange={(e) => setGoalForm((s) => ({ ...s, goalType: e.target.value }))} className="w-full h-9 rounded-md border px-2 text-sm dark:bg-gray-800 dark:border-gray-700">
                      {GOAL_TYPES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                    </select></div>
                  <div className="sm:col-span-3"><label className="text-[11px] text-gray-500">Valor inicial</label>
                    <Input type="number" step="0.1" value={goalForm.baselineValue} onChange={(e) => setGoalForm((s) => ({ ...s, baselineValue: e.target.value }))} placeholder="43.2" className="h-9 text-sm" /></div>
                  <div className="sm:col-span-2"><label className="text-[11px] text-gray-500">Alvo</label>
                    <Input type="number" step="0.1" value={goalForm.targetValue} onChange={(e) => setGoalForm((s) => ({ ...s, targetValue: e.target.value }))} placeholder="47" className="h-9 text-sm" /></div>
                  <div className="sm:col-span-2"><label className="text-[11px] text-gray-500">Unidade</label>
                    <Input value={goalForm.targetUnit} onChange={(e) => setGoalForm((s) => ({ ...s, targetUnit: e.target.value }))} placeholder="kg" className="h-9 text-sm" /></div>
                </div>
                <div className="flex justify-end">
                  <Button size="sm" disabled={savingGoal} onClick={handleAddGoal} className="h-8 text-xs flex items-center gap-1.5">
                    {savingGoal ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />} Criar meta
                  </Button>
                </div>
              </CardContent>
            </Card>
            {goalsQ.isLoading ? <Empty text="Carregando..." /> :
              goals.length === 0 ? <Empty text="Nenhuma meta definida." /> :
              goals.map((g, i) => (
                <Card key={g.id ?? i}><CardContent className="py-4 px-5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2"><Target className="h-4 w-4 text-blue-600" />
                      <span className="font-semibold text-sm">{GOAL_LABEL[g.goalType] ?? g.goalType ?? 'Meta'}</span>
                    </div>
                    {num(g.targetValue) != null && <span className="text-xs text-gray-500">{num(g.baselineValue) != null ? `${g.baselineValue} → ` : 'Alvo: '}{g.targetValue} {g.targetUnit ?? ''}</span>}
                  </div>
                </CardContent></Card>
              ))}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
