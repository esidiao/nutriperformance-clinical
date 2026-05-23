'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  FileText, Coins, ShieldAlert, CheckSquare, Square,
  Download, Printer, User,
} from 'lucide-react';

type ReportType =
  | 'nutritional_assessment' | 'physical_assessment'
  | 'supplementation_analysis' | 'full_clinical' | 'evolution' | 'goals';

const REPORT_TYPES: { value: ReportType; label: string; description: string }[] = [
  { value: 'nutritional_assessment', label: 'Avaliação Nutricional', description: 'Anamnese, cálculo energético, metas e estratégia alimentar' },
  { value: 'physical_assessment', label: 'Avaliação Física', description: 'Composição corporal, circunferências, atividade e objetivos' },
  { value: 'supplementation_analysis', label: 'Análise de Suplementação', description: 'Suplementos, riscos identificados e recomendações' },
  { value: 'full_clinical', label: 'Relatório Clínico Completo', description: 'Todos os módulos em um único documento' },
  { value: 'evolution', label: 'Evolução', description: 'Gráficos e histórico de mudanças ao longo do tempo' },
  { value: 'goals', label: 'Metas e Acompanhamento', description: 'Progresso das metas definidas pelo profissional' },
];

const MODULES = [
  { id: 'nutritional', label: 'Avaliação Nutricional' },
  { id: 'physical', label: 'Avaliação Física' },
  { id: 'supplementation', label: 'Suplementação' },
  { id: 'interactions', label: 'Análise de Interações' },
  { id: 'bioavailability', label: 'Biodisponibilidade' },
  { id: 'lab', label: 'Exames Laboratoriais' },
  { id: 'goals', label: 'Metas e Evolução' },
  { id: 'alerts', label: 'Alertas Clínicos' },
];

export default function ReportNewPage() {
  const [selectedType, setSelectedType] = useState<ReportType>('full_clinical');
  const [selectedModules, setSelectedModules] = useState<string[]>([
    'nutritional', 'physical', 'supplementation', 'interactions', 'goals',
  ]);
  const [professionalNotes, setProfessionalNotes] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [pdfReady, setPdfReady] = useState(false);

  const toggleModule = (id: string) => {
    setSelectedModules((prev) =>
      prev.includes(id) ? prev.filter((m) => m !== id) : [...prev, id],
    );
  };

  const handleGenerate = async () => {
    setIsGenerating(true);
    setPdfReady(false);
    await new Promise((r) => setTimeout(r, 2500));
    setIsGenerating(false);
    setPdfReady(true);
  };

  const LEGAL_DISCLAIMER = `Este relatório foi gerado pelo sistema NutriPerformance Clinical como ferramenta de apoio profissional.
NÃO constitui diagnóstico médico, prescrição terapêutica ou tratamento clínico.
As informações devem ser interpretadas exclusivamente pelo profissional de saúde habilitado responsável pelo paciente.
Regulamentação: CFN (Res. 599/2018), CONFEF, LGPD (Lei 13.709/2018).`;

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Gerar Relatório</h1>
          <p className="text-gray-500 text-sm mt-1">PDF profissional com assinatura e aviso legal</p>
        </div>
        <Badge variant="outline" className="text-blue-700 border-blue-300 flex items-center gap-1">
          <Coins className="h-3 w-3" /> 5 tokens
        </Badge>
      </div>

      <Alert className="border-amber-300 bg-amber-50">
        <ShieldAlert className="h-4 w-4 text-amber-600" />
        <AlertDescription className="text-amber-800 text-xs leading-relaxed">
          Relatório gerado como <strong>ferramenta de apoio profissional</strong>. Todos os PDFs incluem
          aviso legal, indicando que não constituem diagnóstico ou prescrição. Assinatura e registro
          profissional são obrigatórios para documentos clínicos.
        </AlertDescription>
      </Alert>

      {/* Paciente */}
      <Card>
        <CardContent className="pt-4 pb-4">
          <div className="flex items-center gap-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
            <User className="h-5 w-5 text-blue-600" />
            <div>
              <p className="font-semibold text-gray-800">Paciente: PAC-SEED-001</p>
              <p className="text-xs text-gray-500">28 anos · Feminino · Hipertrofia</p>
            </div>
            <button className="ml-auto text-xs text-blue-600 hover:underline">Alterar</button>
          </div>
        </CardContent>
      </Card>

      {/* Tipo de relatório */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Tipo de Relatório</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {REPORT_TYPES.map((rt) => (
            <button
              key={rt.value}
              onClick={() => setSelectedType(rt.value)}
              className={`text-left p-3 rounded-lg border-2 transition-all ${
                selectedType === rt.value
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <p className="font-medium text-sm text-gray-800">{rt.label}</p>
              <p className="text-xs text-gray-500 mt-0.5">{rt.description}</p>
            </button>
          ))}
        </CardContent>
      </Card>

      {/* Módulos a incluir */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Módulos a Incluir</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {MODULES.map((mod) => {
            const selected = selectedModules.includes(mod.id);
            return (
              <button
                key={mod.id}
                onClick={() => toggleModule(mod.id)}
                className={`flex items-center gap-2 p-2.5 rounded-md border text-xs transition-all ${
                  selected
                    ? 'border-blue-400 bg-blue-50 text-blue-800'
                    : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                }`}
              >
                {selected
                  ? <CheckSquare className="h-3.5 w-3.5 text-blue-600 flex-shrink-0" />
                  : <Square className="h-3.5 w-3.5 text-gray-400 flex-shrink-0" />}
                {mod.label}
              </button>
            );
          })}
        </CardContent>
      </Card>

      {/* Observações profissionais */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Observações do Profissional</CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea
            value={professionalNotes}
            onChange={(e) => setProfessionalNotes(e.target.value)}
            rows={4}
            placeholder="Observações clínicas adicionais a incluir no relatório (opcional)..."
          />
          <p className="text-xs text-gray-400 mt-2 italic">
            Campo de responsabilidade exclusiva do profissional. Será incluído no PDF com destaque.
          </p>
        </CardContent>
      </Card>

      {/* Prévia do aviso legal */}
      <Card className="border-amber-200 bg-amber-50">
        <CardHeader className="pb-2">
          <CardTitle className="text-xs text-amber-800 uppercase tracking-wide">
            Aviso Legal (incluído automaticamente)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <pre className="text-xs text-amber-700 whitespace-pre-wrap leading-relaxed">{LEGAL_DISCLAIMER}</pre>
        </CardContent>
      </Card>

      {/* Botões */}
      <div className="flex justify-end gap-3">
        {pdfReady && (
          <>
            <Button variant="outline" className="flex items-center gap-2">
              <Printer className="h-4 w-4" /> Imprimir
            </Button>
            <Button variant="outline" className="flex items-center gap-2">
              <Download className="h-4 w-4" /> Baixar PDF
            </Button>
          </>
        )}
        <Button
          onClick={handleGenerate}
          disabled={isGenerating || selectedModules.length === 0}
          className="flex items-center gap-2"
        >
          {isGenerating ? (
            <><span className="animate-spin">⟳</span> Gerando PDF…</>
          ) : (
            <>
              <FileText className="h-4 w-4" />
              Gerar Relatório
              <span className="flex items-center gap-0.5 text-blue-200">
                (5 <Coins className="h-3 w-3" />)
              </span>
            </>
          )}
        </Button>
      </div>

      {/* Confirmação */}
      {pdfReady && (
        <Alert className="border-green-300 bg-green-50">
          <FileText className="h-4 w-4 text-green-600" />
          <AlertDescription className="text-green-800 text-sm">
            <strong>Relatório gerado com sucesso.</strong> O PDF inclui todas as seções selecionadas,
            assinatura do profissional e aviso legal. Disponível para download por 7 dias.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
