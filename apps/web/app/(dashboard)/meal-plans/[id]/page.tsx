'use client';

import { useState, useMemo } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Plus, Trash2, Loader2, GripVertical, Copy, UtensilsCrossed, AlertTriangle,
} from 'lucide-react';
import { api } from '@/lib/api-client';
import { PageHeader } from '@/components/PageHeader';
import { FoodAutocomplete, type FoodResult } from '@/components/FoodAutocomplete';
import { ListaCompras } from '@/components/ListaCompras';
import { SalvarComoModelo } from '@/components/ModelosDePlano';
import { SupervisaoDoTrabalho } from '@/components/Supervisao';
import { usePapel } from '@/lib/usePapel';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

// A ordem aqui é a ordem do dia — as colunas seguem a rotina da consulta,
// não a ordem alfabética.
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

type RefeicaoId = (typeof REFEICOES)[number]['id'];

interface Item {
  id: string;
  refeicao: string;
  alimentoNome: string;
  quantidadeG: number | string;
  medidaCaseira: string | null;
  kcal: number | string;
  proteinasG: number | string;
  carboidratosG: number | string;
  lipidiosG: number | string;
  fonte: string | null;
}

const n = (v: unknown) => {
  const x = Number(v);
  return Number.isFinite(x) ? x : 0;
};
const fmt = (v: unknown, casas = 0) =>
  n(v).toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas });

// ─── Barra de meta ────────────────────────────────────────────────────────────
function MetaBar({ label, atual, meta, unidade }: {
  label: string; atual: number; meta: number | null; unidade: string;
}) {
  if (!meta) {
    return (
      <div className="flex-1 min-w-[120px]">
        <p className="text-[10px] text-gray-400 uppercase tracking-wide">{label}</p>
        <p className="text-lg font-bold text-gray-900 dark:text-white">
          {fmt(atual)}<span className="text-xs font-normal text-gray-400 ml-0.5">{unidade}</span>
        </p>
        <p className="text-[10px] text-gray-400">sem meta definida</p>
      </div>
    );
  }

  const pct = meta > 0 ? (atual / meta) * 100 : 0;
  // Faixa de tolerância de 10% — abaixo é falta, acima é excesso. Fora dela a
  // cor muda, para a diferença saltar sem precisar comparar números.
  const dentro = pct >= 90 && pct <= 110;
  const cor = dentro ? 'bg-primary' : pct > 110 ? 'bg-red-500' : 'bg-amber-400';

  return (
    <div className="flex-1 min-w-[120px]">
      <p className="text-[10px] text-gray-400 uppercase tracking-wide">{label}</p>
      <p className="text-lg font-bold text-gray-900 dark:text-white leading-tight">
        {fmt(atual)}
        <span className="text-xs font-normal text-gray-400"> / {fmt(meta)} {unidade}</span>
      </p>
      <div className="h-1.5 bg-gray-100 dark:bg-gray-800 rounded-full mt-1 overflow-hidden">
        <div className={`h-full ${cor} transition-all`} style={{ width: `${Math.min(pct, 100)}%` }} />
      </div>
      <p className={`text-[10px] mt-0.5 ${dentro ? 'text-gray-400' : pct > 110 ? 'text-red-600' : 'text-amber-600'}`}>
        {fmt(pct)}% da meta
      </p>
    </div>
  );
}

// ─── Formulário de item ───────────────────────────────────────────────────────
function AddItemForm({ refeicao, planId, onDone }: {
  refeicao: RefeicaoId; planId: string; onDone: () => void;
}) {
  const qc = useQueryClient();
  const [nome, setNome] = useState('');
  const [food, setFood] = useState<FoodResult | null>(null);
  const [qtd, setQtd] = useState('100');
  const [medida, setMedida] = useState('');
  const [erro, setErro] = useState<string | null>(null);

  const add = useMutation({
    mutationFn: () => api.mealPlans.addItem(planId, {
      refeicao,
      foodId: food?.id,
      alimentoNome: nome.trim(),
      quantidadeG: Number(qtd),
      medidaCaseira: medida.trim() || null,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['meal-plan', planId] });
      setNome(''); setFood(null); setQtd('100'); setMedida(''); setErro(null);
      onDone();
    },
    onError: (e: any) => setErro(e?.message ?? 'Não foi possível adicionar o alimento.'),
  });

  const qtdNum = Number(qtd);
  const valido = nome.trim().length > 0 && Number.isFinite(qtdNum) && qtdNum > 0;

  // Prévia do que será somado, antes de confirmar
  const previa = food && qtdNum > 0
    ? Math.round(n(food.energiaKcal) * (qtdNum / 100))
    : null;

  return (
    <div className="space-y-2 p-2.5 bg-accent/40 rounded-lg border border-border">
      <FoodAutocomplete
        value={nome}
        onChange={(v) => {
          setNome(v);
          // O FoodAutocomplete dispara onSelect e, na sequência, onChange com o
          // nome escolhido. Limpar aqui sem comparar apagava o alimento recém
          // selecionado: o item ia para o plano como texto livre, sem valores
          // nutricionais e sem somar aos totais.
          setFood((atual) => (atual && atual.nome === v ? atual : null));
        }}
        onSelect={(f) => {
          setFood(f);
          setNome(f.nome);
          if (f.porcaoPadraoG) setQtd(String(f.porcaoPadraoG));
        }}
        placeholder="Buscar alimento na base…"
      />
      <div className="flex gap-2">
        <div className="w-24">
          <Input
            type="number" min="1" value={qtd}
            onChange={(e) => setQtd(e.target.value)}
            placeholder="g" aria-label="Quantidade em gramas"
          />
        </div>
        <Input
          value={medida} onChange={(e) => setMedida(e.target.value)}
          placeholder="medida caseira (opcional)" aria-label="Medida caseira"
        />
      </div>

      {previa !== null && (
        <p className="text-[11px] text-muted-foreground">
          Adiciona aproximadamente <strong>{fmt(previa)} kcal</strong> ao plano.
        </p>
      )}
      {!food && nome.trim() && (
        <p className="text-[11px] text-amber-600 flex items-start gap-1">
          <AlertTriangle className="h-3 w-3 mt-0.5 flex-shrink-0" />
          Alimento fora da base: entra sem valores nutricionais e não soma aos totais.
        </p>
      )}
      {erro && <p className="text-[11px] text-red-600">{erro}</p>}

      <div className="flex gap-2">
        <Button size="sm" className="flex-1" disabled={!valido || add.isPending}
                onClick={() => add.mutate()}>
          {add.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Adicionar'}
        </Button>
        <Button size="sm" variant="outline" onClick={onDone}>Cancelar</Button>
      </div>
    </div>
  );
}

// ─── Coluna de refeição ───────────────────────────────────────────────────────
function ColunaRefeicao({
  refeicao, label, itens, planId, onDrop, arrastando,
}: {
  refeicao: RefeicaoId; label: string; itens: Item[]; planId: string;
  onDrop: (item: Item, destino: RefeicaoId) => void;
  arrastando: Item | null;
}) {
  const qc = useQueryClient();
  const [abrindo, setAbrindo] = useState(false);
  const [sobre, setSobre] = useState(false);

  const remover = useMutation({
    mutationFn: (itemId: string) => api.mealPlans.removeItem(planId, itemId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['meal-plan', planId] }),
  });

  const kcal = itens.reduce((s, i) => s + n(i.kcal), 0);
  const podeSoltar = arrastando && arrastando.refeicao !== refeicao;

  return (
    <Card
      onDragOver={(e) => { if (podeSoltar) { e.preventDefault(); setSobre(true); } }}
      onDragLeave={() => setSobre(false)}
      onDrop={(e) => {
        e.preventDefault(); setSobre(false);
        if (podeSoltar && arrastando) onDrop(arrastando, refeicao);
      }}
      className={`flex flex-col transition-colors ${
        sobre ? 'ring-2 ring-primary border-primary' : podeSoltar ? 'border-dashed border-primary/40' : ''
      }`}
    >
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-sm">{label}</CardTitle>
          <span className="text-[11px] text-muted-foreground whitespace-nowrap">
            {fmt(kcal)} kcal
          </span>
        </div>
      </CardHeader>

      <CardContent className="flex-1 space-y-1.5">
        {itens.length === 0 && !abrindo && (
          <p className="text-[11px] text-gray-400 py-3 text-center">
            {podeSoltar ? 'Solte aqui' : 'Nenhum alimento'}
          </p>
        )}

        {itens.map((item) => (
          <div
            key={item.id}
            draggable
            onDragStart={(e) => {
              e.dataTransfer.effectAllowed = 'move';
              onDrop(item, refeicao); // registra origem; o destino confirma
            }}
            className="group flex items-start gap-1.5 p-2 rounded-md bg-gray-50 dark:bg-gray-800/60
                       border border-transparent hover:border-border cursor-grab active:cursor-grabbing"
          >
            <GripVertical className="h-3.5 w-3.5 text-gray-300 mt-0.5 flex-shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium leading-tight truncate">{item.alimentoNome}</p>
              <p className="text-[10px] text-muted-foreground">
                {fmt(item.quantidadeG)} g
                {item.medidaCaseira ? ` · ${item.medidaCaseira}` : ''}
                {' · '}{fmt(item.kcal)} kcal
              </p>
            </div>
            <button
              onClick={() => remover.mutate(item.id)}
              disabled={remover.isPending}
              aria-label={`Remover ${item.alimentoNome}`}
              className="opacity-0 group-hover:opacity-100 focus:opacity-100 text-gray-400
                         hover:text-red-600 transition-opacity flex-shrink-0 p-0.5"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}

        {abrindo ? (
          <AddItemForm refeicao={refeicao} planId={planId} onDone={() => setAbrindo(false)} />
        ) : (
          <button
            onClick={() => setAbrindo(true)}
            className="w-full flex items-center justify-center gap-1 py-1.5 text-[11px]
                       text-primary hover:bg-accent rounded-md transition-colors"
          >
            <Plus className="h-3 w-3" /> Adicionar
          </button>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Página ───────────────────────────────────────────────────────────────────
export default function MealPlanPage() {
  const params = useParams();
  const search = useSearchParams();
  const planId = String(params.id);
  const patientId = search.get('patient') ?? '';
  const qc = useQueryClient();
  const { souEstudante } = usePapel();

  const [arrastando, setArrastando] = useState<Item | null>(null);

  const planQ = useQuery({
    queryKey: ['meal-plan', planId],
    queryFn: () => api.mealPlans.get(planId),
  });

  // Mover = recriar no destino e apagar da origem. O item guarda cópia dos
  // valores nutricionais, então recriar não recalcula nada nem consulta a base.
  const mover = useMutation({
    mutationFn: async ({ item, destino }: { item: Item; destino: RefeicaoId }) => {
      await api.mealPlans.addItem(planId, {
        refeicao: destino,
        alimentoNome: item.alimentoNome,
        quantidadeG: n(item.quantidadeG),
        medidaCaseira: item.medidaCaseira,
        kcal: n(item.kcal),
        proteinasG: n(item.proteinasG),
        carboidratosG: n(item.carboidratosG),
        lipidiosG: n(item.lipidiosG),
      });
      await api.mealPlans.removeItem(planId, item.id);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['meal-plan', planId] }),
  });

  const duplicar = useMutation({
    mutationFn: () => api.mealPlans.duplicate(planId),
    onSuccess: (novo: any) => {
      if (novo?.id) window.location.href = `/meal-plans/${novo.id}?patient=${patientId}`;
    },
  });

  const plano: any = planQ.data;

  const porRefeicao = useMemo(() => {
    const mapa: Record<string, Item[]> = {};
    for (const r of REFEICOES) mapa[r.id] = [];
    for (const grupo of plano?.refeicoes ?? []) {
      mapa[grupo.refeicao] = grupo.itens ?? [];
    }
    return mapa;
  }, [plano]);

  const totais = plano?.totais ?? { kcal: 0, proteinasG: 0, carboidratosG: 0, lipidiosG: 0 };

  const aoSoltar = (item: Item, destino: RefeicaoId) => {
    if (!arrastando) { setArrastando(item); return; }   // início do arrasto
    if (arrastando.refeicao !== destino) {
      mover.mutate({ item: arrastando, destino });
    }
    setArrastando(null);
  };

  if (planQ.isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-5 w-5 animate-spin text-primary" />
      </div>
    );
  }

  if (planQ.isError || !plano) {
    return (
      <div className="p-6">
        <p className="text-sm text-red-600">Não foi possível carregar o plano alimentar.</p>
      </div>
    );
  }

  return (
    <div onDragEnd={() => setArrastando(null)}>
      <PageHeader
        title={plano.nome}
        description={plano.objetivo ?? 'Plano alimentar'}
        breadcrumbs={[
          { label: 'Pacientes', href: '/patients' },
          ...(patientId ? [{ label: 'Paciente', href: `/patients/${patientId}` }] : []),
          { label: 'Plano alimentar' },
        ]}
        action={
          <Button size="sm" variant="outline" onClick={() => duplicar.mutate()}
                  disabled={duplicar.isPending}>
            {duplicar.isPending
              ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
              : <><Copy className="h-3.5 w-3.5 mr-1.5" /> Duplicar</>}
          </Button>
        }
      />

      <div className="p-4 sm:p-6 space-y-5">
        {/* Totais contra as metas — fica no topo porque é o que se olha o tempo todo */}
        <Card>
          <CardContent className="pt-5">
            <div className="flex flex-wrap gap-5">
              <MetaBar label="Energia" atual={n(totais.kcal)} meta={plano.metaKcal ? n(plano.metaKcal) : null} unidade="kcal" />
              <MetaBar label="Proteínas" atual={n(totais.proteinasG)} meta={plano.metaProteinasG ? n(plano.metaProteinasG) : null} unidade="g" />
              <MetaBar label="Carboidratos" atual={n(totais.carboidratosG)} meta={plano.metaCarboidratosG ? n(plano.metaCarboidratosG) : null} unidade="g" />
              <MetaBar label="Lipídios" atual={n(totais.lipidiosG)} meta={plano.metaLipidiosG ? n(plano.metaLipidiosG) : null} unidade="g" />
            </div>
          </CardContent>
        </Card>

        {plano.isDraft && (
          <div className="flex items-start gap-2 px-3 py-2 rounded-lg bg-amber-50 dark:bg-amber-950
                          border border-amber-200 dark:border-amber-900">
            <UtensilsCrossed className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
            <p className="text-xs text-amber-800 dark:text-amber-300">
              <strong>Rascunho.</strong> Revise as quantidades e os totais antes de entregar ao
              paciente — o plano só vale como prescrição depois de conferido.
            </p>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {REFEICOES.map((r) => (
            <ColunaRefeicao
              key={r.id}
              refeicao={r.id}
              label={r.label}
              itens={porRefeicao[r.id] ?? []}
              planId={planId}
              onDrop={aoSoltar}
              arrastando={arrastando}
            />
          ))}
        </div>

        <p className="text-[11px] text-muted-foreground">
          Arraste um alimento entre refeições para reposicionar. Os valores nutricionais
          acompanham o item — nada é recalculado no caminho.
        </p>

        {/* Depois do cardápio, não antes: a lista é consequência do plano. */}
        <ListaCompras planoId={planId} />

        {/* Antes do "salvar como modelo": a situação da supervisão é o que
            decide se este plano pode chegar ao paciente. */}
        <SupervisaoDoTrabalho recurso="meal_plan" recursoId={planId} souEstudante={souEstudante} />

        <SalvarComoModelo planoId={planId} nomeAtual={plano.nome} />
      </div>
    </div>
  );
}
