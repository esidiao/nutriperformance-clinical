'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Loader2, UtensilsCrossed, CalendarDays, Camera, Check, AlertTriangle, ShieldCheck,
} from 'lucide-react';

/**
 * Portal do paciente — a página que ele abre no celular.
 *
 * Fala direto com as rotas `publico/`, sem cabeçalho de autenticação: o token
 * da URL é a única credencial, e não existe sessão aqui.
 *
 * O plano é a primeira coisa da tela porque é para isso que a pessoa abre —
 * saber o que comer hoje. Consulta e diário vêm depois.
 */

const API = process.env.NEXT_PUBLIC_API_URL ?? '';

const ROTULO_REFEICAO: Record<string, string> = {
  cafe_manha: 'Café da manhã',
  lanche_manha: 'Lanche da manhã',
  almoco: 'Almoço',
  lanche_tarde: 'Lanche da tarde',
  jantar: 'Jantar',
  ceia: 'Ceia',
  pre_treino: 'Pré-treino',
  pos_treino: 'Pós-treino',
};

const ROTULO_TIPO: Record<string, string> = {
  primeira_consulta: 'Primeira consulta',
  retorno: 'Retorno',
  avaliacao: 'Avaliação',
  online: 'Consulta online',
};

const dataHora = (iso: string) =>
  new Date(iso).toLocaleString('pt-BR', {
    weekday: 'long', day: '2-digit', month: 'long', hour: '2-digit', minute: '2-digit',
  });

const soData = (iso: string) =>
  new Date(`${String(iso).slice(0, 10)}T12:00:00`).toLocaleDateString('pt-BR');

const num = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

function refeicaoProvavel(): string {
  const h = new Date().getHours();
  if (h < 10) return 'cafe_manha';
  if (h < 12) return 'lanche_manha';
  if (h < 15) return 'almoco';
  if (h < 18) return 'lanche_tarde';
  if (h < 22) return 'jantar';
  return 'ceia';
}

export default function PortalPaciente() {
  const { token } = useParams<{ token: string }>();
  const qc = useQueryClient();

  const [refeicao, setRefeicao] = useState(refeicaoProvavel());
  const [descricao, setDescricao] = useState('');
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [enviado, setEnviado] = useState(false);

  const { data, isLoading, error } = useQuery({
    queryKey: ['portal', token],
    queryFn: async () => {
      const r = await fetch(`${API}/publico/portal/${token}`);
      const corpo = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(corpo?.message ?? 'Não foi possível abrir o portal.');
      return corpo;
    },
    retry: false,
  });

  const registrar = useMutation({
    mutationFn: async () => {
      const r = await fetch(`${API}/publico/portal/${token}/refeicao`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          refeicao,
          descricao: descricao.trim() || undefined,
          mimeFoto: arquivo?.type,
        }),
      });
      const corpo = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(corpo?.message ?? 'Não foi possível registrar.');

      if (arquivo && corpo.envio?.url) {
        const up = await fetch(corpo.envio.url, {
          method: 'PUT', headers: { 'Content-Type': arquivo.type }, body: arquivo,
        });
        if (!up.ok) {
          throw new Error('A refeição foi registrada, mas a foto não subiu. Tente anexá-la de novo.');
        }
      }
      return corpo;
    },
    onSuccess: () => {
      setDescricao(''); setArquivo(null); setErro(null); setEnviado(true);
      setTimeout(() => setEnviado(false), 4000);
      qc.invalidateQueries({ queryKey: ['portal', token] });
    },
    onError: (e: any) => setErro(e?.message ?? 'Não foi possível registrar.'),
  });

  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center">
      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
    </div>;
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-background">
        <div className="max-w-md text-center space-y-3">
          <AlertTriangle className="h-10 w-10 mx-auto text-muted-foreground" />
          <h1 className="text-lg font-semibold text-foreground">Link indisponível</h1>
          <p className="text-sm text-muted-foreground">{(error as Error).message}</p>
        </div>
      </div>
    );
  }

  const d = data as any;
  const plano = d?.plano;

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-lg mx-auto p-5 space-y-6">
        <header>
          <h1 className="text-xl font-semibold text-foreground">
            {d?.primeiroNome ? `Olá, ${d.primeiroNome}` : 'Seu acompanhamento'}
          </h1>
        </header>

        {/* ── Plano alimentar: o motivo de a pessoa abrir isto ── */}
        <section className="space-y-3">
          <h2 className="text-sm font-semibold flex items-center gap-1.5">
            <UtensilsCrossed className="h-4 w-4 text-muted-foreground" />
            Seu plano alimentar
          </h2>

          {!plano ? (
            <p className="text-sm text-muted-foreground rounded-lg border p-4">
              Sua nutricionista ainda não liberou um plano. Assim que ela finalizar,
              ele aparece aqui.
            </p>
          ) : (
            <div className="space-y-3">
              <div className="rounded-lg border p-3">
                <p className="text-sm font-medium">{plano.nome}</p>
                {plano.objetivo && (
                  <p className="text-xs text-muted-foreground">{plano.objetivo}</p>
                )}
                {(plano.dataInicio || plano.dataFim) && (
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    {plano.dataInicio && `de ${soData(plano.dataInicio)}`}
                    {plano.dataFim && ` até ${soData(plano.dataFim)}`}
                  </p>
                )}
              </div>

              {plano.orientacoesGerais && (
                <p className="text-sm rounded-lg bg-muted p-3 whitespace-pre-wrap">
                  {plano.orientacoesGerais}
                </p>
              )}

              {(plano.refeicoes ?? []).map((r: any) => (
                <div key={r.refeicao} className="rounded-lg border p-3">
                  <p className="text-sm font-medium mb-1.5">
                    {ROTULO_REFEICAO[r.refeicao] ?? r.refeicao}
                  </p>
                  <ul className="space-y-1">
                    {(r.itens ?? []).map((i: any) => (
                      <li key={i.id} className="text-sm flex justify-between gap-3">
                        <span className="min-w-0">
                          {i.alimentoNome}
                          {i.medidaCaseira && (
                            <span className="text-muted-foreground"> — {i.medidaCaseira}</span>
                          )}
                          {i.observacao && (
                            <span className="block text-[11px] text-muted-foreground">
                              {i.observacao}
                            </span>
                          )}
                        </span>
                        <span className="text-muted-foreground tabular-nums shrink-0">
                          {num(i.quantidadeG).toLocaleString('pt-BR')} g
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* ── Próximas consultas ── */}
        {d?.consultas?.length > 0 && (
          <section className="space-y-2">
            <h2 className="text-sm font-semibold flex items-center gap-1.5">
              <CalendarDays className="h-4 w-4 text-muted-foreground" />
              Suas próximas consultas
            </h2>
            <ul className="space-y-1.5">
              {d.consultas.map((c: any, i: number) => (
                <li key={i} className="rounded-lg border p-3">
                  <p className="text-sm first-letter:uppercase">{dataHora(c.inicio)}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {ROTULO_TIPO[c.tipo] ?? c.tipo}
                    {c.status === 'confirmada' && ' · confirmada'}
                  </p>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* ── Registro de refeição ── */}
        <section className="space-y-3">
          <h2 className="text-sm font-semibold flex items-center gap-1.5">
            <Camera className="h-4 w-4 text-muted-foreground" />
            Registrar uma refeição
          </h2>

          <div className="rounded-lg border p-3 space-y-3">
            <div>
              <label htmlFor="ref" className="text-xs text-muted-foreground">Refeição</label>
              <select id="ref" value={refeicao} onChange={(e) => setRefeicao(e.target.value)}
                      className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm">
                {['cafe_manha', 'lanche_manha', 'almoco', 'lanche_tarde', 'jantar', 'ceia']
                  .map((k) => <option key={k} value={k}>{ROTULO_REFEICAO[k]}</option>)}
              </select>
            </div>

            <div>
              <label htmlFor="foto" className="text-xs text-muted-foreground">Foto do prato</label>
              <label htmlFor="foto"
                     className="flex items-center justify-center gap-2 h-14 rounded-md border border-dashed border-input cursor-pointer text-sm text-muted-foreground">
                {arquivo
                  ? <><Check className="h-4 w-4" /> {arquivo.name.slice(0, 28)}</>
                  : <><Camera className="h-4 w-4" /> Tirar ou escolher foto</>}
              </label>
              <input id="foto" type="file" accept="image/*" capture="environment" className="sr-only"
                     onChange={(e) => setArquivo(e.target.files?.[0] ?? null)} />
            </div>

            <div>
              <label htmlFor="desc" className="text-xs text-muted-foreground">
                Descrição <span className="text-muted-foreground">(opcional se enviar foto)</span>
              </label>
              <textarea id="desc" rows={2} value={descricao}
                        onChange={(e) => setDescricao(e.target.value)}
                        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
            </div>

            {erro && <p className="text-xs text-destructive">{erro}</p>}
            {enviado && (
              <p className="text-xs text-primary flex items-center gap-1">
                <Check className="h-3.5 w-3.5" /> Registrado.
              </p>
            )}

            <button
              type="button"
              disabled={(!descricao.trim() && !arquivo) || registrar.isPending}
              onClick={() => registrar.mutate()}
              className="w-full h-11 rounded-md bg-primary text-primary-foreground text-sm font-medium disabled:opacity-60"
            >
              {registrar.isPending
                ? <Loader2 className="h-4 w-4 animate-spin mx-auto" />
                : 'Registrar'}
            </button>
          </div>

          {d?.diario?.length > 0 && (
            <ul className="space-y-1.5">
              {d.diario.map((r: any) => (
                <li key={r.id} className="flex gap-3 rounded-lg border p-2.5">
                  {r.fotoUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={r.fotoUrl} alt={`Foto do ${ROTULO_REFEICAO[r.refeicao] ?? 'registro'}`}
                         className="h-12 w-12 object-cover rounded shrink-0" />
                  )}
                  <div className="min-w-0">
                    <p className="text-sm">{ROTULO_REFEICAO[r.refeicao] ?? r.refeicao}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {new Date(r.tomadaEm).toLocaleString('pt-BR', {
                        dateStyle: 'short', timeStyle: 'short',
                      })}
                    </p>
                    {r.descricao && <p className="text-sm">{r.descricao}</p>}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Diz o que este espaço é e o que não é. Um portal com plano alimentar
            pode ser confundido com um canal de atendimento — e não é. */}
        <div className="flex items-start gap-2 text-xs text-muted-foreground border-t pt-4 pb-6">
          <ShieldCheck className="h-4 w-4 mt-0.5 shrink-0" />
          <p>
            Este espaço é seu e mostra o que sua nutricionista liberou. Ele não substitui a
            consulta e não é canal de urgência — para dúvidas sobre sua saúde, fale
            diretamente com ela. O acesso expira e pode ser desativado a qualquer momento.
          </p>
        </div>
      </div>
    </div>
  );
}
