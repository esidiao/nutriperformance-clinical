'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { PageHeader } from '@/components/PageHeader';
import {
  FileText, Coins, ShieldAlert, CheckSquare, Square,
  Download, Printer, User, CheckCircle, Eye, ChevronDown,
} from 'lucide-react';

type ReportType = 'nutritional_assessment' | 'physical_assessment' | 'supplementation_analysis' | 'full_clinical' | 'evolution' | 'goals';

const REPORT_TYPES = [
  { value: 'nutritional_assessment' as ReportType, label: 'Avaliação Nutricional', description: 'Anamnese, cálculo energético, metas e estratégia', tokens: 5, icon: '🥗' },
  { value: 'physical_assessment'    as ReportType, label: 'Avaliação Física',      description: 'Composição corporal, circunferências e objetivos', tokens: 5, icon: '🏋️' },
  { value: 'supplementation_analysis' as ReportType, label: 'Análise de Suplementação', description: 'Suplementos, riscos e recomendações', tokens: 5, icon: '💊' },
  { value: 'full_clinical'          as ReportType, label: 'Relatório Clínico Completo', description: 'Todos os módulos em um documento', tokens: 5, icon: '📋' },
  { value: 'evolution'              as ReportType, label: 'Evolução',             description: 'Histórico e progresso ao longo do tempo', tokens: 5, icon: '📈' },
  { value: 'goals'                  as ReportType, label: 'Metas e Acompanhamento', description: 'Progresso das metas definidas', tokens: 5, icon: '🎯' },
];

const MODULES = [
  { id: 'nutritional',   label: 'Avaliação Nutricional' },
  { id: 'physical',      label: 'Avaliação Física' },
  { id: 'supplementation', label: 'Suplementação' },
  { id: 'interactions',  label: 'Análise de Interações' },
  { id: 'bioavailability', label: 'Biodisponibilidade' },
  { id: 'lab',           label: 'Exames Laboratoriais' },
  { id: 'goals',         label: 'Metas e Evolução' },
  { id: 'alerts',        label: 'Alertas Clínicos' },
];

// Fake patient list for selector
const PATIENTS = [
  { id: 'P001', code: 'PAC-SEED-001', age: 28, gender: 'F', goal: 'Hipertrofia' },
  { id: 'P002', code: 'PAC-002',      age: 42, gender: 'M', goal: 'Emagrecimento' },
  { id: 'P003', code: 'PAC-003',      age: 35, gender: 'F', goal: 'Saúde geral' },
];

const LEGAL = `Este relatório foi gerado pelo NutriPerformance Clinical como ferramenta de apoio profissional.
NÃO constitui diagnóstico médico, prescrição ou tratamento.
Deve ser interpretado exclusivamente pelo profissional de saúde habilitado responsável.
CFN (Res. 599/2018) · CONFEF · LGPD (Lei 13.709/2018).`;

// Fake AI-generated preview content
const PREVIEW_CONTENT = `RELATÓRIO CLÍNICO COMPLETO
NutriPerformance Clinical — Ferramenta de Apoio

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PACIENTE: PAC-SEED-001 | DATA: 23/05/2026
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. AVALIAÇÃO NUTRICIONAL
   TMB (Mifflin): 1.448 kcal/dia
   GET (PAL 1,55): 2.244 kcal/dia
   IMC: 23,6 kg/m² — Eutrofia
   Diagnóstico: Eutrofia com massa muscular em ganho progressivo.
   Estratégia: Dieta hipercalórica moderada +300 kcal, foco em proteínas magras.

2. SUPLEMENTAÇÃO EM USO
   • Creatina Monoidratada 5g/dia — Risco: Baixo
   • Whey Protein 30g pós-treino — Risco: Baixo
   • Sulfato Ferroso 40mg/dia — Risco: Moderado
   • Vitamina D3 5000 UI/dia — Risco: Baixo

3. INTERAÇÕES IDENTIFICADAS
   ⚠ Ferro × Omeprazol (Moderado): Avaliar estratégia de suplementação.
   ✓ Creatina × Função renal (Baixo): Monitorar periodicamente.

4. METAS EM ANDAMENTO
   Massa muscular: 44,3 kg → Meta: 47,0 kg (75% concluído)
   Gordura corporal: 27,1% → Meta: 23,0% (28% concluído)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
AVISO LEGAL: Ferramenta de apoio. Não substitui diagnóstico médico.
CFN · CONFEF · LGPD (Lei 13.709/2018)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`;

export default function ReportNewPage() {
  const [selectedType, setSelectedType]       = useState<ReportType>('full_clinical');
  const [selectedPatient, setSelectedPatient] = useState(PATIENTS[0]);
  const [showPatientSelector, setShowPatientSelector] = useState(false);
  const [selectedModules, setSelectedModules] = useState(['nutritional', 'physical', 'supplementation', 'interactions', 'goals']);
  const [professionalNotes, setProfessionalNotes] = useState('');
  const [pdfReady, setPdfReady]               = useState(false);
  const [showPreview, setShowPreview]         = useState(false);

  const toggleModule = (id: string) =>
    setSelectedModules((p) => p.includes(id) ? p.filter((m) => m !== id) : [...p, id]);

  const handleGenerate = () => {
    setPdfReady(false);
    toast.promise(
      new Promise<void>((resolve) => setTimeout(resolve, 2500)).then(() => setPdfReady(true)),
      {
        loading: 'Gerando relatório PDF... (pode levar alguns segundos)',
        success: 'Relatório gerado! — 5 tokens consumidos',
        error: 'Erro ao gerar relatório',
      },
    );
  };

  const handleDownload = () => {
    toast.success('Download iniciado', { description: 'relatorio-pac-seed-001-2026-05-23.pdf' });
  };

  const handlePrint = () => {
    toast.info('Enviando para impressão...');
  };

  return (
    <div className="flex flex-col min-h-full">
      <PageHeader
        title="Gerar Relatório"
        description="PDF profissional com assinatura e aviso legal"
        breadcrumbs={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Relatórios' }]}
        action={
          <Badge variant="outline" className="text-blue-700 border-blue-300 flex items-center gap-1.5 px-3 py-1.5">
            <Coins className="h-3.5 w-3.5" /> 5 tokens
          </Badge>
        }
      />

      <div className="px-4 py-5 sm:p-6 max-w-3xl mx-auto w-full space-y-5 flex-1">
        <Alert className="border-amber-200 bg-amber-50 dark:bg-amber-950 dark:border-amber-900">
          <ShieldAlert className="h-4 w-4 text-amber-600 flex-shrink-0" />
          <AlertDescription className="text-amber-800 dark:text-amber-300 text-xs leading-relaxed">
            Relatório gerado como <strong>ferramenta de apoio profissional</strong>. PDFs incluem aviso legal —
            não constituem diagnóstico ou prescrição. Assinatura é obrigatória para documentos clínicos.
          </AlertDescription>
        </Alert>

        {/* Paciente */}
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="relative">
              <button
                onClick={() => setShowPatientSelector(!showPatientSelector)}
                className="w-full flex items-center gap-3 p-3 bg-blue-50 dark:bg-blue-950 rounded-xl border border-blue-200 dark:border-blue-800 hover:border-blue-300 transition-colors"
              >
                <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center flex-shrink-0">
                  <User className="h-4 w-4 text-white" />
                </div>
                <div className="flex-1 text-left">
                  <p className="font-semibold text-gray-800 dark:text-gray-200 text-sm">{selectedPatient.code}</p>
                  <p className="text-xs text-gray-500">{selectedPatient.age} anos · {selectedPatient.gender === 'F' ? 'Feminino' : 'Masculino'} · {selectedPatient.goal}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-blue-600 font-medium">Alterar</span>
                  <ChevronDown className={`h-4 w-4 text-blue-600 transition-transform ${showPatientSelector ? 'rotate-180' : ''}`} />
                </div>
              </button>
              {showPatientSelector && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-gray-900 rounded-xl border shadow-lg z-10 overflow-hidden">
                  {PATIENTS.map((p) => (
                    <button key={p.id} onClick={() => { setSelectedPatient(p); setShowPatientSelector(false); }}
                      className={`w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-800 text-left transition-colors ${selectedPatient.id === p.id ? 'bg-blue-50 dark:bg-blue-950' : ''}`}>
                      <div className="w-7 h-7 rounded-full bg-blue-500 flex items-center justify-center flex-shrink-0">
                        <span className="text-white text-xs font-bold">{p.code.slice(-2)}</span>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-800 dark:text-gray-200">{p.code}</p>
                        <p className="text-xs text-gray-500">{p.age}a · {p.goal}</p>
                      </div>
                      {selectedPatient.id === p.id && <CheckCircle className="ml-auto h-4 w-4 text-blue-600" />}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Tipo de relatório */}
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-sm font-semibold">Tipo de Relatório</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {REPORT_TYPES.map((rt) => (
              <button key={rt.value} onClick={() => setSelectedType(rt.value)}
                className={`text-left p-3 rounded-xl border-2 transition-all hover:-translate-y-0.5 ${selectedType === rt.value ? 'border-blue-500 bg-blue-50 dark:bg-blue-950' : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'}`}>
                <span className="text-xl mb-1 block">{rt.icon}</span>
                <p className="font-medium text-xs text-gray-800 dark:text-gray-200">{rt.label}</p>
                <p className="text-[10px] text-gray-400 mt-0.5 leading-tight">{rt.description}</p>
              </button>
            ))}
          </CardContent>
        </Card>

        {/* Módulos */}
        <Card>
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-semibold">Módulos a Incluir</CardTitle>
            <div className="flex gap-2">
              <button onClick={() => setSelectedModules(MODULES.map((m) => m.id))} className="text-xs text-blue-600 hover:underline">Todos</button>
              <span className="text-gray-300">·</span>
              <button onClick={() => setSelectedModules([])} className="text-xs text-gray-400 hover:underline">Nenhum</button>
            </div>
          </CardHeader>
          <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {MODULES.map((mod) => {
              const sel = selectedModules.includes(mod.id);
              return (
                <button key={mod.id} onClick={() => toggleModule(mod.id)}
                  className={`flex items-center gap-2 p-2.5 rounded-lg border text-xs transition-all ${sel ? 'border-blue-400 bg-blue-50 dark:bg-blue-950 text-blue-800 dark:text-blue-200' : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'}`}>
                  {sel ? <CheckSquare className="h-3.5 w-3.5 text-blue-600 flex-shrink-0" /> : <Square className="h-3.5 w-3.5 text-gray-400 flex-shrink-0" />}
                  {mod.label}
                </button>
              );
            })}
          </CardContent>
        </Card>

        {/* Notas profissionais */}
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold">Observações do Profissional</CardTitle></CardHeader>
          <CardContent>
            <Textarea value={professionalNotes} onChange={(e) => setProfessionalNotes(e.target.value)} rows={3}
              placeholder="Observações clínicas adicionais (responsabilidade exclusiva do profissional)..." />
          </CardContent>
        </Card>

        {/* Legal notice */}
        <details className="rounded-xl border border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950 overflow-hidden">
          <summary className="px-4 py-3 text-xs font-semibold text-amber-800 dark:text-amber-300 cursor-pointer uppercase tracking-wide">
            Aviso Legal (incluído automaticamente no PDF)
          </summary>
          <pre className="px-4 pb-3 text-xs text-amber-700 dark:text-amber-400 whitespace-pre-wrap leading-relaxed">{LEGAL}</pre>
        </details>

        {/* Preview modal */}
        {showPreview && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col">
              <div className="flex items-center justify-between px-5 py-4 border-b dark:border-gray-700">
                <h3 className="font-semibold text-sm">Prévia do Relatório</h3>
                <button onClick={() => setShowPreview(false)} className="text-gray-400 hover:text-gray-600 text-lg font-bold">×</button>
              </div>
              <div className="flex-1 overflow-y-auto p-5">
                <pre className="text-xs text-gray-700 dark:text-gray-300 font-mono whitespace-pre-wrap leading-relaxed">{PREVIEW_CONTENT}</pre>
              </div>
              <div className="px-5 py-3 border-t dark:border-gray-700 flex justify-end gap-2">
                <Button size="sm" variant="outline" onClick={() => setShowPreview(false)}>Fechar</Button>
                <Button size="sm" onClick={handleDownload} className="flex items-center gap-2">
                  <Download className="h-4 w-4" /> Baixar PDF
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-between pt-2 border-t dark:border-gray-800">
          {pdfReady ? (
            <div className="flex items-center gap-2 text-green-600 text-sm font-medium">
              <CheckCircle className="h-4 w-4" />
              PDF pronto — disponível por 7 dias
            </div>
          ) : <div />}
          <div className="flex gap-2">
            {pdfReady && (
              <>
                <Button variant="outline" size="sm" onClick={() => setShowPreview(true)} className="flex items-center gap-2">
                  <Eye className="h-4 w-4" /> Prévia
                </Button>
                <Button variant="outline" size="sm" onClick={handlePrint} className="flex items-center gap-2">
                  <Printer className="h-4 w-4" /> Imprimir
                </Button>
                <Button variant="outline" size="sm" onClick={handleDownload} className="flex items-center gap-2 text-green-700 border-green-300 hover:bg-green-50">
                  <Download className="h-4 w-4" /> Baixar PDF
                </Button>
              </>
            )}
            <Button onClick={handleGenerate} disabled={selectedModules.length === 0} className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              {pdfReady ? 'Regenerar' : 'Gerar Relatório'}
              <span className="text-blue-200 text-xs">(5 tk)</span>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
