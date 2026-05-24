'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { PageHeader } from '@/components/PageHeader';
import Link from 'next/link';
import {
  Users, Coins, TrendingUp, Database, ShieldAlert,
  AlertTriangle, BookOpen, Activity, RefreshCw, Search,
  ChevronLeft, ChevronRight, MoreHorizontal, CheckCircle,
  XCircle, Edit3, Shield,
} from 'lucide-react';

const metrics = {
  totalWorkspaces: 47, activeWorkspaces: 43,
  totalUsers: 189, totalPatients: 1240,
  tokensConsumedThisMonth: 28750, mrr: 12350,
  analyses: { interactions: 890, nutritional: 1240, physical: 780, bioavailability: 320, reports: 560 },
  scientificBase: [
    { category: 'Suplementação',             lastUpdated: '15/04/2026', daysAgo: 37, stale: false },
    { category: 'Interações medicamentosas', lastUpdated: '18/03/2026', daysAgo: 65, stale: false },
    { category: 'Biodisponibilidade',        lastUpdated: '10/01/2026', daysAgo: 132, stale: true },
    { category: 'Diretrizes nutricionais',   lastUpdated: '02/02/2026', daysAgo: 109, stale: true },
    { category: 'Valores laboratoriais',     lastUpdated: '20/05/2026', daysAgo: 2, stale: false },
  ],
};

type UserStatus = 'active' | 'suspended' | 'pending';
type UserPlan = 'starter' | 'individual_pro' | 'clinic' | 'institutional';

interface WorkspaceUser {
  id: string; name: string; email: string; plan: UserPlan;
  tokensLeft: number; tokensTotal: number;
  lastAccess: string; status: UserStatus;
  usersCount: number; patientsCount: number;
}

const MOCK_USERS: WorkspaceUser[] = [
  { id: 'W1', name: 'Clínica Alpha',       email: 'admin@alpha.com.br',   plan: 'clinic',        tokensLeft: 850,  tokensTotal: 2000, lastAccess: 'Hoje',       status: 'active',    usersCount: 4, patientsCount: 87 },
  { id: 'W2', name: 'Nutri Esportivo SP',  email: 'nutri@esportivo.com',  plan: 'individual_pro',tokensLeft: 420,  tokensTotal: 600,  lastAccess: 'Ontem',      status: 'active',    usersCount: 1, patientsCount: 34 },
  { id: 'W3', name: 'Centro Beta',         email: 'adm@centrobeta.com.br',plan: 'clinic',        tokensLeft: 1200, tokensTotal: 2000, lastAccess: '20/05/2026', status: 'active',    usersCount: 3, patientsCount: 62 },
  { id: 'W4', name: 'Academia Premium',    email: 'premium@acad.com',     plan: 'individual_pro',tokensLeft: 0,    tokensTotal: 600,  lastAccess: '15/05/2026', status: 'active',    usersCount: 1, patientsCount: 18 },
  { id: 'W5', name: 'Dr. Carlos Melo',     email: 'carlos@nutrimelo.com', plan: 'starter',       tokensLeft: 40,   tokensTotal: 200,  lastAccess: '10/05/2026', status: 'active',    usersCount: 1, patientsCount: 7 },
  { id: 'W6', name: 'Clínica Suspensos',   email: 'contato@suspenso.com', plan: 'individual_pro',tokensLeft: 0,    tokensTotal: 600,  lastAccess: '01/04/2026', status: 'suspended', usersCount: 1, patientsCount: 12 },
  { id: 'W7', name: 'Hospital Institucional', email: 'ti@hospital.org.br',plan: 'institutional', tokensLeft: 7200, tokensTotal: 10000,lastAccess: 'Hoje',       status: 'active',    usersCount: 18, patientsCount: 340 },
  { id: 'W8', name: 'Nutri Pendente',      email: 'novo@nutri.com',       plan: 'starter',       tokensLeft: 200,  tokensTotal: 200,  lastAccess: 'Nunca',      status: 'pending',   usersCount: 1, patientsCount: 0 },
];

const PLAN_BADGE: Record<UserPlan, string> = {
  starter:        'bg-gray-100 text-gray-600',
  individual_pro: 'bg-blue-100 text-blue-700',
  clinic:         'bg-purple-100 text-purple-700',
  institutional:  'bg-amber-100 text-amber-700',
};
const PLAN_LABEL: Record<UserPlan, string> = {
  starter: 'Starter', individual_pro: 'Profissional', clinic: 'Clínica', institutional: 'Institucional',
};

const PAGE_SIZE = 5;

export default function AdminPage() {
  const [search, setSearch]       = useState('');
  const [planFilter, setPlanFilter] = useState<UserPlan | 'all'>('all');
  const [page, setPage]           = useState(1);
  const [users, setUsers]         = useState<WorkspaceUser[]>(MOCK_USERS);
  const [actionMenu, setActionMenu] = useState<string | null>(null);

  const staleCategories = metrics.scientificBase.filter((s) => s.stale);

  const filtered = users.filter((u) => {
    const q = search.toLowerCase();
    const matchSearch = !q || u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q);
    const matchPlan = planFilter === 'all' || u.plan === planFilter;
    return matchSearch && matchPlan;
  });

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const handleAction = (action: string, user: WorkspaceUser) => {
    setActionMenu(null);
    if (action === 'suspend') {
      setUsers((us) => us.map((u) => u.id === user.id ? { ...u, status: 'suspended' as UserStatus } : u));
      toast.warning(`Workspace "${user.name}" suspenso`);
    } else if (action === 'activate') {
      setUsers((us) => us.map((u) => u.id === user.id ? { ...u, status: 'active' as UserStatus } : u));
      toast.success(`Workspace "${user.name}" reativado`);
    } else if (action === 'tokens') {
      toast.info(`Ajuste de tokens para "${user.name}" — em breve`);
    }
  };

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

      <div className="p-6 max-w-6xl mx-auto w-full space-y-6 flex-1">
        {staleCategories.length > 0 && (
          <Alert className="border-red-200 bg-red-50 dark:bg-red-950">
            <AlertTriangle className="h-4 w-4 text-red-600" />
            <AlertDescription className="text-red-800 dark:text-red-300 text-sm">
              <strong>Base científica desatualizada:</strong>{' '}
              {staleCategories.map((s) => s.category).join(', ')} — mais de 90 dias sem atualização.
            </AlertDescription>
          </Alert>
        )}

        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { icon: Users,     color: 'text-blue-500',   value: metrics.totalWorkspaces,              sub: `${metrics.activeWorkspaces} ativos`,         label: 'Workspaces' },
            { icon: Users,     color: 'text-green-500',  value: metrics.totalUsers,                   sub: `${metrics.totalPatients.toLocaleString('pt-BR')} pacientes`, label: 'Profissionais' },
            { icon: Coins,     color: 'text-yellow-500', value: metrics.tokensConsumedThisMonth.toLocaleString('pt-BR'), sub: 'tokens consumidos (mês)', label: 'Tokens' },
            { icon: TrendingUp, color: 'text-purple-500', value: `R$ ${metrics.mrr.toLocaleString('pt-BR')}`, sub: 'MRR estimado', label: 'Receita' },
          ].map((kpi, i) => (
            <Card key={i}>
              <CardContent className="pt-5">
                <div className="flex items-center gap-3">
                  <kpi.icon className={`h-6 w-6 ${kpi.color} flex-shrink-0`} />
                  <div>
                    <p className="text-2xl font-black text-gray-900 dark:text-white">{kpi.value}</p>
                    <p className="text-xs text-gray-500">{kpi.sub}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Analysis chart + Scientific base */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Activity className="h-4 w-4" /> Análises por Módulo (30 dias)
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {[
                { label: 'Avaliação Nutricional', count: metrics.analyses.nutritional, color: 'bg-green-500' },
                { label: 'Análise de Interações', count: metrics.analyses.interactions, color: 'bg-red-400' },
                { label: 'Avaliação Física',      count: metrics.analyses.physical,     color: 'bg-blue-400' },
                { label: 'Relatórios Gerados',    count: metrics.analyses.reports,      color: 'bg-purple-400' },
                { label: 'Biodisponibilidade',    count: metrics.analyses.bioavailability, color: 'bg-yellow-400' },
              ].map((item) => {
                const max = Math.max(...Object.values(metrics.analyses));
                return (
                  <div key={item.label} className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-gray-600 dark:text-gray-400">{item.label}</span>
                      <span className="font-bold text-gray-800 dark:text-gray-200">{item.count}</span>
                    </div>
                    <div className="h-2 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                      <div className={`h-full ${item.color} rounded-full`} style={{ width: `${(item.count / max) * 100}%` }} />
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <BookOpen className="h-4 w-4" /> Base Científica
              </CardTitle>
              <Button size="sm" variant="outline" className="text-xs flex items-center gap-1" onClick={() => toast.info('Atualização agendada')}>
                <RefreshCw className="h-3 w-3" /> Atualizar
              </Button>
            </CardHeader>
            <CardContent className="space-y-2">
              {metrics.scientificBase.map((item) => (
                <div key={item.category} className="flex items-center justify-between py-2 border-b dark:border-gray-800 last:border-0">
                  <div>
                    <p className="text-sm font-medium text-gray-800 dark:text-gray-200">{item.category}</p>
                    <p className="text-xs text-gray-400">{item.lastUpdated}</p>
                  </div>
                  {item.stale
                    ? <Badge variant="outline" className="text-xs bg-red-50 text-red-700 border-red-200 flex items-center gap-1"><AlertTriangle className="h-3 w-3" />{item.daysAgo}d</Badge>
                    : <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-200">OK · {item.daysAgo}d</Badge>
                  }
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        {/* Users table */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center justify-between gap-3">
              <span className="flex items-center gap-2"><Users className="h-4 w-4" /> Workspaces</span>
              <span className="text-xs text-gray-400 font-normal">{filtered.length} total</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {/* Filters */}
            <div className="flex flex-col sm:flex-row gap-3 mb-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
                <Input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="Buscar por nome ou email..." className="pl-9 h-9 text-sm" />
              </div>
              <div className="flex gap-1.5 flex-wrap">
                {(['all', 'starter', 'individual_pro', 'clinic', 'institutional'] as const).map((plan) => (
                  <button key={plan} onClick={() => { setPlanFilter(plan); setPage(1); }}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-all ${planFilter === plan ? 'bg-blue-600 text-white border-blue-600' : 'bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-700 hover:border-gray-300'}`}>
                    {plan === 'all' ? 'Todos' : plan === 'individual_pro' ? 'Profissional' : plan.charAt(0).toUpperCase() + plan.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto rounded-xl border dark:border-gray-800">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 dark:bg-gray-800">
                  <tr>
                    {['Workspace', 'Plano', 'Tokens', 'Pacientes', 'Último acesso', 'Status', ''].map((h) => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {paged.map((u) => {
                    const tokenPct = Math.round((u.tokensLeft / u.tokensTotal) * 100);
                    const tokenColor = tokenPct > 40 ? 'bg-blue-400' : tokenPct > 15 ? 'bg-yellow-400' : 'bg-red-400';
                    return (
                      <tr key={u.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                        <td className="px-4 py-3">
                          <p className="font-medium text-gray-800 dark:text-gray-200">{u.name}</p>
                          <p className="text-xs text-gray-400">{u.email}</p>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${PLAN_BADGE[u.plan]}`}>
                            {PLAN_LABEL[u.plan]}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <p className="text-xs font-bold text-gray-700 dark:text-gray-300">{u.tokensLeft.toLocaleString('pt-BR')}</p>
                          <div className="w-16 h-1 bg-gray-200 dark:bg-gray-700 rounded-full mt-1 overflow-hidden">
                            <div className={`h-full ${tokenColor} rounded-full`} style={{ width: `${tokenPct}%` }} />
                          </div>
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-600 dark:text-gray-400">{u.patientsCount}</td>
                        <td className="px-4 py-3 text-xs text-gray-500">{u.lastAccess}</td>
                        <td className="px-4 py-3">
                          {u.status === 'active'    && <span className="flex items-center gap-1 text-xs text-green-600"><CheckCircle className="h-3 w-3" />Ativo</span>}
                          {u.status === 'suspended' && <span className="flex items-center gap-1 text-xs text-red-600"><XCircle className="h-3 w-3" />Suspenso</span>}
                          {u.status === 'pending'   && <span className="flex items-center gap-1 text-xs text-yellow-600"><AlertTriangle className="h-3 w-3" />Pendente</span>}
                        </td>
                        <td className="px-4 py-3 relative">
                          <button onClick={() => setActionMenu(actionMenu === u.id ? null : u.id)}
                            className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400">
                            <MoreHorizontal className="h-4 w-4" />
                          </button>
                          {actionMenu === u.id && (
                            <div className="absolute right-4 top-10 bg-white dark:bg-gray-900 rounded-xl shadow-lg border dark:border-gray-700 z-20 overflow-hidden w-44">
                              <button onClick={() => handleAction('tokens', u)} className="w-full px-4 py-2.5 text-xs text-left hover:bg-gray-50 dark:hover:bg-gray-800 flex items-center gap-2">
                                <Coins className="h-3 w-3 text-blue-500" /> Ajustar tokens
                              </button>
                              {u.status !== 'suspended'
                                ? <button onClick={() => handleAction('suspend', u)} className="w-full px-4 py-2.5 text-xs text-left hover:bg-gray-50 dark:hover:bg-gray-800 text-red-600 flex items-center gap-2">
                                    <XCircle className="h-3 w-3" /> Suspender
                                  </button>
                                : <button onClick={() => handleAction('activate', u)} className="w-full px-4 py-2.5 text-xs text-left hover:bg-gray-50 dark:hover:bg-gray-800 text-green-600 flex items-center gap-2">
                                    <CheckCircle className="h-3 w-3" /> Reativar
                                  </button>
                              }
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-4">
                <p className="text-xs text-gray-400">
                  Mostrando {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filtered.length)} de {filtered.length}
                </p>
                <div className="flex items-center gap-1">
                  <button onClick={() => setPage((p) => Math.max(p - 1, 1))} disabled={page === 1}
                    className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-30">
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                    <button key={p} onClick={() => setPage(p)}
                      className={`w-7 h-7 text-xs rounded-lg transition-colors ${p === page ? 'bg-blue-600 text-white' : 'hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600'}`}>
                      {p}
                    </button>
                  ))}
                  <button onClick={() => setPage((p) => Math.min(p + 1, totalPages))} disabled={page === totalPages}
                    className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-30">
                    <ChevronRight className="h-4 w-4" />
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
