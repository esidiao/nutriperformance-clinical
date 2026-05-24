'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { PageHeader } from '@/components/PageHeader';
import {
  Shield, Search, ChevronLeft, ChevronRight,
  Eye, Edit, Plus, Trash2, FileText, AlertTriangle,
} from 'lucide-react';

interface AuditLog {
  id: string;
  userEmail: string;
  action: string;
  entityType: string;
  entityLabel?: string;
  createdAt: string;
  ipAddress?: string;
}

// ─── Mock data ────────────────────────────────────────────────────────────────
const MOCK_LOGS: AuditLog[] = [
  { id:'1', userEmail:'nutricionista@clinic.com', action:'VIEW_PATIENT', entityType:'patient', entityLabel:'PAC-001', createdAt:'2026-05-23T14:32:00Z', ipAddress:'192.168.1.10' },
  { id:'2', userEmail:'nutricionista@clinic.com', action:'CREATE_ASSESSMENT', entityType:'nutritional_assessment', entityLabel:'PAC-001 — Avaliação Nutricional', createdAt:'2026-05-23T14:35:00Z', ipAddress:'192.168.1.10' },
  { id:'3', userEmail:'admin@clinic.com', action:'ADJUST_TOKENS', entityType:'workspace', entityLabel:'Workspace Principal', createdAt:'2026-05-23T13:00:00Z', ipAddress:'192.168.0.1' },
  { id:'4', userEmail:'cref@clinic.com', action:'CREATE_ASSESSMENT', entityType:'physical_assessment', entityLabel:'PAC-003 — Avaliação Física', createdAt:'2026-05-23T11:15:00Z', ipAddress:'192.168.1.22' },
  { id:'5', userEmail:'nutricionista@clinic.com', action:'CREATE_INTERACTION_ANALYSIS', entityType:'interaction_analysis', entityLabel:'PAC-002 — Análise de interações', createdAt:'2026-05-23T10:05:00Z', ipAddress:'192.168.1.10' },
  { id:'6', userEmail:'nutricionista@clinic.com', action:'EXPORT_PDF', entityType:'report', entityLabel:'Relatório completo — PAC-001', createdAt:'2026-05-22T16:50:00Z', ipAddress:'192.168.1.10' },
  { id:'7', userEmail:'cref@clinic.com', action:'VIEW_PATIENT', entityType:'patient', entityLabel:'PAC-004', createdAt:'2026-05-22T15:20:00Z', ipAddress:'192.168.1.22' },
  { id:'8', userEmail:'admin@clinic.com', action:'VIEW_ADMIN', entityType:'system', entityLabel:'Painel administrativo', createdAt:'2026-05-22T09:00:00Z', ipAddress:'192.168.0.1' },
  { id:'9', userEmail:'nutricionista@clinic.com', action:'CREATE_PATIENT', entityType:'patient', entityLabel:'PAC-007', createdAt:'2026-05-21T16:30:00Z', ipAddress:'192.168.1.10' },
  { id:'10', userEmail:'nutricionista@clinic.com', action:'CREATE_BIOAVAILABILITY_ANALYSIS', entityType:'bioavailability_analysis', entityLabel:'PAC-002 — Biodisponibilidade', createdAt:'2026-05-21T14:00:00Z', ipAddress:'192.168.1.10' },
  { id:'11', userEmail:'cref@clinic.com', action:'CREATE_ASSESSMENT', entityType:'physical_assessment', entityLabel:'PAC-005 — Avaliação Física', createdAt:'2026-05-21T11:00:00Z', ipAddress:'192.168.1.22' },
  { id:'12', userEmail:'admin@clinic.com', action:'ADJUST_TOKENS', entityType:'workspace', entityLabel:'Workspace Filial', createdAt:'2026-05-20T17:00:00Z', ipAddress:'192.168.0.1' },
];

const ACTION_CONFIG: Record<string, { label: string; icon: React.ComponentType<{ className?: string }>; color: string }> = {
  VIEW_PATIENT:                  { label: 'Visualizou paciente',         icon: Eye,         color: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300' },
  CREATE_PATIENT:                { label: 'Cadastrou paciente',          icon: Plus,        color: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300' },
  UPDATE_PATIENT:                { label: 'Atualizou paciente',          icon: Edit,        color: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300' },
  DELETE_PATIENT:                { label: 'Arquivou paciente',           icon: Trash2,      color: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300' },
  CREATE_ASSESSMENT:             { label: 'Criou avaliação',             icon: Plus,        color: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300' },
  VIEW_ASSESSMENT:               { label: 'Visualizou avaliação',        icon: Eye,         color: 'bg-gray-100 text-gray-700' },
  CREATE_INTERACTION_ANALYSIS:   { label: 'Análise de interações',       icon: AlertTriangle, color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300' },
  CREATE_BIOAVAILABILITY_ANALYSIS:{ label: 'Análise biodisponibilidade', icon: FileText,    color: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300' },
  CREATE_LAB_EXAM:               { label: 'Registrou exame',             icon: Plus,        color: 'bg-green-100 text-green-800' },
  CREATE_REPORT:                 { label: 'Gerou relatório',             icon: FileText,    color: 'bg-blue-100 text-blue-800' },
  EXPORT_PDF:                    { label: 'Exportou PDF',                icon: FileText,    color: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-300' },
  VIEW_ADMIN:                    { label: 'Acessou admin',               icon: Shield,      color: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300' },
  ADJUST_TOKENS:                 { label: 'Ajustou tokens',              icon: AlertTriangle, color: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-300' },
};

const PAGE_SIZE = 10;

function formatDate(iso: string) {
  return new Date(iso).toLocaleString('pt-BR', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' });
}

export default function AuditLogPage() {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [actionFilter, setActionFilter] = useState('all');

  const filtered = MOCK_LOGS.filter((log) => {
    const matchSearch = !search || log.userEmail.includes(search) || (log.entityLabel ?? '').toLowerCase().includes(search.toLowerCase());
    const matchAction = actionFilter === 'all' || log.action === actionFilter;
    return matchSearch && matchAction;
  });

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const actionTypes = Array.from(new Set(MOCK_LOGS.map((l) => l.action)));

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
          {[
            { label: 'Total de eventos', value: MOCK_LOGS.length, color: 'text-gray-800' },
            { label: 'Hoje', value: MOCK_LOGS.filter(l => l.createdAt.startsWith('2026-05-23')).length, color: 'text-blue-700' },
            { label: 'Ações clínicas', value: MOCK_LOGS.filter(l => l.entityType === 'patient' || l.entityType.includes('assessment')).length, color: 'text-green-700' },
            { label: 'Ações admin', value: MOCK_LOGS.filter(l => ['VIEW_ADMIN','ADJUST_TOKENS'].includes(l.action)).length, color: 'text-orange-700' },
          ].map((s) => (
            <div key={s.label} className="bg-white dark:bg-gray-900 rounded-xl border dark:border-gray-800 px-4 py-3">
              <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
              <p className="text-xs text-gray-500 mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              placeholder="Buscar por usuário ou entidade..." className="pl-9" />
          </div>
          <select
            value={actionFilter}
            onChange={(e) => { setActionFilter(e.target.value); setPage(1); }}
            className="h-10 rounded-md border px-3 text-sm dark:bg-gray-800 dark:border-gray-700 min-w-[200px]"
          >
            <option value="all">Todas as ações</option>
            {actionTypes.map((a) => (
              <option key={a} value={a}>{ACTION_CONFIG[a]?.label ?? a}</option>
            ))}
          </select>
        </div>

        {/* Table */}
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50">
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Data/Hora</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Usuário</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Ação</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Entidade</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide hidden lg:table-cell">IP</th>
                  </tr>
                </thead>
                <tbody className="divide-y dark:divide-gray-800">
                  {paginated.map((log) => {
                    const cfg = ACTION_CONFIG[log.action];
                    const Icon = cfg?.icon ?? Shield;
                    return (
                      <tr key={log.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/40 transition-colors">
                        <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">{formatDate(log.createdAt)}</td>
                        <td className="px-4 py-3">
                          <span className="text-xs font-medium text-gray-800 dark:text-gray-200">{log.userEmail}</span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center gap-1.5 text-xs px-2 py-1 rounded-full font-medium ${cfg?.color ?? 'bg-gray-100 text-gray-700'}`}>
                            <Icon className="h-3 w-3" />
                            {cfg?.label ?? log.action}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div>
                            <span className="text-xs text-gray-600 dark:text-gray-300">{log.entityLabel ?? '—'}</span>
                            <span className="text-[10px] text-gray-400 ml-2">{log.entityType}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-400 font-mono hidden lg:table-cell">{log.ipAddress ?? '—'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t dark:border-gray-800">
                <span className="text-xs text-gray-500">
                  {filtered.length} registros · página {page} de {totalPages}
                </span>
                <div className="flex items-center gap-1">
                  <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}
                    className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-40">
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  {Array.from({ length: totalPages }, (_, i) => i + 1)
                    .filter((p) => Math.abs(p - page) <= 2)
                    .map((p) => (
                      <button key={p} onClick={() => setPage(p)}
                        className={`w-8 h-8 rounded text-xs font-medium ${p === page ? 'bg-blue-600 text-white' : 'hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-400'}`}>
                        {p}
                      </button>
                    ))}
                  <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                    className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-40">
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <p className="text-xs text-gray-400 text-center border-t dark:border-gray-800 pt-4 leading-relaxed">
          Todos os acessos e ações são registrados conforme LGPD (Lei 13.709/2018) e Resolução CFN 599/2018.
          Logs são imutáveis e retidos por 5 anos.
        </p>
      </div>
    </div>
  );
}
