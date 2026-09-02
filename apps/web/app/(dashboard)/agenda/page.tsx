'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ChevronLeft, ChevronRight, Plus, Loader2, Check, X, UserX, CalendarDays, Clock,
} from 'lucide-react';
import { api } from '@/lib/api-client';
import { PageHeader } from '@/components/PageHeader';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { SalaDeVideo } from '@/components/SalaDeVideo';

// Expediente da grade. Fora dele a consulta ainda existe e aparece na lista do
// dia — a grade não é a fonte da verdade, só a visão comum.
const HORA_INICIO = 7;
const HORA_FIM = 20;
const ALTURA_HORA = 52; // px

const TIPOS: Record<string, string> = {
  primeira_consulta: 'Primeira consulta',
  retorno: 'Retorno',
  avaliacao: 'Avaliação',
  online: 'Online',
};

// A cor diz o estado do compromisso, não a qualidade dele. "Faltou" e
// "cancelada" são fatos de agenda, não julgamentos — por isso cinza, e o
// significado vem sempre acompanhado do rótulo.
const ESTILO_STATUS: Record<string, string> = {
  agendada: 'bg-primary/10 border-primary/40 text-primary',
  confirmada: 'bg-primary/20 border-primary text-primary',
  realizada: 'bg-muted border-border text-muted-foreground',
  faltou: 'bg-muted border-border text-muted-foreground line-through',
  cancelada: 'bg-muted border-border text-muted-foreground line-through opacity-60',
};

const inicioDaSemana = (d: Date) => {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  x.setDate(x.getDate() - x.getDay()); // domingo
  return x;
};

const hhmm = (iso: string) =>
  new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

const diaMes = (d: Date) =>
  d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });

const DIAS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

// ─── Formulário de agendamento ────────────────────────────────────────────────
function NovaConsulta({ dia, onFechar }: { dia: Date; onFechar: () => void }) {
  const qc = useQueryClient();
  const [patientId, setPatientId] = useState('');
  const [hora, setHora] = useState('09:00');
  const [duracao, setDuracao] = useState('60');
  const [tipo, setTipo] = useState('retorno');
  const [erro, setErro] = useState<string | null>(null);

  const pacientesQ = useQuery({ queryKey: ['patients-lista'], queryFn: () => api.patients.list() });
  const pacientes = (pacientesQ.data as any)?.items ?? [];

  const criar = useMutation({
    mutationFn: () => {
      const [h, m] = hora.split(':').map(Number);
      const inicio = new Date(dia);
      inicio.setHours(h, m, 0, 0);
      return api.appointments.create({
        patientId, inicio: inicio.toISOString(), duracaoMin: Number(duracao), tipo,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['agenda'] });
      onFechar();
    },
    // O backend recusa conflito com 409 e explica qual horário colide —
    // repassar a mensagem dele é mais útil que um "erro ao agendar".
    onError: (e: any) => setErro(e?.message ?? 'Não foi possível agendar.'),
  });

  return (
    <Card>
      <CardContent className="pt-5 space-y-3">
        <p className="text-sm font-semibold">
          Nova consulta — {dia.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })}
        </p>

        <div>
          <label htmlFor="ag-paciente" className="text-[11px] text-muted-foreground">Paciente</label>
          <select
            id="ag-paciente"
            value={patientId}
            onChange={(e) => setPatientId(e.target.value)}
            className="w-full h-9 px-3 rounded-md border border-input bg-background text-sm"
          >
            <option value="">Selecione…</option>
            {pacientes.map((p: any) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <div>
            <label htmlFor="ag-hora" className="text-[11px] text-muted-foreground">Horário</label>
            <Input id="ag-hora" type="time" value={hora} onChange={(e) => setHora(e.target.value)} />
          </div>
          <div>
            <label htmlFor="ag-dur" className="text-[11px] text-muted-foreground">Duração (min)</label>
            <Input id="ag-dur" type="number" min="15" step="15" value={duracao}
                   onChange={(e) => setDuracao(e.target.value)} />
          </div>
          <div>
            <label htmlFor="ag-tipo" className="text-[11px] text-muted-foreground">Tipo</label>
            <select
              id="ag-tipo" value={tipo} onChange={(e) => setTipo(e.target.value)}
              className="w-full h-9 px-3 rounded-md border border-input bg-background text-sm"
            >
              {Object.entries(TIPOS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
        </div>

        {erro && <p className="text-xs text-red-600">{erro}</p>}

        <div className="flex gap-2">
          <Button size="sm" disabled={!patientId || criar.isPending} onClick={() => criar.mutate()}>
            {criar.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Agendar'}
          </Button>
          <Button size="sm" variant="outline" onClick={onFechar}>Cancelar</Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Detalhe / ações ──────────────────────────────────────────────────────────
function AcoesConsulta({ consulta, onFechar }: { consulta: any; onFechar: () => void }) {
  const qc = useQueryClient();
  const [erro, setErro] = useState<string | null>(null);

  const mudar = useMutation({
    mutationFn: ({ status, motivo }: { status: string; motivo?: string }) =>
      api.appointments.mudarStatus(consulta.id, status, motivo),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['agenda'] }); onFechar(); },
    onError: (e: any) => setErro(e?.message ?? 'Não foi possível alterar.'),
  });

  const jaAconteceu = new Date(consulta.inicio) <= new Date();
  const encerrada = ['cancelada', 'realizada', 'faltou'].includes(consulta.status);

  return (
    <Card>
      <CardContent className="pt-5 space-y-3">
        <div>
          <p className="text-sm font-semibold">{consulta.pacienteNome ?? 'Consulta'}</p>
          <p className="text-xs text-muted-foreground">
            {new Date(consulta.inicio).toLocaleString('pt-BR', {
              weekday: 'long', day: '2-digit', month: 'long', hour: '2-digit', minute: '2-digit',
            })}
            {' · '}{TIPOS[consulta.tipo] ?? consulta.tipo}
            {' · '}<span className="capitalize">{consulta.status}</span>
          </p>
          {/* Sala de vídeo: só aparece em consulta online, e só enquanto ela
              não foi encerrada — sala de consulta que já passou é porta aberta
              sem motivo. */}
          {!encerrada && (
            <div className="mt-2">
              <SalaDeVideo consulta={consulta} />
            </div>
          )}
          {consulta.motivoCancelamento && (
            <p className="text-xs text-muted-foreground mt-1">
              Motivo: {consulta.motivoCancelamento}
            </p>
          )}
        </div>

        {erro && <p className="text-xs text-red-600">{erro}</p>}

        {!encerrada && (
          <div className="flex flex-wrap gap-2">
            {consulta.status === 'agendada' && (
              <Button size="sm" variant="outline" disabled={mudar.isPending}
                      onClick={() => mudar.mutate({ status: 'confirmada' })}>
                <Check className="h-3.5 w-3.5 mr-1.5" /> Confirmar
              </Button>
            )}
            {/* presença e falta só depois da hora: o backend recusa antes, e a
                interface não deve oferecer o que vai ser negado */}
            {jaAconteceu && (
              <>
                <Button size="sm" variant="outline" disabled={mudar.isPending}
                        onClick={() => mudar.mutate({ status: 'realizada' })}>
                  <Check className="h-3.5 w-3.5 mr-1.5" /> Compareceu
                </Button>
                <Button size="sm" variant="outline" disabled={mudar.isPending}
                        onClick={() => mudar.mutate({ status: 'faltou' })}>
                  <UserX className="h-3.5 w-3.5 mr-1.5" /> Faltou
                </Button>
              </>
            )}
            <Button
              size="sm" variant="outline" disabled={mudar.isPending}
              onClick={() => {
                const motivo = window.prompt('Motivo do cancelamento (opcional):') ?? undefined;
                mudar.mutate({ status: 'cancelada', motivo });
              }}
            >
              <X className="h-3.5 w-3.5 mr-1.5" /> Cancelar
            </Button>
          </div>
        )}

        <div className="flex gap-2 pt-1">
          {consulta.patientId && (
            <Link href={`/patients/${consulta.patientId}`}>
              <Button size="sm" variant="outline">Abrir paciente</Button>
            </Link>
          )}
          <Button size="sm" variant="ghost" onClick={onFechar}>Fechar</Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Página ───────────────────────────────────────────────────────────────────
export default function AgendaPage() {
  const [semana, setSemana] = useState(() => inicioDaSemana(new Date()));
  const [diaNovo, setDiaNovo] = useState<Date | null>(null);
  const [selecionada, setSelecionada] = useState<any>(null);

  const fimSemana = useMemo(() => {
    const f = new Date(semana);
    f.setDate(f.getDate() + 7);
    return f;
  }, [semana]);

  const agendaQ = useQuery({
    queryKey: ['agenda', semana.toISOString()],
    queryFn: () => api.appointments.list({ de: semana.toISOString(), ate: fimSemana.toISOString() }),
    // Segura o render anterior em vez de piscar esqueleto ao trocar de semana
    placeholderData: (anterior) => anterior,
  });

  const pacientesQ = useQuery({ queryKey: ['patients-lista'], queryFn: () => api.patients.list() });
  const nomePorId = useMemo(() => {
    const m = new Map<string, string>();
    for (const p of ((pacientesQ.data as any)?.items ?? [])) m.set(p.id, p.name);
    return m;
  }, [pacientesQ.data]);

  const dias = useMemo(
    () => Array.from({ length: 7 }, (_, i) => {
      const d = new Date(semana);
      d.setDate(d.getDate() + i);
      return d;
    }),
    [semana],
  );

  const porDia = useMemo(() => {
    const mapa: Record<string, any[]> = {};
    for (const c of (agendaQ.data ?? [])) {
      const chave = new Date(c.inicio).toDateString();
      (mapa[chave] ??= []).push({ ...c, pacienteNome: nomePorId.get(c.patientId) });
    }
    return mapa;
  }, [agendaQ.data, nomePorId]);

  const hoje = new Date().toDateString();
  const horas = Array.from({ length: HORA_FIM - HORA_INICIO }, (_, i) => HORA_INICIO + i);

  return (
    <>
      <PageHeader
        title="Agenda"
        description="Consultas da semana"
        action={
          <div className="flex items-center gap-1.5">
            <Button size="sm" variant="outline" aria-label="Semana anterior"
                    onClick={() => setSemana((s) => { const n = new Date(s); n.setDate(n.getDate() - 7); return n; })}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button size="sm" variant="outline" onClick={() => setSemana(inicioDaSemana(new Date()))}>
              Hoje
            </Button>
            <Button size="sm" variant="outline" aria-label="Próxima semana"
                    onClick={() => setSemana((s) => { const n = new Date(s); n.setDate(n.getDate() + 7); return n; })}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        }
      />

      <div className="p-4 sm:p-6 space-y-4">
        {diaNovo && <NovaConsulta dia={diaNovo} onFechar={() => setDiaNovo(null)} />}
        {selecionada && <AcoesConsulta consulta={selecionada} onFechar={() => setSelecionada(null)} />}

        {agendaQ.isError && (
          <p className="text-sm text-red-600">Não foi possível carregar a agenda.</p>
        )}

        <Card className={agendaQ.isFetching ? 'opacity-70 transition-opacity' : ''}>
          <CardContent className="p-0 overflow-x-auto">
            <div className="min-w-[760px]">
              {/* cabeçalho dos dias */}
              <div className="grid grid-cols-[56px_repeat(7,1fr)] border-b border-border">
                <div />
                {dias.map((d) => {
                  const ehHoje = d.toDateString() === hoje;
                  return (
                    <div key={d.toISOString()}
                         className={`px-2 py-2 text-center border-l border-border ${ehHoje ? 'bg-accent/60' : ''}`}>
                      <p className="text-[11px] text-muted-foreground">{DIAS[d.getDay()]}</p>
                      <p className={`text-sm font-semibold ${ehHoje ? 'text-primary' : ''}`}>{diaMes(d)}</p>
                      <button
                        onClick={() => { setSelecionada(null); setDiaNovo(d); }}
                        className="text-[10px] text-primary hover:underline inline-flex items-center gap-0.5 mt-0.5"
                        aria-label={`Agendar em ${d.toLocaleDateString('pt-BR')}`}
                      >
                        <Plus className="h-2.5 w-2.5" /> agendar
                      </button>
                    </div>
                  );
                })}
              </div>

              {/* grade */}
              <div className="grid grid-cols-[56px_repeat(7,1fr)]">
                {/* faixa de horas */}
                <div>
                  {horas.map((h) => (
                    <div key={h} style={{ height: ALTURA_HORA }}
                         className="text-[10px] text-muted-foreground text-right pr-2 pt-0.5 tabular-nums">
                      {String(h).padStart(2, '0')}:00
                    </div>
                  ))}
                </div>

                {dias.map((d) => {
                  const doDia = porDia[d.toDateString()] ?? [];
                  const ehHoje = d.toDateString() === hoje;
                  return (
                    <div key={d.toISOString()}
                         className={`relative border-l border-border ${ehHoje ? 'bg-accent/30' : ''}`}
                         style={{ height: horas.length * ALTURA_HORA }}>
                      {horas.map((h) => (
                        <div key={h} style={{ height: ALTURA_HORA }} className="border-b border-border/60" />
                      ))}

                      {doDia.map((c) => {
                        const ini = new Date(c.inicio);
                        const fim = new Date(c.fim);
                        const minInicio = ini.getHours() * 60 + ini.getMinutes() - HORA_INICIO * 60;
                        const dur = Math.max(24, (fim.getTime() - ini.getTime()) / 60000);
                        const topo = (minInicio / 60) * ALTURA_HORA;
                        // Consulta fora do expediente da grade não é escondida:
                        // é grampeada na borda, para não sumir da vista.
                        const topoVisivel = Math.max(0, Math.min(topo, horas.length * ALTURA_HORA - 24));
                        return (
                          <button
                            key={c.id}
                            onClick={() => { setDiaNovo(null); setSelecionada(c); }}
                            style={{ top: topoVisivel, height: (dur / 60) * ALTURA_HORA - 2 }}
                            className={`absolute left-1 right-1 rounded-md border px-1.5 py-0.5 text-left
                                        overflow-hidden ${ESTILO_STATUS[c.status] ?? ESTILO_STATUS.agendada}`}
                          >
                            <span className="block text-[10px] font-semibold truncate">{hhmm(c.inicio)}</span>
                            <span className="block text-[10px] truncate">
                              {c.pacienteNome ?? 'Paciente'}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            </div>
          </CardContent>
        </Card>

        {!agendaQ.isLoading && (agendaQ.data?.length ?? 0) === 0 && (
          <Card>
            <CardContent className="py-8 text-center space-y-2">
              <CalendarDays className="h-7 w-7 text-gray-300 mx-auto" />
              <p className="text-sm text-muted-foreground">Nenhuma consulta nesta semana.</p>
              <p className="text-xs text-muted-foreground">
                Use “agendar” no topo de um dia para marcar.
              </p>
            </CardContent>
          </Card>
        )}

        {/* legenda: o estado nunca depende só da cor */}
        <div className="flex flex-wrap gap-3 text-[11px] text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm border border-primary/40 bg-primary/10" /> Agendada
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm border border-primary bg-primary/20" /> Confirmada
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm border border-border bg-muted" /> Realizada
          </span>
          <span className="flex items-center gap-1.5">
            <Clock className="h-3 w-3" /> Falta e cancelamento aparecem riscados
          </span>
        </div>
      </div>
    </>
  );
}
