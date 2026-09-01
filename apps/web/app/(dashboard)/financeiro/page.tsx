'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Plus, Loader2, AlertTriangle, Wallet, HandCoins, HeartHandshake, Ban, Check,
} from 'lucide-react';
import { api } from '@/lib/api-client';
import { PageHeader } from '@/components/PageHeader';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { brl, paraCentavos } from '@/lib/moeda';

const FORMAS: Record<string, string> = {
  dinheiro: 'Dinheiro',
  pix: 'PIX',
  debito: 'Débito',
  credito: 'Crédito',
  transferencia: 'Transferência',
  convenio: 'Convênio',
  outro: 'Outro',
};

const ROTULO_STATUS: Record<string, string> = {
  pendente: 'Pendente',
  pago: 'Recebido',
  isento: 'Isento',
  cancelado: 'Cancelado',
};

const dataBR = (iso: string) =>
  new Date(`${String(iso).slice(0, 10)}T12:00:00`).toLocaleDateString('pt-BR');

// Data local, não UTC. `toISOString()` no Brasil (UTC-3) devolve o dia
// seguinte depois das 21h — o vencimento apareceria um dia adiantado e um
// lançamento feito à noite nasceria "a vencer amanhã".
const hojeISO = () => {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 10);
};

/**
 * Instante a gravar como recebimento na data escolhida.
 *
 * Para hoje devolve AGORA, não meio-dia: às 9h da manhã, meio-dia de hoje
 * ainda é futuro, e o backend recusa recebimento futuro — a profissional
 * levaria "o dinheiro ainda não entrou" registrando um pagamento que acabou de
 * receber. Para datas passadas, meio-dia evita que o fuso jogue o registro
 * para o dia anterior.
 */
const instanteDoRecebimento = (dia: string) =>
  (dia === hojeISO() ? new Date() : new Date(`${dia}T12:00:00`)).toISOString();


// ─── Indicadores de caixa ─────────────────────────────────────────────────────
// Quatro escalares independentes, não uma série: stat tiles, não gráfico. Um
// gráfico aqui só desenharia quatro barras sem eixo comum — "a receber" e
// "recebido no mês" nem medem o mesmo período.
function Indicador({
  rotulo, valor, qtd, Icone, alerta = false,
}: {
  rotulo: string; valor: number; qtd: number; Icone: any; alerta?: boolean;
}) {
  return (
    <Card>
      <CardContent className="pt-5">
        <div className="flex items-center gap-1.5 text-muted-foreground">
          {/* O alerta vem por ícone + rótulo, não só pela cor: quem não
              distingue vermelho precisa enxergar "vencido" do mesmo jeito. */}
          <Icone className={`h-3.5 w-3.5 ${alerta ? 'text-destructive' : ''}`} />
          <span className="text-[11px] uppercase tracking-wide">{rotulo}</span>
        </div>
        <p className={`mt-1 text-2xl font-semibold tabular-nums ${alerta && valor > 0 ? 'text-destructive' : ''}`}>
          {brl(valor)}
        </p>
        <p className="text-[11px] text-muted-foreground">
          {qtd} {qtd === 1 ? 'lançamento' : 'lançamentos'}
        </p>
      </CardContent>
    </Card>
  );
}

// ─── Novo lançamento ──────────────────────────────────────────────────────────
function NovoLancamento({ onFechar }: { onFechar: () => void }) {
  const qc = useQueryClient();
  const [patientId, setPatientId] = useState('');
  const [descricao, setDescricao] = useState('Consulta');
  const [valorTexto, setValorTexto] = useState('');
  const [vencimento, setVencimento] = useState(hojeISO());
  const [erro, setErro] = useState<string | null>(null);

  const pacientesQ = useQuery({ queryKey: ['patients-lista'], queryFn: () => api.patients.list() });
  const pacientes = (pacientesQ.data as any)?.items ?? [];

  const centavos = paraCentavos(valorTexto);

  const criar = useMutation({
    // Envia centavos inteiros, nunca reais decimais: assim nenhum float
    // atravessa a rede e o valor gravado é exatamente o conferido na tela.
    mutationFn: () => api.charges.create({
      patientId, descricao, valorCentavos: centavos, vencimento,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['charges'] });
      qc.invalidateQueries({ queryKey: ['charges-resumo'] });
      onFechar();
    },
    onError: (e: any) => setErro(e?.message ?? 'Não foi possível registrar.'),
  });

  return (
    <Card>
      <CardContent className="pt-5 space-y-3">
        <p className="text-sm font-semibold">Novo lançamento</p>

        <div>
          <label htmlFor="fin-paciente" className="text-[11px] text-muted-foreground">Paciente</label>
          <select
            id="fin-paciente" value={patientId} onChange={(e) => setPatientId(e.target.value)}
            className="w-full h-9 px-3 rounded-md border border-input bg-background text-sm"
          >
            <option value="">Selecione…</option>
            {pacientes.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <div>
            <label htmlFor="fin-desc" className="text-[11px] text-muted-foreground">Descrição</label>
            <Input id="fin-desc" value={descricao} onChange={(e) => setDescricao(e.target.value)} />
          </div>
          <div>
            <label htmlFor="fin-valor" className="text-[11px] text-muted-foreground">Valor</label>
            <Input
              id="fin-valor" inputMode="decimal" placeholder="200,00"
              value={valorTexto} onChange={(e) => setValorTexto(e.target.value)}
            />
          </div>
          <div>
            <label htmlFor="fin-venc" className="text-[11px] text-muted-foreground">Vencimento</label>
            <Input id="fin-venc" type="date" value={vencimento}
                   onChange={(e) => setVencimento(e.target.value)} />
          </div>
        </div>

        {/* Devolve o valor interpretado antes de gravar. Digitar "1.200" e
            cobrar R$ 12,00 seria erro invisível até o paciente reclamar. */}
        {valorTexto && (
          <p className="text-xs text-muted-foreground">
            Será registrado como <strong className="text-foreground tabular-nums">
              {centavos ? brl(centavos) : 'valor inválido'}
            </strong>
          </p>
        )}

        {erro && <p className="text-xs text-destructive">{erro}</p>}

        <div className="flex gap-2">
          <Button
            size="sm"
            disabled={!patientId || !centavos || centavos <= 0 || criar.isPending}
            onClick={() => { setErro(null); criar.mutate(); }}
          >
            {criar.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Registrar'}
          </Button>
          <Button size="sm" variant="outline" onClick={onFechar}>Cancelar</Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Registrar recebimento ────────────────────────────────────────────────────
function Receber({ lancamento, onFechar }: { lancamento: any; onFechar: () => void }) {
  const qc = useQueryClient();
  const [forma, setForma] = useState('pix');
  const [valorTexto, setValorTexto] = useState(
    (lancamento.valorCentavos / 100).toFixed(2).replace('.', ','),
  );
  const [pagoEm, setPagoEm] = useState(hojeISO());
  const [erro, setErro] = useState<string | null>(null);

  const centavos = paraCentavos(valorTexto);
  const parcial = centavos !== null && centavos < lancamento.valorCentavos;

  const pagar = useMutation({
    mutationFn: () => api.charges.pagar(lancamento.id, {
      formaPagamento: forma,
      valorPagoCentavos: centavos,
      pagoEm: instanteDoRecebimento(pagoEm),
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['charges'] });
      qc.invalidateQueries({ queryKey: ['charges-resumo'] });
      onFechar();
    },
    onError: (e: any) => setErro(e?.message ?? 'Não foi possível registrar o recebimento.'),
  });

  return (
    <div className="mt-3 pt-3 border-t space-y-3">
      <div className="grid grid-cols-3 gap-2">
        <div>
          <label htmlFor="rec-forma" className="text-[11px] text-muted-foreground">Forma</label>
          <select
            id="rec-forma" value={forma} onChange={(e) => setForma(e.target.value)}
            className="w-full h-9 px-3 rounded-md border border-input bg-background text-sm"
          >
            {Object.entries(FORMAS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="rec-valor" className="text-[11px] text-muted-foreground">Valor recebido</label>
          <Input id="rec-valor" inputMode="decimal" value={valorTexto}
                 onChange={(e) => setValorTexto(e.target.value)} />
        </div>
        <div>
          <label htmlFor="rec-data" className="text-[11px] text-muted-foreground">Data</label>
          <Input id="rec-data" type="date" max={hojeISO()} value={pagoEm}
                 onChange={(e) => setPagoEm(e.target.value)} />
        </div>
      </div>

      {/* Recebimento parcial é caso legítimo — mas precisa ser uma escolha
          consciente, não um dígito esquecido. */}
      {parcial && (
        <p className="text-xs text-muted-foreground">
          Recebimento parcial: {brl(centavos!)} de {brl(lancamento.valorCentavos)}
          {' '}(faltam {brl(lancamento.valorCentavos - centavos!)}).
        </p>
      )}

      {erro && <p className="text-xs text-destructive">{erro}</p>}

      <div className="flex gap-2">
        <Button size="sm" disabled={!centavos || pagar.isPending}
                onClick={() => { setErro(null); pagar.mutate(); }}>
          {pagar.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Confirmar recebimento'}
        </Button>
        <Button size="sm" variant="outline" onClick={onFechar}>Fechar</Button>
      </div>
    </div>
  );
}

// ─── Linha do lançamento ──────────────────────────────────────────────────────
function Lancamento({ c, nomePaciente }: { c: any; nomePaciente: string }) {
  const qc = useQueryClient();
  const [aberto, setAberto] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const vencido = c.status === 'pendente' && String(c.vencimento).slice(0, 10) < hojeISO();

  const invalidar = () => {
    qc.invalidateQueries({ queryKey: ['charges'] });
    qc.invalidateQueries({ queryKey: ['charges-resumo'] });
  };

  const cancelar = useMutation({
    mutationFn: (motivo: string) => api.charges.cancelar(c.id, motivo),
    onSuccess: invalidar,
    onError: (e: any) => setErro(e?.message ?? 'Não foi possível cancelar.'),
  });

  const isentar = useMutation({
    mutationFn: (motivo: string) => api.charges.isentar(c.id, motivo),
    onSuccess: invalidar,
    onError: (e: any) => setErro(e?.message ?? 'Não foi possível isentar.'),
  });

  return (
    <Card>
      <CardContent className="py-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-medium truncate">{nomePaciente}</p>
            <p className="text-xs text-muted-foreground truncate">{c.descricao}</p>
            <p className="text-[11px] text-muted-foreground mt-0.5 flex items-center gap-1">
              {vencido && <AlertTriangle className="h-3 w-3 text-destructive" />}
              {vencido ? 'Vencido em ' : 'Vence em '}{dataBR(c.vencimento)}
              {' · '}
              {/* Estado sempre por rótulo. Cor sozinha não informa. */}
              <span className={c.status === 'cancelado' ? 'line-through' : ''}>
                {ROTULO_STATUS[c.status] ?? c.status}
              </span>
              {c.status === 'pago' && c.formaPagamento && ` · ${FORMAS[c.formaPagamento]}`}
            </p>
          </div>

          <div className="text-right shrink-0">
            <p className={`text-sm font-semibold tabular-nums ${vencido ? 'text-destructive' : ''}`}>
              {brl(c.valorCentavos)}
            </p>
            {c.status === 'pago' && c.valorPagoCentavos !== c.valorCentavos && (
              <p className="text-[11px] text-muted-foreground tabular-nums">
                recebido {brl(c.valorPagoCentavos)}
              </p>
            )}
          </div>
        </div>

        {c.status === 'pendente' && !aberto && (
          <div className="flex flex-wrap gap-1.5 mt-2">
            <Button size="sm" variant="outline" onClick={() => setAberto(true)}>
              <Check className="h-3 w-3 mr-1" /> Receber
            </Button>
            <Button
              size="sm" variant="ghost"
              onClick={() => {
                const m = window.prompt('Motivo da isenção (atendimento gratuito):');
                if (m?.trim()) { setErro(null); isentar.mutate(m); }
              }}
            >
              <HeartHandshake className="h-3 w-3 mr-1" /> Isentar
            </Button>
            <Button
              size="sm" variant="ghost"
              onClick={() => {
                // Motivo obrigatório: "cancelado" sem explicação não conta
                // história nenhuma na auditoria seis meses depois.
                const m = window.prompt('Motivo do cancelamento:');
                if (m?.trim()) { setErro(null); cancelar.mutate(m); }
              }}
            >
              <Ban className="h-3 w-3 mr-1" /> Cancelar
            </Button>
          </div>
        )}

        {c.status === 'cancelado' && c.motivoCancelamento && (
          <p className="text-[11px] text-muted-foreground mt-1.5">
            Motivo: {c.motivoCancelamento}
          </p>
        )}

        {erro && <p className="text-xs text-destructive mt-2">{erro}</p>}

        {aberto && <Receber lancamento={c} onFechar={() => setAberto(false)} />}
      </CardContent>
    </Card>
  );
}

// ─── Página ───────────────────────────────────────────────────────────────────
export default function FinanceiroPage() {
  const [novo, setNovo] = useState(false);
  const [filtro, setFiltro] = useState<string>('pendente');

  const resumoQ = useQuery({
    queryKey: ['charges-resumo'],
    queryFn: () => api.charges.resumo(),
  });

  const listaQ = useQuery({
    queryKey: ['charges', filtro],
    queryFn: () => api.charges.list(filtro === 'todos' ? {} : { status: filtro }),
  });

  const pacientesQ = useQuery({ queryKey: ['patients-lista'], queryFn: () => api.patients.list() });
  const nomePorId: Record<string, string> = {};
  for (const p of ((pacientesQ.data as any)?.items ?? [])) nomePorId[p.id] = p.name;

  const r = resumoQ.data as any;
  const lista = (listaQ.data as any) ?? [];

  return (
    <div className="space-y-4">
      <PageHeader
        title="Financeiro"
        description="Controle de recebimento por paciente"
        action={
          <Button size="sm" onClick={() => setNovo(true)}>
            <Plus className="h-3.5 w-3.5 mr-1" /> Novo lançamento
          </Button>
        }
      />

      {r && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Indicador rotulo="A receber" valor={r.aReceberCentavos} qtd={r.aReceberQtd} Icone={Wallet} />
          <Indicador rotulo="Vencido" valor={r.vencidoCentavos} qtd={r.vencidoQtd}
                     Icone={AlertTriangle} alerta />
          <Indicador rotulo="Recebido no mês" valor={r.recebidoNoMesCentavos}
                     qtd={r.recebidoNoMesQtd} Icone={HandCoins} />
          {/* Isento aparece separado e nunca somado à receita: atendimento
              gratuito não é dinheiro que entrou. */}
          <Indicador rotulo="Isento no mês" valor={r.isentoNoMesCentavos}
                     qtd={r.isentoNoMesQtd} Icone={HeartHandshake} />
        </div>
      )}

      {novo && <NovoLancamento onFechar={() => setNovo(false)} />}

      <div className="flex flex-wrap gap-1.5">
        {['pendente', 'pago', 'isento', 'cancelado', 'todos'].map((f) => (
          <Button
            key={f} size="sm" variant={filtro === f ? 'default' : 'outline'}
            onClick={() => setFiltro(f)}
          >
            {f === 'todos' ? 'Todos' : ROTULO_STATUS[f]}
          </Button>
        ))}
      </div>

      {listaQ.isLoading ? (
        <div className="flex justify-center py-10">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : lista.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            Nenhum lançamento {filtro === 'todos' ? '' : ROTULO_STATUS[filtro]?.toLowerCase()}.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {lista.map((c: any) => (
            <Lancamento key={c.id} c={c} nomePaciente={nomePorId[c.patientId] ?? 'Paciente'} />
          ))}
        </div>
      )}
    </div>
  );
}
