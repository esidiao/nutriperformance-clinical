'use client';

import { useState, useMemo, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  ShieldAlert, Plus, FlaskConical, Coins, Brain, Loader2, AlertCircle, RefreshCw, X,
} from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import { api } from '@/lib/api-client';
import { toast } from 'sonner';

type LabStatus = 'normal' | 'low' | 'high' | 'borderline' | 'optimal';

// ── Definição de marcadores (espelha as faixas de referência do backend) ────────
interface MarkerDef {
  field: string;
  label: string;
  unit: string;
  reference: string;
  group: string;
  status: (v: number) => LabStatus;
}

const MARKERS: MarkerDef[] = [
  // Hematologia
  { field: 'hemoglobinGDl', label: 'Hemoglobina', unit: 'g/dL', reference: '12–17,5', group: 'Hematologia', status: (v) => (v < 12 ? 'low' : v > 17.5 ? 'high' : 'normal') },
  { field: 'hematocritPct', label: 'Hematócrito', unit: '%', reference: '35–52', group: 'Hematologia', status: (v) => (v < 35 ? 'low' : v > 52 ? 'high' : 'normal') },
  // Metabolismo do ferro
  { field: 'ferritinNgMl', label: 'Ferritina', unit: 'ng/mL', reference: '15–200', group: 'Ferro', status: (v) => (v < 15 ? 'low' : v > 200 ? 'high' : 'normal') },
  { field: 'serumIronUgDl', label: 'Ferro sérico', unit: 'µg/dL', reference: '60–170', group: 'Ferro', status: (v) => (v < 60 ? 'low' : v > 170 ? 'high' : 'normal') },
  { field: 'transferrinSaturationPct', label: 'Sat. transferrina', unit: '%', reference: '20–50', group: 'Ferro', status: (v) => (v < 20 ? 'low' : v > 50 ? 'high' : 'normal') },
  // Vitaminas
  { field: 'vitaminDNgMl', label: 'Vitamina D (25-OH)', unit: 'ng/mL', reference: '30–100', group: 'Vitaminas', status: (v) => (v < 20 ? 'low' : v > 100 ? 'high' : 'normal') },
  { field: 'vitaminB12PgMl', label: 'Vitamina B12', unit: 'pg/mL', reference: '200–900', group: 'Vitaminas', status: (v) => (v < 200 ? 'low' : v > 900 ? 'high' : 'normal') },
  { field: 'folicAcidNgMl', label: 'Ácido fólico', unit: 'ng/mL', reference: '3–17', group: 'Vitaminas', status: (v) => (v < 3 ? 'low' : v > 17 ? 'high' : 'normal') },
  // Minerais
  { field: 'zincUgDl', label: 'Zinco sérico', unit: 'µg/dL', reference: '70–120', group: 'Minerais', status: (v) => (v < 70 ? 'low' : v > 120 ? 'high' : 'normal') },
  { field: 'magnesiumMgDl', label: 'Magnésio', unit: 'mg/dL', reference: '1,7–2,4', group: 'Minerais', status: (v) => (v < 1.7 ? 'low' : v > 2.4 ? 'high' : 'normal') },
  // Glicemia
  { field: 'fastingGlucoseMgDl', label: 'Glicemia em jejum', unit: 'mg/dL', reference: '70–99', group: 'Glicemia', status: (v) => (v < 70 ? 'low' : v > 99 ? 'high' : 'normal') },
  { field: 'hba1cPct', label: 'HbA1c', unit: '%', reference: '< 5,7', group: 'Glicemia', status: (v) => (v >= 6.5 ? 'high' : v >= 5.7 ? 'borderline' : 'normal') },
  // Lipidograma
  { field: 'totalCholesterolMgDl', label: 'Colesterol total', unit: 'mg/dL', reference: '< 200', group: 'Lipidograma', status: (v) => (v >= 240 ? 'high' : v >= 200 ? 'borderline' : 'normal') },
  { field: 'hdlMgDl', label: 'HDL', unit: 'mg/dL', reference: '> 40', group: 'Lipidograma', status: (v) => (v < 40 ? 'low' : v > 60 ? 'optimal' : 'normal') },
  { field: 'ldlMgDl', label: 'LDL', unit: 'mg/dL', reference: '< 130', group: 'Lipidograma', status: (v) => (v >= 160 ? 'high' : v >= 130 ? 'borderline' : 'normal') },
  { field: 'triglyceridesMgDl', label: 'Triglicerídeos', unit: 'mg/dL', reference: '< 150', group: 'Lipidograma', status: (v) => (v >= 200 ? 'high' : v >= 150 ? 'borderline' : 'normal') },
  // Renal
  { field: 'creatinineMgDl', label: 'Creatinina', unit: 'mg/dL', reference: '0,5–1,3', group: 'Renal', status: (v) => (v > 1.3 ? 'high' : v < 0.5 ? 'low' : 'normal') },
  { field: 'egfrMlMin', label: 'TFGe', unit: 'mL/min', reference: '≥ 60', group: 'Renal', status: (v) => (v < 60 ? 'low' : 'normal') },
  // Hormônios
  { field: 'tshUuiMl', label: 'TSH', unit: 'µUI/mL', reference: '0,4–4,0', group: 'Hormônios', status: (v) => (v < 0.4 ? 'low' : v > 4.0 ? 'high' : 'normal') },
  // Inflamação
  { field: 'crpMgL', label: 'PCR', unit: 'mg/L', reference: '< 3,0', group: 'Inflamação', status: (v) => (v >= 10 ? 'high' : v >= 3.0 ? 'borderline' : 'normal') },
];

const STATUS_CONFIG: Record<LabStatus, { label: string; badge: string; dot: string }> = {
  normal:     { label: 'Normal',     badge: 'bg-green-100 text-green-800',   dot: 'bg-green-500' },
  optimal:    { label: 'Ótimo',      badge: 'bg-green-100 text-green-800',   dot: 'bg-green-600' },
  low:        { label: 'Baixo',      badge: 'bg-yellow-100 text-yellow-800', dot: 'bg-yellow-500' },
  high:       { label: 'Elevado',    badge: 'bg-orange-100 text-orange-800', dot: 'bg-orange-500' },
  borderline: { label: 'Limítrofe',  badge: 'bg-amber-100 text-amber-800',   dot: 'bg-amber-500' },
};

const GROUPS = MARKERS.map((m) => m.group).filter((g, i, arr) => arr.indexOf(g) === i);

interface ApiExam {
  id: string;
  collectionDate?: string;
  laboratoryName?: string;
  tokensConsumed?: number;
  [field: string]: unknown;
}

function fmtDate(iso?: string) {
  if (!iso) return '—';
  const d = new Date(iso);
  return isNaN(d.getTime()) ? '—' : d.toLocaleDateString('pt-BR');
}

function LaboratoryContent() {
  const searchParams = useSearchParams();
  const qc = useQueryClient();

  const [patientId, setPatientId] = useState<string>(searchParams.get('patient') ?? '');
  const [selectedExamId, setSelectedExamId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [interpretation, setInterpretation] = useState('');

  // AI analysis state
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [aiContext, setAiContext] = useState<string | null>(null);
  const [aiMeta, setAiMeta] = useState<{ confidence?: string; warnings?: string[]; tokensConsumed?: number } | null>(null);

  // Form state
  const [collectionDate, setCollectionDate] = useState('');
  const [labName, setLabName] = useState('');
  const [values, setValues] = useState<Record<string, string>>({});

  // ── Queries ───────────────────────────────────────────────────────────────
  const patientsQuery = useQuery({
    queryKey: ['patients', { page: 1, limit: 100 }],
    queryFn: () => api.patients.list({ page: 1, limit: 100 }),
  });
  const patients = patientsQuery.data?.items ?? [];

  const examsQuery = useQuery({
    queryKey: ['lab-exams', patientId],
    queryFn: () => api.laboratory.list(patientId),
    enabled: !!patientId,
  });
  const exams: ApiExam[] = examsQuery.data ?? [];

  // Suplementos ativos do paciente — usados como contexto real na análise de IA
  const supplementsQuery = useQuery({
    queryKey: ['supplementation', patientId],
    queryFn: () => api.supplementation.list(patientId),
    enabled: !!patientId,
  });
  const activeSupplements: string[] = useMemo(
    () => (supplementsQuery.data ?? [])
      .filter((s: any) => s.isActive !== false)
      .map((s: any) => s.supplementName)
      .filter((n: any): n is string => typeof n === 'string' && n.length > 0),
    [supplementsQuery.data],
  );

  const selectedExam = useMemo(
    () => exams.find((e) => e.id === selectedExamId) ?? exams[0] ?? null,
    [exams, selectedExamId],
  );

  // Carrega a interpretação salva ao selecionar/trocar de exame
  useEffect(() => {
    setInterpretation((selectedExam?.professionalInterpretation as string) ?? '');
  }, [selectedExam?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Marcadores presentes no exame selecionado
  const presentMarkers = useMemo(() => {
    if (!selectedExam) return [];
    return MARKERS.filter((m) => {
      const v = selectedExam[m.field];
      return v !== null && v !== undefined && v !== '';
    }).map((m) => {
      const value = Number(selectedExam[m.field]);
      return { ...m, value, statusValue: m.status(value) };
    });
  }, [selectedExam]);

  const altered = presentMarkers.filter((m) => m.statusValue !== 'normal' && m.statusValue !== 'optimal');

  // ── Create mutation ─────────────────────────────────────────────────────────
  const createMutation = useMutation({
    mutationFn: (dto: Record<string, unknown>) => api.laboratory.create(dto),
    onSuccess: (created: any) => {
      toast.success('Exame registrado com sucesso.');
      setShowForm(false);
      setValues({});
      setCollectionDate('');
      setLabName('');
      qc.invalidateQueries({ queryKey: ['lab-exams', patientId] });
      if (created?.id) setSelectedExamId(created.id);
    },
    onError: (err: any) => toast.error(err?.message ?? 'Erro ao registrar exame.'),
  });

  // ── Salvar interpretação profissional ───────────────────────────────────────
  const saveInterpMutation = useMutation({
    mutationFn: () => api.laboratory.update(selectedExam!.id, { professionalInterpretation: interpretation }),
    onSuccess: () => {
      toast.success('Interpretação salva.');
      qc.invalidateQueries({ queryKey: ['lab-exams', patientId] });
    },
    onError: (err: any) => toast.error(err?.message ?? 'Erro ao salvar interpretação.'),
  });

  const interpretationDirty =
    interpretation.trim() !== ((selectedExam?.professionalInterpretation as string) ?? '').trim();

  const handleSubmit = () => {
    if (!patientId) { toast.error('Selecione um paciente.'); return; }
    if (!collectionDate) { toast.error('Informe a data da coleta.'); return; }

    const numericFields: Record<string, number> = {};
    let filled = 0;
    for (const m of MARKERS) {
      const raw = values[m.field];
      if (raw !== undefined && raw !== '') {
        const n = Number(raw.replace(',', '.'));
        if (!isNaN(n)) { numericFields[m.field] = n; filled++; }
      }
    }
    if (filled === 0) { toast.error('Preencha ao menos um marcador.'); return; }

    createMutation.mutate({
      patientId,
      collectionDate,
      laboratoryName: labName || undefined,
      ...numericFields,
    });
  };

  // ── Analyze ──────────────────────────────────────────────────────────────────
  const handleAnalyze = async () => {
    if (!selectedExam) return;
    setIsAnalyzing(true);
    setAiContext(null);
    try {
      const result: any = await api.laboratory.analyze(selectedExam.id, activeSupplements);
      setAiContext(result.analysis?.content ?? 'Análise concluída.');
      setAiMeta({
        confidence: result.analysis?.confidenceLevel,
        warnings: result.analysis?.warnings,
        tokensConsumed: result.tokensConsumed,
      });
      qc.invalidateQueries({ queryKey: ['lab-exams', patientId] });
    } catch (err: any) {
      toast.error(err?.message ?? 'Não foi possível analisar o exame.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const selectedPatient = patients.find((p: any) => p.id === patientId);

  return (
    <div className="flex flex-col min-h-full">
      <PageHeader
        title="Exames Laboratoriais"
        description="Contexto nutricional dos exames — não substitui interpretação médica"
        breadcrumbs={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Exames' }]}
        action={
          patientId ? (
            <Button size="sm" onClick={() => setShowForm((v) => !v)} className="flex items-center gap-2">
              {showForm ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
              {showForm ? 'Cancelar' : 'Registrar exame'}
            </Button>
          ) : null
        }
      />
      <div className="px-4 py-5 sm:p-6 max-w-4xl mx-auto space-y-5 flex-1 w-full">

        <Alert className="border-blue-200 bg-blue-50">
          <ShieldAlert className="h-4 w-4 text-blue-600" />
          <AlertDescription className="text-blue-800 text-xs leading-relaxed">
            <strong>Interpretação diagnóstica de exames é atribuição exclusiva do médico.</strong>{' '}
            Este módulo analisa os resultados sob perspectiva nutricional e de suplementação. Não emite diagnóstico clínico.
            Conforme CFM, CFN e CONFEF.
          </AlertDescription>
        </Alert>

        {/* Seletor de paciente */}
        <Card>
          <CardContent className="py-4">
            <Label htmlFor="lab-patient-select" className="text-xs text-gray-600 font-semibold">Paciente</Label>
            {patientsQuery.isLoading ? (
              <div role="status" className="flex items-center gap-2 mt-2 text-sm text-gray-400">
                <Loader2 className="h-4 w-4 animate-spin" /> Carregando pacientes...
              </div>
            ) : (
              <select
                id="lab-patient-select"
                aria-label="Selecionar paciente"
                value={patientId}
                onChange={(e) => { setPatientId(e.target.value); setSelectedExamId(null); setAiContext(null); }}
                className="mt-1 w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Selecione um paciente…</option>
                {patients.map((p: any) => (
                  <option key={p.id} value={p.id}>{p.name || p.internalCode || p.id}</option>
                ))}
              </select>
            )}
          </CardContent>
        </Card>

        {!patientId && (
          <div className="text-center py-12 text-gray-400">
            <FlaskConical className="h-10 w-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm">Selecione um paciente para ver e registrar exames.</p>
          </div>
        )}

        {/* Formulário de novo exame */}
        {patientId && showForm && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Registrar novo exame</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Data da coleta *</Label>
                  <Input type="date" value={collectionDate} onChange={(e) => setCollectionDate(e.target.value)} className="mt-1" />
                </div>
                <div>
                  <Label className="text-xs">Laboratório</Label>
                  <Input value={labName} onChange={(e) => setLabName(e.target.value)} placeholder="Ex.: Laboratório Central" className="mt-1" />
                </div>
              </div>

              {GROUPS.map((group) => (
                <div key={group}>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">{group}</p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {MARKERS.filter((m) => m.group === group).map((m) => (
                      <div key={m.field}>
                        <Label className="text-[11px] text-gray-500">{m.label} <span className="text-gray-300">({m.unit})</span></Label>
                        <Input
                          inputMode="decimal"
                          value={values[m.field] ?? ''}
                          onChange={(e) => setValues((prev) => ({ ...prev, [m.field]: e.target.value }))}
                          placeholder={m.reference}
                          className="mt-0.5 h-8 text-sm"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              ))}

              <p className="text-xs text-gray-400">Preencha apenas os marcadores disponíveis. Campos vazios são ignorados.</p>
              <div className="flex justify-end gap-2">
                <Button variant="outline" size="sm" onClick={() => setShowForm(false)}>Cancelar</Button>
                <Button size="sm" onClick={handleSubmit} disabled={createMutation.isPending}>
                  {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Salvar exame'}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Estados de exames */}
        {patientId && !showForm && examsQuery.isLoading && (
          <div className="flex flex-col items-center justify-center py-12 text-gray-400">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600 mb-3" />
            <p className="text-sm">Carregando exames...</p>
          </div>
        )}

        {patientId && !showForm && examsQuery.isError && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-5 text-center">
            <AlertCircle className="h-6 w-6 text-red-500 mx-auto mb-2" />
            <p className="text-sm font-medium text-red-800">Não foi possível carregar os exames</p>
            <Button variant="outline" size="sm" className="mt-3" onClick={() => examsQuery.refetch()}>
              <RefreshCw className="h-3.5 w-3.5 mr-1.5" /> Tentar novamente
            </Button>
          </div>
        )}

        {patientId && !showForm && !examsQuery.isLoading && !examsQuery.isError && exams.length === 0 && (
          <div className="text-center py-12 text-gray-400">
            <FlaskConical className="h-10 w-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm">Nenhum exame registrado para {selectedPatient?.name ?? 'este paciente'}.</p>
            <Button size="sm" className="mt-3" onClick={() => setShowForm(true)}>
              <Plus className="h-4 w-4 mr-1.5" /> Registrar primeiro exame
            </Button>
          </div>
        )}

        {/* Seletor de exame + tabela */}
        {patientId && !showForm && selectedExam && (
          <>
            {exams.length > 1 && (
              <div className="flex gap-2 flex-wrap">
                {exams.map((e) => (
                  <button
                    key={e.id}
                    onClick={() => { setSelectedExamId(e.id); setAiContext(null); }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                      selectedExam.id === e.id ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    {fmtDate(e.collectionDate)}
                  </button>
                ))}
              </div>
            )}

            <Card>
              <CardHeader className="pb-3 flex flex-row items-start justify-between">
                <div>
                  <CardTitle className="text-base flex items-center gap-2">
                    <FlaskConical className="h-4 w-4 text-blue-600" />
                    Exame de {fmtDate(selectedExam.collectionDate)}
                    {selectedExam.laboratoryName && (
                      <span className="text-xs text-gray-400 font-normal">— {selectedExam.laboratoryName}</span>
                    )}
                  </CardTitle>
                  <div className="flex gap-3 mt-1 text-xs text-gray-500">
                    <span>{presentMarkers.length} marcadores</span>
                    {altered.length > 0 && <span className="text-yellow-700 font-medium">{altered.length} alterados</span>}
                  </div>
                </div>
                <Button size="sm" variant="outline" onClick={handleAnalyze} disabled={isAnalyzing} className="flex items-center gap-1 text-xs">
                  {isAnalyzing ? (
                    <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Analisando…</>
                  ) : (
                    <><Brain className="h-3.5 w-3.5" /> Contexto nutricional
                      <span className="text-gray-400 ml-1 flex items-center gap-0.5">(10 <Coins className="h-2.5 w-2.5" />)</span>
                    </>
                  )}
                </Button>
              </CardHeader>

              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-gray-50">
                        <th className="text-left py-2 px-3 font-medium text-gray-600 text-xs">Marcador</th>
                        <th className="text-right py-2 px-3 font-medium text-gray-600 text-xs">Valor</th>
                        <th className="text-center py-2 px-3 font-medium text-gray-600 text-xs">Referência</th>
                        <th className="text-center py-2 px-3 font-medium text-gray-600 text-xs">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {presentMarkers.map((m) => {
                        const cfg = STATUS_CONFIG[m.statusValue];
                        return (
                          <tr key={m.field} className={m.statusValue !== 'normal' && m.statusValue !== 'optimal' ? 'bg-yellow-50/30' : ''}>
                            <td className="py-2.5 px-3">
                              <div className="flex items-center gap-2">
                                <span className={`w-2 h-2 rounded-full flex-shrink-0 ${cfg.dot}`} />
                                <span className="font-medium text-gray-800">{m.label}</span>
                              </div>
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono font-semibold text-gray-900">{m.value} {m.unit}</td>
                            <td className="py-2.5 px-3 text-center text-xs text-gray-500">{m.reference}</td>
                            <td className="py-2.5 px-3 text-center">
                              <Badge variant="outline" className={`text-xs ${cfg.badge}`}>{cfg.label}</Badge>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <div className="mt-4 pt-4 border-t">
                  <Label className="text-xs text-gray-600 font-semibold uppercase tracking-wide">
                    Interpretação do Profissional
                  </Label>
                  <textarea
                    value={interpretation}
                    onChange={(e) => setInterpretation(e.target.value)}
                    rows={3}
                    placeholder="Registre aqui a interpretação nutricional do profissional responsável..."
                    className="mt-1 w-full rounded-md border px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <div className="flex items-center justify-between mt-1">
                    <p className="text-xs text-gray-400 italic">Campo exclusivo do nutricionista. Não constitui diagnóstico médico.</p>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => saveInterpMutation.mutate()}
                      disabled={!interpretationDirty || saveInterpMutation.isPending}
                      className="flex items-center gap-1.5 text-xs flex-shrink-0"
                    >
                      {saveInterpMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Salvar interpretação'}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Análise de IA */}
            {aiContext && (
              <Card className="border-blue-200 bg-blue-50">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-blue-800 flex items-center gap-2">
                    <Brain className="h-4 w-4" />
                    Contexto Nutricional — Análise de Apoio (IA)
                    {aiMeta?.tokensConsumed !== undefined && (
                      <span className="ml-auto text-xs font-normal text-gray-400 flex items-center gap-0.5">
                        {aiMeta.tokensConsumed} <Coins className="h-2.5 w-2.5" />
                      </span>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <pre className="text-xs text-blue-900 whitespace-pre-wrap leading-relaxed">{aiContext}</pre>
                  {aiMeta?.warnings && aiMeta.warnings.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-blue-200">
                      <p className="text-xs font-semibold text-amber-700 mb-1">Avisos:</p>
                      <ul className="space-y-0.5">
                        {aiMeta.warnings.map((w, i) => <li key={i} className="text-xs text-amber-800">• {w}</li>)}
                      </ul>
                    </div>
                  )}
                  <p className="text-xs text-gray-500 italic mt-3 pt-3 border-t border-blue-200">
                    Confiança: {aiMeta?.confidence ?? 'Moderada'} · Requer validação profissional.
                    Diagnóstico e conduta médica são exclusividade do médico responsável.
                  </p>
                </CardContent>
              </Card>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default function LaboratoryPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-gray-400 text-sm">Carregando…</div>}>
      <LaboratoryContent />
    </Suspense>
  );
}
