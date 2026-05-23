'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Target, Plus, TrendingUp, CheckCircle,
  Clock, ChevronDown, ChevronUp,
} from 'lucide-react';

type GoalType =
  | 'weight_loss' | 'hypertrophy' | 'body_recomposition' | 'metabolic_improvement'
  | 'performance_improvement' | 'endurance_gain' | 'general_health'
  | 'clinical_recovery' | 'lean_mass_maintenance' | 'gastrointestinal_improvement';

const GOAL_LABEL: Record<GoalType, string> = {
  weight_loss: 'Emagrecimento',
  hypertrophy: 'Hipertrofia',
  body_recomposition: 'Recomposição corporal',
  metabolic_improvement: 'Melhora metabólica',
  performance_improvement: 'Melhora de performance',
  endurance_gain: 'Ganho de resistência',
  general_health: 'Saúde geral',
  clinical_recovery: 'Recuperação clínica',
  lean_mass_maintenance: 'Manutenção de massa magra',
  gastrointestinal_improvement: 'Melhora gastrointestinal',
};

interface Checkpoint { date: string; value: number; note?: string; }
interface Goal {
  id: string;
  goalType: GoalType;
  description: string;
  baselineValue?: number;
  targetValue?: number;
  targetUnit?: string;
  startDate: string;
  targetDate?: string;
  isAchieved: boolean;
  checkpoints: Checkpoint[];
}

const MOCK_GOALS: Goal[] = [
  {
    id: 'G1', goalType: 'hypertrophy', description: 'Aumentar massa muscular',
    baselineValue: 43.2, targetValue: 47.0, targetUnit: 'kg',
    startDate: '01/04/2026', targetDate: '01/10/2026',
    isAchieved: false,
    checkpoints: [
      { date: '01/04/2026', value: 43.2, note: 'Baseline' },
      { date: '01/05/2026', value: 43.9, note: 'Avaliação mensal' },
      { date: '22/05/2026', value: 44.3 },
    ],
  },
  {
    id: 'G2', goalType: 'body_recomposition', description: 'Reduzir percentual de gordura',
    baselineValue: 28.5, targetValue: 23.0, targetUnit: '%',
    startDate: '01/04/2026', targetDate: '01/10/2026',
    isAchieved: false,
    checkpoints: [
      { date: '01/04/2026', value: 28.5, note: 'Baseline' },
      { date: '01/05/2026', value: 27.8 },
      { date: '22/05/2026', value: 27.1 },
    ],
  },
  {
    id: 'G3', goalType: 'general_health', description: 'Normalizar ferritina sérica',
    baselineValue: 8.2, targetValue: 30.0, targetUnit: 'ng/mL',
    startDate: '15/03/2026', targetDate: '15/09/2026',
    isAchieved: false,
    checkpoints: [
      { date: '15/03/2026', value: 8.2, note: 'Baseline — início suplementação de ferro' },
      { date: '22/05/2026', value: 14.0, note: 'Reavaliação parcial' },
    ],
  },
];

function ProgressBar({ current, baseline, target }: { current: number; baseline: number; target: number }) {
  const isIncreasing = target > baseline;
  const range = Math.abs(target - baseline);
  if (range === 0) return null;
  const progress = isIncreasing
    ? Math.min(((current - baseline) / range) * 100, 100)
    : Math.min(((baseline - current) / range) * 100, 100);
  const pct = Math.max(0, Math.round(progress));

  return (
    <div className="space-y-1 mt-2">
      <div className="flex justify-between text-xs text-gray-500">
        <span>Baseline: {baseline}</span>
        <span className="font-semibold text-blue-700">{pct}% concluído</span>
        <span>Meta: {target}</span>
      </div>
      <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${pct >= 100 ? 'bg-green-500' : pct >= 50 ? 'bg-blue-500' : 'bg-blue-300'}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function daysRemaining(targetDate?: string): number | null {
  if (!targetDate) return null;
  const [d, m, y] = targetDate.split('/').map(Number);
  const target = new Date(y, m - 1, d);
  const today = new Date();
  return Math.ceil((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

export default function GoalsPage() {
  const [goals, setGoals] = useState<Goal[]>(MOCK_GOALS);
  const [showForm, setShowForm] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [checkpointValues, setCheckpointValues] = useState<Record<string, string>>({});

  const handleAddCheckpoint = (goalId: string) => {
    const val = parseFloat(checkpointValues[goalId] ?? '');
    if (isNaN(val)) return;
    setGoals((prev) =>
      prev.map((g) =>
        g.id === goalId
          ? { ...g, checkpoints: [...g.checkpoints, { date: new Date().toLocaleDateString('pt-BR'), value: val }] }
          : g,
      ),
    );
    setCheckpointValues((prev) => ({ ...prev, [goalId]: '' }));
  };

  const handleMarkAchieved = (goalId: string) => {
    setGoals((prev) => prev.map((g) => (g.id === goalId ? { ...g, isAchieved: true } : g)));
  };

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Metas e Evolução</h1>
          <p className="text-gray-500 text-sm mt-1">
            {goals.filter((g) => !g.isAchieved).length} metas em andamento ·{' '}
            {goals.filter((g) => g.isAchieved).length} atingidas
          </p>
        </div>
        <Button onClick={() => setShowForm((v) => !v)} className="flex items-center gap-2">
          <Plus className="h-4 w-4" />
          Nova meta
        </Button>
      </div>

      {/* Formulário nova meta (simplificado) */}
      {showForm && (
        <Card className="border-blue-200">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Definir Nova Meta</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>Tipo de meta</Label>
              <select className="w-full h-10 rounded-md border px-3 text-sm">
                {Object.entries(GOAL_LABEL).map(([val, label]) => (
                  <option key={val} value={val}>{label}</option>
                ))}
              </select>
            </div>
            <div>
              <Label>Descrição</Label>
              <Input placeholder="Ex: Reduzir percentual de gordura" />
            </div>
            <div>
              <Label>Valor inicial (baseline)</Label>
              <Input type="number" step="0.1" placeholder="Ex: 28.5" />
            </div>
            <div className="flex gap-2">
              <div className="flex-1">
                <Label>Meta</Label>
                <Input type="number" step="0.1" placeholder="Ex: 23.0" />
              </div>
              <div className="w-24">
                <Label>Unidade</Label>
                <Input placeholder="%, kg, ng/mL" />
              </div>
            </div>
            <div>
              <Label>Início</Label>
              <Input type="date" />
            </div>
            <div>
              <Label>Prazo</Label>
              <Input type="date" />
            </div>
            <div className="md:col-span-2 flex gap-3 justify-end">
              <Button variant="outline" onClick={() => setShowForm(false)}>Cancelar</Button>
              <Button onClick={() => setShowForm(false)}>Criar meta</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Lista de metas */}
      <div className="space-y-4">
        {goals.map((goal) => {
          const isExpanded = expandedId === goal.id;
          const latest = goal.checkpoints.at(-1);
          const days = daysRemaining(goal.targetDate);
          const pctDone = goal.baselineValue !== undefined && goal.targetValue !== undefined && latest
            ? Math.max(0, Math.min(100, Math.round(
                (Math.abs(latest.value - goal.baselineValue) /
                 Math.abs(goal.targetValue - goal.baselineValue)) * 100)))
            : 0;

          return (
            <Card key={goal.id} className={`${goal.isAchieved ? 'border-green-300 bg-green-50/30' : ''}`}>
              <CardContent className="pt-4 pb-3">
                {/* Cabeçalho da meta */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      {goal.isAchieved
                        ? <CheckCircle className="h-4 w-4 text-green-600 flex-shrink-0" />
                        : <Target className="h-4 w-4 text-blue-600 flex-shrink-0" />}
                      <span className="font-semibold text-gray-900">{goal.description}</span>
                      <Badge variant="outline" className="text-xs">{GOAL_LABEL[goal.goalType]}</Badge>
                      {goal.isAchieved && (
                        <Badge className="text-xs bg-green-600 text-white">Atingida</Badge>
                      )}
                    </div>

                    {/* Barra de progresso */}
                    {goal.baselineValue !== undefined && goal.targetValue !== undefined && latest && (
                      <ProgressBar
                        current={latest.value}
                        baseline={goal.baselineValue}
                        target={goal.targetValue}
                      />
                    )}

                    {/* Valores resumidos */}
                    <div className="flex gap-4 mt-2 text-xs text-gray-500 flex-wrap">
                      {latest && (
                        <span className="flex items-center gap-1">
                          <TrendingUp className="h-3 w-3" />
                          Atual: <strong className="text-gray-800">{latest.value} {goal.targetUnit}</strong>
                        </span>
                      )}
                      {goal.targetValue !== undefined && (
                        <span>Meta: <strong>{goal.targetValue} {goal.targetUnit}</strong></span>
                      )}
                      {days !== null && !goal.isAchieved && (
                        <span className={`flex items-center gap-1 ${days < 30 ? 'text-orange-600 font-medium' : ''}`}>
                          <Clock className="h-3 w-3" />
                          {days > 0 ? `${days} dias restantes` : `Prazo: ${goal.targetDate}`}
                        </span>
                      )}
                    </div>
                  </div>

                  <button
                    onClick={() => setExpandedId(isExpanded ? null : goal.id)}
                    className="text-gray-400 hover:text-gray-600 mt-1"
                  >
                    {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </button>
                </div>

                {/* Área expandida — histórico e novo checkpoint */}
                {isExpanded && (
                  <div className="mt-4 pt-4 border-t space-y-4">
                    {/* Histórico de checkpoints */}
                    <div>
                      <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-2">
                        Histórico de medições
                      </p>
                      <div className="space-y-1">
                        {goal.checkpoints.map((cp, i) => (
                          <div key={i} className="flex items-center gap-3 text-xs">
                            <span className="text-gray-400 w-20 flex-shrink-0">{cp.date}</span>
                            <span className="font-mono font-semibold text-gray-800 w-20">
                              {cp.value} {goal.targetUnit}
                            </span>
                            {cp.note && <span className="text-gray-500 italic">{cp.note}</span>}
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Adicionar checkpoint */}
                    {!goal.isAchieved && (
                      <div className="flex items-end gap-3">
                        <div className="flex-1">
                          <Label className="text-xs">Registrar novo valor ({goal.targetUnit})</Label>
                          <Input
                            type="number" step="0.1"
                            value={checkpointValues[goal.id] ?? ''}
                            onChange={(e) =>
                              setCheckpointValues((p) => ({ ...p, [goal.id]: e.target.value }))}
                            placeholder={`Ex: ${latest?.value}`}
                          />
                        </div>
                        <Button size="sm" onClick={() => handleAddCheckpoint(goal.id)}>
                          Registrar
                        </Button>
                        <Button size="sm" variant="outline"
                          className="text-green-700 border-green-300"
                          onClick={() => handleMarkAchieved(goal.id)}>
                          <CheckCircle className="h-4 w-4 mr-1" /> Marcar como atingida
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
