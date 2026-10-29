'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api } from '@/lib/api-client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { PageHeader } from '@/components/PageHeader';
import { FoodAutocomplete, type FoodResult } from '@/components/FoodAutocomplete';
import { SeletorDePaciente, type PacienteResumo } from '@/components/SeletorDePaciente';
import { escalarMacros, emGramas, type Por100 } from '@/lib/escala-nutricional';
import { micronutrientesPor100, escalarMicros, somarMicros } from '@/lib/micronutrientes-alimento';
import { RelatorioAdequacao } from '@/components/RelatorioAdequacao';
import type { PrescriptionData, PrescriptionItem, PrescriptionInteraction, PrescriptionMeal } from '@/lib/pdf/generatePrescription';
import {
  FileText, Download, Plus, Trash2, Coins, ShieldAlert,
  CheckCircle, Pill, Leaf, AlertTriangle, Clock, UtensilsCrossed, Flame,
} from 'lucide-react';

// A lista de pacientes vem da API. Antes eram quatro exemplos escritos aqui
// (PAC-SEED-001 a PAC-004): o PDF saía certinho, mas vinculado a um paciente
// que não existe. Relatório de testes de 07/10/2026, item 4.

// QUEM ASSINA VEM DE `/users/me`, nunca de constante.
//
// Aqui havia PROFESSIONAL = { name: 'Dra. Ana Costa', council: 'CRN-3',
// councilNumber: '12345', ... }: TODO PDF, de qualquer profissional, saía
// assinado com esse nome e esse registro.
//
// Registro de conselho identifica legalmente quem assina um documento
// clínico. Um documento que chega ao paciente com registro inventado é pior
// que um sem assinatura, porque parece assinado.
//
// É o mesmo defeito que o relatório de 07/10/2026 pegou com os PACIENTES
// (quatro exemplos escritos aqui, "o PDF saía certinho, mas vinculado a um
// paciente que não existe"). A parte do paciente foi corrigida e esta ficou,
// porque o PDF continuou saindo bonito. Achada em 29/10/2026 ao ligar o mesmo
// gerador na tela do plano alimentar.

const COMMON_SUPPLEMENTS = [
  'Creatina monoidratada', 'Whey Protein Concentrado', 'Whey Protein Isolado',
  'BCAA', 'Glutamina', 'Beta-alanina', 'Cafeína anidra',
  'Vitamina D3', 'Vitamina C', 'Vitamina B12', 'Complexo B',
  'Ômega-3', 'Ferro bisglicinato', 'Zinco quelato',
  'Magnésio dimalato', 'Cálcio quelato', 'Probiótico',
  'Colágeno hidrolisado', 'Melatonina', 'Ashwagandha',
  'L-Carnitina', 'Coenzima Q10', 'Curcumina',
];

type DocType = 'supplementation' | 'prescription';

// ─── Meal model (prescrição nutricional) ───────────────────────────────────────
//
// `quantidadeG` é número e `dose` é a medida caseira ("3 colheres de sopa").
// Antes havia só `dose`, texto livre, e os macros vinham da base SEM
// multiplicar — ou seja, ficavam na base 100 qualquer que fosse a quantidade
// digitada. Toda tabela de composição (TACO, USDA) é por 100 g, então "60 g de
// arroz" exibia os valores de 100 g. Relatado pela nutricionista em
// 09/10/2026, e é o defeito mais grave do conjunto: a dieta inteira fechava
// com números errados.
type MealFood = {
  name: string;
  /** Gramas. Dirige o cálculo. */
  quantidadeG: string;
  /** Medida caseira, para o paciente: "3 colheres de sopa", "1 escumadeira". */
  dose: string;
  notes: string;
  kcal: string; prot: string; carb: string; fat: string;
  /**
   * Valores por 100 g do alimento escolhido na base. Enquanto existirem, mudar
   * as gramas recalcula. Editar um macro à mão desfaz o vínculo (vira null):
   * número prescrito não pode ser sobrescrito sem o profissional mandar.
   */
  por100: Por100 | null;
  /** Micronutrientes por 100 g do alimento da base. Ausencia = sem dado. */
  microsPor100: Record<string, number> | null;
};
type Meal = { name: string; time: string; foods: MealFood[] };

const emptyMealFood = (): MealFood => ({
  name: '', quantidadeG: '', dose: '', notes: '',
  kcal: '', prot: '', carb: '', fat: '', por100: null, microsPor100: null,
});

const recalcular = (f: MealFood): MealFood =>
  f.por100 ? { ...f, ...escalarMacros(f.por100, emGramas(f.quantidadeG)) } : f;

// Refeições disponíveis para adição rápida
const MEAL_PRESETS = [
  'Desjejum', 'Colação', 'Almoço', 'Lanche da tarde I', 'Lanche da tarde II',
  'Lanche da tarde III', 'Jantar', 'Ceia', 'Pré-treino', 'Pós-treino',
];

const makeDefaultMeals = (): Meal[] =>
  [
    { name: 'Desjejum',          time: '07:00' },
    { name: 'Colação',           time: '10:00' },
    { name: 'Almoço',            time: '12:30' },
    { name: 'Lanche da tarde I', time: '16:00' },
    { name: 'Jantar',            time: '19:30' },
  ].map((m) => ({ ...m, foods: [emptyMealFood()] }));

// Converte string "12,5" / "12.5" em número seguro (0 se inválido)
const toNum = (s: string) => {
  const n = parseFloat((s || '').replace(',', '.'));
  return isFinite(n) ? Math.max(0, n) : 0;
};

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
const emptyInter = (): PrescriptionInteraction => ({ pair: '', risk: 'moderate', recommendation: '' });

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function PrescriptionNewPage() {
  const [docType, setDocType]           = useState<DocType>('supplementation');
  const [patientId, setPatientId]       = useState('');
  const [patient, setPatient]           = useState<PacienteResumo | null>(null);
  const [items, setItems]               = useState<PrescriptionItem[]>([emptySupp()]);
  const [meals, setMeals]               = useState<Meal[]>(makeDefaultMeals());
  const [interactions, setInteractions] = useState<PrescriptionInteraction[]>([]);
  const [notes, setNotes]               = useState('');
  const [validity, setValidity]         = useState('90');
  const [generating, setGenerating]     = useState(false);

  // Quem assina. Buscado aqui, e nao no clique, porque faltando registro a
  // tela precisa avisar ANTES de a profissional montar o documento inteiro.
  const eu = useQuery({ queryKey: ['eu'], queryFn: () => api.usuarios.eu(), retry: false });
  const semIdentidade = !eu.isLoading && (!eu.data?.conselho || !eu.data?.conselhoNumero);

  // ─── Supplement item CRUD ──────────────────────────────────────────────────
  const updateItem = (i: number, field: keyof PrescriptionItem, val: string) =>
    setItems((prev) => prev.map((it, idx) => idx === i ? { ...it, [field]: val } : it));
  const addItem = () => setItems((p) => [...p, emptySupp()]);
  const removeItem = (i: number) => setItems((p) => p.filter((_, idx) => idx !== i));

  // ─── Meal CRUD (prescrição nutricional) ────────────────────────────────────
  const updateMeal = (mi: number, field: 'name' | 'time', val: string) =>
    setMeals((prev) => prev.map((m, idx) => idx === mi ? { ...m, [field]: val } : m));
  const addMeal = (name = 'Nova refeição') => setMeals((p) => [...p, { name, time: '', foods: [emptyMealFood()] }]);
  const removeMeal = (mi: number) => setMeals((p) => p.filter((_, idx) => idx !== mi));
  const MACROS = ['kcal', 'prot', 'carb', 'fat'] as const;

  const updateFood = (mi: number, fi: number, field: keyof MealFood, val: string) =>
    setMeals((prev) => prev.map((m, idx) => idx !== mi ? m : {
      ...m,
      foods: m.foods.map((f, j) => {
        if (j !== fi) return f;
        // Mexer na gramagem recalcula; mexer num macro à mão desfaz o vínculo
        // com a base, senão a próxima mudança de gramas apagaria o valor que
        // o profissional digitou.
        if (field === 'quantidadeG') return recalcular({ ...f, quantidadeG: val });
        if ((MACROS as readonly string[]).includes(field as string)) {
          // Desfaz o vinculo com a base: a partir daqui os numeros sao do
          // profissional. Os micros tambem saem — mantê-los seria afirmar
          // composicao de um alimento cujos macros foram sobrescritos.
          return { ...f, [field]: val, por100: null, microsPor100: null };
        }
        return { ...f, [field]: val };
      }),
    }));
  const addFood = (mi: number) =>
    setMeals((prev) => prev.map((m, idx) => idx === mi ? { ...m, foods: [...m.foods, emptyMealFood()] } : m));
  const removeFood = (mi: number, fi: number) =>
    setMeals((prev) => prev.map((m, idx) => idx === mi ? { ...m, foods: m.foods.filter((_, j) => j !== fi) } : m));

  /**
   * Guarda os valores POR 100 G do alimento e calcula para a quantidade atual.
   *
   * A versão anterior copiava `food.energiaKcal` direto para o campo kcal.
   * Como a base é toda por 100 g, o número exibido era o de 100 g — e mudar a
   * quantidade não mexia nele, porque não havia o que recalcular.
   */
  const applyFood = (mi: number, fi: number, food: FoodResult) =>
    setMeals((prev) => prev.map((m, idx) => idx !== mi ? m : {
      ...m,
      foods: m.foods.map((f, j) => j !== fi ? f : recalcular({
        ...f,
        name: food.nome,
        // Se ainda não há quantidade, começa pela porção padrão do alimento.
        quantidadeG: f.quantidadeG.trim() || String(Math.round(food.porcaoPadraoG)),
        por100: {
          kcal: food.energiaKcal,
          prot: food.proteinasG,
          carb: food.carboidratosG,
          fat: food.lipidiosG,
        },
        // Fibra e sodio entram junto: na DRI eles sao avaliados como os
        // demais, e a base fornece os dois.
        microsPor100: {
          ...micronutrientesPor100(food),
          ...(food.fibrasG != null ? { fibrasG: Number(food.fibrasG) } : {}),
          ...(food.sodioMg != null ? { sodioMg: Number(food.sodioMg) } : {}),
        },
      })),
    }));

  // ─── Interaction CRUD ──────────────────────────────────────────────────────
  const updateInter = (i: number, field: keyof PrescriptionInteraction, val: string) =>
    setInteractions((p) => p.map((it, idx) => idx === i ? { ...it, [field]: val } : it));
  const addInter = () => setInteractions((p) => [...p, emptyInter()]);
  const removeInter = (i: number) => setInteractions((p) => p.filter((_, idx) => idx !== i));

  // ─── Derived: prescrição por refeição → estrutura para o PDF ────────────────
  const buildMeals = (): PrescriptionMeal[] =>
    meals
      .map((m) => ({
        name: m.name.trim() || 'Refeição',
        time: m.time.trim() || undefined,
        items: m.foods
          .filter((f) => f.name.trim())
          // O PDF leva gramas E medida caseira: a grama é o que foi prescrito,
          // a medida caseira é como o paciente serve. Perder qualquer uma das
          // duas torna o documento pior para um dos dois leitores.
          .map<PrescriptionItem>((f) => {
            const g = f.quantidadeG.trim();
            const caseira = f.dose.trim();
            const dose = g && caseira ? `${g} g (${caseira})` : (g ? `${g} g` : caseira);
            return { name: f.name, dose, frequency: '', notes: f.notes };
          }),
      }))
      .filter((m) => m.items.length > 0);

  const suppCount = items.filter((i) => i.name.trim()).length;
  const mealFoodCount = meals.reduce((acc, m) => acc + m.foods.filter((f) => f.name.trim()).length, 0);
  const mealCount = meals.filter((m) => m.foods.some((f) => f.name.trim())).length;
  const hasContent = docType === 'supplementation' ? suppCount > 0 : mealFoodCount > 0;

  // ─── Totais nutricionais (calorias + macros) ────────────────────────────────
  const mealTotal = (m: Meal) =>
    m.foods.reduce((acc, f) => f.name.trim() ? {
      kcal: acc.kcal + toNum(f.kcal), prot: acc.prot + toNum(f.prot),
      carb: acc.carb + toNum(f.carb), fat: acc.fat + toNum(f.fat),
    } : acc, { kcal: 0, prot: 0, carb: 0, fat: 0 });
  const totals = meals.reduce((acc, m) => {
    const t = mealTotal(m);
    return { kcal: acc.kcal + t.kcal, prot: acc.prot + t.prot, carb: acc.carb + t.carb, fat: acc.fat + t.fat };
  }, { kcal: 0, prot: 0, carb: 0, fat: 0 });
  // ─── Micronutrientes do dia, com COBERTURA ─────────────────────────────────
  //
  // Entram TODOS os alimentos com nome, inclusive os digitados a mao — e e
  // proposital. Alimento digitado nao tem micronutriente conhecido, e contar
  // so os da base faria a cobertura parecer completa quando nao e. O relatorio
  // precisa poder dizer "3 de 10 alimentos nao tem este nutriente".
  const alimentosDoDia = meals.flatMap((m) => m.foods.filter((f) => f.name.trim()));
  const microsDoDia = somarMicros(
    alimentosDoDia.map((f) => escalarMicros(f.microsPor100, emGramas(f.quantidadeG))),
  );

  const macroKcal = totals.prot * 4 + totals.carb * 4 + totals.fat * 9;
  const macroPct = (v: number) => (macroKcal > 0 ? Math.round((v / macroKcal) * 100) : 0);
  const hasNutrition = totals.kcal > 0 || macroKcal > 0;

  // ─── Generate PDF ──────────────────────────────────────────────────────────
  const handleGenerate = async () => {
    // Antes a tela tinha um paciente de exemplo sempre selecionado, entao
    // nunca faltava. Com a lista real, gerar sem escolher produziria um
    // documento assinado sem identificar ninguem.
    if (!patient) {
      toast.error('Escolha o paciente antes de gerar o PDF.');
      return;
    }
    if (!hasContent) {
      toast.error(docType === 'supplementation'
        ? 'Adicione ao menos um suplemento antes de gerar o PDF.'
        : 'Adicione ao menos um alimento em alguma refeição.');
      return;
    }

    setGenerating(true);
    try {
      const presMeals = docType === 'prescription' ? buildMeals() : undefined;
      const data: PrescriptionData = {
        type: docType,
        prescriptionNumber: generatePrescNum(),
        date: todayBR(),
        validity: validityDate(Number(validity) || 90),
        professional: {
          name: eu.data!.nome,
          council: eu.data!.conselho!,
          councilNumber: eu.data!.conselhoUf
            ? `${eu.data!.conselhoNumero}/${eu.data!.conselhoUf}`
            : eu.data!.conselhoNumero!,
          specialty: '',
          clinic: '',
        },
        patient: {
          name: patient!.name,
          code: patient!.internalCode ?? '—',
          age: patient!.age ?? 0,
          gender: patient!.gender ?? '—',
        },
        items: docType === 'supplementation'
          ? items.filter((it) => it.name.trim())
          : (presMeals ?? []).flatMap((m) => m.items),
        meals: presMeals,
        nutritionSummary: docType === 'prescription' && hasNutrition
          ? { kcal: totals.kcal, protein: totals.prot, carb: totals.carb, fat: totals.fat }
          : undefined,
        interactions: interactions.filter((i) => i.pair.trim()),
        professionalNotes: notes || undefined,
      };

      const { generatePrescriptionPDF } = await import('@/lib/pdf/generatePrescription');
      await generatePrescriptionPDF(data);
      toast.success('Prescrição gerada com sucesso!', {
        // Nome do paciente NAO entra no nome do arquivo: ele fica visivel na
        // pasta de downloads e em qualquer tela compartilhada.
        description: `prescricao-${(patient!.internalCode ?? patient!.id.slice(0, 8)).toLowerCase()}-${todayBR().replace(/\//g, '-')}.pdf`,
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
      desc: 'Plano alimentar organizado por refeição (café, almoço, lanches, jantar...)' },
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
                  onClick={() => { setDocType(key); if (key === 'supplementation') setItems([emptySupp()]); }}
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
            <SeletorDePaciente
              id="prescricao-paciente"
              label="Paciente"
              obrigatorio
              value={patientId}
              onChange={(id, p) => { setPatientId(id); setPatient(p ?? null); }}
            />
            {patient && (
              <p className="mt-2 text-xs text-gray-500">
                {patient.internalCode ?? 'sem código'}
                {patient.age != null ? ` · ${patient.age} anos` : ''}
                {patient.gender ? ` · ${patient.gender}` : ''}
              </p>
            )}
          </CardContent>
        </Card>

        {/* ─── SUPLEMENTAÇÃO: lista simples ─────────────────────────────────── */}
        {docType === 'supplementation' && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Pill className="h-4 w-4 text-gray-500" />
                {cfg.label}
              </CardTitle>
              <Button type="button" variant="outline" size="sm" onClick={addItem} className="flex items-center gap-1.5 text-xs">
                <Plus className="h-3.5 w-3.5" /> Adicionar
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              {items.map((item, i) => (
                <div key={i} className="p-3 bg-gray-50 dark:bg-gray-800 rounded-xl space-y-3 relative">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-semibold text-gray-500">Item {i + 1}</span>
                    {items.length > 1 && (
                      <button onClick={() => removeItem(i)} aria-label={`Remover item ${item.name?.trim() || i + 1}`}
                        className="text-red-400 hover:text-red-600 p-1 rounded">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="sm:col-span-2">
                      <Label className="text-xs">Nome do suplemento *</Label>
                      <Input value={item.name} onChange={(e) => updateItem(i, 'name', e.target.value)}
                        placeholder="Ex: Creatina monoidratada" list={`supp-${i}`} maxLength={100} className="mt-1" />
                      <datalist id={`supp-${i}`}>
                        {COMMON_SUPPLEMENTS.map((s) => <option key={s} value={s} />)}
                      </datalist>
                    </div>
                    <div>
                      <Label className="text-xs">Dose / Quantidade *</Label>
                      <Input value={item.dose} onChange={(e) => updateItem(i, 'dose', e.target.value)} placeholder="Ex: 5g" maxLength={50} className="mt-1" />
                    </div>
                    <div>
                      <Label className="text-xs">Frequência *</Label>
                      <Input value={item.frequency} onChange={(e) => updateItem(i, 'frequency', e.target.value)} placeholder="Ex: 1x ao dia" maxLength={60} className="mt-1" />
                    </div>
                    <div>
                      <Label className="text-xs">Horário / Timing</Label>
                      <Input value={item.timing ?? ''} onChange={(e) => updateItem(i, 'timing', e.target.value)} placeholder="Ex: Pré-treino" maxLength={60} className="mt-1" />
                    </div>
                    <div>
                      <Label className="text-xs">Observações</Label>
                      <Input value={item.notes ?? ''} onChange={(e) => updateItem(i, 'notes', e.target.value)} placeholder="Ex: Tomar com suco de laranja" maxLength={200} className="mt-1" />
                    </div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* ─── PRESCRIÇÃO NUTRICIONAL: por refeição ─────────────────────────── */}
        {docType === 'prescription' && (
          <Card>
            <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <UtensilsCrossed className="h-4 w-4 text-green-600" />
                Plano Alimentar por Refeição
              </CardTitle>
              <div className="flex items-center gap-2">
                <select
                  value=""
                  onChange={(e) => { if (e.target.value) { addMeal(e.target.value); e.target.value = ''; } }}
                  className="h-8 rounded-md border px-2 text-xs dark:bg-gray-800 dark:border-gray-700"
                  title="Adicionar refeição pré-definida"
                >
                  <option value="">+ Refeição pré-definida…</option>
                  {MEAL_PRESETS.map((m) => <option key={m} value={m}>{m}</option>)}
                </select>
                <Button type="button" variant="outline" size="sm" onClick={() => addMeal()} className="flex items-center gap-1.5 text-xs">
                  <Plus className="h-3.5 w-3.5" /> Personalizada
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {meals.map((meal, mi) => (
                <div key={mi} className="rounded-xl border border-green-200 dark:border-green-900 overflow-hidden">
                  {/* Cabeçalho da refeição */}
                  <div className="flex items-center gap-2 bg-green-50 dark:bg-green-950 px-3 py-2 border-b border-green-100 dark:border-green-900">
                    <Leaf className="h-4 w-4 text-green-600 flex-shrink-0" />
                    <Input
                      value={meal.name}
                      onChange={(e) => updateMeal(mi, 'name', e.target.value)}
                      placeholder="Nome da refeição"
                      maxLength={40}
                      className="h-8 text-sm font-semibold bg-white dark:bg-gray-900 flex-1"
                    />
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <Clock className="h-3.5 w-3.5 text-gray-400" />
                      <Input
                        value={meal.time}
                        onChange={(e) => updateMeal(mi, 'time', e.target.value)}
                        placeholder="hh:mm"
                        maxLength={12}
                        className="h-8 text-xs w-20 bg-white dark:bg-gray-900"
                      />
                    </div>
                    {meals.length > 1 && (
                      <button onClick={() => removeMeal(mi)} className="text-red-400 hover:text-red-600 p-1 rounded flex-shrink-0" title="Remover refeição" aria-label="Remover refeição">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                  {/* Alimentos da refeição */}
                  <div className="p-3 space-y-2">
                    {meal.foods.map((food, fi) => (
                      <div key={fi} className="rounded-lg border border-gray-100 dark:border-gray-800 p-2 space-y-2">
                        <div className="grid grid-cols-12 gap-2 items-start">
                          <div className="col-span-12 sm:col-span-4">
                            <Label className="text-[10px] text-gray-500">Alimento / Preparação</Label>
                            <FoodAutocomplete
                              value={food.name}
                              onChange={(name) => updateFood(mi, fi, 'name', name)}
                              onSelect={(f) => applyFood(mi, fi, f)}
                              placeholder="Buscar na base (TACO/USDA) ou digitar…"
                              className="h-9 text-sm"
                            />
                          </div>
                          <div className="col-span-4 sm:col-span-2">
                            <Label className="text-[10px] text-gray-500">Quantidade (g)</Label>
                            <Input
                              type="number" min={0} step="1" inputMode="decimal"
                              value={food.quantidadeG}
                              onChange={(e) => updateFood(mi, fi, 'quantidadeG', e.target.value)}
                              placeholder="60"
                              className="h-9 text-sm"
                            />
                          </div>
                          <div className="col-span-8 sm:col-span-3">
                            <Label className="text-[10px] text-gray-500">Medida caseira</Label>
                            <Input value={food.dose} onChange={(e) => updateFood(mi, fi, 'dose', e.target.value)}
                              placeholder="3 colheres de sopa" maxLength={60} className="h-9 text-sm" />
                          </div>
                          <div className="col-span-12 sm:col-span-3">
                            <Label className="text-[10px] text-gray-500">Obs. / Substituição</Label>
                            <Input value={food.notes} onChange={(e) => updateFood(mi, fi, 'notes', e.target.value)}
                              placeholder="Ex: ou 1 scoop whey" maxLength={200} className="h-9 text-sm" />
                          </div>
                        </div>
                        {/* Valores nutricionais. Com alimento da base, saem do
                            cálculo e NÃO devem ser digitados — por isso o
                            aviso diz o que acontece se forem. */}
                        <p className="text-[10px] text-gray-400">
                          {food.por100
                            ? `Calculado para ${food.quantidadeG || '0'} g a partir da base (valores por 100 g). Editar um campo abaixo desfaz o cálculo automático.`
                            : 'Valores digitados manualmente.'}
                        </p>
                        <div className="flex items-end gap-2">
                          <div className="flex-1">
                            <Label className="text-[10px] text-gray-500">Kcal</Label>
                            <Input type="number" min={0} value={food.kcal} onChange={(e) => updateFood(mi, fi, 'kcal', e.target.value)} placeholder="0" className="h-8 text-xs" />
                          </div>
                          <div className="flex-1">
                            <Label className="text-[10px] text-gray-500">Proteína (g)</Label>
                            <Input type="number" min={0} step="0.1" value={food.prot} onChange={(e) => updateFood(mi, fi, 'prot', e.target.value)} placeholder="0" className="h-8 text-xs" />
                          </div>
                          <div className="flex-1">
                            <Label className="text-[10px] text-gray-500">Carbo (g)</Label>
                            <Input type="number" min={0} step="0.1" value={food.carb} onChange={(e) => updateFood(mi, fi, 'carb', e.target.value)} placeholder="0" className="h-8 text-xs" />
                          </div>
                          <div className="flex-1">
                            <Label className="text-[10px] text-gray-500">Gordura (g)</Label>
                            <Input type="number" min={0} step="0.1" value={food.fat} onChange={(e) => updateFood(mi, fi, 'fat', e.target.value)} placeholder="0" className="h-8 text-xs" />
                          </div>
                          {meal.foods.length > 1 && (
                            <button onClick={() => removeFood(mi, fi)} className="text-red-400 hover:text-red-600 p-1.5 rounded mb-0.5" title="Remover alimento" aria-label="Remover alimento">
                              <Trash2 className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <Button type="button" variant="ghost" size="sm" onClick={() => addFood(mi)}
                        className="text-xs text-green-700 hover:text-green-800 hover:bg-green-50 dark:hover:bg-green-950 mt-1">
                        <Plus className="h-3.5 w-3.5 mr-1" /> Adicionar alimento
                      </Button>
                      {(() => {
                        const t = mealTotal(meal);
                        return (t.kcal > 0 || t.prot > 0 || t.carb > 0 || t.fat > 0) ? (
                          <span className="text-[11px] text-gray-500">
                            Subtotal: <strong>{Math.round(t.kcal)}</strong> kcal · P {Math.round(t.prot)}g · C {Math.round(t.carb)}g · G {Math.round(t.fat)}g
                          </span>
                        ) : null;
                      })()}
                    </div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Adequação de macro e micronutrientes.
            Vem DEPOIS do resumo porque o resumo é o que se olha o tempo todo
            enquanto monta; a adequação é a conferência do fim. */}
        {docType === 'prescription' && patientId && hasContent && (
          <RelatorioAdequacao
            patientId={patientId}
            // Proteina vem dos macros, que todo item tem. Fibra e sodio vem
            // de `microsDoDia` COM cobertura — passar zero aqui afirmaria que
            // a dieta nao fornece, que e diferente de nao haver o dado.
            totais={{
              proteinasG: totals.prot,
              ...microsDoDia,
            }}
          />
        )}

        {/* Dashboard nutricional (calorias + macros) — prescrição nutricional */}
        {docType === 'prescription' && (
          <Card className="border-green-200 bg-green-50/40 dark:bg-green-950/20">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Flame className="h-4 w-4 text-orange-500" /> Resumo Nutricional do Dia
              </CardTitle>
            </CardHeader>
            <CardContent>
              {hasNutrition ? (
                <>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {[
                      { label: 'Calorias', value: `${Math.round(totals.kcal)}`, unit: 'kcal', color: 'text-orange-600' },
                      { label: 'Proteínas', value: `${Math.round(totals.prot)}`, unit: `g · ${macroPct(totals.prot * 4)}%`, color: 'text-blue-600' },
                      { label: 'Carboidratos', value: `${Math.round(totals.carb)}`, unit: `g · ${macroPct(totals.carb * 4)}%`, color: 'text-amber-600' },
                      { label: 'Gorduras', value: `${Math.round(totals.fat)}`, unit: `g · ${macroPct(totals.fat * 9)}%`, color: 'text-rose-600' },
                    ].map((k) => (
                      <div key={k.label} className="rounded-xl bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 px-3 py-2 text-center">
                        <p className={`text-2xl font-bold ${k.color}`}>{k.value}</p>
                        <p className="text-[11px] text-gray-500">{k.label} · {k.unit}</p>
                      </div>
                    ))}
                  </div>
                  {/* Barra de distribuição de macronutrientes */}
                  <div className="mt-3 flex h-2.5 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
                    <div className="bg-blue-500" style={{ width: `${macroPct(totals.prot * 4)}%` }} />
                    <div className="bg-amber-500" style={{ width: `${macroPct(totals.carb * 4)}%` }} />
                    <div className="bg-rose-500" style={{ width: `${macroPct(totals.fat * 9)}%` }} />
                  </div>
                  <p className="mt-2 text-[11px] text-gray-500 leading-relaxed">
                    Cálculo automático a partir dos valores por alimento — preenchidos pela base de composição
                    (TACO/USDA) ao buscar, com edição manual livre. <strong>Micronutrientes</strong> serão ampliados
                    nas próximas fases (USDA/TBCA).
                  </p>
                </>
              ) : (
                <p className="text-xs text-gray-400 text-center py-2">
                  Informe <strong>Kcal</strong> e <strong>macros</strong> nos alimentos para visualizar o total de calorias e a distribuição de macronutrientes.
                </p>
              )}
            </CardContent>
          </Card>
        )}

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
          {interactions.length > 0 ? (
            <CardContent className="space-y-3">
              {interactions.map((inter, i) => (
                <div key={i} className="p-3 bg-yellow-50 dark:bg-yellow-950 rounded-xl space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-yellow-800 dark:text-yellow-300">Alerta {i + 1}</span>
                    <button onClick={() => removeInter(i)} aria-label={`Remover alerta ${i + 1}`}
                      className="text-red-400 hover:text-red-600 p-1 rounded">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <div className="sm:col-span-2">
                      <Label className="text-xs">Par de interação</Label>
                      <Input value={inter.pair} onChange={(e) => updateInter(i, 'pair', e.target.value)}
                        placeholder="Ex: Ferro × Omeprazol" maxLength={100} className="mt-1" />
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
                        placeholder="Ex: Separar horário de uso em 2 horas" maxLength={300} className="mt-1" />
                    </div>
                  </div>
                </div>
              ))}
            </CardContent>
          ) : (
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
                maxLength={500}
                placeholder="Orientações gerais, hidratação, contraindicações, próxima consulta..." />
            </CardContent>
          </Card>
        </div>

        {/* Preview do que será gerado */}
        <Card className="border-blue-200 bg-blue-50 dark:bg-blue-950/30">
          <CardContent className="pt-4 pb-4">
            <p className="text-xs font-semibold text-blue-800 dark:text-blue-300 mb-2">📄 O PDF incluirá:</p>
            <ul className="grid grid-cols-2 gap-x-4 gap-y-1">
              {[
                eu.data?.registro
                  ? `Cabeçalho — ${eu.data.nome} · ${eu.data.registro}`
                  : 'Cabeçalho — seu perfil não tem registro de conselho',
                patient
                  ? `Paciente — ${patient.name}${patient.internalCode ? ` · ${patient.internalCode}` : ''}`
                  : 'Paciente — nenhum selecionado',
                docType === 'supplementation'
                  ? `${suppCount} suplemento(s)`
                  : `${mealCount} refeição(ões) · ${mealFoodCount} alimento(s)`,
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

        {/*
          Sem registro de conselho nao se emite documento clinico. O aviso vem
          ANTES do botao: travar sem dizer por que e pior que nao travar.
        */}
        {semIdentidade && (
          <Alert className="border-amber-300 bg-amber-50 dark:bg-amber-950/30">
            <AlertTriangle className="h-4 w-4 text-amber-700" />
            <AlertDescription className="text-xs text-amber-900 dark:text-amber-200">
              Seu perfil nao tem <strong>registro de conselho</strong>. Um documento
              clinico identifica legalmente quem assina, entao ele nao pode ser
              emitido sem o seu numero. Complete o cadastro profissional para
              liberar a geracao.
            </AlertDescription>
          </Alert>
        )}

        {/* Action */}
        <div className="flex justify-end pt-2 border-t dark:border-gray-800">
          <Button
            onClick={handleGenerate}
            disabled={generating || !hasContent || !patient || semIdentidade}
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
