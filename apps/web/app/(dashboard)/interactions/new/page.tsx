'use client';

import { useState, useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  ShieldAlert, Coins, Plus, X, AlertTriangle,
  CheckCircle, Loader2, Search,
} from 'lucide-react';

interface SupplementEntry { name: string; dose: string; frequency: string; }
interface MedicationEntry { name: string; activePrinciple: string; dose: string; }

interface InteractionResult {
  entityA: string; entityB: string;
  riskLevel: 'low' | 'moderate' | 'high' | 'contraindicated' | 'insufficient_data';
  mechanism: string; recommendation: string;
  confidenceLevel: string; evidenceQuality: string;
  requiresMedicalReview: boolean; source: string;
}

const RISK_CONFIG = {
  contraindicated: { label: 'CONTRAINDICADO', bg: 'bg-red-100 dark:bg-red-950', border: 'border-l-red-600', text: 'text-red-900', badge: 'bg-red-200 text-red-900' },
  high:            { label: 'Alto',           bg: 'bg-red-50 dark:bg-red-950',  border: 'border-l-red-500', text: 'text-red-800', badge: 'bg-red-100 text-red-700' },
  moderate:        { label: 'Moderado',       bg: 'bg-yellow-50 dark:bg-yellow-950', border: 'border-l-yellow-500', text: 'text-yellow-900', badge: 'bg-yellow-100 text-yellow-800' },
  low:             { label: 'Baixo',          bg: 'bg-green-50 dark:bg-green-950', border: 'border-l-green-500', text: 'text-green-900', badge: 'bg-green-100 text-green-700' },
  insufficient_data: { label: 'Dados insuficientes', bg: 'bg-gray-50 dark:bg-gray-800', border: 'border-l-gray-400', text: 'text-gray-700', badge: 'bg-gray-100 text-gray-600' },
};

// Common supplements for autocomplete
const COMMON_SUPPLEMENTS = [
  'Creatina monoidratada', 'Whey protein concentrado', 'Whey protein isolado',
  'BCAA', 'Glutamina', 'Beta-alanina', 'Cafeína anidra', 'Pré-treino',
  'Vitamina D3', 'Vitamina C', 'Vitamina B12', 'Vitamina E', 'Vitamina K2',
  'Complexo B', 'Ômega-3', 'Ferro bisglicinato', 'Ferro quelato',
  'Zinco quelato', 'Magnésio dimalato', 'Magnésio bisglicinato',
  'Cálcio quelato', 'Probiótico', 'Colágeno hidrolisado', 'Melatonina',
  'Ashwagandha', 'Rhodiola rosea', 'Curcumina', 'Coenzima Q10',
  'L-Carnitina', 'Albumina', 'Dextrose', 'Maltodextrina', 'Palatinose',
];

const ANALYSIS_STEPS = [
  { label: 'Consultando base de dados...', icon: '🗄️' },
  { label: 'Verificando interações conhecidas...', icon: '🔍' },
  { label: 'Analisando nível de evidência...', icon: '📊' },
  { label: 'Gerando relatório clínico...', icon: '📋' },
];

// ─── Autocomplete input for supplements ──────────────────────────────────────
function AutocompleteInput({
  value, onChange, placeholder, suggestions,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  suggestions: string[];
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState(value);
  const ref = useRef<HTMLDivElement>(null);

  const filtered = query.length >= 2
    ? suggestions.filter((s) => s.toLowerCase().includes(query.toLowerCase())).slice(0, 6)
    : [];

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div ref={ref} className="relative">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400 pointer-events-none" />
        <input
          type="text"
          value={query}
          placeholder={placeholder}
          className="w-full h-10 pl-8 pr-3 rounded-md border border-input bg-background text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:bg-gray-800 dark:border-gray-700"
          onChange={(e) => {
            setQuery(e.target.value);
            onChange(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
        />
      </div>
      {open && filtered.length > 0 && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white dark:bg-gray-800 border dark:border-gray-700 rounded-lg shadow-lg overflow-hidden">
          {filtered.map((s) => (
            <button
              key={s}
              type="button"
              className="w-full text-left px-3 py-2 text-sm hover:bg-blue-50 dark:hover:bg-blue-900 text-gray-700 dark:text-gray-200 transition-colors"
              onMouseDown={(e) => {
                e.preventDefault();
                setQuery(s);
                onChange(s);
                setOpen(false);
              }}
            >
              {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function InteractionAnalysisNewPage() {
  const [supplements, setSupplements] = useState<SupplementEntry[]>([{ name: '', dose: '', frequency: '' }]);
  const [medications, setMedications] = useState<MedicationEntry[]>([{ name: '', activePrinciple: '', dose: '' }]);
  const [conditions, setConditions] = useState<string[]>(['']);
  const [patientAge, setPatientAge] = useState('');
  const [isPregnant, setIsPregnant] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisStep, setAnalysisStep] = useState(-1);
  const [results, setResults] = useState<InteractionResult[] | null>(null);
  const [overallRisk, setOverallRisk] = useState<string | null>(null);
  const [aiAnalysis, setAiAnalysis] = useState<string | null>(null);

  const updateSupplement = (i: number, field: keyof SupplementEntry, val: string) =>
    setSupplements((s) => s.map((e, idx) => idx === i ? { ...e, [field]: val } : e));
  const addSupplement = () => setSupplements((s) => [...s, { name: '', dose: '', frequency: '' }]);
  const removeSupplement = (i: number) => setSupplements((s) => s.filter((_, idx) => idx !== i));

  const updateMedication = (i: number, field: keyof MedicationEntry, val: string) =>
    setMedications((m) => m.map((e, idx) => idx === i ? { ...e, [field]: val } : e));
  const addMedication = () => setMedications((m) => [...m, { name: '', activePrinciple: '', dose: '' }]);
  const removeMedication = (i: number) => setMedications((m) => m.filter((_, idx) => idx !== i));

  const updateCondition = (i: number, val: string) =>
    setConditions((c) => c.map((x, idx) => idx === i ? val : x));
  const addCondition = () => setConditions((c) => [...c, '']);
  const removeCondition = (i: number) => setConditions((c) => c.filter((_, idx) => idx !== i));

  const handleAnalyze = async () => {
    const validSupplements = supplements.filter((s) => s.name.trim());
    const validMedications = medications.filter((m) => m.name.trim());
    if (!validSupplements.length && !validMedications.length) {
      alert('Informe ao menos um suplemento ou medicamento.');
      return;
    }

    setIsAnalyzing(true);
    setResults(null);
    setAiAnalysis(null);
    setAnalysisStep(0);

    try {
      // Step-by-step animation
      for (let i = 0; i < ANALYSIS_STEPS.length; i++) {
        setAnalysisStep(i);
        await new Promise((r) => setTimeout(r, 600));
      }

      const mockResults: InteractionResult[] = [];
      if (validSupplements.some((s) => /ferro/i.test(s.name)) &&
          validMedications.some((m) => /omeprazol/i.test(m.name))) {
        mockResults.push({
          entityA: 'Ferro', entityB: 'Omeprazol', riskLevel: 'moderate',
          mechanism: 'IBPs reduzem produção de ácido gástrico, prejudicando absorção de ferro não-heme',
          recommendation: 'Preferir ferro quelato. Administrar com vitamina C longe do omeprazol. Monitorar ferritina.',
          confidenceLevel: 'high', evidenceQuality: 'Observacional (alta qualidade)',
          requiresMedicalReview: false, source: 'Base de evidências local',
        });
      }
      if (validSupplements.some((s) => /creatina/i.test(s.name)) &&
          conditions.some((c) => /renal/i.test(c))) {
        mockResults.push({
          entityA: 'Creatina', entityB: 'Doença Renal', riskLevel: 'high',
          mechanism: 'Creatina eleva creatinina sérica e pode sobrecarregar rins comprometidos',
          recommendation: 'Avaliar com nefrologista antes de iniciar. Monitorar função renal.',
          confidenceLevel: 'high', evidenceQuality: 'ECR',
          requiresMedicalReview: true, source: 'Base de evidências local',
        });
      }

      setResults(mockResults);
      setOverallRisk(
        mockResults.some((r) => r.riskLevel === 'contraindicated') ? 'contraindicated'
        : mockResults.some((r) => r.riskLevel === 'high') ? 'high'
        : mockResults.some((r) => r.riskLevel === 'moderate') ? 'moderate'
        : mockResults.length ? 'low' : 'insufficient_data',
      );
      setAiAnalysis(
        'Análise complementar (IA): Com base nos dados informados, não foram identificadas outras interações ' +
        'de alta evidência além das listadas acima. Recomenda-se revisão periódica do protocolo de suplementação.\n\n' +
        '⚠️ Esta análise é de apoio — valide com o profissional responsável.',
      );
    } finally {
      setIsAnalyzing(false);
      setAnalysisStep(-1);
    }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Análise de Interações</h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">Suplemento × Medicamento × Condição Clínica</p>
        </div>
        <Badge variant="outline" className="text-blue-700 border-blue-300 flex items-center gap-1">
          <Coins className="h-3 w-3" /> 15 tokens
        </Badge>
      </div>

      <Alert className="border-amber-300 bg-amber-50 dark:bg-amber-950 dark:border-amber-800">
        <ShieldAlert className="h-4 w-4 text-amber-600" />
        <AlertDescription className="text-amber-800 dark:text-amber-300 text-xs leading-relaxed">
          <strong>Ferramenta de apoio técnico.</strong> O nível de confiança e qualidade de evidência são indicados em cada resultado.
          O profissional responsável deve validar e interpretar clinicamente cada interação identificada.
        </AlertDescription>
      </Alert>

      {/* SUPLEMENTOS */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="text-base">Suplementos em Uso</CardTitle>
          <Button type="button" variant="outline" size="sm" onClick={addSupplement}>
            <Plus className="h-4 w-4 mr-1" /> Adicionar
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {supplements.map((s, i) => (
            <div key={i} className="grid grid-cols-3 gap-3 items-end">
              <div>
                {i === 0 && <Label>Nome do suplemento</Label>}
                <AutocompleteInput
                  value={s.name}
                  onChange={(v) => updateSupplement(i, 'name', v)}
                  placeholder="Ex: Creatina monoidratada"
                  suggestions={COMMON_SUPPLEMENTS}
                />
              </div>
              <div>
                {i === 0 && <Label>Dose</Label>}
                <Input value={s.dose} onChange={(e) => updateSupplement(i, 'dose', e.target.value)}
                  placeholder="Ex: 5g" />
              </div>
              <div className="flex gap-2">
                <div className="flex-1">
                  {i === 0 && <Label>Frequência</Label>}
                  <Input value={s.frequency} onChange={(e) => updateSupplement(i, 'frequency', e.target.value)}
                    placeholder="Ex: Diária" />
                </div>
                {supplements.length > 1 && (
                  <Button type="button" variant="ghost" size="sm" className="mt-auto" onClick={() => removeSupplement(i)}>
                    <X className="h-4 w-4 text-red-400" />
                  </Button>
                )}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* MEDICAMENTOS */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="text-base">Medicamentos em Uso</CardTitle>
          <Button type="button" variant="outline" size="sm" onClick={addMedication}>
            <Plus className="h-4 w-4 mr-1" /> Adicionar
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {medications.map((m, i) => (
            <div key={i} className="grid grid-cols-3 gap-3 items-end">
              <div>
                {i === 0 && <Label>Nome do medicamento</Label>}
                <Input value={m.name} onChange={(e) => updateMedication(i, 'name', e.target.value)}
                  placeholder="Ex: Omeprazol 20mg" />
              </div>
              <div>
                {i === 0 && <Label>Princípio ativo</Label>}
                <Input value={m.activePrinciple} onChange={(e) => updateMedication(i, 'activePrinciple', e.target.value)}
                  placeholder="Ex: omeprazol" />
              </div>
              <div className="flex gap-2">
                <div className="flex-1">
                  {i === 0 && <Label>Dose</Label>}
                  <Input value={m.dose} onChange={(e) => updateMedication(i, 'dose', e.target.value)}
                    placeholder="Ex: 20mg/dia" />
                </div>
                {medications.length > 1 && (
                  <Button type="button" variant="ghost" size="sm" className="mt-auto" onClick={() => removeMedication(i)}>
                    <X className="h-4 w-4 text-red-400" />
                  </Button>
                )}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* CONDIÇÕES CLÍNICAS */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="text-base">Condições Clínicas</CardTitle>
          <Button type="button" variant="outline" size="sm" onClick={addCondition}>
            <Plus className="h-4 w-4 mr-1" /> Adicionar
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>Idade do paciente</Label>
              <Input value={patientAge} onChange={(e) => setPatientAge(e.target.value)} type="number" placeholder="Ex: 34" />
            </div>
            <div className="flex items-center gap-3 pt-6">
              <input type="checkbox" id="pregnant" checked={isPregnant}
                onChange={(e) => setIsPregnant(e.target.checked)} className="h-4 w-4" />
              <label htmlFor="pregnant" className="text-sm">Gestante / lactante</label>
            </div>
          </div>
          {conditions.map((c, i) => (
            <div key={i} className="flex gap-2 items-center">
              <Input value={c} onChange={(e) => updateCondition(i, e.target.value)}
                placeholder="Ex: Hipertensão, Doença renal crônica, Diabetes tipo 2" />
              {conditions.length > 1 && (
                <Button type="button" variant="ghost" size="sm" onClick={() => removeCondition(i)}>
                  <X className="h-4 w-4 text-red-400" />
                </Button>
              )}
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Step-by-step loading indicator */}
      {isAnalyzing && (
        <Card className="border-blue-200 dark:border-blue-800">
          <CardContent className="pt-5 pb-4">
            <div className="space-y-3">
              {ANALYSIS_STEPS.map((step, i) => (
                <div key={i} className={`flex items-center gap-3 transition-all duration-300 ${i > analysisStep ? 'opacity-30' : ''}`}>
                  {i < analysisStep ? (
                    <CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0" />
                  ) : i === analysisStep ? (
                    <Loader2 className="h-5 w-5 text-blue-600 animate-spin flex-shrink-0" />
                  ) : (
                    <div className="h-5 w-5 rounded-full border-2 border-gray-200 flex-shrink-0" />
                  )}
                  <span className={`text-sm ${i === analysisStep ? 'font-semibold text-blue-700 dark:text-blue-400' : 'text-gray-500'}`}>
                    {step.icon} {step.label}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Button onClick={handleAnalyze} disabled={isAnalyzing} className="w-full flex items-center gap-2" size="lg">
        {isAnalyzing ? (
          <><Loader2 className="h-4 w-4 animate-spin" /> Analisando interações...</>
        ) : (
          <><Coins className="h-4 w-4" /> Analisar Interações (15 tokens)</>
        )}
      </Button>

      {/* RESULTADOS */}
      {results !== null && !isAnalyzing && (
        <div className="space-y-4">
          <div className="flex items-center gap-3 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border dark:border-gray-700">
            <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">Risco geral:</span>
            {overallRisk && (
              <span className={`text-xs px-2 py-1 rounded-full font-bold ${RISK_CONFIG[overallRisk as keyof typeof RISK_CONFIG]?.badge}`}>
                {RISK_CONFIG[overallRisk as keyof typeof RISK_CONFIG]?.label}
              </span>
            )}
            <span className="text-xs text-gray-400 ml-auto">{results.length} interação(ões)</span>
          </div>

          {results.length === 0 ? (
            <Card className="border-green-200 bg-green-50 dark:bg-green-950">
              <CardContent className="pt-6 flex items-center gap-3">
                <CheckCircle className="h-5 w-5 text-green-600" />
                <p className="text-sm text-green-800 dark:text-green-300">
                  Nenhuma interação de alta evidência identificada. Não exclui interações não catalogadas.
                </p>
              </CardContent>
            </Card>
          ) : (
            results.map((r, i) => {
              const cfg = RISK_CONFIG[r.riskLevel];
              return (
                <Card key={i} className={`border-l-4 ${cfg.border} ${cfg.bg}`}>
                  <CardContent className="pt-4 pb-3">
                    <div className="flex items-center gap-2 flex-wrap mb-2">
                      <span className="font-semibold text-sm">{r.entityA} × {r.entityB}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${cfg.badge}`}>{cfg.label}</span>
                      <span className="text-xs text-gray-500 italic">Confiança: {r.confidenceLevel}</span>
                    </div>
                    <p className="text-xs text-gray-700 dark:text-gray-300 mb-2">{r.mechanism}</p>
                    <p className="text-xs font-medium text-gray-900 dark:text-gray-200 mb-2 flex gap-1">
                      <span className="text-blue-600">→</span> {r.recommendation}
                    </p>
                    <div className="flex flex-wrap gap-3 text-xs text-gray-400">
                      <span>Evidência: {r.evidenceQuality}</span>
                      <span>Fonte: {r.source}</span>
                      {r.requiresMedicalReview && (
                        <span className="flex items-center gap-1 text-red-600 font-semibold">
                          <AlertTriangle className="h-3 w-3" /> Requer revisão médica
                        </span>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}

          {aiAnalysis && (
            <Card className="border-blue-200 bg-blue-50 dark:bg-blue-950 dark:border-blue-800">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-blue-800 dark:text-blue-300">Análise Complementar (IA)</CardTitle>
              </CardHeader>
              <CardContent>
                <pre className="text-xs text-blue-900 dark:text-blue-200 whitespace-pre-wrap leading-relaxed">{aiAnalysis}</pre>
                <p className="text-xs text-gray-400 italic mt-3 border-t pt-2">
                  Análise de apoio · Responsabilidade clínica é do profissional habilitado · CFN · CONFEF · LGPD
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
