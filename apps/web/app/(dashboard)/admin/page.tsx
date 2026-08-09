'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api } from '@/lib/api-client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { PageHeader } from '@/components/PageHeader';
import { AuthGuard } from '@/components/AuthGuard';
import { EmptyState } from '@/components/EmptyState';
import Link from 'next/link';
import {
  Users, Coins, TrendingUp, AlertTriangle, BookOpen, Activity, Search,
  ChevronLeft, ChevronRight, MoreHorizontal, CheckCircle, XCircle, Shield, Loader2,
} from 'lucide-react';

const PLAN_BADGE: Record<string, string> = {
  free_trial:       'bg-muted text-muted-foreground',
  individual_basic: 'bg-secondary text-secondary-foreground',
  individual_pro:   'bg-accent text-accent-foreground',
  clinic:           'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300',
  institutional:    'bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300',
};
const PLAN_LABEL: Record<string, string> = {
  free_trial: 'Trial', individual_basic: 'Básico', individual_pro: 'Profissional',
  clinic: 'Clínica', institutional: 'Institucional',
};

// Rótulos das operações registradas em token_transactions.operation.
const OPERATION_LABEL: Record<string, string> = {
  nutritional_assessment: 'Avaliação Nutricional',
  physical_assessment: 'Avaliação Física',
  interaction_analysis: 'Análise de Interações',
  bioavailability_analysis: 'Biodisponibilidade',
  report_generation: 'Relatórios Gerados',
  assistant_query: 'Consultas ao Assistente',
  lab_analysis: 'Análise Laboratorial',
  supplementation_analysis: 'Análise de Suplementação',
};

const PAGE_SIZE = 10;
const BAR_COLORS = ['bg-primary', 'bg-emerald-500', 'bg-sky-500', 'bg-violet-500', 'bg-amber-500'];

function fmtNum(n: number) {
  return n.toLocaleString('pt-BR');
}

function fmtDate(iso: string | null) {
  return iso ? new Date(iso).toLocaleDateString('pt-BR') : '—';
}

function AdminContent() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [planFilter, setPlanFilter] = useState<string>('all');
  const [page, setPage] = useState(1);
  const [actionMenu, setActionMenu] = useState<string | null>(null);

  const metricsQuery = useQuery({
    queryKey: ['admin-metrics'],
    queryFn: () => api.admin.metrics(),
  });

  const healthQuery = useQuery({
    queryKey: ['admin-scientific-health'],
    queryFn: () => api.admin.scientificBaseHealth(),
  });

  const workspacesQuery = useQuery({
    queryKey: ['admin-workspaces', page],
    queryFn: () => api.admin.listWorkspaces({ page, limit: PAGE_SIZE }),
    placeholderData: keepPreviousData,
  });

  const invalidateWorkspaces = () => {
    queryClient.invalidateQueries({ queryKey: ['admin-workspaces'] });
    queryClient.invalidateQueries({ queryKey: ['admin-metrics'] });
  };

  const suspendMutation = useMutation({
    mutationFn: (id: string) => api.admin.suspendWorkspace(id),
    onSuccess: (_d, id) => {
      toast.warning(`Workspace suspenso (${id.slice(0, 8)})`);
      invalidateWorkspaces();
    },
    onError: (e: Error) => toast.error(e.message ?? 'Falha ao suspender workspace'),
  });

  const reactivateMutation = useMutation({
    mutationFn: (id: string) => api.admin.reactivateWorkspace(id),
    onSuccess: () => {
      toast.success('Workspace reativado');
      invalidateWorkspaces();
    },
    onError: (e: Error) => toast.error(e.message ?? 'Falha ao reativar workspace'),
  });

  const metrics = metricsQuery.data;
  const health = healthQuery.data ?? [];
  const staleCategories = health.filter((h) => h.isStale);

  // Filtro local sobre a página corrente — a API pagina por data de criação.
  const items = workspacesQuery.data?.items ?? [];
  const filtered = items.filter((w) => {
    const q = search.toLowerCase();
    const matchSearch = !q || w.name.toLowerCase().includes(q);
    const matchPlan = planFilter === 'all' || w.plan === planFilter;
    return matchSearch && matchPlan;
  });
  const totalPages = workspacesQuery.data?.pages ?? 1;

  const moduleUsage = (metrics?.moduleUsage ?? []).slice(0, 6);
  const maxUses = Math.max(1, ...moduleUsage.map((m) => Number(m.uses)));

  const kpis = [
    {
      icon: Users, color: 'text-primary',
      value: metrics ? fmtNum(metrics.totalWorkspaces) : '—',
      sub: metrics ? `${fmtNum(metrics.activeWorkspaces)} ativos` : 'carregando…',
      label: 'Workspaces',
    },
    {
      icon: Users, color: 'text-emerald-500',
      value: metrics ? fmtNum(metrics.totalUsers) : '—',
      sub: metrics ? `${fmtNum(metrics.totalPatients)} pacientes` : 'carregando…',
      label: 'Profissionais',
    },
    {
      icon: Coins, color: 'text-amber-500',
      value: metrics ? fmtNum(metrics.tokensConsumedThisMonth) : '—',
      sub: 'tokens consumidos (mês)',
      label: 'Tokens',
    },
    {
      icon: TrendingUp, color: 'text-violet-500',
      value: metrics ? `R$ ${fmtNum(metrics.mrrBrl)}` : '—',
      sub: 'MRR dos planos ativos',
      label: 'Receita',
    },
  ];

  return (
    <div className="flex flex-col min-h-full">
      <PageHeader
        title="Painel Administrativo"
        description="NutriPerformance Clinical — Visão global do SaaS"
        breadcrumbs={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Admin' }]}
        action={
          <Link href="/admin/audit">
            <Button variant="outline" size="sm" className="flex items-center gap-2">
              <Shield className="h-4 w-4" /> Audit Log
            </Button>
          </Link>
        }
      />

      <div className="px-4 py-5 sm:p-6 max-w-6xl mx-auto w-full space-y-6 flex-1">
        {metricsQuery.isError && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription className="text-sm">
              Não foi possível carregar as métricas administrativas:{' '}
              {(metricsQuery.error as Error)?.message ?? 'erro desconhecido'}
            </AlertDescription>
          </Alert>
        )}

        {staleCategories.length > 0 && (
          <Alert className="border-destructive/30 bg-destructive/10">
            <AlertTriangle className="h-4 w-4 text-destructive" />
            <AlertDescription className="text-sm">
              <strong>Base científica desatualizada:</strong>{' '}
              {staleCategories.map((s) => s.category).join(', ')} — mais de 90 dias sem atualização.
            </AlertDescription>
          </Alert>
        )}

        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {kpis.map((kpi) => (
            <Card key={kpi.label}>
              <CardContent className="pt-5">
                <div className="flex items-center gap-3">
                  <kpi.icon className={`h-6 w-6 ${kpi.color} flex-shrink-0`} aria-hidden="true" />
                  <div>
                    <p className="text-2xl font-black text-foreground">{kpi.value}</p>
                    <p className="text-xs text-muted-foreground">{kpi.sub}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Uso por módulo + Base científica */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Activity className="h-4 w-4" aria-hidden="true" /> Uso por Módulo (30 dias)
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {metricsQuery.isLoading ? (
                <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
              ) : moduleUsage.length === 0 ? (
                <p className="text-xs text-muted-foreground py-4 text-center">
                  Nenhum consumo registrado nos últimos 30 dias.
                </p>
              ) : moduleUsage.map((item, i) => {
                const uses = Number(item.uses);
                return (
                  <div key={item.operation} className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">{OPERATION_LABEL[item.operation] ?? item.operation}</span>
                      <span className="font-bold text-foreground">{fmtNum(uses)}</span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div className={`h-full ${BAR_COLORS[i % BAR_COLORS.length]} rounded-full`}
                        style={{ width: `${(uses / maxUses) * 100}%` }} />
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <BookOpen className="h-4 w-4" aria-hidden="true" /> Base Científica
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {healthQuery.isLoading ? (
                <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
              ) : health.length === 0 ? (
                <p className="text-xs text-muted-foreground py-4 text-center">
                  Nenhuma categoria registrada em <code>scientific_base_health</code>.
                </p>
              ) : health.map((item) => (
                <div key={item.category} className="flex items-center justify-between py-2 border-b last:border-0">
                  <div>
                    <p className="text-sm font-medium text-foreground">{item.category}</p>
                    <p className="text-xs text-muted-foreground">
                      {fmtDate(item.lastUpdatedAt)} · {fmtNum(item.totalReferences ?? 0)} referências
                    </p>
                  </div>
                  {item.isStale
                    ? <Badge variant="outline" className="text-xs border-destructive/40 text-destructive flex items-center gap-1"><AlertTriangle className="h-3 w-3" />{item.daysSinceUpdate}d</Badge>
                    : <Badge variant="outline" className="text-xs border-primary/40 text-primary">OK · {item.daysSinceUpdate}d</Badge>
                  }
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        {/* Workspaces */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center justify-between gap-3">
              <span className="flex items-center gap-2"><Users className="h-4 w-4" aria-hidden="true" /> Workspaces</span>
              <span className="text-xs text-muted-foreground font-normal">
                {fmtNum(workspacesQuery.data?.total ?? 0)} total
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {/* Filtros */}
            <div className="flex flex-col sm:flex-row gap-3 mb-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
                <Input value={search} onChange={(e) => setSearch(e.target.value)}
                  placeholder="Buscar por nome nesta página..." className="pl-9 h-9 text-sm"
                  aria-label="Buscar workspace por nome" />
              </div>
              <div className="flex gap-1.5 flex-wrap">
                {(['all', 'free_trial', 'individual_basic', 'individual_pro', 'clinic', 'institutional'] as const).map((plan) => (
                  <button key={plan} onClick={() => setPlanFilter(plan)}
                    aria-pressed={planFilter === plan}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                      planFilter === plan
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'bg-card text-muted-foreground hover:border-foreground/30'
                    }`}>
                    {plan === 'all' ? 'Todos' : PLAN_LABEL[plan] ?? plan}
                  </button>
                ))}
              </div>
            </div>

            {/* Tabela */}
            {workspacesQuery.isLoading ? (
              <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
            ) : workspacesQuery.isError ? (
              <EmptyState
                icon="⚠️"
                title="Não foi possível carregar os workspaces"
                description={(workspacesQuery.error as Error)?.message ?? 'Tente novamente em instantes.'}
              />
            ) : filtered.length === 0 ? (
              <EmptyState
                icon="🏢"
                title="Nenhum workspace encontrado"
                description="Ajuste os filtros ou navegue para outra página."
              />
            ) : (
              <div className="overflow-x-auto rounded-xl border">
                <table className="w-full text-sm">
                  <caption className="sr-only">Workspaces cadastrados na plataforma</caption>
                  <thead className="bg-muted/50">
                    <tr>
                      {['Workspace', 'Plano', 'Tokens', 'Usuários', 'Pacientes', 'Criado em', 'Status', 'Ações'].map((h) => (
                        <th key={h} scope="col" className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">
                          {h === 'Ações' ? <span className="sr-only">Ações</span> : h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {filtered.map((w) => {
                      const isBusy = suspendMutation.isPending || reactivateMutation.isPending;
                      return (
                        <tr key={w.id} className="hover:bg-muted/40 transition-colors">
                          <td className="px-4 py-3">
                            <p className="font-medium text-foreground">{w.name}</p>
                            <p className="text-xs text-muted-foreground font-mono">{w.id.slice(0, 8)}</p>
                          </td>
                          <td className="px-4 py-3">
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${PLAN_BADGE[w.plan] ?? 'bg-muted text-muted-foreground'}`}>
                              {PLAN_LABEL[w.plan] ?? w.plan}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <p className="text-xs font-bold text-foreground">{fmtNum(Number(w.token_balance))}</p>
                            {Number(w.token_reserved) > 0 && (
                              <p className="text-xs text-muted-foreground">{fmtNum(Number(w.token_reserved))} reservados</p>
                            )}
                          </td>
                          <td className="px-4 py-3 text-xs text-muted-foreground">{w.user_count}</td>
                          <td className="px-4 py-3 text-xs text-muted-foreground">{w.patient_count}</td>
                          <td className="px-4 py-3 text-xs text-muted-foreground">{fmtDate(w.created_at)}</td>
                          <td className="px-4 py-3">
                            {w.is_active
                              ? <span className="flex items-center gap-1 text-xs text-primary"><CheckCircle className="h-3 w-3" aria-hidden="true" />Ativo</span>
                              : <span className="flex items-center gap-1 text-xs text-destructive"><XCircle className="h-3 w-3" aria-hidden="true" />Suspenso</span>
                            }
                          </td>
                          <td className="px-4 py-3 relative">
                            <button onClick={() => setActionMenu(actionMenu === w.id ? null : w.id)}
                              aria-label={`Ações para o workspace ${w.name}`}
                              aria-expanded={actionMenu === w.id}
                              className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground">
                              <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
                            </button>
                            {actionMenu === w.id && (
                              <div className="absolute right-4 top-10 bg-popover rounded-xl shadow-lg border z-20 overflow-hidden w-44">
                                {w.is_active ? (
                                  <button
                                    onClick={() => { setActionMenu(null); suspendMutation.mutate(w.id); }}
                                    disabled={isBusy}
                                    className="w-full px-4 py-2.5 text-xs text-left hover:bg-muted text-destructive flex items-center gap-2 disabled:opacity-50">
                                    <XCircle className="h-3 w-3" aria-hidden="true" /> Suspender
                                  </button>
                                ) : (
                                  <button
                                    onClick={() => { setActionMenu(null); reactivateMutation.mutate(w.id); }}
                                    disabled={isBusy}
                                    className="w-full px-4 py-2.5 text-xs text-left hover:bg-muted text-primary flex items-center gap-2 disabled:opacity-50">
                                    <CheckCircle className="h-3 w-3" aria-hidden="true" /> Reativar
                                  </button>
                                )}
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* Paginação */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-4">
                <p className="text-xs text-muted-foreground">
                  Página {page} de {totalPages} · {fmtNum(workspacesQuery.data?.total ?? 0)} workspaces
                </p>
                <div className="flex items-center gap-1">
                  <button onClick={() => setPage((p) => Math.max(p - 1, 1))} disabled={page === 1}
                    aria-label="Página anterior"
                    className="p-1.5 rounded-lg hover:bg-muted disabled:opacity-30">
                    <ChevronLeft className="h-4 w-4" aria-hidden="true" />
                  </button>
                  {Array.from({ length: totalPages }, (_, i) => i + 1)
                    .filter((p) => Math.abs(p - page) <= 2)
                    .map((p) => (
                      <button key={p} onClick={() => setPage(p)}
                        aria-label={`Ir para página ${p}`}
                        aria-current={p === page ? 'page' : undefined}
                        className={`w-7 h-7 text-xs rounded-lg transition-colors ${
                          p === page ? 'bg-primary text-primary-foreground' : 'hover:bg-muted text-muted-foreground'
                        }`}>
                        {p}
                      </button>
                    ))}
                  <button onClick={() => setPage((p) => Math.min(p + 1, totalPages))} disabled={page === totalPages}
                    aria-label="Próxima página"
                    className="p-1.5 rounded-lg hover:bg-muted disabled:opacity-30">
                    <ChevronRight className="h-4 w-4" aria-hidden="true" />
                  </button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default function AdminPage() {
  return (
    <AuthGuard requiredRole="admin">
      <AdminContent />
    </AuthGuard>
  );
}
