'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api-client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { PageHeader } from '@/components/PageHeader';
import {
  Coins, TrendingUp, ArrowDownCircle, ArrowUpCircle, Zap,
  AlertTriangle,
} from 'lucide-react';

// ─── Token progress bar ───────────────────────────────────────────────────────
function TokenBar({ used, total }: { used: number; total: number }) {
  const pct = Math.min(100, Math.round((used / total) * 100));
  const color = pct > 80 ? 'bg-red-500' : pct > 60 ? 'bg-yellow-400' : 'bg-blue-500';
  const textColor = pct > 80 ? 'text-red-600' : pct > 60 ? 'text-yellow-600' : 'text-blue-600';
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between text-xs">
        <span className="text-gray-500">{used.toLocaleString('pt-BR')} usados</span>
        <span className={`font-semibold ${textColor}`}>{(total - used).toLocaleString('pt-BR')} restantes</span>
      </div>
      <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all duration-500 ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <p className="text-[10px] text-gray-500">{pct}% do limite mensal utilizado (total: {total.toLocaleString('pt-BR')})</p>
    </div>
  );
}

// ─── Module usage bar ─────────────────────────────────────────────────────────
function ModuleBar({ label, used, total, color }: { label: string; used: number; total: number; color: string }) {
  const pct = Math.min(100, Math.round((used / total) * 100));
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className="text-gray-600">{label}</span>
        <span className="font-medium text-gray-700">{used} tk</span>
      </div>
      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

// ─── Data ─────────────────────────────────────────────────────────────────────
//
// A tabela de preços e o consumo por módulo eram constantes escritas aqui.
// Duas consequências concretas:
//
//  - a lista anunciava "Sugestão de Meta · 5 tokens", preço que foi REMOVIDO
//    de `token_costs` em 03/10/2026 por não ter nenhum código que o cobre;
//  - o gráfico de consumo mostrava números inventados ao lado de um saldo
//    real, o que é pior que não ter gráfico: parece medição.
//
// Agora os dois saem da API.

const ROTULO_OPERACAO: Record<string, { label: string; icon: string; color: string }> = {
  interaction_analysis:           { label: 'Análise de Interações',   icon: '🔬', color: 'bg-red-400' },
  nutritional_assessment_summary: { label: 'Avaliação Nutricional',   icon: '🥗', color: 'bg-green-400' },
  bioavailability_analysis:       { label: 'Biodisponibilidade',      icon: '🧬', color: 'bg-purple-400' },
  supplementation_analysis:       { label: 'Suplementação',           icon: '💊', color: 'bg-amber-400' },
  report_generation:              { label: 'Geração de Relatório',    icon: '📄', color: 'bg-blue-400' },
  laboratory_analysis:            { label: 'Exames Laboratoriais',    icon: '🔭', color: 'bg-cyan-400' },
  assistant_query:                { label: 'Assistente (RAG)',        icon: '💬', color: 'bg-indigo-400' },
  nutritional_audio_intake:       { label: 'Transcrição nutricional', icon: '🎙️', color: 'bg-pink-400' },
  physical_audio_intake:          { label: 'Transcrição física',      icon: '🎙️', color: 'bg-rose-400' },
};

const descreverOperacao = (op: string) =>
  ROTULO_OPERACAO[op] ?? { label: op, icon: '•', color: 'bg-gray-400' };

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function TokensPage() {

  const balanceQ = useQuery({ queryKey: ['tokenBalance'], queryFn: () => api.tokens.balance() });
  const historyQ = useQuery({ queryKey: ['tokenHistory'], queryFn: () => api.tokens.history() });
  const costsQ = useQuery({ queryKey: ['tokenCosts'], queryFn: () => api.tokens.costs() });

  const bal: any = balanceQ.data ?? {};
  const currentBalance = typeof bal.balance === 'number' ? bal.balance : 0;
  const available = typeof bal.available === 'number' ? bal.available : currentBalance;
  const isUnlimited = currentBalance >= 100_000_000;

  const lowBalance = !isUnlimited && !balanceQ.isLoading && currentBalance < 120;
  const history: any[] = Array.isArray(historyQ.data) ? historyQ.data : [];

  // Consumo por módulo derivado do histórico real. Só débitos entram: recarga
  // é entrada de saldo, não uso.
  const porModulo = new Map<string, number>();
  for (const t of history) {
    const valor = Number(t.amount);
    if (!Number.isFinite(valor) || valor >= 0) continue;
    const chave = String(t.module ?? 'outros');
    porModulo.set(chave, (porModulo.get(chave) ?? 0) + Math.abs(valor));
  }
  const moduleUsage = Array.from(porModulo.entries())
    .map(([op, used]) => ({ ...descreverOperacao(op), used }))
    .sort((a, b) => b.used - a.used);
  const totalUsage = moduleUsage.reduce((a, b) => a + b.used, 0);

  const custos: any[] = Array.isArray((costsQ.data as any)?.costs)
    ? (costsQ.data as any).costs
    : [];

  const fmtDate = (iso?: string) => { if (!iso) return '—'; const d = new Date(iso); return isNaN(d.getTime()) ? '—' : d.toLocaleDateString('pt-BR'); };

  return (
    <div className="flex flex-col min-h-full">
      <PageHeader
        title="Tokens & Assinatura"
        description="Gerencie seu saldo de créditos e plano"
        breadcrumbs={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Tokens' }]}
      />

      <div className="px-4 py-5 sm:p-6 max-w-5xl mx-auto w-full space-y-6">

        {/* Low balance alert */}
        {lowBalance && (
          <Alert className="border-red-200 bg-red-50">
            <AlertTriangle className="h-4 w-4 text-red-600" />
            <AlertDescription className="text-red-800 text-sm">
              <strong>Saldo baixo!</strong> Você tem apenas <strong>{currentBalance} tokens</strong> restantes.
              Considere fazer uma recarga para continuar as análises.
            </AlertDescription>
          </Alert>
        )}

        {/* Balance + usage */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="md:col-span-2 border-blue-100">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Coins className="h-4 w-4 text-blue-500" /> Saldo do Plano Atual
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {balanceQ.isLoading ? (
                <p className="text-sm text-gray-400">Carregando saldo...</p>
              ) : balanceQ.isError ? (
                <p className="text-sm text-red-600">Não foi possível carregar o saldo.</p>
              ) : (
                <div className="flex items-baseline gap-2">
                  {isUnlimited ? (
                    <span className="text-4xl sm:text-5xl font-black text-blue-600">Ilimitado ∞</span>
                  ) : (
                    <>
                      <span className="text-4xl sm:text-5xl font-black text-blue-600">{currentBalance.toLocaleString('pt-BR')}</span>
                      <span className="text-lg text-gray-400">tokens</span>
                    </>
                  )}
                  <span className="ml-auto text-sm text-gray-500 bg-blue-50 px-2 py-1 rounded-lg border border-blue-100">
                    {isUnlimited ? 'Acesso administrador' : 'Saldo do workspace'}
                  </span>
                </div>
              )}
              {!isUnlimited && !balanceQ.isLoading && !balanceQ.isError && (
                <p className="text-xs text-gray-500">Disponível: <strong>{available.toLocaleString('pt-BR')}</strong> tokens (reservados: {(currentBalance - available).toLocaleString('pt-BR')})</p>
              )}
              <p className="text-xs text-gray-500">
                Plataforma em fase de testes — os tokens são creditados pelo administrador.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-gray-400" /> Consumo por Módulo
              </CardTitle>
              <CardDescription className="text-xs">Mês atual</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {moduleUsage.map((m) => (
                <ModuleBar key={m.label} label={m.label} used={m.used} total={totalUsage} color={m.color} />
              ))}
              {!historyQ.isLoading && moduleUsage.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  Nenhum consumo registrado ainda.
                </p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Cost table */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Zap className="h-4 w-4 text-yellow-500" /> Custo por Operação
            </CardTitle>
            <CardDescription className="text-xs">Cada análise consome tokens do saldo do workspace</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {custos.map((cost: any) => {
                const d = descreverOperacao(cost.operation);
                return (
                  <div key={cost.operation} className="flex items-center gap-2 px-3 py-2 bg-gray-50 rounded-lg border border-gray-100 hover:border-gray-200 transition-colors">
                    <span className="text-base">{d.icon}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-gray-700 truncate leading-tight">{d.label}</p>
                      <p className="text-xs font-bold text-blue-600 mt-0.5">{cost.tokens} tokens</p>
                    </div>
                  </div>
                );
              })}
              {!costsQ.isLoading && custos.length === 0 && (
                <p className="col-span-full text-xs text-muted-foreground">
                  Nenhuma operação tarifada.
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Transaction history */}
        <Card>
          <CardHeader className="pb-3 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-semibold">Histórico de Tokens</CardTitle>
            <button className="text-xs text-blue-600 hover:underline">Exportar CSV</button>
          </CardHeader>
          <CardContent>
            {historyQ.isLoading ? (
              <p className="text-xs text-gray-400 text-center py-6">Carregando histórico...</p>
            ) : history.length === 0 ? (
              <p className="text-xs text-gray-400 text-center py-6">Nenhuma transação de tokens ainda.</p>
            ) : (
              <div className="space-y-1">
                {history.map((tx: any, i: number) => {
                  const amount = typeof tx.amount === 'number' ? tx.amount : 0;
                  const label = tx.description || tx.module || tx.operation || 'Transação';
                  return (
                    <div key={tx.id ?? i} className="flex items-center gap-3 py-2.5 border-b last:border-0">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${amount > 0 ? 'bg-green-50' : 'bg-red-50'}`}>
                        {amount > 0 ? <ArrowUpCircle className="h-4 w-4 text-green-500" /> : <ArrowDownCircle className="h-4 w-4 text-red-400" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-gray-800 truncate">{label}</p>
                        <p className="text-xs text-gray-400">{fmtDate(tx.createdAt)}</p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className={`text-sm font-bold ${amount > 0 ? 'text-green-600' : 'text-red-500'}`}>{amount > 0 ? '+' : ''}{amount} tk</p>
                        {typeof tx.balanceAfter === 'number' && <p className="text-[10px] text-gray-500">saldo: {tx.balanceAfter}</p>}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

      </div>
    </div>
  );
}
