'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  Users,
  Coins,
  AlertTriangle,
  TrendingUp,
  FileText,
  Pill,
  ShieldAlert,
  Activity,
  FlaskConical,
  ArrowRight,
} from 'lucide-react';
import Link from 'next/link';

// Aviso ético persistente no dashboard
function SystemPurposeBanner() {
  return (
    <Alert className="mb-6 border-blue-200 bg-blue-50">
      <ShieldAlert className="h-4 w-4 text-blue-600" />
      <AlertDescription className="text-blue-800 text-xs leading-relaxed">
        <strong>NutriPerformance Clinical — Ferramenta de Apoio Profissional.</strong>{' '}
        Este sistema auxilia Nutricionistas e Profissionais de Educação Física na organização clínica,
        análise de suplementação e geração de relatórios. <strong>Não substitui</strong> consulta,
        diagnóstico ou prescrição profissional. Toda análise deve ser validada pelo profissional responsável.
        Conforme CFN, CONFEF e LGPD (Lei 13.709/2018).
      </AlertDescription>
    </Alert>
  );
}

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ReactNode;
  href?: string;
  alertCount?: number;
}

function StatCard({ title, value, subtitle, icon, href, alertCount }: StatCardProps) {
  const content = (
    <Card className={`hover:shadow-md transition-shadow ${href ? 'cursor-pointer' : ''}`}>
      <CardHeader className="pb-2 flex flex-row items-center justify-between">
        <CardTitle className="text-sm font-medium text-gray-600">{title}</CardTitle>
        <div className="text-gray-400">{icon}</div>
      </CardHeader>
      <CardContent>
        <div className="flex items-baseline justify-between">
          <p className="text-2xl font-bold text-gray-900">{value}</p>
          {alertCount !== undefined && alertCount > 0 && (
            <Badge variant="destructive" className="text-xs">
              {alertCount} alerta{alertCount > 1 ? 's' : ''}
            </Badge>
          )}
        </div>
        {subtitle && <p className="text-xs text-gray-500 mt-1">{subtitle}</p>}
      </CardContent>
    </Card>
  );

  return href ? <Link href={href}>{content}</Link> : content;
}

// Mock de alertas pendentes
const pendingAlerts = [
  {
    id: 1,
    patientCode: 'PAC-SEED-001',
    severity: 'high' as const,
    title: 'Interação: Ferro × Omeprazol',
    description: 'IBP pode reduzir absorção de ferro. Avaliar estratégia de suplementação.',
    module: 'interactions',
  },
  {
    id: 2,
    patientCode: 'PAC-SEED-001',
    severity: 'info' as const,
    title: 'Base científica: suplementação',
    description: 'Diretrizes de suplementação não revisadas há 87 dias.',
    module: 'scientific_base',
  },
];

const alertSeverityConfig = {
  critical: { class: 'border-l-red-600 bg-red-50', badge: 'bg-red-200 text-red-900', label: 'Crítico' },
  danger:   { class: 'border-l-red-500 bg-red-50',  badge: 'bg-red-100 text-red-800',  label: 'Urgente' },
  high:     { class: 'border-l-red-500 bg-red-50',  badge: 'bg-red-100 text-red-800',  label: 'Alto' },
  warning:  { class: 'border-l-yellow-500 bg-yellow-50', badge: 'bg-yellow-100 text-yellow-800', label: 'Moderado' },
  moderate: { class: 'border-l-yellow-500 bg-yellow-50', badge: 'bg-yellow-100 text-yellow-800', label: 'Moderado' },
  info:     { class: 'border-l-blue-400 bg-blue-50', badge: 'bg-blue-100 text-blue-800', label: 'Info' },
};

// Atividade recente fictícia
const recentActivity = [
  { action: 'Avaliação nutricional', patient: 'PAC-SEED-001', date: 'Hoje', tokens: 10, module: 'nutritional' },
  { action: 'Análise de interações', patient: 'PAC-SEED-001', date: 'Ontem', tokens: 15, module: 'interactions' },
  { action: 'Relatório PDF gerado', patient: 'PAC-SEED-001', date: '20/05', tokens: 5, module: 'reports' },
];

export default function DashboardPage() {
  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-500 text-sm mt-1">Visão geral do seu workspace clínico</p>
      </div>

      <SystemPurposeBanner />

      {/* Stats principais */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <StatCard
          title="Pacientes Ativos"
          value={12}
          subtitle="3 com alertas pendentes"
          icon={<Users className="h-5 w-5" />}
          href="/patients"
          alertCount={3}
        />
        <StatCard
          title="Tokens Disponíveis"
          value={557}
          subtitle="Plano Profissional · 600/mês"
          icon={<Coins className="h-5 w-5 text-blue-500" />}
          href="/tokens"
        />
        <StatCard
          title="Relatórios do Mês"
          value={8}
          subtitle="Último há 2 dias"
          icon={<FileText className="h-5 w-5" />}
          href="/reports"
        />
        <StatCard
          title="Alertas Pendentes"
          value={pendingAlerts.length}
          subtitle="Requerem atenção"
          icon={<AlertTriangle className="h-5 w-5 text-yellow-500" />}
          alertCount={pendingAlerts.length}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Alertas clínicos */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-yellow-500" />
              Alertas Pendentes
            </CardTitle>
            <Link href="/alerts" className="text-xs text-blue-600 hover:underline">
              Ver todos
            </Link>
          </CardHeader>
          <CardContent className="space-y-3">
            {pendingAlerts.map((alert) => {
              const config = alertSeverityConfig[alert.severity as keyof typeof alertSeverityConfig] ?? alertSeverityConfig.info;
              return (
                <div key={alert.id} className={`border-l-4 ${config.class} p-3 rounded-r-md`}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium">{alert.title}</span>
                        <span className={`text-xs px-1.5 py-0.5 rounded ${config.badge}`}>
                          {config.label}
                        </span>
                      </div>
                      <p className="text-xs text-gray-600 mt-1">{alert.description}</p>
                      <p className="text-xs text-gray-400 mt-1">Paciente: {alert.patientCode}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>

        {/* Atividade recente */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Activity className="h-4 w-4 text-gray-500" />
              Atividade Recente
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {recentActivity.map((item, i) => (
              <div key={i} className="flex items-center justify-between py-2 border-b last:border-0">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center">
                    {item.module === 'nutritional' && <FlaskConical className="h-4 w-4 text-green-600" />}
                    {item.module === 'interactions' && <Pill className="h-4 w-4 text-red-500" />}
                    {item.module === 'reports' && <FileText className="h-4 w-4 text-blue-500" />}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-800">{item.action}</p>
                    <p className="text-xs text-gray-400">
                      {item.patient} · {item.date}
                    </p>
                  </div>
                </div>
                <Badge variant="outline" className="text-xs text-blue-700 border-blue-200">
                  -{item.tokens} tokens
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Ações rápidas */}
      <div className="mt-6">
        <h2 className="text-sm font-semibold text-gray-600 mb-3 uppercase tracking-wide">
          Ações Rápidas
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: 'Nova Avaliação Nutricional', icon: FlaskConical, href: '/assessments/nutritional/new', tokens: 10, color: 'text-green-600' },
            { label: 'Nova Avaliação Física', icon: TrendingUp, href: '/assessments/physical/new', tokens: 5, color: 'text-blue-600' },
            { label: 'Analisar Interações', icon: Pill, href: '/interactions/new', tokens: 15, color: 'text-red-500' },
            { label: 'Gerar Relatório', icon: FileText, href: '/reports/new', tokens: 5, color: 'text-purple-600' },
          ].map((action) => (
            <Link key={action.href} href={action.href}>
              <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
                <CardContent className="pt-4 pb-3">
                  <action.icon className={`h-6 w-6 ${action.color} mb-2`} />
                  <p className="text-sm font-medium text-gray-800 leading-tight">{action.label}</p>
                  <p className="text-xs text-gray-400 mt-1 flex items-center gap-1">
                    <Coins className="h-3 w-3" />
                    {action.tokens} tokens
                  </p>
                  <ArrowRight className="h-3 w-3 text-gray-300 mt-2" />
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
