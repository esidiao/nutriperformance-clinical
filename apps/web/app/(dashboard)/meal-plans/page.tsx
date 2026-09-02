'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Loader2, UtensilsCrossed, ChevronRight, Users } from 'lucide-react';
import { api } from '@/lib/api-client';
import { PageHeader } from '@/components/PageHeader';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ModelosDePlano } from '@/components/ModelosDePlano';

const dataBR = (v?: string | null) =>
  v ? new Date(v).toLocaleDateString('pt-BR') : '—';

export default function MealPlansPage() {
  const search = useSearchParams();
  const patientId = search.get('patient') ?? '';
  const qc = useQueryClient();
  const [nome, setNome] = useState('');
  const [criando, setCriando] = useState(false);

  const listQ = useQuery({
    queryKey: ['meal-plans', patientId],
    queryFn: () => api.mealPlans.list(patientId),
    enabled: !!patientId,
  });

  const criar = useMutation({
    mutationFn: () => api.mealPlans.create({ patientId, nome: nome.trim() }),
    onSuccess: (novo: any) => {
      qc.invalidateQueries({ queryKey: ['meal-plans', patientId] });
      setNome(''); setCriando(false);
      if (novo?.id) window.location.href = `/meal-plans/${novo.id}?patient=${patientId}`;
    },
  });

  // Sem paciente na URL não há plano a listar — planos existem sempre vinculados
  // a alguém, então a tela orienta em vez de mostrar lista vazia.
  if (!patientId) {
    return (
      <>
        <PageHeader
          title="Planos Alimentares"
          description="Prescrição de plano alimentar por paciente"
        />
        <div className="p-4 sm:p-6">
          <Card>
            <CardContent className="py-10 text-center space-y-3">
              <Users className="h-8 w-8 text-gray-300 mx-auto" />
              <p className="text-sm text-muted-foreground">
                Escolha um paciente para ver ou criar planos alimentares.
              </p>
              <Link href="/patients">
                <Button size="sm" variant="outline">Ir para pacientes</Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </>
    );
  }

  const planos = listQ.data ?? [];

  return (
    <>
      <PageHeader
        title="Planos Alimentares"
        description="Prescrição de plano alimentar"
        breadcrumbs={[
          { label: 'Pacientes', href: '/patients' },
          { label: 'Paciente', href: `/patients/${patientId}` },
          { label: 'Planos alimentares' },
        ]}
        action={
          !criando && (
            <Button size="sm" onClick={() => setCriando(true)}>
              <Plus className="h-3.5 w-3.5 mr-1.5" /> Novo plano
            </Button>
          )
        }
      />

      <div className="p-4 sm:p-6 space-y-4">
        {criando && (
          <Card>
            <CardContent className="pt-5 space-y-3">
              <Input
                autoFocus value={nome} onChange={(e) => setNome(e.target.value)}
                placeholder="Nome do plano — ex: Plano de emagrecimento, fase 1"
                aria-label="Nome do plano"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && nome.trim()) criar.mutate();
                  if (e.key === 'Escape') { setCriando(false); setNome(''); }
                }}
              />
              <div className="flex gap-2">
                <Button size="sm" disabled={!nome.trim() || criar.isPending}
                        onClick={() => criar.mutate()}>
                  {criar.isPending
                    ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    : 'Criar e montar'}
                </Button>
                <Button size="sm" variant="outline"
                        onClick={() => { setCriando(false); setNome(''); }}>
                  Cancelar
                </Button>
              </div>
              {criar.isError && (
                <p className="text-xs text-red-600">Não foi possível criar o plano.</p>
              )}
            </CardContent>
          </Card>
        )}

        {listQ.isLoading && (
          <div className="flex justify-center py-12">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
          </div>
        )}

        {listQ.isError && (
          <p className="text-sm text-red-600">Não foi possível carregar os planos.</p>
        )}

        {!listQ.isLoading && !listQ.isError && planos.length === 0 && !criando && (
          <Card>
            <CardContent className="py-10 text-center space-y-3">
              <UtensilsCrossed className="h-8 w-8 text-gray-300 mx-auto" />
              <p className="text-sm text-muted-foreground">
                Nenhum plano alimentar para este paciente.
              </p>
              <Button size="sm" onClick={() => setCriando(true)}>
                <Plus className="h-3.5 w-3.5 mr-1.5" /> Criar o primeiro
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Os modelos aparecem quando ainda não há plano — que é exatamente
            quando remontar do zero seria o caminho mais caro. */}
        {!listQ.isLoading && !listQ.isError && planos.length === 0 && !criando && (
          <ModelosDePlano patientId={patientId} />
        )}

        <div className="space-y-2">
          {planos.map((p: any) => (
            <Link key={p.id} href={`/meal-plans/${p.id}?patient=${patientId}`}>
              <Card className="hover:border-primary/40 transition-colors cursor-pointer">
                <CardContent className="py-3 flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-accent flex items-center justify-center flex-shrink-0">
                    <UtensilsCrossed className="h-4 w-4 text-primary" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold truncate">{p.nome}</p>
                    <p className="text-[11px] text-muted-foreground">
                      Criado em {dataBR(p.createdAt)}
                      {p.metaKcal ? ` · meta ${Math.round(Number(p.metaKcal))} kcal` : ''}
                    </p>
                  </div>
                  {p.isDraft && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-800
                                     font-medium flex-shrink-0">
                      Rascunho
                    </span>
                  )}
                  <ChevronRight className="h-4 w-4 text-gray-300 flex-shrink-0" />
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </>
  );
}
