'use client';

import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  AlertTriangle,
  Activity,
  Pill,
  FlaskConical,
  Target,
  FileText,
  ShieldAlert,
} from 'lucide-react';

// Componente de aviso ético — aparece em todas as análises
function EthicsDisclaimer() {
  return (
    <Alert className="mb-4 border-amber-300 bg-amber-50">
      <ShieldAlert className="h-4 w-4 text-amber-600" />
      <AlertDescription className="text-amber-800 text-xs leading-relaxed">
        <strong>Ferramenta de apoio profissional.</strong> As análises apresentadas são sugestivas e
        devem ser interpretadas e validadas pelo profissional de saúde responsável. Este sistema não
        substitui avaliação clínica individualizada, diagnóstico ou prescrição profissional. Conforme
        CFN, CONFEF e LGPD.
      </AlertDescription>
    </Alert>
  );
}

interface RiskBadgeProps {
  level: 'low' | 'moderate' | 'high' | 'contraindicated' | 'insufficient_data';
}

function RiskBadge({ level }: RiskBadgeProps) {
  const config = {
    low: { label: 'Baixo', class: 'bg-green-100 text-green-800 border-green-300' },
    moderate: { label: 'Moderado', class: 'bg-yellow-100 text-yellow-800 border-yellow-300' },
    high: { label: 'Alto', class: 'bg-red-100 text-red-800 border-red-300' },
    contraindicated: { label: 'Contraindicado', class: 'bg-red-200 text-red-900 border-red-400 font-bold' },
    insufficient_data: { label: 'Dados insuficientes', class: 'bg-gray-100 text-gray-600 border-gray-300' },
  };
  const c = config[level] ?? config.insufficient_data;
  return (
    <Badge variant="outline" className={`text-xs ${c.class}`}>
      {c.label}
    </Badge>
  );
}

interface ConfidenceBadgeProps {
  level: 'high' | 'moderate' | 'low' | 'insufficient_data';
}

function ConfidenceBadge({ level }: ConfidenceBadgeProps) {
  const labels = {
    high: 'Confiança: Alta',
    moderate: 'Confiança: Moderada',
    low: 'Confiança: Baixa',
    insufficient_data: 'Dados insuficientes',
  };
  return (
    <span className="text-xs text-gray-500 ml-2 italic">{labels[level] ?? labels.insufficient_data}</span>
  );
}

// ---------------------------------------------------------------------------
// PAINEL DE INTERAÇÕES
// ---------------------------------------------------------------------------
interface Interaction {
  entityA: string;
  entityB: string;
  riskLevel: 'low' | 'moderate' | 'high' | 'contraindicated' | 'insufficient_data';
  mechanism: string;
  recommendation: string;
  confidenceLevel: 'high' | 'moderate' | 'low' | 'insufficient_data';
  evidenceQuality: string;
  requiresMedicalReview: boolean;
  source: string;
}

interface InteractionsPanelProps {
  interactions: Interaction[];
  overallRisk: string;
  disclaimer: string;
  onRequestAnalysis: () => void;
  isLoading: boolean;
}

function InteractionsPanel({
  interactions,
  overallRisk,
  disclaimer,
  onRequestAnalysis,
  isLoading,
}: InteractionsPanelProps) {
  return (
    <div className="space-y-4">
      <EthicsDisclaimer />

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-600">Risco geral:</span>
          <RiskBadge level={overallRisk as RiskBadgeProps['level']} />
        </div>
        <Button onClick={onRequestAnalysis} disabled={isLoading} size="sm">
          {isLoading ? 'Analisando...' : 'Nova Análise'}
        </Button>
      </div>

      {interactions.length === 0 ? (
        <p className="text-sm text-gray-500 italic py-4 text-center">
          Nenhuma interação identificada com os dados disponíveis.
        </p>
      ) : (
        <div className="space-y-3">
          {interactions.map((interaction, idx) => (
            <Card
              key={idx}
              className={`border-l-4 ${
                interaction.riskLevel === 'contraindicated' || interaction.riskLevel === 'high'
                  ? 'border-l-red-500 bg-red-50'
                  : interaction.riskLevel === 'moderate'
                    ? 'border-l-yellow-500 bg-yellow-50'
                    : 'border-l-green-500 bg-green-50'
              }`}
            >
              <CardContent className="pt-4 pb-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-sm">
                        {interaction.entityA} × {interaction.entityB}
                      </span>
                      <RiskBadge level={interaction.riskLevel} />
                      <ConfidenceBadge level={interaction.confidenceLevel} />
                    </div>
                    {interaction.mechanism && (
                      <p className="text-xs text-gray-700 mt-2">{interaction.mechanism}</p>
                    )}
                    {interaction.recommendation && (
                      <p className="text-xs font-medium text-gray-800 mt-1 flex items-start gap-1">
                        <span className="text-blue-600">→</span>
                        {interaction.recommendation}
                      </p>
                    )}
                    <div className="flex items-center gap-3 mt-2 flex-wrap">
                      <span className="text-xs text-gray-400">
                        Evidência: {interaction.evidenceQuality}
                      </span>
                      <span className="text-xs text-gray-400">Fonte: {interaction.source}</span>
                      {interaction.requiresMedicalReview && (
                        <span className="text-xs text-red-600 font-medium flex items-center gap-1">
                          <AlertTriangle className="h-3 w-3" />
                          Requer revisão médica
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <p className="text-xs text-gray-400 italic border-t pt-3 leading-relaxed">{disclaimer}</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// PÁGINA PRINCIPAL DO PACIENTE
// ---------------------------------------------------------------------------
interface PatientPageProps {
  params: { id: string };
}

export default function PatientPage({ params }: PatientPageProps) {
  const [activeTab, setActiveTab] = useState('overview');
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  // Em produção: substituir por hooks de dados reais (React Query / SWR)
  const mockPatient = {
    internalCode: 'PAC-001',
    age: 34,
    gender: 'Feminino',
    isPregnant: false,
    primaryGoal: 'Recomposição corporal',
  };

  const mockInteractions: Interaction[] = [
    {
      entityA: 'Ferro',
      entityB: 'Omeprazol',
      riskLevel: 'moderate',
      mechanism: 'IBPs reduzem acidez gástrica, prejudicando absorção de ferro não-heme',
      recommendation: 'Preferir ferro quelato. Administrar com vitamina C. Monitorar ferritina.',
      confidenceLevel: 'high',
      evidenceQuality: 'Observacional',
      requiresMedicalReview: false,
      source: 'Base de evidências local',
    },
    {
      entityA: 'Vitamina K2',
      entityB: 'Varfarina',
      riskLevel: 'high',
      mechanism: 'Vitamina K antagoniza o efeito anticoagulante da varfarina',
      recommendation: 'Monitoramento rigoroso do INR obrigatório. Encaminhar para revisão médica.',
      confidenceLevel: 'high',
      evidenceQuality: 'Meta-análise',
      requiresMedicalReview: true,
      source: 'Base de evidências local',
    },
  ];

  const handleRequestAnalysis = async () => {
    setIsAnalyzing(true);
    // Em produção: chamar API com consumo de tokens
    setTimeout(() => setIsAnalyzing(false), 2000);
  };

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Header do paciente */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Paciente {mockPatient.internalCode}
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            {mockPatient.age} anos · {mockPatient.gender} · Objetivo: {mockPatient.primaryGoal}
          </p>
        </div>
        <Button variant="outline" size="sm">
          <FileText className="h-4 w-4 mr-2" />
          Gerar Relatório
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-6">
          <TabsTrigger value="overview">
            <Activity className="h-4 w-4 mr-1" />
            Visão Geral
          </TabsTrigger>
          <TabsTrigger value="nutritional">
            <FlaskConical className="h-4 w-4 mr-1" />
            Nutricional
          </TabsTrigger>
          <TabsTrigger value="physical">
            <Activity className="h-4 w-4 mr-1" />
            Físico
          </TabsTrigger>
          <TabsTrigger value="supplementation">
            <Pill className="h-4 w-4 mr-1" />
            Suplementação
          </TabsTrigger>
          <TabsTrigger value="interactions">
            <AlertTriangle className="h-4 w-4 mr-1" />
            Interações
          </TabsTrigger>
          <TabsTrigger value="goals">
            <Target className="h-4 w-4 mr-1" />
            Metas
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <EthicsDisclaimer />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-gray-600">Alertas Clínicos</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-yellow-600">2</p>
                <p className="text-xs text-gray-500 mt-1">1 moderado · 1 alto</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-gray-600">Suplementos em Uso</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-blue-600">4</p>
                <p className="text-xs text-gray-500 mt-1">2 analisados</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-gray-600">Meta Principal</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm font-semibold text-gray-800">{mockPatient.primaryGoal}</p>
                <p className="text-xs text-gray-500 mt-1">Em andamento</p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="interactions">
          <InteractionsPanel
            interactions={mockInteractions}
            overallRisk="high"
            disclaimer="Esta análise é uma ferramenta de apoio técnico para profissionais habilitados. Não constitui diagnóstico, prescrição ou tratamento. Deve ser interpretada e validada pelo profissional responsável pelo paciente."
            onRequestAnalysis={handleRequestAnalysis}
            isLoading={isAnalyzing}
          />
        </TabsContent>

        <TabsContent value="nutritional">
          <EthicsDisclaimer />
          <Card>
            <CardContent className="pt-6">
              <p className="text-gray-500 text-sm">
                Selecione ou inicie uma avaliação nutricional para este paciente.
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="physical">
          <EthicsDisclaimer />
          <Card>
            <CardContent className="pt-6">
              <p className="text-gray-500 text-sm">
                Selecione ou inicie uma avaliação física para este paciente.
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="supplementation">
          <EthicsDisclaimer />
          <Card>
            <CardContent className="pt-6">
              <p className="text-gray-500 text-sm">
                Gerencie a suplementação deste paciente.
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="goals">
          <EthicsDisclaimer />
          <Card>
            <CardContent className="pt-6">
              <p className="text-gray-500 text-sm">Metas e checkpoints de evolução.</p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
