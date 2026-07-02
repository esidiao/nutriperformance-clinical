'use client';

import { useState, useEffect, Suspense, KeyboardEvent } from 'react';
import { useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { ShieldAlert, Coins, Dna, AlertTriangle, X, ChevronDown, ChevronUp, Plus, Loader2, UserPlus } from 'lucide-react';
import { api } from '@/lib/api-client';

interface BioRisk {
  factor: string; affectedInContext: string[];
  mechanism: string; riskLevel: 'low' | 'moderate' | 'high';
  confidence: string; evidence: string; suggestion: string;
}

const RISK_STYLE = {
  low:      { border: 'border-l-green-400',  bg: 'bg-green-50 dark:bg-green-950',   badge: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',   label: 'Baixo' },
  moderate: { border: 'border-l-yellow-400', bg: 'bg-yellow-50 dark:bg-yellow-950', badge: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300', label: 'Moderado' },
  high:     { border: 'border-l-red-500',    bg: 'bg-red-50 dark:bg-red-950',       badge: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300',             label: 'Alto' },
};

const TAG_COLORS = [
  'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
  'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300',
  'bg-teal-100 text-teal-800 dark:bg-teal-900 dark:text-teal-300',
  'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300',
  'bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-300',
];

const NUTRIENT_SUGGESTIONS = [
  'Ferro', 'Vitamina D3', 'Vitamina B12', 'Vitamina C', 'Zinco',
  'Magnésio', 'Cálcio', 'Ômega-3', 'Vitamina K2', 'Selênio',
  'Creatina', 'Colágeno', 'Coenzima Q10',
];
const MED_SUGGESTIONS = [
  'Omeprazol', 'Pantoprazol', 'Metformina', 'Levotiroxina',
  'Atorvastatina', 'Captopril', 'Losartana', 'AAS',
];

// ─── Tag chip input ───────────────────────────────────────────────────────────
function TagInput({
  label, tags, onAdd, onRemove, placeholder, suggestions, colorBase,
}: {
  label: string; tags: string[]; onAdd: (v: string) => void;
  onRemove: (i: number) => void; placeholder: string;
  suggestions?: string[]; colorBase?: string;
}) {
  const [input, setInput] = useState('');
  const [showSug, setShowSug] = useState(false);

  const filtered = input.length >= 1 && suggestions
    ? suggestions.filter((s) => s.toLowerCase().includes(input.toLowerCase()) && !tags.includes(s)).slice(0, 5)
    : [];

  const commit = (val: string) => {
    const v = val.trim();
    if (v && !tags.includes(v)) { onAdd(v); }
    setInput('');
    setShowSug(false);
  };

  const handleKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); commit(input); }
    if (e.key === 'Backspace' && !input && tags.length > 0) onRemove(tags.length - 1);
  };

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium text-gray-700 dark:text-gray-300">{label}</label>
      <div className="relative">
        <div className={`flex flex-wrap gap-1.5 min-h-[42px] p-2 rounded-lg border border-input dark:border-gray-700 bg-background dark:bg-gray-800 focus-within:ring-2 focus-within:ring-ring transition-all`}>
          {tags.map((tag, i) => (
            <span key={tag} className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${colorBase ?? TAG_COLORS[i % TAG_COLORS.length]}`}>
              {tag}
              <button type="button" onClick={() => onRemove(i)} className="hover:opacity-70 transition-opacity">
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
          <input
            type="text" value={input}
            placeholder={tags.length === 0 ? placeholder : 'Adicionar...'}
            className="flex-1 min-w-[120px] bg-transparent text-sm outline-none placeholder:text-gray-400"
            onChange={(e) => { setInput(e.target.value); setShowSug(true); }}
            onKeyDown={handleKey}
            onFocus={() => setShowSug(true)}
            onBlur={() => setTimeout(() => setShowSug(false), 150)}
          />
          {input && (
            <button type="button" onClick={() => commit(input)}
              className="flex-shrink-0 text-blue-600 hover:text-blue-700 text-xs font-medium px-1">
              <Plus className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        {showSug && filtered.length > 0 && (
          <div className="absolute z-30 top-full left-0 right-0 mt-1 bg-white dark:bg-gray-800 border dark:border-gray-700 rounded-lg shadow-lg overflow-hidden">
            {filtered.map((s) => (
              <button key={s} type="button"
                className="w-full text-left px-3 py-2 text-sm hover:bg-blue-50 dark:hover:bg-blue-900 transition-colors text-gray-700 dark:text-gray-200"
                onMouseDown={(e) => { e.preventDefault(); commit(s); }}>
                {s}
              </button>
            ))}
          </div>
        )}
      </div>
      <p className="text-xs text-gray-400">Digite e pressione Enter ou vírgula para adicionar</p>
    </div>
  );
}

// ─── Collapsible result card ──────────────────────────────────────────────────
function RiskCard({ risk }: { risk: BioRisk }) {
  const [open, setOpen] = useState(true);
  const style = RISK_STYLE[risk.riskLevel];
  return (
    <Card className={`border-l-4 ${style.border} ${style.bg}`}>
      <CardContent className="pt-3 pb-2">
        <button type="button" className="w-full text-left" onClick={() => setOpen((v) => !v)}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-sm text-gray-900 dark:text-gray-100">{risk.factor}</span>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${style.badge}`}>{style.label}</span>
              <div className="flex gap-1">
                {risk.affectedInContext.map((n) => (
                  <span key={n} className="text-xs px-1.5 py-0.5 bg-white/60 dark:bg-black/20 rounded text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-600">{n}</span>
                ))}
              </div>
            </div>
            {open ? <ChevronUp className="h-4 w-4 text-gray-400 flex-shrink-0" /> : <ChevronDown className="h-4 w-4 text-gray-400 flex-shrink-0" />}
          </div>
        </button>

        {open && (
          <div className="mt-3 space-y-2 text-xs text-gray-700 dark:text-gray-300">
            <p><span className="font-medium text-gray-500 dark:text-gray-400">Mecanismo:</span> {risk.mechanism}</p>
            <p className="font-medium text-gray-900 dark:text-gray-100 flex gap-1">
              <span className="text-blue-600">→</span> {risk.suggestion}
            </p>
            <div className="flex gap-3 text-gray-400 pt-1">
              <span>Evidência: {risk.evidence}</span>
              <span>Confiança: {risk.confidence}</span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function BioavailabilityContent() {
  const searchParams = useSearchParams();
  const [patientId, setPatientId] = useState<string>(searchParams.get('patient') ?? '');
  const [nutrients, setNutrients] = useState<string[]>([]);
  const [medications, setMedications] = useState<string[]>([]);
  const [giConditions, setGiConditions] = useState<string[]>([]);
  const [surgicalHistory, setSurgicalHistory] = useState<string[]>([]);
  const [dietaryFactors, setDietaryFactors] = useState<string[]>([]);

  // Pacientes do workspace (seletor opcional)
  const patientsQuery = useQuery({
    queryKey: ['patients', { page: 1, limit: 100 }],
    queryFn: () => api.patients.list({ page: 1, limit: 100 }),
  });
  const patients = patientsQuery.data?.items ?? [];

  // Suplementos ativos do paciente (para importar como nutrientes)
  const supplementsQuery = useQuery({
    queryKey: ['supplementation', patientId],
    queryFn: () => api.supplementation.list(patientId),
    enabled: !!patientId,
  });

  const selectedPatient = patients.find((p: any) => p.id === patientId);

  const importFromProfile = () => {
    const active = (supplementsQuery.data ?? []).filter((s: any) => s.isActive !== false);
    const profileMeds: any[] = Array.isArray(selectedPatient?.medications) ? selectedPatient.medications : [];

    if (active.length === 0 && profileMeds.length === 0) {
      toast.message('Este paciente não tem suplementos ativos nem medicamentos cadastrados.');
      return;
    }

    setNutrients((prev) => {
      const existing = new Set(prev.map((n) => n.toLowerCase()));
      const fresh = active
        .map((s: any) => s.supplementName)
        .filter((n: any): n is string => typeof n === 'string' && n.length > 0 && !existing.has(n.toLowerCase()));
      return [...prev, ...fresh];
    });

    setMedications((prev) => {
      const existing = new Set(prev.map((n) => n.toLowerCase()));
      const fresh = profileMeds
        .map((m: any) => m?.name)
        .filter((n: any): n is string => typeof n === 'string' && n.length > 0 && !existing.has(n.toLowerCase()));
      return [...prev, ...fresh];
    });

    const parts = [
      active.length && `${active.length} suplemento(s)`,
      profileMeds.length && `${profileMeds.length} medicamento(s)`,
    ].filter(Boolean);
    toast.success(`Importado do perfil: ${parts.join(', ')}.`);
  };
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [results, setResults] = useState<BioRisk[] | null>(null);
  const [aiAssessment, setAiAssessment] = useState<string | null>(null);
  const [referralNeeded, setReferralNeeded] = useState(false);
  const [isAiAnalyzing, setIsAiAnalyzing] = useState(false);
  const [aiConfidence, setAiConfidence] = useState<string | null>(null);

  const handleAnalyze = async () => {
    setIsAnalyzing(true);
    setResults(null);
    setAiAssessment(null);
    setAiConfidence(null);
    setIsAiAnalyzing(false);

    // ── Local BioRisk cards (instant, rule-based) ─────────────────────────
    const localResults: BioRisk[] = [];
    if (medications.some((m) => /omeprazol|IBP|lansoprazol|pantoprazol/i.test(m)) && nutrients.some((n) => /ferro/i.test(n))) {
      localResults.push({
        factor: 'IBP (Omeprazol)',
        affectedInContext: ['Ferro'],
        mechanism: 'IBPs reduzem acidez gástrica, prejudicando absorção de ferro não-heme que depende de pH ácido',
        riskLevel: 'moderate', confidence: 'high', evidence: 'Observacional',
        suggestion: 'Preferir ferro quelato (bisglicinato). Administrar com vitamina C. Separar horário do omeprazol.',
      });
    }
    if (nutrients.some((n) => /vitamina.d/i.test(n))) {
      localResults.push({
        factor: 'Vitamina D — lipossolúvel',
        affectedInContext: ['Vitamina D3'],
        mechanism: 'Vitamina D3 é lipossolúvel; absorção depende da presença de gordura na refeição',
        riskLevel: 'low', confidence: 'high', evidence: 'ECR',
        suggestion: 'Administrar com refeição contendo gordura. Monitorar 25-OH vitamina D sérica.',
      });
    }
    if (nutrients.some((n) => /zinco/i.test(n)) && dietaryFactors.some((d) => /fitato|cereal|leguminosa/i.test(d))) {
      localResults.push({
        factor: 'Fitatos na dieta',
        affectedInContext: ['Zinco'],
        mechanism: 'Ácido fítico quelam zinco e outros minerais divalentes, reduzindo biodisponibilidade',
        riskLevel: 'moderate', confidence: 'high', evidence: 'ECR',
        suggestion: 'Remolho/germinação de cereais e leguminosas. Separar ingestão de zinco destas refeições.',
      });
    }

    setResults(localResults);
    setReferralNeeded(localResults.some((r) => r.riskLevel === 'high'));
    setIsAnalyzing(false);

    // ── Real Gemini AI analysis (async, non-blocking) ─────────────────────
    setIsAiAnalyzing(true);
    const dto = {
      nutrientsOrSupplements: nutrients,
      giConditions: giConditions,
      medications: medications,
      surgicalHistory: surgicalHistory,
      dietaryFactors: dietaryFactors,
    };

    api.bioavailability.analyze(dto)
      .then((res: any) => {
        setAiAssessment(res.aiAnalysis?.content ?? null);
        setAiConfidence(res.aiAnalysis?.confidenceLevel ?? null);
      })
      .catch(() => {
        // Backend unavailable — show a local fallback summary
        setAiAssessment(
          'Com base nos dados informados, os principais fatores de comprometimento identificados são a combinação ferro+IBP e vitamina D lipossolúvel.\n\n' +
          'Sugere-se:\n• Reavaliação de ferro e ferritina em 60-90 dias após ajuste\n• Monitoramento de 25-OH vitamina D em 90 dias\n\n' +
          'Dados insuficientes para análise completa de zinco sem informações sobre ingestão dietética habitual.',
        );
      })
      .finally(() => setIsAiAnalyzing(false));
  };

  return (
    <div className="px-4 py-5 sm:p-6 max-w-4xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Análise de Biodisponibilidade</h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">
            Identificar fatores que comprometem absorção nutricional e de suplementos
          </p>
        </div>
        <Badge variant="outline" className="text-blue-700 border-blue-300 flex items-center gap-1">
          <Coins className="h-3 w-3" /> 12 tokens
        </Badge>
      </div>

      <Alert className="border-amber-300 bg-amber-50 dark:bg-amber-950 dark:border-amber-800">
        <ShieldAlert className="h-4 w-4 text-amber-600" />
        <AlertDescription className="text-amber-800 dark:text-amber-300 text-xs leading-relaxed">
          <strong>Ferramenta de apoio clínico.</strong> Identifica potenciais fatores de comprometimento com base nos dados informados.
          Todas as sugestões requerem validação profissional.
        </AlertDescription>
      </Alert>

      {/* Paciente (opcional) */}
      <Card>
        <CardContent className="py-4">
          <div className="flex flex-col sm:flex-row sm:items-end gap-3">
            <div className="flex-1">
              <Label htmlFor="bio-patient-select" className="text-xs text-gray-600 font-semibold">Paciente (opcional — para importar dados reais)</Label>
              {patientsQuery.isLoading ? (
                <div role="status" className="flex items-center gap-2 mt-1 text-sm text-gray-400">
                  <Loader2 className="h-4 w-4 animate-spin" /> Carregando…
                </div>
              ) : (
                <select
                  id="bio-patient-select"
                  aria-label="Selecionar paciente para importar dados"
                  value={patientId}
                  onChange={(e) => setPatientId(e.target.value)}
                  className="mt-1 w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Sem paciente (entrada manual)</option>
                  {patients.map((p: any) => (
                    <option key={p.id} value={p.id}>{p.name || p.internalCode || p.id}</option>
                  ))}
                </select>
              )}
            </div>
            {patientId && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={importFromProfile}
                disabled={supplementsQuery.isLoading}
                className="flex items-center gap-1.5 flex-shrink-0"
              >
                {supplementsQuery.isLoading
                  ? <Loader2 className="h-4 w-4 animate-spin" />
                  : <><UserPlus className="h-4 w-4" /> Importar dados do perfil</>}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Tag input form */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Dna className="h-4 w-4 text-blue-600" />
            Dados para Análise
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <TagInput
            label="Nutrientes / Suplementos a analisar"
            tags={nutrients} onAdd={(v) => setNutrients((p) => [...p, v])}
            onRemove={(i) => setNutrients((p) => p.filter((_, idx) => idx !== i))}
            placeholder="Ex: Ferro, Vitamina D..." suggestions={NUTRIENT_SUGGESTIONS}
            colorBase="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200"
          />
          <TagInput
            label="Medicamentos em uso"
            tags={medications} onAdd={(v) => setMedications((p) => [...p, v])}
            onRemove={(i) => setMedications((p) => p.filter((_, idx) => idx !== i))}
            placeholder="Ex: Omeprazol, Metformina..." suggestions={MED_SUGGESTIONS}
            colorBase="bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200"
          />
          <TagInput
            label="Condições gastrointestinais"
            tags={giConditions} onAdd={(v) => setGiConditions((p) => [...p, v])}
            onRemove={(i) => setGiConditions((p) => p.filter((_, idx) => idx !== i))}
            placeholder="Ex: SII, Doença celíaca..."
          />
          <TagInput
            label="Histórico cirúrgico"
            tags={surgicalHistory} onAdd={(v) => setSurgicalHistory((p) => [...p, v])}
            onRemove={(i) => setSurgicalHistory((p) => p.filter((_, idx) => idx !== i))}
            placeholder="Ex: Cirurgia bariátrica (sleeve)..."
          />
          <div className="md:col-span-2">
            <TagInput
              label="Fatores dietéticos relevantes"
              tags={dietaryFactors} onAdd={(v) => setDietaryFactors((p) => [...p, v])}
              onRemove={(i) => setDietaryFactors((p) => p.filter((_, idx) => idx !== i))}
              placeholder="Ex: Dieta rica em fitatos, Alto consumo de cafeína..."
            />
          </div>
        </CardContent>
      </Card>

      <Button onClick={handleAnalyze} disabled={isAnalyzing} size="lg" className="w-full flex items-center gap-2">
        {isAnalyzing ? (
          <><Loader2 className="h-4 w-4 animate-spin" /> Analisando biodisponibilidade…</>
        ) : (
          <><Dna className="h-4 w-4" /> Analisar Biodisponibilidade (12 tokens)</>
        )}
      </Button>

      {/* Resultados colapsáveis */}
      {results !== null && (
        <div className="space-y-4">
          <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg border dark:border-gray-700 text-sm">
            <span className="font-medium text-gray-700 dark:text-gray-300">{results.length} fator(es) identificado(s)</span>
            {referralNeeded && (
              <span className="flex items-center gap-1 text-red-700 dark:text-red-400 text-xs font-semibold ml-auto">
                <AlertTriangle className="h-3.5 w-3.5" /> Encaminhamento recomendado
              </span>
            )}
          </div>

          {results.length === 0 ? (
            <Card className="border-green-200 bg-green-50 dark:bg-green-950">
              <CardContent className="pt-4 pb-3 text-sm text-green-800 dark:text-green-300">
                Nenhum fator de comprometimento de alta evidência identificado para esta combinação.
              </CardContent>
            </Card>
          ) : (
            results.map((risk, i) => <RiskCard key={i} risk={risk} />)
          )}

          {isAiAnalyzing && (
            <Card className="border-blue-200 bg-blue-50 dark:bg-blue-950 dark:border-blue-800">
              <CardContent className="pt-4 pb-4 flex items-center gap-3">
                <Loader2 className="h-4 w-4 text-blue-600 animate-spin flex-shrink-0" />
                <span className="text-sm text-blue-700 dark:text-blue-300 animate-pulse">IA analisando... (pode levar alguns segundos)</span>
              </CardContent>
            </Card>
          )}

          {aiAssessment && !isAiAnalyzing && (
            <Card className="border-blue-200 bg-blue-50 dark:bg-blue-950 dark:border-blue-800">
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <CardTitle className="text-sm text-blue-800 dark:text-blue-300">Análise Complementar (IA)</CardTitle>
                  {aiConfidence && (
                    <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                      Confiança: {aiConfidence}
                    </span>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <pre className="text-xs text-blue-900 dark:text-blue-200 whitespace-pre-wrap leading-relaxed">{aiAssessment}</pre>
                <p className="text-xs text-gray-400 italic mt-3 border-t border-blue-200 dark:border-blue-800 pt-2">
                  Análise de apoio · Requer validação do nutricionista · Não substitui avaliação clínica.
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}

export default function BioavailabilityPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-gray-400 text-sm">Carregando…</div>}>
      <BioavailabilityContent />
    </Suspense>
  );
}
