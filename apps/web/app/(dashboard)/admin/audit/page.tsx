'use client';

import { useState } from 'react';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { api } from '@/lib/api-client';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { PageHeader } from '@/components/PageHeader';
import { AuthGuard } from '@/components/AuthGuard';
import { EmptyState } from '@/components/EmptyState';
import { useDebounce } from '@/hooks/useDebounce';
import {
  Shield, Search, ChevronLeft, ChevronRight, Loader2,
  Eye, Edit, Plus, Trash2,
} from 'lucide-react';

// Ações realmente gravadas pela API (AuditInterceptor + AuditService).
const ACTION_CONFIG: Record<string, { label: string; icon: React.ComponentType<{ className?: string }>; color: string }> = {
  READ:            { label: 'Consultou',        icon: Eye,           color: 'bg-muted text-muted-foreground' },
  CREATE:          { label: 'Criou',            icon: Plus,          color: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300' },
  UPDATE:          { label: 'Atualizou',        icon: Edit,          color: 'bg-secondary text-secondary-foreground' },
  DELETE:          { label: 'Removeu',          icon: Trash2,        color: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300' },
  add_checkpoint:  { label: 'Registrou avanço', icon: Plus,          color: 'bg-accent text-accent-foreground' },
  mark_achieved:   { label: 'Concluiu meta',    icon: Shield,        color: 'bg-accent text-accent-foreground' },
};

// Rótulo legível para o campo `resource` — que pode ser um nome semântico
// (ex: `laboratory_exam`) ou o path da requisição (ex: `/patients/123`).
const RESOURCE_LABELS: Record<string, string> = {
  patients: 'Paciente',
  nutritional_assessment: 'Avaliação nutricional',
  physical_assessment: 'Avaliação física',
  laboratory_exam: 'Exame laboratorial',
  patient_supplementation: 'Suplementação',
  patient_goal: 'Meta do paciente',
  interaction_analyses: 'Análise de interações',
  foods: 'Base de alimentos',
};

function resourceLabel(resource: string) {
  if (RESOURCE_LABELS[resource]) return RESOURCE_LABELS[resource];
  // Path de requisição → usa o primeiro segmento como recurso.
  const segment = resource.replace(/^\//, '').split('/')[0];
  return RESOURCE_LABELS[segment] ?? segment ?? resource;
}

const PAGE_SIZE = 20;

function formatDate(iso: string) {
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

function AuditLogContent() {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [actionFilter, setActionFilter] = useState('all');
  const debouncedSearch = useDebounce(search, 400);

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['admin-audit-logs', page, debouncedSearch],
    queryFn: () => api.admin.auditLogs({
      page,
      limit: PAGE_SIZE,
      resource: debouncedSearch || undefined,
    }),
    placeholderData: keepPreviousData,
  });

  const items = data?.items ?? [];
  // Filtro de ação aplicado sobre a página corrente (a API pagina por data).
  const visible = actionFilter === 'all' ? items : items.filter((l) => l.action === actionFilter);
  const totalPages = data?.pages ?? 1;

  const stats = [
    { label: 'Eventos no período', value: data?.total ?? 0, color: 'text-foreground' },
    { label: 'Nesta página', value: items.length, color: 'text-primary' },
    { label: 'Falhas registradas', value: items.filter((l) => !l.success).length, color: 'text-destructive' },
    { label: 'Página', value: `${page} / ${totalPages}`, color: 'text-muted-foreground' },
  ];

  return (
    <div className="flex flex-col min-h-full">
      <PageHeader
        title="Audit Log"
        description="Registro de todas as ações clínicas — conformidade LGPD (Lei 13.709/2018)"
        breadcrumbs={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Admin', href: '/admin' },
          { label: 'Audit Log' },
        ]}
      />

      <div className="px-4 py-5 sm:p-6 max-w-6xl mx-auto w-full space-y-5">

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {stats.map((s) => (
            <div key={s.label} className="bg-card rounded-xl border px-4 py-3">
              <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              placeholder="Filtrar por recurso (ex: patients, laboratory_exam)..."
              className="pl-9"
              aria-label="Filtrar registros por recurso"
            />
          </div>
          <select
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            aria-label="Filtrar por tipo de ação"
            className="h-10 rounded-md border bg-background px-3 text-sm min-w-[200px]"
          >
            <option value="all">Todas as ações</option>
            {Object.entries(ACTION_CONFIG).map(([value, cfg]) => (
              <option key={value} value={value}>{cfg.label}</option>
            ))}
          </select>
        </div>

        {/* Table */}
        <Card>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : isError ? (
              <EmptyState
                icon="⚠️"
                title="Não foi possível carregar a trilha de auditoria"
                description={(error as Error)?.message ?? 'Tente novamente em instantes.'}
              />
            ) : visible.length === 0 ? (
              <EmptyState
                icon="🛡️"
                title="Nenhum registro encontrado"
                description="Ainda não há eventos de auditoria para os filtros selecionados."
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <caption className="sr-only">Registros de auditoria de ações clínicas e administrativas</caption>
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th scope="col" className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Data/Hora</th>
                      <th scope="col" className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Usuário</th>
                      <th scope="col" className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Ação</th>
                      <th scope="col" className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Recurso</th>
                      <th scope="col" className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide hidden lg:table-cell">IP</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {visible.map((log) => {
                      const cfg = ACTION_CONFIG[log.action];
                      const Icon = cfg?.icon ?? Shield;
                      return (
                        <tr key={log.id} className="hover:bg-muted/40 transition-colors">
                          <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">{formatDate(log.created_at)}</td>
                          <td className="px-4 py-3">
                            <span className="text-xs font-medium text-foreground">{log.user_email ?? '—'}</span>
                          </td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex items-center gap-1.5 text-xs px-2 py-1 rounded-full font-medium ${cfg?.color ?? 'bg-muted text-muted-foreground'}`}>
                              <Icon className="h-3 w-3" />
                              {cfg?.label ?? log.action}
                              {!log.success && <span className="text-destructive font-semibold">· falhou</span>}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <span className="text-xs text-foreground">{resourceLabel(log.resource)}</span>
                            <span className="text-xs text-muted-foreground ml-2">{log.resource}</span>
                          </td>
                          <td className="px-4 py-3 text-xs text-muted-foreground font-mono hidden lg:table-cell">{log.ip_address ?? '—'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t">
                <span className="text-xs text-muted-foreground">
                  {data?.total ?? 0} registros · página {page} de {totalPages}
                </span>
                <div className="flex items-center gap-1">
                  <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}
                    aria-label="Página anterior"
                    className="p-1.5 rounded hover:bg-muted disabled:opacity-40">
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  {Array.from({ length: totalPages }, (_, i) => i + 1)
                    .filter((p) => Math.abs(p - page) <= 2)
                    .map((p) => (
                      <button key={p} onClick={() => setPage(p)}
                        aria-label={`Ir para página ${p}`}
                        aria-current={p === page ? 'page' : undefined}
                        className={`w-8 h-8 rounded text-xs font-medium ${p === page ? 'bg-primary text-primary-foreground' : 'hover:bg-muted text-muted-foreground'}`}>
                        {p}
                      </button>
                    ))}
                  <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                    aria-label="Próxima página"
                    className="p-1.5 rounded hover:bg-muted disabled:opacity-40">
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <p className="text-xs text-muted-foreground text-center border-t pt-4 leading-relaxed">
          Todos os acessos e ações são registrados conforme LGPD (Lei 13.709/2018) e Resolução CFN 599/2018.
          Logs são imutáveis e retidos por 5 anos.
        </p>
      </div>
    </div>
  );
}

export default function AuditLogPage() {
  return (
    <AuthGuard requiredRole="admin">
      <AuditLogContent />
    </AuthGuard>
  );
}
