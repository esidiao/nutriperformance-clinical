'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api-client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PageHeader } from '@/components/PageHeader';
import { EmptyState } from '@/components/EmptyState';
import {
  Plus, Search, ChevronRight, Calendar, Users, Loader2, AlertCircle, RefreshCw,
} from 'lucide-react';

// Shape retornado por GET /patients (toPublicDto da API)
interface ApiPatient {
  id: string;
  internalCode?: string | null;
  name?: string;
  age?: number;
  gender?: 'male' | 'female' | 'other' | 'not_informed';
  isActive?: boolean;
  createdAt?: string;
}

const AVATAR_COLORS = ['bg-blue-500', 'bg-emerald-500', 'bg-violet-500', 'bg-orange-500', 'bg-pink-500', 'bg-teal-500'];

const GENDER_LABEL: Record<string, string> = { male: 'Masculino', female: 'Feminino', other: 'Outro', not_informed: '—' };

function fmtDate(iso?: string) {
  if (!iso) return '—';
  const d = new Date(iso);
  return isNaN(d.getTime()) ? '—' : d.toLocaleDateString('pt-BR');
}

type FilterType = 'all' | 'active' | 'inactive';

export default function PatientsPage() {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<FilterType>('all');

  const { data, isLoading, isError, error, refetch, isFetching } = useQuery<ApiPatient[]>({
    queryKey: ['patients'],
    queryFn: () => api.patients.list(),
  });

  const patients = data ?? [];

  const filtered = patients.filter((p) => {
    const term = search.toLowerCase();
    const matchSearch =
      (p.internalCode?.toLowerCase().includes(term) ?? false) ||
      (p.name?.toLowerCase().includes(term) ?? false);
    const active = p.isActive !== false;
    const matchFilter =
      filter === 'all' || (filter === 'active' && active) || (filter === 'inactive' && !active);
    return (term === '' || matchSearch) && matchFilter;
  });

  const tabs: { key: FilterType; label: string; count: number }[] = [
    { key: 'all', label: 'Todos', count: patients.length },
    { key: 'active', label: 'Ativos', count: patients.filter((p) => p.isActive !== false).length },
    { key: 'inactive', label: 'Inativos', count: patients.filter((p) => p.isActive === false).length },
  ];

  return (
    <div className="flex flex-col min-h-full">
      <PageHeader
        title="Pacientes"
        description={isLoading ? 'Carregando...' : `${patients.length} paciente(s) no seu workspace`}
        breadcrumbs={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Pacientes' }]}
        action={
          <Link href="/patients/new">
            <Button size="sm" className="flex items-center gap-2">
              <Plus className="h-4 w-4" /> Novo Paciente
            </Button>
          </Link>
        }
      />

      <div className="px-4 py-5 sm:p-6 max-w-5xl mx-auto w-full space-y-5 flex-1">

        {/* Search + filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por código ou nome..."
              className="pl-9"
            />
          </div>
          <div className="flex gap-1.5 flex-wrap">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setFilter(tab.key)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${
                  filter === tab.key ? 'bg-blue-600 text-white border-blue-600 shadow-sm' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
                }`}
              >
                {tab.label}
                <span className={`text-[10px] px-1 py-0.5 rounded-full ${filter === tab.key ? 'bg-white/20' : 'bg-gray-100 text-gray-500'}`}>{tab.count}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Loading */}
        {isLoading && (
          <div className="flex flex-col items-center justify-center py-16 text-gray-400">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600 mb-3" />
            <p className="text-sm">Carregando pacientes...</p>
          </div>
        )}

        {/* Error */}
        {isError && !isLoading && (
          <div className="rounded-xl border border-red-200 bg-red-50 dark:bg-red-950 dark:border-red-900 p-5 text-center">
            <AlertCircle className="h-6 w-6 text-red-500 mx-auto mb-2" />
            <p className="text-sm font-medium text-red-800 dark:text-red-300">Não foi possível carregar os pacientes</p>
            <p className="text-xs text-red-600 dark:text-red-400 mt-1">{(error as Error)?.message ?? 'Erro de conexão com a API.'}</p>
            <Button variant="outline" size="sm" className="mt-3" onClick={() => refetch()}>
              <RefreshCw className="h-3.5 w-3.5 mr-1.5" /> Tentar novamente
            </Button>
          </div>
        )}

        {/* Patient list */}
        {!isLoading && !isError && (
          <div className="space-y-2">
            {filtered.map((patient, i) => {
              const avatarColor = AVATAR_COLORS[i % AVATAR_COLORS.length];
              const label = patient.name || patient.internalCode || 'Paciente';
              const initials = label.split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase();
              const active = patient.isActive !== false;
              return (
                <Link key={patient.id} href={`/patients/${patient.id}`}>
                  <Card className="hover:shadow-md transition-all cursor-pointer group hover:-translate-y-0.5">
                    <CardContent className="py-3.5 px-5">
                      <div className="flex items-center gap-4">
                        <div className={`w-10 h-10 rounded-full ${avatarColor} flex items-center justify-center flex-shrink-0`}>
                          <span className="text-white text-sm font-bold">{initials}</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold text-gray-900 dark:text-white text-sm truncate">{patient.name || patient.internalCode}</span>
                            {patient.internalCode && patient.name && (
                              <span className="text-[10px] text-gray-400">{patient.internalCode}</span>
                            )}
                            <span className={`text-[10px] px-2 py-0.5 rounded-full ${active ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-gray-50 text-gray-500 border border-gray-200'}`}>
                              {active ? 'Ativo' : 'Inativo'}
                            </span>
                          </div>
                          <div className="flex items-center gap-4 mt-1.5 flex-wrap text-xs text-gray-500">
                            <span>{patient.age != null ? `${patient.age} anos` : 'Idade —'} · {GENDER_LABEL[patient.gender ?? 'not_informed']}</span>
                            <span className="flex items-center gap-1"><Calendar className="h-3 w-3 text-gray-400" /> Cadastro: {fmtDate(patient.createdAt)}</span>
                          </div>
                        </div>
                        <ChevronRight className="h-4 w-4 text-gray-300 group-hover:text-blue-500 transition-colors flex-shrink-0" />
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              );
            })}

            {filtered.length === 0 && (
              search || filter !== 'all' ? (
                <EmptyState
                  icon="🔍"
                  title="Nenhum paciente encontrado"
                  description="Ajuste os filtros ou a busca."
                  actionLabel="Limpar filtros"
                  onAction={() => { setSearch(''); setFilter('all'); }}
                />
              ) : (
                <EmptyState
                  icon="👥"
                  title="Nenhum paciente cadastrado"
                  description="Cadastre o primeiro paciente do seu workspace para começar."
                  actionLabel="Cadastrar Paciente"
                  actionHref="/patients/new"
                />
              )
            )}
          </div>
        )}

        <p className="text-[10px] text-gray-400 text-center border-t pt-4 leading-relaxed">
          Apenas pacientes do seu workspace são exibidos. Todos os acessos são registrados conforme LGPD (Lei 13.709/2018).
          {isFetching && !isLoading && ' · Atualizando…'}
        </p>
      </div>
    </div>
  );
}
