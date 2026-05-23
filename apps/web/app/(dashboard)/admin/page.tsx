'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Users, Coins, TrendingUp, Database, ShieldAlert,
  AlertTriangle, BookOpen, Activity, RefreshCw,
} from 'lucide-react';

// Mock de métricas administrativas
const metrics = {
  totalWorkspaces: 47,
  activeWorkspaces: 43,
  totalUsers: 189,
  totalPatients: 1240,
  tokensConsumedThisMonth: 28750,
  tokensSoldThisMonth: 35000,
  mrr: 12350, // R$
  analyses: { interactions: 890, nutritional: 1240, physical: 780, bioavailability: 320, reports: 560 },
  scientificBase: [
    { category: 'Suplementação', lastUpdated: '15/04/2026', daysAgo: 37, stale: false },
    { category: 'Interações medicamentosas', lastUpdated: '18/03/2026', daysAgo: 65, stale: false },
    { category: 'Biodisponibilidade', lastUpdated: '10/01/2026', daysAgo: 132, stale: true },
    { category: 'Diretrizes nutricionais', lastUpdated: '02/02/2026', daysAgo: 109, stale: true },
    { category: 'Valores laboratoriais', lastUpdated: '20/05/2026', daysAgo: 2, stale: false },
  ],
  topWorkspaces: [
    { name: 'Clínica Alpha', tokens: 2850, plan: 'clinic' },
    { name: 'Nutri Esportivo SP', tokens: 1920, plan: 'individual_pro' },
    { name: 'Centro de Saúde Beta', tokens: 1650, plan: 'clinic' },
    { name: 'Academia Premium', tokens: 980, plan: 'individual_pro' },
  ],
  recentAlerts: [
    { workspace: 'Clínica Alpha', patient: '***', alert: 'Vitamina K + Varfarina', severity: 'high', date: 'Hoje' },
    { workspace: 'Nutri Esportivo SP', patient: '***', alert: 'Base científica desatualizada', severity: 'warning', date: 'Ontem' },
  ],
};

export default function AdminPage() {
  const staleCategories = metrics.scientificBase.filter((s) => s.stale);

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Painel Administrativo</h1>
        <p className="text-gray-500 text-sm mt-1">NutriPerformance Clinical — Visão global do SaaS</p>
      </div>

      {/* Alerta de base científica desatualizada */}
      {staleCategories.length > 0 && (
        <Alert className="border-red-300 bg-red-50">
          <AlertTriangle className="h-4 w-4 text-red-600" />
          <AlertDescription className="text-red-800 text-sm">
            <strong>Base científica desatualizada:</strong>{' '}
            {staleCategories.map((s) => s.category).join(', ')} — há mais de 90 dias sem atualização.
            Revisar e atualizar para garantir qualidade das análises.
          </AlertDescription>
        </Alert>
      )}

      {/* KPIs principais */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center gap-3">
              <Users className="h-6 w-6 text-blue-500" />
              <div>
                <p className="text-2xl font-bold">{metrics.totalWorkspaces}</p>
                <p className="text-xs text-gray-500">Workspaces ({metrics.activeWorkspaces} ativos)</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center gap-3">
              <Users className="h-6 w-6 text-green-500" />
              <div>
                <p className="text-2xl font-bold">{metrics.totalUsers}</p>
                <p className="text-xs text-gray-500">Profissionais cadastrados</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center gap-3">
              <Coins className="h-6 w-6 text-yellow-500" />
              <div>
                <p className="text-2xl font-bold">{metrics.tokensConsumedThisMonth.toLocaleString('pt-BR')}</p>
                <p className="text-xs text-gray-500">Tokens consumidos (mês)</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center gap-3">
              <TrendingUp className="h-6 w-6 text-purple-500" />
              <div>
                <p className="text-2xl font-bold">R$ {metrics.mrr.toLocaleString('pt-BR')}</p>
                <p className="text-xs text-gray-500">MRR</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Uso por módulo */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Activity className="h-4 w-4" /> Análises por Módulo (30 dias)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {[
              { label: 'Avaliação Nutricional', count: metrics.analyses.nutritional, color: 'bg-green-500' },
              { label: 'Análise de Interações', count: metrics.analyses.interactions, color: 'bg-red-400' },
              { label: 'Avaliação Física', count: metrics.analyses.physical, color: 'bg-blue-400' },
              { label: 'Relatórios Gerados', count: metrics.analyses.reports, color: 'bg-purple-400' },
              { label: 'Biodisponibilidade', count: metrics.analyses.bioavailability, color: 'bg-yellow-400' },
            ].map((item) => {
              const max = Math.max(...Object.values(metrics.analyses));
              const pct = Math.round((item.count / max) * 100);
              return (
                <div key={item.label} className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-600">{item.label}</span>
                    <span className="font-semibold">{item.count}</span>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div className={`h-full ${item.color} rounded-full`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>

        {/* Saúde da base científica */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <BookOpen className="h-4 w-4" /> Base Científica
            </CardTitle>
            <Button size="sm" variant="outline" className="flex items-center gap-1 text-xs">
              <RefreshCw className="h-3 w-3" /> Atualizar
            </Button>
          </CardHeader>
          <CardContent className="space-y-2">
            {metrics.scientificBase.map((item) => (
              <div key={item.category} className="flex items-center justify-between py-2 border-b last:border-0">
                <div>
                  <p className="text-sm font-medium text-gray-800">{item.category}</p>
                  <p className="text-xs text-gray-400">Última atualização: {item.lastUpdated}</p>
                </div>
                {item.stale ? (
                  <Badge variant="outline" className="text-xs bg-red-50 text-red-700 border-red-300 flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3" />
                    {item.daysAgo}d
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-300">
                    OK · {item.daysAgo}d
                  </Badge>
                )}
              </div>
            ))}
            <p className="text-xs text-gray-400 italic pt-1">
              Alerta automático após 90 dias sem atualização.
            </p>
          </CardContent>
        </Card>

        {/* Top workspaces por consumo */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Top Workspaces por Consumo</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {metrics.topWorkspaces.map((w, i) => (
              <div key={i} className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-sm text-gray-400 font-bold w-4">{i + 1}</span>
                  <div>
                    <p className="text-sm font-medium text-gray-800">{w.name}</p>
                    <Badge variant="outline" className="text-xs mt-0.5">{w.plan}</Badge>
                  </div>
                </div>
                <span className="text-sm font-bold text-blue-700">{w.tokens.toLocaleString('pt-BR')} tokens</span>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Alertas recentes do sistema */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <ShieldAlert className="h-4 w-4 text-yellow-600" />
              Alertas Clínicos Recentes
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {metrics.recentAlerts.map((a, i) => (
              <div key={i} className={`border-l-4 p-3 rounded-r-md ${
                a.severity === 'high' ? 'border-l-red-500 bg-red-50' : 'border-l-yellow-400 bg-yellow-50'
              }`}>
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium">{a.alert}</p>
                  <Badge variant="outline" className="text-xs">{a.severity}</Badge>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  {a.workspace} · Paciente {a.patient} · {a.date}
                </p>
              </div>
            ))}
            <p className="text-xs text-gray-400 italic">
              Dados anonimizados. Acesso completo via workspace do profissional.
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Ações administrativas */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Database className="h-4 w-4" /> Ações Administrativas
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: 'Exportar logs de auditoria', icon: Database },
            { label: 'Atualizar base científica', icon: BookOpen },
            { label: 'Ajustar custo de tokens', icon: Coins },
            { label: 'Revisar usuários suspensos', icon: Users },
          ].map((action, i) => (
            <Button key={i} variant="outline" size="sm" className="flex items-center gap-2 h-auto py-3 text-xs">
              <action.icon className="h-4 w-4" />
              {action.label}
            </Button>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
