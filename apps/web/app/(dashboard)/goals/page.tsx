'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Target, Plus, TrendingUp, CheckCircle, Clock, ChevronDown, ChevronUp,
  Loader2, User,
} from 'lucide-react';
import { EmptyState } from '@/components/EmptyState';
import { SeletorDePaciente } from '@/components/SeletorDePaciente';
import { api } from '@/lib/api-client';

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

interface Checkpoint { date: string; value: number; note?: string }
interface Goal {
  id: string;
  patientId: string;
  paciente: { nome: string; codigo: string | null } | null;
  goalType: GoalType;
  description: string;
  baselineValue?: number | string | null;
  targetValue?: number | string | null;
  targetUnit?: string | null;
  startDate?: string | null;
  targetDate?: string | null;
  isAchieved: boolean;
  checkpoints: Checkpoint[];
}

const n = (v: unknown): number | undefined => {
  if (v === null || v === undefined || v === '') return undefined;
  const x = Number(v);
  return Number.isFinite(x) ? x : undefined;
};

function ProgressBar({ current, baseline, target }: { current: number; baseline: number; target: number }) {
  const span = Math.abs(target - baseline);
  const pct = span === 0 ? 100
    : Math.max(0, Math.min(100, Math.round((Math.abs(current - baseline) / span) * 100)));
  return (
    <div className="mt-2">
      <div className="flex justify-between text-xs text-gray-500 mb-1">
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

/**
 * Prazo em dias. A data vem do banco como ISO (AAAA-MM-DD); o formato
 * brasileiro só aparece no que o próprio usuário digitou. Tratar os dois
 * evita um `NaN dias restantes` na tela.
 */
function daysRemaining(targetDate?: string | null): number | null {
  if (!targetDate) return null;
  const iso = /^\d{4}-\d{2}-\d{2}/.test(targetDate);
  const alvo = iso
    ? new Date(`${targetDate.slice(0, 10)}T12:00:00`)
    : (() => {
        const [d, m, y] = targetDate.split('/').map(Number);
        return new Date(y, m - 1, d, 12);
      })();
  if (Number.isNaN(alvo.getTime())) return null;
  return Math.ceil((alvo.getTime() - Date.now()) / 86_400_000);
}

const dataBR = (s?: string | null) => {
  if (!s) return '';
  return /^\d{4}-\d{2}-\d{2}/.test(s)
    ? new Date(`${s.slice(0, 10)}T12:00:00`).toLocaleDateString('pt-BR')
    : s;
};

export default function GoalsPage() {
  const qc = useQueryClient();
  const [filtroPaciente, setFiltroPaciente] = useState('');
  const [verConcluidas, setVerConcluidas] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [checkpointValues, setCheckpointValues] = useState<Record<string, string>>({});
  const [erro, setErro] = useState<string | null>(null);

  const [nova, setNova] = useState({
    patientId: '', goalType: 'weight_loss' as GoalType, description: '',
    baselineValue: '', targetValue: '', targetUnit: '', startDate: '', targetDate: '',
  });

  const chave = ['metas', filtroPaciente, verConcluidas];
  const { data, isLoading, isError } = useQuery({
    queryKey: chave,
    queryFn: () => api.goals.listarTodas(filtroPaciente || undefined, verConcluidas),
  });
  const goals: Goal[] = (data as any) ?? [];

  const recarregar = () => qc.invalidateQueries({ queryKey: ['metas'] });
  const aoFalhar = (e: any) => setErro(e?.message ?? 'Não foi possível concluir a ação.');

  const criar = useMutation({
    mutationFn: () => api.goals.create({
      patientId: nova.patientId,
      goalType: nova.goalType,
      description: nova.description.trim(),
      baselineValue: n(nova.baselineValue),
      targetValue: n(nova.targetValue),
      targetUnit: nova.targetUnit.trim() || undefined,
      startDate: nova.startDate || new Date().toISOString().slice(0, 10),
      targetDate: nova.targetDate || undefined,
    }),
    onSuccess: () => {
      setShowForm(false); setErro(null);
      setNova({
        patientId: '', goalType: 'weight_loss', description: '',
        baselineValue: '', targetValue: '', targetUnit: '', startDate: '', targetDate: '',
      });
      recarregar();
    },
    onError: aoFalhar,
  });

  const registrar = useMutation({
    mutationFn: ({ id, valor }: { id: string; valor: number }) =>
      api.goals.addCheckpoint(id, valor),
    onSuccess: (_r, v) => {
      setCheckpointValues((p) => ({ ...p, [v.id]: '' }));
      setErro(null);
      recarregar();
    },
    onError: aoFalhar,
  });

  const atingir = useMutation({
    mutationFn: (id: string) => api.goals.markAchieved(id),
    onSuccess: () => { setErro(null); recarregar(); },
    onError: aoFalhar,
  });

  const emAndamento = goals.filter((g) => !g.isAchieved).length;
  const atingidas = goals.filter((g) => g.isAchieved).length;
  const podeCriar = nova.patientId !== '' && nova.description.trim() !== '';

  return (
    <div className="px-4 py-5 sm:p-6 max-w-4xl mx-auto space-y-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Metas e Evolução</h1>
          <p className="text-gray-500 text-sm mt-1">
            {emAndamento} em andamento{verConcluidas ? ` · ${atingidas} atingidas` : ''}
          </p>
        </div>
        <Button onClick={() => setShowForm((v) => !v)} className="flex items-center gap-2">
          <Plus className="h-4 w-4" />
          Nova meta
        </Button>
      </div>

      {/* Filtro por paciente — o pedido do relatório de testes. */}
      <Card>
        <CardContent className="pt-4 grid grid-cols-1 sm:grid-cols-2 gap-4 items-end">
          <SeletorDePaciente
            id="filtro-paciente"
            label="Filtrar por paciente"
            value={filtroPaciente}
            onChange={(id) => setFiltroPaciente(id)}
          />
          <label className="flex items-center gap-2 text-sm h-10">
            <input
              type="checkbox"
              checked={verConcluidas}
              onChange={(e) => setVerConcluidas(e.target.checked)}
              className="h-4 w-4"
            />
            Mostrar também as metas já atingidas
          </label>
        </CardContent>
      </Card>

      {erro && <p className="text-sm text-destructive">{erro}</p>}

      {showForm && (
        <Card className="border-blue-200">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Definir Nova Meta</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <SeletorDePaciente
              id="meta-paciente"
              value={nova.patientId}
              obrigatorio
              onChange={(id) => setNova((p) => ({ ...p, patientId: id }))}
            />
            <div>
              <Label htmlFor="meta-tipo">Tipo de meta</Label>
              <select
                id="meta-tipo"
                value={nova.goalType}
                onChange={(e) => setNova((p) => ({ ...p, goalType: e.target.value as GoalType }))}
                className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
              >
                {Object.entries(GOAL_LABEL).map(([val, label]) => (
                  <option key={val} value={val}>{label}</option>
                ))}
              </select>
            </div>
            <div className="md:col-span-2">
              <Label htmlFor="meta-desc">Descrição <span className="text-destructive">*</span></Label>
              <Input
                id="meta-desc"
                value={nova.description}
                onChange={(e) => setNova((p) => ({ ...p, description: e.target.value }))}
                placeholder="Ex: Reduzir percentual de gordura"
              />
            </div>
            <div>
              <Label htmlFor="meta-base">Valor inicial (baseline)</Label>
              <Input
                id="meta-base" type="number" step="0.1" value={nova.baselineValue}
                onChange={(e) => setNova((p) => ({ ...p, baselineValue: e.target.value }))}
                placeholder="Ex: 28.5"
              />
            </div>
            <div className="flex gap-2">
              <div className="flex-1">
                <Label htmlFor="meta-alvo">Meta</Label>
                <Input
                  id="meta-alvo" type="number" step="0.1" value={nova.targetValue}
                  onChange={(e) => setNova((p) => ({ ...p, targetValue: e.target.value }))}
                  placeholder="Ex: 23.0"
                />
              </div>
              <div className="w-28">
                <Label htmlFor="meta-un">Unidade</Label>
                <Input
                  id="meta-un" value={nova.targetUnit}
                  onChange={(e) => setNova((p) => ({ ...p, targetUnit: e.target.value }))}
                  placeholder="%, kg"
                />
              </div>
            </div>
            <div>
              <Label htmlFor="meta-inicio">Início</Label>
              <Input
                id="meta-inicio" type="date" value={nova.startDate}
                onChange={(e) => setNova((p) => ({ ...p, startDate: e.target.value }))}
              />
            </div>
            <div>
              <Label htmlFor="meta-prazo">Prazo</Label>
              <Input
                id="meta-prazo" type="date" value={nova.targetDate}
                onChange={(e) => setNova((p) => ({ ...p, targetDate: e.target.value }))}
              />
            </div>
            <div className="md:col-span-2 flex gap-3 justify-end">
              <Button variant="outline" onClick={() => setShowForm(false)}>Cancelar</Button>
              <Button onClick={() => criar.mutate()} disabled={!podeCriar || criar.isPending}>
                {criar.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
                Criar meta
              </Button>
            </div>
            {!podeCriar && (
              <p className="md:col-span-2 text-xs text-muted-foreground -mt-2">
                Escolha o paciente e escreva a descrição para salvar.
              </p>
            )}
          </CardContent>
        </Card>
      )}

      <div className="space-y-4">
        {isLoading && (
          <div className="py-10 flex justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        )}

        {isError && (
          <p className="py-10 text-center text-sm text-destructive">
            Não foi possível carregar as metas.
          </p>
        )}

        {!isLoading && !isError && goals.length === 0 && (
          <EmptyState
            icon="🎯"
            title={filtroPaciente ? 'Nenhuma meta para este paciente' : 'Nenhuma meta definida'}
            description="Defina metas para acompanhar a evolução dos seus pacientes ao longo do tempo."
            actionLabel="Nova Meta"
            onAction={() => setShowForm(true)}
          />
        )}

        {goals.map((goal) => {
          const isExpanded = expandedId === goal.id;
          const latest = goal.checkpoints?.at(-1);
          const days = daysRemaining(goal.targetDate);
          const baseline = n(goal.baselineValue);
          const target = n(goal.targetValue);

          return (
            <Card key={goal.id} className={goal.isAchieved ? 'border-green-300 bg-green-50/30' : ''}>
              <CardContent className="pt-4 pb-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    {/* Dono da meta em primeiro lugar: era o que faltava para
                        saber de quem é cada linha. */}
                    <div className="flex items-center gap-1.5 text-xs text-gray-600 mb-1">
                      <User className="h-3 w-3 text-gray-400" />
                      {goal.paciente ? (
                        <span className="font-medium">
                          {goal.paciente.nome}
                          {goal.paciente.codigo && (
                            <span className="text-gray-400"> · {goal.paciente.codigo}</span>
                          )}
                        </span>
                      ) : (
                        <span className="italic text-gray-400">paciente não identificado</span>
                      )}
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                      {goal.isAchieved
                        ? <CheckCircle className="h-4 w-4 text-green-600 flex-shrink-0" />
                        : <Target className="h-4 w-4 text-blue-600 flex-shrink-0" />}
                      <span className="font-semibold text-gray-900">{goal.description}</span>
                      <Badge variant="outline" className="text-xs">
                        {GOAL_LABEL[goal.goalType] ?? goal.goalType}
                      </Badge>
                      {goal.isAchieved && (
                        <Badge className="text-xs bg-green-600 text-white">Atingida</Badge>
                      )}
                    </div>

                    {baseline !== undefined && target !== undefined && latest && (
                      <ProgressBar current={latest.value} baseline={baseline} target={target} />
                    )}

                    <div className="flex gap-4 mt-2 text-xs text-gray-500 flex-wrap">
                      {latest && (
                        <span className="flex items-center gap-1">
                          <TrendingUp className="h-3 w-3" />
                          Atual: <strong className="text-gray-800">{latest.value} {goal.targetUnit}</strong>
                        </span>
                      )}
                      {target !== undefined && (
                        <span>Meta: <strong>{target} {goal.targetUnit}</strong></span>
                      )}
                      {days !== null && !goal.isAchieved && (
                        <span className={`flex items-center gap-1 ${days < 30 ? 'text-orange-600 font-medium' : ''}`}>
                          <Clock className="h-3 w-3" />
                          {days > 0 ? `${days} dias restantes` : `Prazo: ${dataBR(goal.targetDate)}`}
                        </span>
                      )}
                    </div>
                  </div>

                  <button
                    onClick={() => setExpandedId(isExpanded ? null : goal.id)}
                    aria-label={isExpanded ? 'Recolher detalhes da meta' : 'Expandir detalhes da meta'}
                    aria-expanded={isExpanded}
                    className="text-gray-400 hover:text-gray-600 mt-1"
                  >
                    {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </button>
                </div>

                {isExpanded && (
                  <div className="mt-4 pt-4 border-t space-y-4">
                    <div>
                      <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-2">
                        Histórico de medições
                      </p>
                      {goal.checkpoints?.length ? (
                        <div className="space-y-1">
                          {goal.checkpoints.map((cp, i) => (
                            <div key={i} className="flex items-center gap-3 text-xs">
                              <span className="text-gray-400 w-20 flex-shrink-0">{dataBR(cp.date)}</span>
                              <span className="font-mono font-semibold text-gray-800 w-20">
                                {cp.value} {goal.targetUnit}
                              </span>
                              {cp.note && <span className="text-gray-500 italic">{cp.note}</span>}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-gray-400">Nenhuma medição registrada ainda.</p>
                      )}
                    </div>

                    {!goal.isAchieved && (
                      <div className="flex items-end gap-3 flex-wrap">
                        <div className="flex-1 min-w-[160px]">
                          <Label htmlFor={`cp-${goal.id}`} className="text-xs">
                            Registrar novo valor {goal.targetUnit ? `(${goal.targetUnit})` : ''}
                          </Label>
                          <Input
                            id={`cp-${goal.id}`}
                            type="number" step="0.1"
                            value={checkpointValues[goal.id] ?? ''}
                            onChange={(e) =>
                              setCheckpointValues((p) => ({ ...p, [goal.id]: e.target.value }))}
                            placeholder={latest ? `Ex: ${latest.value}` : 'Ex: 23.0'}
                          />
                        </div>
                        <Button
                          size="sm"
                          disabled={registrar.isPending || n(checkpointValues[goal.id]) === undefined}
                          onClick={() => {
                            const valor = n(checkpointValues[goal.id]);
                            if (valor !== undefined) registrar.mutate({ id: goal.id, valor });
                          }}
                        >
                          Registrar
                        </Button>
                        <Button
                          size="sm" variant="outline"
                          className="text-green-700 border-green-300"
                          disabled={atingir.isPending}
                          onClick={() => atingir.mutate(goal.id)}
                        >
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
