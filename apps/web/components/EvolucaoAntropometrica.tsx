'use client';

import { useMemo, useState } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceDot,
} from 'recharts';
import { TrendingUp, TrendingDown, Minus, Table2, LineChart as IconeGrafico } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

/**
 * Evolução antropométrica do paciente.
 *
 * São quatro medidas em escalas diferentes — kg, kg/m², % e cm. Plotá-las num
 * gráfico só exigiria dois eixos y, e o alinhamento entre escalas é arbitrário:
 * o gráfico passaria a sugerir uma correlação que não está no dado. Por isso
 * são quatro gráficos pequenos, cada um na sua escala.
 *
 * Uma única medição não é tendência: nesse caso mostra-se o valor, não a linha.
 */

export interface MedidaHistorico {
  data: string;
  weightKg?: number | string | null;
  bmi?: number | string | null;
  bodyFatPct?: number | string | null;
  waistCm?: number | string | null;
}

const METRICAS = [
  { chave: 'weightKg', titulo: 'Peso', unidade: 'kg', casas: 1 },
  { chave: 'bmi', titulo: 'IMC', unidade: '', casas: 1 },
  { chave: 'bodyFatPct', titulo: 'Gordura corporal', unidade: '%', casas: 1 },
  { chave: 'waistCm', titulo: 'Circunferência da cintura', unidade: 'cm', casas: 1 },
] as const;

const num = (v: unknown): number | null => {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

const dataCurta = (iso: string) =>
  new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });

const dataLonga = (iso: string) =>
  new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });

const fmt = (v: number, casas: number) =>
  v.toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas });

// ─── Tooltip ──────────────────────────────────────────────────────────────────
function Dica({ active, payload, unidade, casas }: any) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  return (
    <div className="rounded-lg border border-border bg-popover px-2.5 py-1.5 shadow-md">
      <p className="text-[11px] text-muted-foreground">{dataLonga(p.dataISO)}</p>
      <p className="text-sm font-semibold text-foreground tabular-nums">
        {fmt(p.valor, casas)}{unidade ? ` ${unidade}` : ''}
      </p>
    </div>
  );
}

// ─── Um gráfico pequeno ───────────────────────────────────────────────────────
function CartaoMetrica({
  titulo, unidade, casas, pontos,
}: {
  titulo: string; unidade: string; casas: number;
  pontos: { dataISO: string; rotulo: string; valor: number }[];
}) {
  if (pontos.length === 0) return null;

  const primeiro = pontos[0].valor;
  const ultimo = pontos[pontos.length - 1].valor;
  const delta = ultimo - primeiro;

  // Uma medição não descreve tendência — mostra-se o valor, sem linha.
  if (pontos.length === 1) {
    return (
      <Card>
        <CardHeader className="pb-1">
          <CardTitle className="text-xs font-medium text-muted-foreground">{titulo}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-2xl font-bold text-foreground">
            {fmt(ultimo, casas)}
            {unidade && <span className="text-sm font-normal text-muted-foreground ml-1">{unidade}</span>}
          </p>
          <p className="text-[11px] text-muted-foreground mt-1">
            Uma medição em {dataLonga(pontos[0].dataISO)} — sem histórico para comparar.
          </p>
        </CardContent>
      </Card>
    );
  }

  // A direção é informada por ícone e texto, não pela cor: variação de peso ou
  // de gordura não é boa nem ruim por si só — depende da meta do paciente.
  const Icone = delta > 0 ? TrendingUp : delta < 0 ? TrendingDown : Minus;
  const sinal = delta > 0 ? '+' : '';

  return (
    <Card>
      <CardHeader className="pb-1">
        <CardTitle className="text-xs font-medium text-muted-foreground">{titulo}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="flex items-baseline gap-2 flex-wrap">
          <p className="text-2xl font-bold text-foreground">
            {fmt(ultimo, casas)}
            {unidade && <span className="text-sm font-normal text-muted-foreground ml-1">{unidade}</span>}
          </p>
          <span className="text-[11px] text-muted-foreground flex items-center gap-1">
            <Icone className="h-3 w-3" aria-hidden="true" />
            <span className="tabular-nums">{sinal}{fmt(delta, casas)}</span>
            desde {dataCurta(pontos[0].dataISO)}
          </span>
        </div>

        {/* altura inclui a faixa do eixo x, para o rótulo não ficar cortado */}
        <div className="h-[132px] -ml-2">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={pontos} margin={{ top: 8, right: 14, bottom: 4, left: 0 }}>
              <CartesianGrid stroke="var(--chart-grid)" strokeWidth={1} vertical={false} />
              <XAxis
                dataKey="rotulo"
                tick={{ fontSize: 10, fill: 'var(--chart-axis)' }}
                tickLine={false}
                axisLine={{ stroke: 'var(--chart-grid)' }}
                minTickGap={12}
              />
              <YAxis
                tick={{ fontSize: 10, fill: 'var(--chart-axis)' }}
                tickLine={false}
                axisLine={false}
                width={38}
                domain={['dataMin - 1', 'dataMax + 1']}
                tickFormatter={(v) => fmt(Number(v), 0)}
              />
              <Tooltip
                content={<Dica unidade={unidade} casas={casas} />}
                cursor={{ stroke: 'var(--chart-axis)', strokeWidth: 1 }}
              />
              <Line
                type="monotone"
                dataKey="valor"
                stroke="var(--chart-series)"
                strokeWidth={2}
                dot={{ r: 3, fill: 'var(--chart-series)', strokeWidth: 0 }}
                activeDot={{ r: 5, strokeWidth: 2, stroke: 'var(--background)' }}
                isAnimationActive={false}
              />
              {/* rótulo só na ponta: número em todo ponto vira ruído */}
              <ReferenceDot
                x={pontos[pontos.length - 1].rotulo}
                y={ultimo}
                r={4}
                fill="var(--chart-series)"
                stroke="var(--background)"
                strokeWidth={2}
                isFront
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Tabela equivalente ───────────────────────────────────────────────────────
function Tabela({ historico }: { historico: MedidaHistorico[] }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full text-sm">
        <caption className="sr-only">
          Histórico de medidas antropométricas do paciente, por data
        </caption>
        <thead>
          <tr className="bg-muted/50">
            <th scope="col" className="text-left px-3 py-2 font-medium text-xs text-muted-foreground">Data</th>
            {METRICAS.map((m) => (
              <th key={m.chave} scope="col" className="text-right px-3 py-2 font-medium text-xs text-muted-foreground whitespace-nowrap">
                {m.titulo}{m.unidade ? ` (${m.unidade})` : ''}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {historico.map((h, i) => (
            <tr key={i} className="border-t border-border">
              <th scope="row" className="text-left px-3 py-2 font-normal whitespace-nowrap">
                {dataLonga(h.data)}
              </th>
              {METRICAS.map((m) => {
                const v = num((h as any)[m.chave]);
                return (
                  <td key={m.chave} className="text-right px-3 py-2 tabular-nums">
                    {v === null ? <span className="text-muted-foreground">—</span> : fmt(v, m.casas)}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Componente ───────────────────────────────────────────────────────────────
export function EvolucaoAntropometrica({ historico }: { historico: MedidaHistorico[] }) {
  const [vendoTabela, setVendoTabela] = useState(false);

  // Ordem cronológica: a API devolve do mais recente para o mais antigo, e um
  // gráfico temporal invertido leria "engordou" onde o paciente emagreceu.
  const ordenado = useMemo(
    () => [...historico].filter((h) => h.data)
      .sort((a, b) => new Date(a.data).getTime() - new Date(b.data).getTime()),
    [historico],
  );

  const series = useMemo(() => METRICAS.map((m) => ({
    ...m,
    pontos: ordenado
      .map((h) => ({ dataISO: h.data, rotulo: dataCurta(h.data), valor: num((h as any)[m.chave]) }))
      .filter((p): p is { dataISO: string; rotulo: string; valor: number } => p.valor !== null),
  })), [ordenado]);

  const comDados = series.filter((s) => s.pontos.length > 0);

  if (comDados.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <p className="text-sm text-muted-foreground">
            Nenhuma medida antropométrica registrada ainda.
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            As curvas aparecem a partir da segunda avaliação física.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <section aria-label="Evolução antropométrica" className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-foreground">Evolução antropométrica</h3>
        <button
          onClick={() => setVendoTabela((v) => !v)}
          className="text-xs text-primary hover:underline flex items-center gap-1.5"
          aria-pressed={vendoTabela}
        >
          {vendoTabela
            ? <><IconeGrafico className="h-3.5 w-3.5" aria-hidden="true" /> Ver gráficos</>
            : <><Table2 className="h-3.5 w-3.5" aria-hidden="true" /> Ver tabela</>}
        </button>
      </div>

      {vendoTabela ? (
        <Tabela historico={ordenado} />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {comDados.map((s) => (
            <CartaoMetrica
              key={s.chave}
              titulo={s.titulo}
              unidade={s.unidade}
              casas={s.casas}
              pontos={s.pontos}
            />
          ))}
        </div>
      )}

      <p className="text-[11px] text-muted-foreground">
        Cada medida tem sua própria escala — por isso um gráfico para cada, e não um só.
      </p>
    </section>
  );
}
