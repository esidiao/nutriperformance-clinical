'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ShieldAlert, Plus, FlaskConical, Coins, Brain, Upload } from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';

type LabStatus = 'normal' | 'low' | 'high' | 'critical_low' | 'critical_high' | 'not_evaluated';

interface LabResult {
  marker: string;
  value: number;
  unit: string;
  reference: string;
  status: LabStatus;
  nutritionalNote?: string;
}

interface LabExam {
  id: string;
  examDate: string;
  labName?: string;
  results: LabResult[];
  professionalInterpretation?: string;
}

const STATUS_CONFIG: Record<LabStatus, { label: string; badge: string; dot: string }> = {
  normal:         { label: 'Normal',         badge: 'bg-green-100 text-green-800',  dot: 'bg-green-500' },
  low:            { label: 'Baixo',          badge: 'bg-yellow-100 text-yellow-800',dot: 'bg-yellow-500' },
  high:           { label: 'Elevado',        badge: 'bg-orange-100 text-orange-800',dot: 'bg-orange-500' },
  critical_low:   { label: 'Baixo crítico',  badge: 'bg-red-200 text-red-900 font-bold', dot: 'bg-red-600' },
  critical_high:  { label: 'Alto crítico',   badge: 'bg-red-200 text-red-900 font-bold', dot: 'bg-red-600' },
  not_evaluated:  { label: 'Não avaliado',   badge: 'bg-gray-100 text-gray-500',    dot: 'bg-gray-300' },
};

const MOCK_EXAM: LabExam = {
  id: 'L001', examDate: '10/05/2026', labName: 'Laboratório Central',
  results: [
    { marker: 'Hemoglobina', value: 11.8, unit: 'g/dL', reference: '12,0–16,0', status: 'low',
      nutritionalNote: 'Valor abaixo do limite inferior. Avaliar deficiência de ferro, B12 ou folato.' },
    { marker: 'Ferritina', value: 8.2, unit: 'ng/mL', reference: '10–150', status: 'low',
      nutritionalNote: 'Ferritina abaixo do ideal — sugere depleção de estoque de ferro. Suplementação em curso.' },
    { marker: 'Vitamina D (25-OH)', value: 18.0, unit: 'ng/mL', reference: '30–100', status: 'low',
      nutritionalNote: 'Insuficiência de vitamina D. Suplementação de D3 5000 UI/dia em curso.' },
    { marker: 'Vitamina B12', value: 310, unit: 'pg/mL', reference: '200–900', status: 'normal', nutritionalNote: '' },
    { marker: 'Glicemia em jejum', value: 88, unit: 'mg/dL', reference: '70–99', status: 'normal', nutritionalNote: '' },
    { marker: 'Creatinina', value: 0.82, unit: 'mg/dL', reference: '0,6–1,1', status: 'normal',
      nutritionalNote: 'Normal. Uso de creatina pode elevar levemente — monitorar.' },
    { marker: 'TSH', value: 2.1, unit: 'mUI/L', reference: '0,4–4,0', status: 'normal', nutritionalNote: '' },
    { marker: 'Zinco sérico', value: 62, unit: 'µg/dL', reference: '70–120', status: 'low',
      nutritionalNote: 'Zinco sérico baixo. Avaliar ingestão dietética e biodisponibilidade.' },
  ],
  professionalInterpretation: '',
};

export default function LaboratoryPage() {
  const [exam] = useState<LabExam>(MOCK_EXAM);
  const [showAddForm, setShowAddForm] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [aiContext, setAiContext] = useState<string | null>(null);
  const [interpretation, setInterpretation] = useState('');

  const altered = exam.results.filter((r) => r.status !== 'normal' && r.status !== 'not_evaluated');
  const critical = exam.results.filter((r) => r.status === 'critical_low' || r.status === 'critical_high');

  const handleAnalyze = async () => {
    setIsAnalyzing(true);
    await new Promise((r) => setTimeout(r, 2500));
    setAiContext(
      'Contexto nutricional dos exames (ferramenta de apoio):\n\n' +
      '• Hemoglobina baixa + ferritina baixa: padrão compatível com anemia ferropriva em investigação. ' +
      'Suplementação de ferro em curso. Monitorar resposta ao tratamento em 30-60 dias.\n\n' +
      '• Vitamina D insuficiente (18 ng/mL): suplementação de D3 iniciada. Reavaliar 25-OH VitD em 90 dias.\n\n' +
      '• Zinco sérico baixo: avaliar ingestão de carnes, sementes e nozes. Fitatos na dieta podem reduzir absorção.\n\n' +
      '• Creatinina normal: uso de creatina é compatível com função renal atual. Monitorar.\n\n' +
      '• B12 e glicemia normais: sem necessidade de intervenção nutricional específica no momento.\n\n' +
      '⚠️ IMPORTANTE: Interpretação diagnóstica dos exames é exclusividade médica. ' +
      'Esta análise foca apenas no contexto nutricional e de suplementação.',
    );
    setIsAnalyzing(false);
  };

  return (
    <div className="flex flex-col min-h-full">
      <PageHeader
        title="Exames Laboratoriais"
        description="Contexto nutricional dos exames — não substitui interpretação médica"
        breadcrumbs={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Exames' }]}
        action={
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="flex items-center gap-2 text-sm">
              <Upload className="h-4 w-4" /> Upload PDF
            </Button>
            <Button size="sm" onClick={() => setShowAddForm((v) => !v)} className="flex items-center gap-2">
              <Plus className="h-4 w-4" /> Registrar exame
            </Button>
          </div>
        }
      />
    <div className="p-6 max-w-4xl mx-auto space-y-5 flex-1">

      <Alert className="border-blue-200 bg-blue-50">
        <ShieldAlert className="h-4 w-4 text-blue-600" />
        <AlertDescription className="text-blue-800 text-xs leading-relaxed">
          <strong>Interpretação diagnóstica de exames é atribuição exclusiva do médico.</strong>{' '}
          Este módulo analisa os resultados sob perspectiva nutricional e de suplementação — identificando
          possíveis deficiências nutricionais e interações com suplementos. Não emite diagnóstico clínico.
          Conforme CFM, CFN e CONFEF.
        </AlertDescription>
      </Alert>

      {/* Resumo do exame mais recente */}
      <Card>
        <CardHeader className="pb-3 flex flex-row items-start justify-between">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <FlaskConical className="h-4 w-4 text-blue-600" />
              Exame de {exam.examDate}
              {exam.labName && <span className="text-xs text-gray-400 font-normal">— {exam.labName}</span>}
            </CardTitle>
            <div className="flex gap-3 mt-1 text-xs text-gray-500">
              <span>{exam.results.length} marcadores</span>
              <span className="text-yellow-700 font-medium">{altered.length} alterados</span>
              {critical.length > 0 && (
                <span className="text-red-700 font-bold">{critical.length} críticos</span>
              )}
            </div>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={handleAnalyze}
            disabled={isAnalyzing}
            className="flex items-center gap-1 text-xs"
          >
            {isAnalyzing ? (
              <><span className="animate-spin">⟳</span> Analisando…</>
            ) : (
              <>
                <Brain className="h-3.5 w-3.5" />
                Contexto nutricional
                <span className="text-gray-400 ml-1 flex items-center gap-0.5">
                  (10 <Coins className="h-2.5 w-2.5" />)
                </span>
              </>
            )}
          </Button>
        </CardHeader>

        <CardContent>
          {/* Tabela de resultados */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-gray-50">
                  <th className="text-left py-2 px-3 font-medium text-gray-600 text-xs">Marcador</th>
                  <th className="text-right py-2 px-3 font-medium text-gray-600 text-xs">Valor</th>
                  <th className="text-center py-2 px-3 font-medium text-gray-600 text-xs">Referência</th>
                  <th className="text-center py-2 px-3 font-medium text-gray-600 text-xs">Status</th>
                  <th className="text-left py-2 px-3 font-medium text-gray-600 text-xs hidden md:table-cell">Nota nutricional</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {exam.results.map((r) => {
                  const cfg = STATUS_CONFIG[r.status];
                  return (
                    <tr key={r.marker} className={r.status !== 'normal' && r.status !== 'not_evaluated' ? 'bg-yellow-50/30' : ''}>
                      <td className="py-2.5 px-3">
                        <div className="flex items-center gap-2">
                          <span className={`w-2 h-2 rounded-full flex-shrink-0 ${cfg.dot}`} />
                          <span className="font-medium text-gray-800">{r.marker}</span>
                        </div>
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-semibold text-gray-900">
                        {r.value} {r.unit}
                      </td>
                      <td className="py-2.5 px-3 text-center text-xs text-gray-500">{r.reference}</td>
                      <td className="py-2.5 px-3 text-center">
                        <Badge variant="outline" className={`text-xs ${cfg.badge}`}>{cfg.label}</Badge>
                      </td>
                      <td className="py-2.5 px-3 text-xs text-gray-500 hidden md:table-cell max-w-xs">
                        {r.nutritionalNote || '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Interpretação profissional */}
          <div className="mt-4 pt-4 border-t">
            <Label className="text-xs text-gray-600 font-semibold uppercase tracking-wide">
              Interpretação do Profissional (Nutricionista)
            </Label>
            <textarea
              value={interpretation}
              onChange={(e) => setInterpretation(e.target.value)}
              rows={3}
              placeholder="Registre aqui a interpretação nutricional do profissional responsável..."
              className="mt-1 w-full rounded-md border px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="text-xs text-gray-400 mt-1 italic">
              Campo exclusivo do nutricionista. Não constitui diagnóstico médico.
            </p>
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
            </CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="text-xs text-blue-900 whitespace-pre-wrap leading-relaxed">{aiContext}</pre>
            <div className="mt-3 pt-3 border-t border-blue-200 space-y-1">
              <p className="text-xs text-gray-500 italic">
                Confiança: Moderada · Fonte: análise contextual de apoio · Requer validação profissional
              </p>
              <p className="text-xs text-gray-400 italic">
                Esta análise foca exclusivamente em implicações nutricionais.
                Diagnóstico e conduta médica são exclusividade do médico responsável.
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
    </div>
  );
}
