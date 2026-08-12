'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api-client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { PageHeader } from '@/components/PageHeader';
import { AuthGuard } from '@/components/AuthGuard';
import { toast } from 'sonner';
import { Database, Loader2, FileStack, ShieldCheck } from 'lucide-react';
import { useDebounce } from '@/hooks/useDebounce';

const CONF_OPTS = ['alta', 'media', 'baixa', 'pendente'];
const CONF_BADGE: Record<string, string> = {
  alta: 'bg-green-100 text-green-700', media: 'bg-yellow-100 text-yellow-800',
  baixa: 'bg-orange-100 text-orange-700', pendente: 'bg-gray-100 text-gray-600',
};
const fmt = (iso?: string | null) => (iso ? new Date(iso).toLocaleString('pt-BR') : '—');

function Overview() {
  const { data, isLoading } = useQuery({ queryKey: ['curation-overview'], queryFn: () => api.curation.overview() });
  if (isLoading) return <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-blue-600" /></div>;
  if (!data) return null;
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Database className="h-4 w-4 text-blue-600" /> Alimentos</CardTitle></CardHeader>
        <CardContent className="text-sm space-y-2">
          <div className="flex flex-wrap gap-1.5">
            {data.foods.byConfiabilidade.map((c) => (
              <span key={c.confiabilidade} className={`text-xs px-2 py-0.5 rounded-full ${CONF_BADGE[c.confiabilidade] ?? 'bg-gray-100'}`}>{c.confiabilidade}: {c.n}</span>
            ))}
          </div>
          <p className="text-xs text-gray-500">Por fonte: {data.foods.bySource.map((s) => `${s.fonte.toUpperCase()} (${s.n})`).join(' · ')}</p>
          <p className="text-xs text-gray-500">Produtos cacheados: {data.products.total}</p>
          <p className="text-xs text-gray-500">Chunks no RAG: {data.rag.byFonte.map((r) => `${r.fonte} (${r.n})`).join(' · ') || '—'}</p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><FileStack className="h-4 w-4 text-blue-600" /> Fontes & Importações</CardTitle></CardHeader>
        <CardContent className="text-sm space-y-2">
          {data.dataSources.map((s) => (
            <div key={s.nome} className="text-xs border-b last:border-0 pb-1.5">
              <strong>{s.nome.toUpperCase()}</strong> {s.versao ? `· ${s.versao}` : ''}<br />
              <span className="text-gray-400">{s.licenca} · último import: {fmt(s.ultimo_import)}</span>
            </div>
          ))}
          {data.recentImports.length > 0 && (
            <p className="text-[11px] text-gray-400 pt-1">Última importação: +{data.recentImports[0].linhas_inseridas} / ~{data.recentImports[0].linhas_atualizadas} / ✗{data.recentImports[0].linhas_rejeitadas}</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function FoodsReview() {
  const qc = useQueryClient();
  const [status, setStatus] = useState('');
  const [q, setQ] = useState('');
  const dq = useDebounce(q, 350);
  const [page, setPage] = useState(1);

  const params = { status: status || undefined, q: dq || undefined, page };
  const { data, isFetching } = useQuery({ queryKey: ['curation-foods', params], queryFn: () => api.curation.listFoods(params), placeholderData: (p) => p });

  const mut = useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: { confiabilidade?: string; ativo?: boolean } }) => api.curation.updateFood(id, dto),
    onSuccess: () => { toast.success('Curadoria salva.'); qc.invalidateQueries({ queryKey: ['curation-foods'] }); qc.invalidateQueries({ queryKey: ['curation-overview'] }); },
    onError: (e: any) => toast.error(e?.message ?? 'Erro ao salvar.'),
  });

  const items = data?.items ?? [];
  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-sm">Revisão de Alimentos</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-col sm:flex-row gap-2">
          <Input value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} placeholder="Buscar por nome…" className="flex-1" aria-label="Buscar alimento" />
          <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} aria-label="Filtrar por confiabilidade"
            className="h-10 rounded-md border px-3 text-sm dark:bg-gray-800">
            <option value="">Toda confiabilidade</option>
            {CONF_OPTS.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        {isFetching && <div className="flex justify-center py-2"><Loader2 className="h-4 w-4 animate-spin text-gray-400" /></div>}
        <div className="divide-y divide-gray-100 dark:divide-gray-800">
          {items.map((f: any) => (
            <div key={f.id} className="py-2 flex items-center gap-2 flex-wrap">
              <span className="text-sm flex-1 min-w-[180px]">{f.nome} <span className="text-[10px] text-gray-400">{f.fonte?.toUpperCase()}</span></span>
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${CONF_BADGE[f.confiabilidade] ?? 'bg-gray-100'}`}>{f.confiabilidade}</span>
              <select defaultValue={f.confiabilidade} onChange={(e) => mut.mutate({ id: f.id, dto: { confiabilidade: e.target.value } })}
                aria-label={`Confiabilidade de ${f.nome}`} className="h-7 text-xs rounded border px-1.5 dark:bg-gray-800">
                {CONF_OPTS.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
              <Button size="sm" variant="outline" className="h-7 text-xs"
                onClick={() => mut.mutate({ id: f.id, dto: { ativo: !f.ativo } })}>
                {f.ativo ? 'Desativar' : 'Ativar'}
              </Button>
            </div>
          ))}
          {items.length === 0 && !isFetching && <p className="text-xs text-gray-400 text-center py-4">Nenhum alimento para os filtros.</p>}
        </div>
        {(data?.pages ?? 1) > 1 && (
          <div className="flex items-center justify-between pt-2 border-t text-xs text-gray-500">
            <span>Página {data?.page} de {data?.pages}</span>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Anterior</Button>
              <Button size="sm" variant="outline" disabled={page >= (data?.pages ?? 1)} onClick={() => setPage((p) => p + 1)}>Próxima</Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function CuradoriaPage() {
  return (
    <AuthGuard requiredRole="admin">
      <div className="flex flex-col min-h-full">
        <PageHeader
          title="Curadoria das Bases"
          description="Governança e revisão profissional dos dados nutricionais"
          breadcrumbs={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Admin', href: '/admin' }, { label: 'Curadoria' }]}
        />
        <div className="px-4 py-5 sm:p-6 max-w-4xl mx-auto w-full space-y-5 flex-1">
          <p className="text-xs text-gray-500 flex items-center gap-1.5">
            <ShieldCheck className="h-3.5 w-3.5 text-green-600" /> Dados marcados como <strong>pendente</strong> são bloqueados do uso clínico (busca/autopreenchimento) até revisão.
          </p>
          <Overview />
          <FoodsReview />
        </div>
      </div>
    </AuthGuard>
  );
}
