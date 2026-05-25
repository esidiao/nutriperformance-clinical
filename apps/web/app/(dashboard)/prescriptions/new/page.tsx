'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { PageHeader } from '@/components/PageHeader';
import type { PrescriptionData, PrescriptionItem, PrescriptionInteraction } from '@/lib/pdf/generatePrescription';
import {
  FileText, Download, Plus, Trash2, Coins, ShieldAlert,
  User, ChevronDown, CheckCircle, Pill, Leaf, AlertTriangle,
} from 'lucide-react';

// ─── Mock data ────────────────────────────────────────────────────────────────
const PATIENTS = [
  { id: 'P001', code: 'PAC-SEED-001', age: 28, gender: 'Feminino', goal: 'Hipertrofia' },
  { id: 'P002', code: 'PAC-002',      age: 42, gender: 'Masculino', goal: 'Emagrecimento' },
  { id: 'P003', code: 'PAC-003',      age: 35, gender: 'Feminino',  goal: 'Saúde geral' },
  { id: 'P004', code: 'PAC-004',      age: 24, gender: 'Masculino', goal: 'Performance' },
];

const PROFESSIONAL = {
  name: 'Dra. Ana Costa',
  council: 'CRN-3',
  councilNumber: '12345',
  specialty: 'Nutrição Clínica e Esportiva',
  clinic: 'Clínica NutriPerformance',
};

const COMMON_SUPPLEMENTS = [
  'Creatina monoidratada', 'Whey Protein Concentrado', 'Whey Protein Isolado',
  'BCAA', 'Glutamina', 'Beta-alanina', 'Cafeína anidra',
  'Vitamina D3', 'Vitamina C', 'Vitamina B12', 'Complexo B',
  'Ômega-3', 'Ferro bisglicinato', 'Zinco quelato',
  'Magnésio dimalato', 'Cálcio quelato', 'Probiótico',
  'Colágeno hidrolisado', 'Melatonina', 'Ashwagandha',
  'L-Carnitina', 'Coenzima Q10', 'Curcumina',
];

const COMMON_FOODS = [
  'Frango grelhado', 'Ovo inteiro', 'Clara de ovo', 'Arroz branco cozido',
  'Batata-doce cozida', 'Aveia em flocos', 'Banana-prata', 'Maçã',
  'Brócolis cozido', 'Espinafre cru', 'Azeite extravirgem', 'Amendoim',
  'Iogurte grego', 'Queijo cottage', 'Salmão grelhado', 'Atum em água',
  'Feijão cozido', 'Lentilha cozida', 'Quinoa cozida',
];

type DocType = 'supplementation' | 'prescription';

function generatePrescNum() {
  const d = new Date();
  return `NP-${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}-${Math.floor(Math.random() * 9000 + 1000)}`;
}

function todayBR() {
  return new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function validityDate(days = 90) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

// ─── Empty item factories ─────────────────────────────────────────────────────
const emptySupp = (): PrescriptionItem => ({ name: '', dose: '', frequency: '', timing: '', notes: '' });
const emptyFood = (): PrescriptionItem => ({ name: '', dose: '', frequency: '', notes: '' });
const emptyInter = (): PrescriptionInteraction => ({ pair: '', risk: 'moderate', recommendation: '' });

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function PrescriptionNewPage() {
  const [docType, setDocType]           = useState<DocType>('supplementation');
  const [patientOpen, setPatientOpen]   = useState(false);
  const [patient, setPatient]           = useState(PATIENTS[0]);
  const [items, setItems]               = useState<PrescriptionItem[]>([emptySupp()]);
  const [interactions, setInteractions] = useState<PrescriptionInteraction[]>([]);
  const [notes, setNotes]               = useState('');
  const [validity, setValidity]         = useState('90');
  const [generating, setGenerating]     = useState(false);

  // ─── Item CRUD ─────────────────────────────────────────────────────────────
  const updateItem = (i: number, field: keyof PrescriptionItem, val: string) =>
    setItems((prev) => prev.map((it, idx) => idx === i ? { ...it, [field]: val } : it));
  const addItem = () => setItems((p) => [...p, docType === 'supplementation' ? emptySupp() : emptyFood()]);
  const removeItem = (i: number) => setItems((p) => p.filter((_, idx) => idx !== i));

  // ─── Interaction CRUD ──────────────────────────────────────────────────────
  const updateInter = (i: number, field: keyof PrescriptionInteraction, val: string) =>
    setInteractions((p) => p.map((it, idx) => idx === i ? { ...it, [field]: val } : it));
  const addInter = () => setInteractions((p) => [...p, emptyInter()]);
  const removeInter = (i: number) => setInteractions((p) => p.filter((_, idx) => idx !== i));

  // ─── Generate PDF ──────────────────────────────────────────────────────────
  const handleGenerate = async () => {
    const validItems = items.filter((it) => it.name.trim());
    if (validItems.length === 0) {
      toast.error('Adicione ao menos um item antes de gerar o PDF.');
      return;
    }

    setGenerating(true);
    try {
      const data: PrescriptionData = {
        type: docType,
        prescriptionNumber: generatePrescNum(),
        date: todayBR(),
        validity: validityDate(Number(validity) || 90),
        professional: PROFESSIONAL,
        patient: {
          code: patient.code,
          age: patient.age,
          gender: patient.gender,
          goal: patient.goal,
        },
        items: validItems,
        interactions: interactions.filter((i) => i.pair.trim()),
        professionalNotes: notes || undefined,
      };

      const { generatePrescriptionPDF } = await import('@/lib/pdf/generatePrescription');
      await generatePrescriptionPDF(data);
      toast.success('Prescrição gerada com sucesso!', {
        description: `prescricao-${patient.code.toLowerCase()}-${todayBR().replace(/\//g, '-')}.pdf`,
      });
    } catch (err) {
      console.error(err);
      toast.error('Erro ao gerar PDF. Tente novamente.');
    } finally {
      setGenerating(false);
    }
  };

  const docTypeConfig = {
    supplementation: { label: 'Protocolo de Suplementação', icon: Pill, color: 'blue',
      desc: 'Lista de suplementos com dose, frequência e horário de uso' },
    prescription:    { label: 'Prescrição Nutricional', icon: Leaf, color: 'green',
      desc: 'Orientações alimentares, macros, alimentos e condutas nutricionais' },
  };

  const cfg = docTypeConfig[docType];

  return (
    <div className="flex flex-col min-h-full">
      <PageHeader
        title="Gerar Prescrição em PDF"
        description="Documento profissional com assinatura e aviso legal LGPD"
        breadcrumbs={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Prescrições', href: '/prescriptions/new' },
        ]}
        action={
          <Badge variant="outline" className="text-blue-700 border-blue-300 flex items-center gap-1.5 px-3 py-1.5">
            <Coins className="h-3.5 w-3.5" /> 3 tokens
          </Badge>
        }
      />

      <div className="px-4 py-5 sm:p-6 max-w-3xl mx-auto w-full space-y-5 flex-1">

        {/* Aviso ético */}
        <Alert className="border-amber-200 bg-amber-50 dark:bg-amber-950 dark:border-amber-900">
          <ShieldAlert className="h-4 w-4 text-amber-600 flex-shrink-0" />
          <AlertDescription className="text-amber-800 dark:text-amber-300 text-xs leading-relaxed">
            <strong>Documento de apoio ao profissional.</strong> A prescrição gerada é uma ferramenta de registro e comunicação —
            não substitui consulta, diagnóstico ou responsabilidade técnica do profissional habilitado (CFN/CONFEF).
            Resolução CFN 599/2018.
          </AlertDescription>
        </Alert>

        {/* Tipo de documento */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold">Tipo de Documento</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {(Object.entries(docTypeConfig) as [DocType, typeof cfg][]).map(([key, c]) => {
              const Icon = c.icon;
              const active = docType === key;
              return (
                <button
                  key={key}
                  onClick={() => { setDocType(key); setItems([key === 'supplementation' ? emptySupp() : emptyFood()]); }}
                  className={`text-left p-4 rounded-xl border-2 transition-all ${
                    active
                      ? key === 'supplementation'
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-950'
                        : 'border-green-500 bg-green-50 dark:bg-green-950'
                      : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <Icon className={`h-4 w-4 ${active ? (key === 'supplementation' ? 'text-blue-600' : 'text-green-600') : 'text-gray-400'}`} />
                    <span className="font-semibold text-sm text-gray-900 dark:text-white">{c.label}</span>
                    {active && <CheckCircle className={`h-3.5 w-3.5 ml-auto ${key === 'supplementation' ? 'text-blue-600' : 'text-green-600'}`} />}
                  </div>
                  <p className="text-xs text-gray-500 leading-relaxed">{c.desc}</p>
                </button>
              );
            })}
          </CardContent>
        </Card>

        {/* Paciente */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Paciente</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="relative">
              <button
                onClick={() => setPatientOpen(!patientOpen)}
                className="w-full flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 hover:border-blue-300 transition-colors"
              >
                <div className="w-9 h-9 rounded-full bg-blue-600 flex items-center justify-center flex-shrink-0">
                  <User className="h-4 w-4 text-white" />
                </div>
                <div className="flex-1 text-left">
                  <p className="font-semibold text-gray-800 dark:text-gray-200 text-sm">{patient.code}</p>
                  <p className="text-xs text-gray-500">{patient.age} anos · {patient.gender} · {patient.goal}</p>
                </div>
                <ChevronDown className={`h-4 w-4 text-gray-400 transition-transform ${patientOpen ? 'rotate-180' : ''}`} />
              </button>
              {patientOpen && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-gray-900 border dark:border-gray-700 rounded-xl shadow-xl z-20 overflow-hidden">
                  {PATIENTS.map((p) => (
                    <button key={p.id} onClick={() => { setPatient(p); setPatientOpen(false); }}
                      className={`w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-800 text-left transition-colors ${patient.id === p.id ? 'bg-blue-50 dark:bg-blue-950' : ''}`}>
                      <div className="w-7 h-7 rounded-full bg-blue-500 flex items-center justify-center flex-shrink-0">
                        <span className="text-white text-xs font-bold">{p.code.slice(-2)}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-800 dark:text-gray-200">{p.code}</p>
                        <p className="text-xs text-gray-500">{p.age}a · {p.gender} · {p.goal}</p>
                      </div>
                      {patient.id === p.id && <CheckCircle className="h-4 w-4 text-blue-600 flex-shrink-0" />}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Items */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <cfg.icon className="h-4 w-4 text-gray-500" />
              {cfg.label}
            </CardTitle>
            <Button type="button" variant="outline" size="sm" onClick={addItem} className="flex items-center gap-1.5 text-xs">
              <Plus className="h-3.5 w-3.5" /> Adicionar
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            {items.map((item, i) => (
              <div key={i} className="p-3 bg-gray-50 dark:bg-gray-800 rounded-xl space-y-3 relative">
                {/* Item number badge */}
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-semibold text-gray-500">Item {i + 1}</span>
                  {items.length > 1 && (
                    <button onClick={() => removeItem(i)} className="text-red-400 hover:text-red-600 p-1 rounded">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="sm:col-span-2">
                    <Label className="text-xs">
                      {docType === 'supplementation' ? 'Nome do suplemento *' : 'Alimento / Nutriente / Orientação *'}
                    </Label>
                    <Input
                      value={item.name}
                      onChange={(e) => updateItem(i, 'name', e.target.value)}
                      placeholder={docType === 'supplementation' ? 'Ex: Creatina monoidratada' : 'Ex: Arroz integral cozido'}
                      list={`suggestions-${i}`}
                      className="mt-1"
                    />
                    <datalist id={`suggestions-${i}`}>
                      {(docType === 'supplementation' ? COMMON_SUPPLEMENTS : COMMON_FOODS).map((s) => (
                        <option key={s} value={s} />
                      ))}
                    </datalist>
                  </div>

                  <div>
                    <Label className="text-xs">Dose / Quantidade *</Label>
                    <Input value={item.dose} onChange={(e) => updateItem(i, 'dose', e.target.value)}
                      placeholder={docType === 'supplementation' ? 'Ex: 5g' : 'Ex: 200g'} className="mt-1" />
                  </div>

                  <div>
                    <Label className="text-xs">Frequência *</Label>
                    <Input value={item.frequency} onChange={(e) => updateItem(i, 'frequency', e.target.value)}
                      placeholder="Ex: 1x ao dia" className="mt-1" />
                  </div>

                  {docType === 'supplementation' && (
                    <div>
                      <Label className="text-xs">Horário / Timing</Label>
                      <Input value={item.timing ?? ''} onChange={(e) => updateItem(i, 'timing', e.target.value)}
                        placeholder="Ex: Pré-treino" className="mt-1" />
                    </div>
                  )}

                  <div className={docType === 'supplementation' ? '' : 'sm:col-span-2'}>
                    <Label className="text-xs">Observações</Label>
                    <Input value={item.notes ?? ''} onChange={(e) => updateItem(i, 'notes', e.target.value)}
                      placeholder="Ex: Tomar com suco de laranja" className="mt-1" />
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Interações */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-yellow-500" />
              Interações e Alertas (opcional)
            </CardTitle>
            <Button type="button" variant="outline" size="sm" onClick={addInter} className="flex items-center gap-1.5 text-xs">
              <Plus className="h-3.5 w-3.5" /> Adicionar
            </Button>
          </CardHeader>
          {interactions.length > 0 && (
            <CardContent className="space-y-3">
              {interactions.map((inter, i) => (
                <div key={i} className="p-3 bg-yellow-50 dark:bg-yellow-950 rounded-xl space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-yellow-800 dark:text-yellow-300">Alerta {i + 1}</span>
                    <button onClick={() => removeInter(i)} className="text-red-400 hover:text-red-600 p-1 rounded">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <div className="sm:col-span-2">
                      <Label className="text-xs">Par de interação</Label>
                      <Input value={inter.pair} onChange={(e) => updateInter(i, 'pair', e.target.value)}
                        placeholder="Ex: Ferro × Omeprazol" className="mt-1" />
                    </div>
                    <div>
                      <Label className="text-xs">Risco</Label>
                      <select value={inter.risk} onChange={(e) => updateInter(i, 'risk', e.target.value as any)}
                        className="mt-1 w-full h-10 rounded-md border px-3 text-sm dark:bg-gray-800 dark:border-gray-700">
                        <option value="low">Baixo</option>
                        <option value="moderate">Moderado</option>
                        <option value="high">Alto</option>
                        <option value="contraindicated">Contraindicado</option>
                      </select>
                    </div>
                    <div className="sm:col-span-3">
                      <Label className="text-xs">Recomendação</Label>
                      <Input value={inter.recommendation} onChange={(e) => updateInter(i, 'recommendation', e.target.value)}
                        placeholder="Ex: Separar horário de uso em 2 horas" className="mt-1" />
                    </div>
                  </div>
                </div>
              ))}
            </CardContent>
          )}
          {interactions.length === 0 && (
            <CardContent>
              <p className="text-xs text-gray-400 text-center py-2">
                Nenhuma interação adicionada. Clique em "Adicionar" para incluir alertas no documento.
              </p>
            </CardContent>
          )}
        </Card>

        {/* Validade + Observações */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-xs font-semibold text-gray-600">Validade da Prescrição</CardTitle></CardHeader>
            <CardContent>
              <select value={validity} onChange={(e) => setValidity(e.target.value)}
                className="w-full h-10 rounded-md border px-3 text-sm dark:bg-gray-800 dark:border-gray-700">
                <option value="30">30 dias</option>
                <option value="60">60 dias</option>
                <option value="90">90 dias</option>
                <option value="180">6 meses</option>
                <option value="365">1 ano</option>
              </select>
            </CardContent>
          </Card>
          <Card className="sm:col-span-2">
            <CardHeader className="pb-2"><CardTitle className="text-xs font-semibold text-gray-600">Observações do Profissional</CardTitle></CardHeader>
            <CardContent>
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2}
                placeholder="Orientações gerais, contraindicações, próxima consulta..." />
            </CardContent>
          </Card>
        </div>

        {/* Preview do que será gerado */}
        <Card className="border-blue-200 bg-blue-50 dark:bg-blue-950/30">
          <CardContent className="pt-4 pb-4">
            <p className="text-xs font-semibold text-blue-800 dark:text-blue-300 mb-2">📄 O PDF incluirá:</p>
            <ul className="grid grid-cols-2 gap-x-4 gap-y-1">
              {[
                `Cabeçalho — ${PROFESSIONAL.name} · ${PROFESSIONAL.council} ${PROFESSIONAL.councilNumber}`,
                `Paciente — ${patient.code} · ${patient.age}a · ${patient.goal}`,
                `${items.filter(i => i.name).length} ${docType === 'supplementation' ? 'suplemento(s)' : 'item(s) alimentar(es)'}`,
                `${interactions.filter(i => i.pair).length} alerta(s) de interação`,
                'Área de assinatura (profissional + paciente)',
                'Aviso legal LGPD e disclaimer clínico',
              ].map((item) => (
                <li key={item} className="text-xs text-blue-700 dark:text-blue-300 flex items-center gap-1">
                  <span className="text-blue-400">✓</span> {item}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        {/* Action */}
        <div className="flex justify-end pt-2 border-t dark:border-gray-800">
          <Button
            onClick={handleGenerate}
            disabled={generating || items.filter(i => i.name.trim()).length === 0}
            size="lg"
            className="flex items-center gap-2 min-w-[200px]"
          >
            {generating ? (
              <>
                <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Gerando PDF...
              </>
            ) : (
              <>
                <Download className="h-4 w-4" />
                Gerar e Baixar PDF
                <span className="text-blue-200 text-xs">(3 tk)</span>
              </>
            )}
          </Button>
        </div>

      </div>
    </div>
  );
}
