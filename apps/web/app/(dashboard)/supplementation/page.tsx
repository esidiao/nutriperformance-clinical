'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { PageHeader } from '@/components/PageHeader';
import { EmptyState } from '@/components/EmptyState';
import {
  Plus, Pill, ShieldAlert, Coins, Search,
  AlertTriangle, ChevronDown, ChevronUp, Brain,
} from 'lucide-react';

type RiskLevel = 'low' | 'moderate' | 'high' | 'contraindicated' | 'insufficient_data';
type SupplementCategory =
  | 'protein' | 'amino_acids' | 'creatine' | 'pre_workout' | 'mass_gainer'
  | 'vitamins' | 'minerals' | 'omega3' | 'thermogenic' | 'probiotics'
  | 'fibers' | 'herbal' | 'recovery' | 'electrolytes' | 'caffeine'
  | 'adaptogen' | 'other';

interface PatientSupplement {
  id: string;
  supplementName: string;
  brand?: string;
  category: SupplementCategory;
  dose: string;
  frequency: string;
  timing?: string;
  withMeal?: boolean;
  withTraining?: boolean;
  purpose: string;
  isActive: boolean;
  riskLevel?: RiskLevel;
  adverseEvents?: string;
  startDate?: string;
}

const CATEGORY_LABELS: Record<SupplementCategory, string> = {
  protein: 'Proteína', amino_acids: 'Aminoácidos', creatine: 'Creatina',
  pre_workout: 'Pré-treino', mass_gainer: 'Hipercalórico', vitamins: 'Vitaminas',
  minerals: 'Minerais', omega3: 'Ômega-3', thermogenic: 'Termogênico',
  probiotics: 'Probiótico', fibers: 'Fibras', herbal: 'Fitoterápico',
  recovery: 'Recuperador', electrolytes: 'Repositor eletrolítico',
  caffeine: 'Cafeína', adaptogen: 'Adaptógeno', other: 'Outro',
};

const RISK_CONFIG: Record<RiskLevel, { label: string; badge: string; border: string }> = {
  low:              { label: 'Baixo',          badge: 'bg-green-100 text-green-800 border-green-300',  border: 'border-l-green-400' },
  moderate:         { label: 'Moderado',        badge: 'bg-yellow-100 text-yellow-800 border-yellow-300', border: 'border-l-yellow-400' },
  high:             { label: 'Alto',            badge: 'bg-red-100 text-red-700 border-red-300',        border: 'border-l-red-500' },
  contraindicated:  { label: 'Contraindicado',  badge: 'bg-red-200 text-red-900 border-red-400 font-bold', border: 'border-l-red-700' },
  insufficient_data:{ label: 'Não avaliado',    badge: 'bg-gray-100 text-gray-600 border-gray-300',    border: 'border-l-gray-300' },
};

const MOCK_SUPPLEMENTS: PatientSupplement[] = [
  {
    id: '1', supplementName: 'Creatina Monoidratada', brand: 'Optimum Nutrition',
    category: 'creatine', dose: '5g', frequency: 'Diária', timing: 'Pós-treino',
    withMeal: true, withTraining: true, purpose: 'Hipertrofia e ganho de força',
    isActive: true, riskLevel: 'low', startDate: '01/04/2026',
  },
  {
    id: '2', supplementName: 'Whey Protein Concentrado', brand: 'Growth',
    category: 'protein', dose: '30g (1 scoop)', frequency: '1-2x ao dia', timing: 'Pós-treino e/ou café da manhã',
    withMeal: false, withTraining: true, purpose: 'Complementação proteica para hipertrofia',
    isActive: true, riskLevel: 'low', startDate: '01/04/2026',
  },
  {
    id: '3', supplementName: 'Sulfato Ferroso', brand: 'Genérico (farmácia)',
    category: 'minerals', dose: '40mg ferro elementar', frequency: 'Diária', timing: 'Em jejum com vitamina C',
    withMeal: false, withTraining: false, purpose: 'Correção de deficiência de ferro',
    isActive: true, riskLevel: 'moderate', startDate: '15/03/2026',
    adverseEvents: 'Leve desconforto gástrico inicial, já resolvido',
  },
  {
    id: '4', supplementName: 'Vitamina D3 5000 UI', brand: 'Sundown',
    category: 'vitamins', dose: '5000 UI', frequency: 'Diária', timing: 'Com refeição gordurosa',
    withMeal: true, withTraining: false, purpose: 'Correção de deficiência (25-OH VitD: 18 ng/mL)',
    isActive: true, riskLevel: 'low', startDate: '15/03/2026',
  },
];

interface SupplementFormState {
  supplementName: string;
  brand: string;
  category: SupplementCategory;
  dose: string;
  frequency: string;
  timing: string;
  purpose: string;
  withMeal: boolean;
  withTraining: boolean;
  startDate: string;
  adverseEvents: string;
}

const EMPTY_FORM: SupplementFormState = {
  supplementName: '', brand: '', category: 'other', dose: '', frequency: '',
  timing: '', purpose: '', withMeal: false, withTraining: false,
  startDate: '', adverseEvents: '',
};

export default function SupplementationPage() {
  const [supplements, setSupplements] = useState<PatientSupplement[]>(MOCK_SUPPLEMENTS);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<SupplementFormState>(EMPTY_FORM);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const filtered = supplements.filter((s) =>
    s.supplementName.toLowerCase().includes(search.toLowerCase()) ||
    CATEGORY_LABELS[s.category].toLowerCase().includes(search.toLowerCase()),
  );

  const handleAdd = () => {
    if (!form.supplementName || !form.dose || !form.frequency) return;
    const newEntry: PatientSupplement = {
      id: String(Date.now()), ...form, isActive: true, riskLevel: 'insufficient_data',
    };
    setSupplements((prev) => [newEntry, ...prev]);
    setForm(EMPTY_FORM);
    setShowForm(false);
  };

  const handleToggleActive = (id: string) => {
    setSupplements((prev) =>
      prev.map((s) => (s.id === id ? { ...s, isActive: !s.isActive } : s)),
    );
  };

  const handleAnalyze = async (id: string) => {
    setIsAnalyzing(id);
    await new Promise((r) => setTimeout(r, 2000));
    setSupplements((prev) =>
      prev.map((s) => (s.id === id ? { ...s, riskLevel: 'low' } : s)),
    );
    setIsAnalyzing(null);
  };

  const activeCount = supplements.filter((s) => s.isActive).length;
  const alertCount = supplements.filter((s) =>
    s.riskLevel === 'high' || s.riskLevel === 'contraindicated',
  ).length;

  return (
    <div className="flex flex-col min-h-full">
      <PageHeader
        title="Suplementação"
        description={`${activeCount} suplementos ativos · ${alertCount > 0 ? `${alertCount} com alerta de risco` : 'sem alertas de risco'}`}
        breadcrumbs={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Suplementação' }]}
        action={
          <Button onClick={() => setShowForm((v) => !v)} size="sm" className="flex items-center gap-2">
            <Plus className="h-4 w-4" />
            {showForm ? 'Cancelar' : 'Adicionar suplemento'}
          </Button>
        }
      />
    <div className="p-6 max-w-4xl mx-auto space-y-5 flex-1">

      <Alert className="border-amber-300 bg-amber-50">
        <ShieldAlert className="h-4 w-4 text-amber-600" />
        <AlertDescription className="text-amber-800 text-xs leading-relaxed">
          <strong>Suplementação é atribuição do Nutricionista.</strong> O sistema organiza e
          analisa riscos como ferramenta de apoio — sem substituir avaliação profissional individualizada.
          Análises de risco indicam nível de evidência e requerem validação do profissional responsável.
          Conforme ANVISA (RDC 786/2023) e Resolução CFN 600/2018.
        </AlertDescription>
      </Alert>

      {/* Formulário de adição */}
      {showForm && (
        <Card className="border-blue-200">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Registrar Suplemento</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>Nome do suplemento *</Label>
                <Input value={form.supplementName}
                  onChange={(e) => setForm((f) => ({ ...f, supplementName: e.target.value }))}
                  placeholder="Ex: Creatina Monoidratada" />
              </div>
              <div>
                <Label>Marca / Fabricante</Label>
                <Input value={form.brand}
                  onChange={(e) => setForm((f) => ({ ...f, brand: e.target.value }))}
                  placeholder="Ex: Optimum Nutrition" />
              </div>
              <div>
                <Label>Categoria</Label>
                <select value={form.category}
                  onChange={(e) => setForm((f) => ({ ...f, category: e.target.value as SupplementCategory }))}
                  className="w-full h-10 rounded-md border px-3 text-sm">
                  {Object.entries(CATEGORY_LABELS).map(([val, label]) => (
                    <option key={val} value={val}>{label}</option>
                  ))}
                </select>
              </div>
              <div>
                <Label>Dose *</Label>
                <Input value={form.dose}
                  onChange={(e) => setForm((f) => ({ ...f, dose: e.target.value }))}
                  placeholder="Ex: 5g ou 2 cápsulas" />
              </div>
              <div>
                <Label>Frequência *</Label>
                <Input value={form.frequency}
                  onChange={(e) => setForm((f) => ({ ...f, frequency: e.target.value }))}
                  placeholder="Ex: Diária, 3x/semana" />
              </div>
              <div>
                <Label>Horário / Momento</Label>
                <Input value={form.timing}
                  onChange={(e) => setForm((f) => ({ ...f, timing: e.target.value }))}
                  placeholder="Ex: Pré-treino, Ao acordar" />
              </div>
              <div>
                <Label>Objetivo de uso</Label>
                <Input value={form.purpose}
                  onChange={(e) => setForm((f) => ({ ...f, purpose: e.target.value }))}
                  placeholder="Ex: Hipertrofia muscular" />
              </div>
              <div>
                <Label>Data de início</Label>
                <Input type="date" value={form.startDate}
                  onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value }))} />
              </div>
              <div className="flex items-center gap-4 pt-5">
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input type="checkbox" checked={form.withMeal}
                    onChange={(e) => setForm((f) => ({ ...f, withMeal: e.target.checked }))} />
                  Com refeição
                </label>
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input type="checkbox" checked={form.withTraining}
                    onChange={(e) => setForm((f) => ({ ...f, withTraining: e.target.checked }))} />
                  Associado ao treino
                </label>
              </div>
              <div className="md:col-span-2">
                <Label>Eventos adversos relatados</Label>
                <Input value={form.adverseEvents}
                  onChange={(e) => setForm((f) => ({ ...f, adverseEvents: e.target.value }))}
                  placeholder="Ex: Desconforto gástrico, Insônia — ou deixe em branco" />
              </div>
            </div>
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setShowForm(false)}>Cancelar</Button>
              <Button onClick={handleAdd}>Registrar suplemento</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Busca */}
      <div className="relative max-w-xs">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <Input value={search} onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar suplemento..." className="pl-9" />
      </div>

      {/* Lista de suplementos */}
      <div className="space-y-3">
        {filtered.map((supp) => {
          const risk = supp.riskLevel ?? 'insufficient_data';
          const riskCfg = RISK_CONFIG[risk];
          const isExpanded = expandedId === supp.id;

          return (
            <Card key={supp.id}
              className={`border-l-4 transition-all ${riskCfg.border} ${!supp.isActive ? 'opacity-50' : ''}`}>
              <CardContent className="py-3 px-4">
                {/* Linha principal */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Pill className="h-4 w-4 text-gray-400 flex-shrink-0" />
                      <span className="font-semibold text-gray-900">{supp.supplementName}</span>
                      {supp.brand && <span className="text-xs text-gray-400">{supp.brand}</span>}
                      <Badge variant="outline" className="text-xs">{CATEGORY_LABELS[supp.category]}</Badge>
                      {!supp.isActive && <Badge variant="outline" className="text-xs text-gray-400">Inativo</Badge>}
                    </div>
                    <div className="flex gap-3 mt-1 flex-wrap text-xs text-gray-600">
                      <span><strong>Dose:</strong> {supp.dose}</span>
                      <span><strong>Freq:</strong> {supp.frequency}</span>
                      {supp.timing && <span><strong>Horário:</strong> {supp.timing}</span>}
                    </div>
                    {supp.purpose && (
                      <p className="text-xs text-gray-500 mt-1"><strong>Objetivo:</strong> {supp.purpose}</p>
                    )}
                    {supp.adverseEvents && (
                      <p className="text-xs text-orange-700 mt-1 flex items-center gap-1">
                        <AlertTriangle className="h-3 w-3" />
                        <strong>Evento adverso:</strong> {supp.adverseEvents}
                      </p>
                    )}
                  </div>

                  {/* Coluna direita */}
                  <div className="flex flex-col items-end gap-2 flex-shrink-0">
                    <span className={`text-xs px-2 py-0.5 rounded-full border ${riskCfg.badge}`}>
                      {riskCfg.label}
                    </span>
                    <div className="flex items-center gap-1">
                      {isAnalyzing === supp.id ? (
                        <Button size="sm" variant="outline" disabled className="text-xs h-7">
                          <span className="animate-spin mr-1">⟳</span> Analisando…
                        </Button>
                      ) : (
                        <Button size="sm" variant="outline" className="text-xs h-7 flex items-center gap-1"
                          onClick={() => handleAnalyze(supp.id)}>
                          <Brain className="h-3 w-3" />
                          Analisar
                          <span className="text-gray-400 ml-0.5">(8</span>
                          <Coins className="h-2.5 w-2.5 text-gray-400" />
                          <span className="text-gray-400">)</span>
                        </Button>
                      )}
                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0"
                        onClick={() => setExpandedId(isExpanded ? null : supp.id)}>
                        {isExpanded
                          ? <ChevronUp className="h-4 w-4 text-gray-400" />
                          : <ChevronDown className="h-4 w-4 text-gray-400" />}
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Expansão — detalhes e contexto */}
                {isExpanded && (
                  <div className="mt-3 pt-3 border-t space-y-2">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                      <div><span className="text-gray-400 block">Com refeição</span>
                        <span>{supp.withMeal ? 'Sim' : 'Não'}</span></div>
                      <div><span className="text-gray-400 block">Com treino</span>
                        <span>{supp.withTraining ? 'Sim' : 'Não'}</span></div>
                      <div><span className="text-gray-400 block">Início</span>
                        <span>{supp.startDate ?? '—'}</span></div>
                      <div><span className="text-gray-400 block">Status</span>
                        <span>{supp.isActive ? 'Ativo' : 'Inativo'}</span></div>
                    </div>
                    <div className="flex gap-2 mt-2">
                      <Button size="sm" variant="outline" className="text-xs h-7"
                        onClick={() => handleToggleActive(supp.id)}>
                        {supp.isActive ? 'Desativar' : 'Reativar'}
                      </Button>
                    </div>
                    <p className="text-xs text-gray-400 italic">
                      Análise de risco é ferramenta de apoio. Validar com o profissional responsável.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}

        {filtered.length === 0 && (
          <EmptyState
            icon="💊"
            title="Nenhum suplemento registrado"
            description="Registre os suplementos em uso pelo paciente para monitorar doses e identificar possíveis interações."
            actionLabel="Adicionar Suplemento"
            onAction={() => document.getElementById('add-supplement-btn')?.click()}
          />
        )}
      </div>
    </div>
    </div>
  );
}
