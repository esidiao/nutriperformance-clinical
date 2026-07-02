'use client';

import { useState, useCallback } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api-client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PageHeader } from '@/components/PageHeader';
import { EmptyState } from '@/components/EmptyState';
import {
  Plus, Search, ChevronRight, ChevronLeft, Calendar, Loader2, AlertCircle, RefreshCw,
} from 'lucide-react';
import { useDebounce } from '@/hooks/useDebounce';

interface ApiPatient {
  id: string;
  internalCode?: string | null;
  name?: string;
  age?: number;
  gender?: 'male' | 'female' | 'other' | 'not_informed';
  isActive?: boolean;
  createdAt?: string;
}

interface PaginatedPatients {
  items: ApiPatient[];
  total: number;
  page: number;
  pages: number;
  limit: number;
}

const AVATAR_COLORS = ['bg-blue-500', 'bg-emerald-500', 'bg-violet-500', 'bg-orange-500', 'bg-pink-500', 'bg-teal-500'];
const GENDER_LABEL: Record<string, string> = { male: 'Masculino', female: 'Feminino', other: 'Outro', not_informed: '—' };
const PAGE_SIZE = 20;

function fmtDate(iso?: string) {
  if (!iso) return '—';
  const d = new Date(iso);
  return isNaN(d.getTime()) ? '—' : d.toLocaleDateString('pt-BR');
}

type FilterType = 'all' | 'active' | 'inactive';

export default function PatientsPage() {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<FilterType>('all');
  const [page, setPage] = useState(1);

  const debouncedSearch = useDebounce(search, 350);

  const queryParams = {
    page,
    limit: PAGE_SIZE,
    code: debouncedSearch || undefined,
    active: filter === 'active' ? true : filter === 'inactive' ? false : undefined,
  };

  const { data, isLoading, isError, error, refetch, isFetching } = useQuery<PaginatedPatients>({
    queryKey: ['patients', queryParams],
    queryFn: () => api.patients.list(queryParams),
    placeholderData: (prev) => prev,
  });

  const patients = data?.items ?? [];
  const total = data?.total ?? 0;
  const pages = data?.pages ?? 1;

  const handleFilterChange = useCallback((f: FilterType) => {
    setFilter(f);
    setPage(1);
  }, []);

  const handleSearchChange = useCallback((v: string) => {
    setSearch(v);
    setPage(1);
  }, []);

  const tabs: { key: FilterType; label: string }[] = [
    { key: 'all', label: 'Todos' },
    { key: 'active', label: 'Ativos' },
    { key: 'inactive', label: 'Inativos' },
  ];

  return (
    <div className="flex flex-col min-h-full">
      <PageHeader
        title="Pacientes"
        description={
          isLoading
            ? 'Carregando...'
            : `${total} paciente(s) no seu workspace`
        }
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
              onChange={(e) => handleSearchChange(e.target.value)}
              placeholder="Buscar por código interno..."
              className="pl-9"
            />
          </div>
          <div className="flex gap-1.5 flex-wrap">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => handleFilterChange(tab.key)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${
                  filter === tab.key
                    ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                    : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
                }`}
              >
                {tab.label}
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
          <div className="rounded-xl border border-red-200 bg-red-50 p-5 text-center">
            <AlertCircle className="h-6 w-6 text-red-500 mx-auto mb-2" />
            <p className="text-sm font-medium text-red-800">Não foi possível carregar os pacientes</p>
            <p className="text-xs text-red-600 mt-1">{(error as Error)?.message ?? 'Erro de conexão com a API.'}</p>
            <Button variant="outline" size="sm" className="mt-3" onClick={() => refetch()}>
              <RefreshCw className="h-3.5 w-3.5 mr-1.5" /> Tentar novamente
            </Button>
          </div>
        )}

        {/* Patient list */}
        {!isLoading && !isError && (
          <>
            <div className={`space-y-2 transition-opacity ${isFetching ? 'opacity-60' : 'opacity-100'}`}>
              {patients.map((patient, i) => {
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
                              <span className="font-semibold text-gray-900 text-sm truncate">
                                {patient.name || patient.internalCode}
                              </span>
                              {patient.internalCode && patient.name && (
                                <span className="text-[10px] text-gray-400">{patient.internalCode}</span>
                              )}
                              <span className={`text-[10px] px-2 py-0.5 rounded-full ${active ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-gray-50 text-gray-500 border border-gray-200'}`}>
                                {active ? 'Ativo' : 'Inativo'}
                              </span>
                            </div>
                            <div className="flex items-center gap-4 mt-1.5 flex-wrap text-xs text-gray-500">
                              <span>
                                {patient.age != null ? `${patient.age} anos` : 'Idade —'} · {GENDER_LABEL[patient.gender ?? 'not_informed']}
                              </span>
                              <span className="flex items-center gap-1">
                                <Calendar className="h-3 w-3 text-gray-400" /> Cadastro: {fmtDate(patient.createdAt)}
                              </span>
                            </div>
                          </div>
                          <ChevronRight className="h-4 w-4 text-gray-300 group-hover:text-blue-500 transition-colors flex-shrink-0" />
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                );
              })}

              {patients.length === 0 && (
                search ? (
                  <EmptyState
                    icon="🔍"
                    title="Nenhum paciente encontrado"
                    description="Tente buscar por outro código interno."
                    actionLabel="Limpar busca"
                    onAction={() => handleSearchChange('')}
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

            {/* Pagination */}
            {pages > 1 && (
              <div className="flex items-center justify-between pt-4 border-t">
                <p className="text-xs text-gray-500">
                  Página {page} de {pages} · {total} paciente(s)
                  {isFetching && ' · Atualizando…'}
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1 || isFetching}
                    className="flex items-center gap-1"
                  >
                    <ChevronLeft className="h-3.5 w-3.5" /> Anterior
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((p) => Math.min(pages, p + 1))}
                    disabled={page >= pages || isFetching}
                    className="flex items-center gap-1"
                  >
                    Próxima <ChevronRight className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            )}
          </>
        )}

        <p className="text-[10px] text-gray-400 text-center border-t pt-4 leading-relaxed">
          Apenas pacientes do seu workspace são exibidos. Todos os acessos são registrados conforme LGPD (Lei 13.709/2018).
        </p>
      </div>
    </div>
  );
}
