'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Loader2, Plus, Trash2, UtensilsCrossed, CalendarDays } from 'lucide-react';
import { api } from '@/lib/api-client';
import { PageHeader } from '@/components/PageHeader';
import { FoodAutocomplete, type FoodResult } from '@/components/FoodAutocomplete';
import { RelatorioAdequacao } from '@/components/RelatorioAdequacao';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const REFEICOES = [
  { id: 'cafe_manha', label: 'Café da manhã' },
  { id: 'lanche_manha', label: 'Lanche da manhã' },
  { id: 'almoco', label: 'Almoço' },
  { id: 'lanche_tarde', label: 'Lanche da tarde' },
  { id: 'jantar', label: 'Jantar' },
  { id: 'ceia', label: 'Ceia' },
  { id: 'pre_treino', label: 'Pré-treino' },
  { id: 'pos_treino', label: 'Pós-treino' },
] as const;

const ROTULO_DIA: Record<string, string> = {
  dia_util: 'Dia útil',
  fim_de_semana: 'Fim de semana',
};

const n = (v: unknown) => {
  const x = Number(v);
  return Number.isFinite(x) ? x : 0;
};
const dataBR = (iso?: string | null) =>
  iso ? new Date(`${String(iso).slice(0, 10)}T12:00:00`).toLocaleDateString('pt-BR') : '—';

export default function RecordatorioDetalhePage() {
  const params = useParams();
  const search = useSearchParams();
  const recallId = String(params?.id ?? '');
  const patientId = search.get('patient') ?? '';
  const qc = useQueryClient();

  const [refeicao, setRefeicao] = useState<string>('cafe_manha');
  const [alimento, setAlimento] = useState<FoodResult | null>(null);
  const [nome, setNome] = useState('');
  const [quantidade, setQuantidade] = useState('');
  const [medidaCaseira, setMedidaCaseira] = useState('');
  const [erro, setErro] = useState<string | null>(null);

  const recallQ = useQuery({
    queryKey: ['recordatorio', recallId],
    queryFn: () => api.recordatorios.get(recallId),
    enabled: !!recallId,
  });

  const recarregar = () => qc.invalidateQueries({ queryKey: ['recordatorio', recallId] });

  const adicionar = useMutation({
    mutationFn: () => api.recordatorios.addItem(recallId, {
      refeicao,
      foodId: alimento?.id,
      alimentoNome: alimento ? undefined : nome.trim(),
      quantidadeG: Number(String(quantidade).replace(',', '.')),
      medidaCaseira: medidaCaseira.trim() || undefined,
    }),
    onSuccess: () => {
      setAlimento(null); setNome(''); setQuantidade(''); setMedidaCaseira('');
      setErro(null);
      recarregar();
    },
    onError: (e: any) => setErro(e?.message ?? 'Não foi possível adicionar.'),
  });

  const remover = useMutation({
    mutationFn: (itemId: string) => api.recordatorios.removeItem(recallId, itemId),
    onSuccess: () => { setErro(null); recarregar(); },
    onError: (e: any) => setErro(e?.message ?? 'Não foi possível remover.'),
  });

  if (recallQ.isLoading) {
    return (
      <div className="p-10 flex justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (recallQ.isError || !recallQ.data) {
    return <p className="p-6 text-sm text-destructive">Recordatório não encontrado.</p>;
  }

  const recall: any = recallQ.data;
  const totais = recall.totais ?? {};
  const grupos: any[] = recall.refeicoes ?? [];
  const totalItens = grupos.reduce((a, g) => a + (g.itens?.length ?? 0), 0);

  const podeAdicionar =
    (alimento !== null || nome.trim() !== '') && n(quantidade) > 0;

  return (
    <>
      <PageHeader
        title={`Recordatório de ${dataBR(recall.dataReferencia)}`}
        description="O que o paciente relatou ter comido"
        breadcrumbs={[
          { label: 'Pacientes', href: '/patients' },
          ...(patientId ? [{ label: 'Paciente', href: `/patients/${patientId}` }] : []),
          { label: 'Recordatórios', href: `/recordatorios?patient=${patientId}` },
          { label: dataBR(recall.dataReferencia) },
        ]}
      />

      <div className="p-4 sm:p-6 space-y-5 max-w-4xl">
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <CalendarDays className="h-3.5 w-3.5" />
          {dataBR(recall.dataReferencia)}
          {recall.tipoDeDia && <span>· {ROTULO_DIA[recall.tipoDeDia] ?? recall.tipoDeDia}</span>}
          <span>· {totalItens} alimento(s)</span>
        </div>

        {/* Totais do dia relatado */}
        <Card>
          <CardContent className="pt-5">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
              {[
                { label: 'Energia', v: Math.round(n(totais.kcal)), u: 'kcal' },
                { label: 'Proteínas', v: Math.round(n(totais.proteinasG)), u: 'g' },
                { label: 'Carboidratos', v: Math.round(n(totais.carboidratosG)), u: 'g' },
                { label: 'Lipídios', v: Math.round(n(totais.lipidiosG)), u: 'g' },
              ].map((x) => (
                <div key={x.label} className="rounded-lg border p-2">
                  <p className="text-lg font-bold">{x.v}<span className="text-[11px] font-normal text-gray-500 ml-1">{x.u}</span></p>
                  <p className="text-[11px] text-gray-500">{x.label}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Adequação: aqui a leitura é "o que a pessoa comeu atingiu",
            não "a prescrição atinge". A conta é a mesma. */}
        {patientId && totalItens > 0 && (
          <RelatorioAdequacao patientId={patientId} totais={totais} />
        )}

        {/* Registrar alimento */}
        <Card>
          <CardContent className="pt-5 space-y-3">
            <p className="text-sm font-semibold">Registrar alimento relatado</p>

            <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
              <div className="sm:col-span-3">
                <Label htmlFor="refeicao">Refeição</Label>
                <select
                  id="refeicao" value={refeicao}
                  onChange={(e) => setRefeicao(e.target.value)}
                  className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                >
                  {REFEICOES.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
                </select>
              </div>

              <div className="sm:col-span-4">
                <Label>Alimento</Label>
                <FoodAutocomplete
                  value={alimento?.nome ?? nome}
                  onChange={(v) => { setNome(v); setAlimento(null); }}
                  onSelect={(f) => { setAlimento(f); setNome(f.nome); }}
                  placeholder="Buscar na base…"
                  className="h-10 text-sm"
                />
                {/* Alimento fora da base entra sem composição, e o relatório
                    de adequação trata como cobertura incompleta. */}
                <p className="text-[11px] text-muted-foreground mt-1">
                  {alimento
                    ? 'Da base — nutrientes calculados.'
                    : 'Fora da base: entra sem composição e não conta na adequação.'}
                </p>
              </div>

              <div className="sm:col-span-2">
                <Label htmlFor="qtd">Quantidade (g)</Label>
                <Input
                  id="qtd" type="number" min={0} step="1" inputMode="decimal"
                  value={quantidade}
                  onChange={(e) => setQuantidade(e.target.value)}
                  placeholder="60"
                />
              </div>

              <div className="sm:col-span-3">
                <Label htmlFor="medida">Medida caseira</Label>
                <Input
                  id="medida" value={medidaCaseira}
                  onChange={(e) => setMedidaCaseira(e.target.value)}
                  placeholder="3 colheres de sopa"
                  maxLength={60}
                />
              </div>
            </div>

            {erro && <p className="text-xs text-destructive">{erro}</p>}

            <Button
              size="sm"
              onClick={() => adicionar.mutate()}
              disabled={!podeAdicionar || adicionar.isPending}
            >
              {adicionar.isPending
                ? <><Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> Adicionando…</>
                : <><Plus className="h-3.5 w-3.5 mr-1" /> Adicionar</>}
            </Button>
          </CardContent>
        </Card>

        {/* Itens por refeição */}
        {grupos.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Nenhum alimento registrado ainda.
          </p>
        ) : (
          <div className="space-y-3">
            {grupos.map((g) => (
              <Card key={g.refeicao}>
                <CardContent className="pt-4 pb-3">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm font-semibold flex items-center gap-1.5">
                      <UtensilsCrossed className="h-3.5 w-3.5 text-green-600" />
                      {REFEICOES.find((r) => r.id === g.refeicao)?.label ?? g.refeicao}
                    </p>
                    <p className="text-[11px] text-gray-500">
                      {Math.round(n(g.totais?.kcal))} kcal
                    </p>
                  </div>

                  <ul className="space-y-1">
                    {(g.itens ?? []).map((i: any) => (
                      <li key={i.id} className="flex items-center gap-2 text-xs py-1 border-b last:border-0">
                        <span className="flex-1">
                          {i.alimentoNome}
                          <span className="text-gray-400 ml-1">
                            {Math.round(n(i.quantidadeG))} g
                            {i.medidaCaseira ? ` (${i.medidaCaseira})` : ''}
                          </span>
                        </span>
                        <span className="font-mono text-gray-600">
                          {Math.round(n(i.kcal))} kcal
                        </span>
                        <button
                          onClick={() => {
                            if (window.confirm(`Remover ${i.alimentoNome}?`)) remover.mutate(i.id);
                          }}
                          aria-label={`Remover ${i.alimentoNome}`}
                          className="text-gray-300 hover:text-destructive p-0.5"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        <p className="text-[11px] text-muted-foreground border-t pt-3">
          Este registro descreve o consumo relatado. Para prescrever, use{' '}
          <Link href={`/meal-plans?patient=${patientId}`} className="underline">
            Planos Alimentares
          </Link>.
        </p>
      </div>
    </>
  );
}
