'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  Users, Coins, AlertTriangle, TrendingUp, FileText,
  Pill, ShieldAlert, Activity, FlaskConical, ArrowRight,
  Microscope, Target, Dna,
} from 'lucide-react';
import Link from 'next/link';
import { createBrowserClient } from '@supabase/ssr';
import { toast } from 'sonner';
import { OnboardingBanner } from '@/components/OnboardingBanner';
import { NotificationPermissionBanner } from '@/components/NotificationPermissionBanner';

// ─── Skeleton ────────────────────────────────────────────────────────────────
function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse bg-gray-200 rounded ${className}`} />;
}

function StatSkeleton() {
  return (
    <Card>
      <CardHeader className="pb-2">
        <Skeleton className="h-4 w-24" />
      </CardHeader>
      <CardContent>
        <Skeleton className="h-8 w-16 mb-1" />
        <Skeleton className="h-3 w-32" />
      </CardContent>
    </Card>
  );
}

// ─── Token progress bar ───────────────────────────────────────────────────────
function TokenBar({ used, total }: { used: number; total: number }) {
  const pct = Math.min(100, Math.round((used / total) * 100));
  const color = pct > 80 ? 'bg-red-500' : pct > 60 ? 'bg-yellow-400' : 'bg-blue-500';
  return (
    <div className="mt-3">
      <div className="flex justify-between text-xs text-gray-500 mb-1">
        <span>{used} usados</span>
        <span>{total - used} restantes</span>
      </div>
      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <p className="text-[10px] text-gray-400 mt-1">{pct}% do plano mensal</p>
    </div>
  );
}

// ─── Quick actions ────────────────────────────────────────────────────────────
const QUICK_ACTIONS = [
  { label: 'Avaliação Nutricional', icon: FlaskConical, href: '/assessments/nutritional/new', tokens: 10, color: 'bg-green-50 text-green-600 border-green-200' },
  { label: 'Avaliação Física', icon: TrendingUp, href: '/assessments/physical/new', tokens: 5, color: 'bg-blue-50 text-blue-600 border-blue-200' },
  { label: 'Análise de Interações', icon: Pill, href: '/interactions/new', tokens: 15, color: 'bg-red-50 text-red-500 border-red-200' },
  { label: 'Biodisponibilidade', icon: Dna, href: '/bioavailability', tokens: 12, color: 'bg-purple-50 text-purple-600 border-purple-200' },
  { label: 'Exames Laboratoriais', icon: Microscope, href: '/laboratory', tokens: 10, color: 'bg-orange-50 text-orange-500 border-orange-200' },
  { label: 'Gerar Relatório', icon: FileText, href: '/reports/new', tokens: 5, color: 'bg-gray-50 text-gray-600 border-gray-200' },
];

// ─── Alert severity config ────────────────────────────────────────────────────
const ALERT_CONFIG = {
  critical: { bar: 'border-l-red-600', bg: 'bg-red-50', badge: 'bg-red-200 text-red-900', label: 'Crítico' },
  danger:   { bar: 'border-l-red-500', bg: 'bg-red-50',  badge: 'bg-red-100 text-red-800',  label: 'Urgente' },
  high:     { bar: 'border-l-red-500', bg: 'bg-red-50',  badge: 'bg-red-100 text-red-800',  label: 'Alto' },
  warning:  { bar: 'border-l-yellow-500', bg: 'bg-yellow-50', badge: 'bg-yellow-100 text-yellow-800', label: 'Atenção' },
  moderate: { bar: 'border-l-yellow-500', bg: 'bg-yellow-50', badge: 'bg-yellow-100 text-yellow-800', label: 'Moderado' },
  info:     { bar: 'border-l-blue-400', bg: 'bg-blue-50', badge: 'bg-blue-100 text-blue-800', label: 'Info' },
} as const;

type AlertSeverity = keyof typeof ALERT_CONFIG;

// ─── Types ────────────────────────────────────────────────────────────────────
interface DashboardData {
  userName: string;
  workspace: { plan: string; tokenBalance: number; tokenLimit: number };
  stats: { patients: number; alertPatients: number; reports: number; alerts: number };
  pendingAlerts: Array<{ id: number; severity: AlertSeverity; title: string; description: string; patientCode: string }>;
  recentActivity: Array<{ action: string; patient: string; date: string; tokens: number; module: string }>;
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [greeting, setGreeting] = useState('Bom dia');

  useEffect(() => {
    const h = new Date().getHours();
    setGreeting(h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite');

    async function load() {
      try {
        const supabase = createBrowserClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        );
        const { data: { session } } = await supabase.auth.getSession();
        const userName = session?.user?.user_metadata?.full_name
          ?? session?.user?.email?.split('@')[0]
          ?? 'Profissional';

        // TODO: fetch real stats from API when endpoints are wired
        // const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/dashboard/stats`, {
        //   headers: { Authorization: `Bearer ${session?.access_token}` },
        // });
        // const stats = await res.json();

        // Placeholder data (replace with real API call above)
        // Example toast on load — remove in production
        // toast.success('Dashboard carregado');
        setData({
          userName,
          workspace: { plan: 'Profissional', tokenBalance: 557, tokenLimit: 600 },
          stats: { patients: 12, alertPatients: 3, reports: 8, alerts: 2 },
          pendingAlerts: [
            { id: 1, severity: 'high', title: 'Interação: Ferro × Omeprazol', description: 'IBP pode reduzir absorção de ferro. Avaliar estratégia de suplementação.', patientCode: 'PAC-SEED-001' },
            { id: 2, severity: 'info', title: 'Revisão recomendada', description: 'Suplementação não revisada há 87 dias.', patientCode: 'PAC-002' },
          ],
          recentActivity: [
            { action: 'Avaliação nutricional', patient: 'PAC-SEED-001', date: 'Hoje', tokens: 10, module: 'nutritional' },
            { action: 'Análise de interações', patient: 'PAC-SEED-001', date: 'Ontem', tokens: 15, module: 'interactions' },
            { action: 'Relatório PDF gerado', patient: 'PAC-SEED-001', date: '20/05', tokens: 5, module: 'reports' },
          ],
        });
      } finally {
        setLoading(false);
      }
    }

    load();
  }, []);

  return (
    <div className="max-w-6xl mx-auto">
      <NotificationPermissionBanner />
      <OnboardingBanner />
    <div className="p-6 space-y-6">

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          {loading
            ? <><Skeleton className="h-7 w-48 mb-2" /><Skeleton className="h-4 w-64" /></>
            : <>
                <h1 className="text-2xl font-bold text-gray-900">
                  {greeting}, {data?.userName?.split(' ')[0]} 👋
                </h1>
                <p className="text-gray-500 text-sm mt-1">
                  Workspace · Plano <strong>{data?.workspace.plan}</strong>
                </p>
              </>
          }
        </div>
        <Link href="/patients/new">
          <Button size="sm" className="flex items-center gap-2">
            <Users className="h-4 w-4" /> Novo Paciente
          </Button>
        </Link>
      </div>

      {/* Ethical banner */}
      <Alert className="border-blue-100 bg-blue-50">
        <ShieldAlert className="h-4 w-4 text-blue-500 flex-shrink-0" />
        <AlertDescription className="text-blue-800 text-xs leading-relaxed">
          <strong>Ferramenta de apoio profissional.</strong> Auxilia na organização clínica e análise de suplementação.{' '}
          <strong>Não substitui</strong> consulta, diagnóstico ou prescrição. Valide cada análise com seu julgamento clínico.{' '}
          CFN · CONFEF · LGPD (Lei 13.709/2018).
        </AlertDescription>
      </Alert>

      {/* Stats grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => <StatSkeleton key={i} />)
        ) : (
          <>
            <Link href="/patients">
              <Card className="hover:shadow-md transition-all cursor-pointer hover:-translate-y-0.5">
                <CardHeader className="pb-1 flex flex-row items-center justify-between">
                  <CardTitle className="text-xs font-medium text-gray-500">Pacientes Ativos</CardTitle>
                  <Users className="h-4 w-4 text-gray-300" />
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-bold text-gray-900">{data?.stats.patients}</p>
                  {data!.stats.alertPatients > 0 && (
                    <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                      <AlertTriangle className="h-3 w-3" />
                      {data?.stats.alertPatients} com alertas
                    </p>
                  )}
                </CardContent>
              </Card>
            </Link>

            <Card className="col-span-1">
              <CardHeader className="pb-1 flex flex-row items-center justify-between">
                <CardTitle className="text-xs font-medium text-gray-500">Tokens</CardTitle>
                <Coins className="h-4 w-4 text-blue-400" />
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold text-blue-600">{data?.workspace.tokenBalance}</p>
                <TokenBar
                  used={data!.workspace.tokenLimit - data!.workspace.tokenBalance}
                  total={data!.workspace.tokenLimit}
                />
              </CardContent>
            </Card>

            <Link href="/reports/new">
              <Card className="hover:shadow-md transition-all cursor-pointer hover:-translate-y-0.5">
                <CardHeader className="pb-1 flex flex-row items-center justify-between">
                  <CardTitle className="text-xs font-medium text-gray-500">Relatórios do Mês</CardTitle>
                  <FileText className="h-4 w-4 text-gray-300" />
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-bold text-gray-900">{data?.stats.reports}</p>
                  <p className="text-xs text-gray-400 mt-1">Último há 2 dias</p>
                </CardContent>
              </Card>
            </Link>

            <Card>
              <CardHeader className="pb-1 flex flex-row items-center justify-between">
                <CardTitle className="text-xs font-medium text-gray-500">Alertas Pendentes</CardTitle>
                <AlertTriangle className="h-4 w-4 text-yellow-400" />
              </CardHeader>
              <CardContent>
                <p className={`text-3xl font-bold ${data!.stats.alerts > 0 ? 'text-red-600' : 'text-gray-900'}`}>
                  {data?.stats.alerts}
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  {data?.stats.alerts === 0 ? 'Nenhum pendente' : 'Requerem atenção'}
                </p>
              </CardContent>
            </Card>
          </>
        )}
      </div>

      {/* Main content */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">

        {/* Pending alerts */}
        <Card className="lg:col-span-3">
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-yellow-500" />
              Alertas Clínicos Pendentes
            </CardTitle>
            <Link href="/patients" className="text-xs text-blue-600 hover:underline flex items-center gap-1">
              Ver pacientes <ArrowRight className="h-3 w-3" />
            </Link>
          </CardHeader>
          <CardContent className="space-y-3">
            {loading ? (
              <>
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-16 w-full" />
              </>
            ) : data?.pendingAlerts.length === 0 ? (
              <div className="text-center py-8 text-gray-400">
                <AlertTriangle className="h-8 w-8 mx-auto mb-2 opacity-30" />
                <p className="text-sm">Nenhum alerta pendente</p>
              </div>
            ) : (
              data?.pendingAlerts.map((alert) => {
                const cfg = ALERT_CONFIG[alert.severity] ?? ALERT_CONFIG.info;
                return (
                  <div key={alert.id} className={`border-l-4 ${cfg.bar} ${cfg.bg} p-3 rounded-r-lg`}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-medium text-gray-900">{alert.title}</span>
                          <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${cfg.badge}`}>
                            {cfg.label}
                          </span>
                        </div>
                        <p className="text-xs text-gray-600 mt-1 leading-relaxed">{alert.description}</p>
                        <p className="text-xs text-gray-400 mt-1">Paciente: {alert.patientCode}</p>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>

        {/* Recent activity */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Activity className="h-4 w-4 text-gray-400" />
              Atividade Recente
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            {loading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 py-2">
                  <Skeleton className="h-8 w-8 rounded-full flex-shrink-0" />
                  <div className="flex-1"><Skeleton className="h-4 w-full mb-1" /><Skeleton className="h-3 w-2/3" /></div>
                </div>
              ))
            ) : (
              data?.recentActivity.map((item, i) => (
                <div key={i} className="flex items-center gap-3 py-2.5 border-b last:border-0">
                  <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
                    {item.module === 'nutritional' && <FlaskConical className="h-4 w-4 text-green-600" />}
                    {item.module === 'interactions' && <Pill className="h-4 w-4 text-red-500" />}
                    {item.module === 'reports' && <FileText className="h-4 w-4 text-blue-500" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-gray-800 truncate">{item.action}</p>
                    <p className="text-[10px] text-gray-400">{item.patient} · {item.date}</p>
                  </div>
                  <span className="text-[10px] text-gray-400 flex-shrink-0">-{item.tokens} tk</span>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      {/* Quick actions */}
      <div>
        <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">
          Ações Rápidas
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {QUICK_ACTIONS.map((action) => (
            <Link key={action.href} href={action.href}>
              <div className={`border rounded-xl p-3 cursor-pointer hover:shadow-md transition-all hover:-translate-y-0.5 ${action.color}`}>
                <action.icon className="h-5 w-5 mb-2" />
                <p className="text-xs font-medium leading-tight">{action.label}</p>
                <p className="text-[10px] mt-1.5 opacity-70 flex items-center gap-1">
                  <Coins className="h-2.5 w-2.5" />{action.tokens} tokens
                </p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
    </div>
  );
}
