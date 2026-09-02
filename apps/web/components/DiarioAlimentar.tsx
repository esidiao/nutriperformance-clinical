'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Loader2, Camera, Link2, Copy, Check, Ban, MessageSquare, ImageOff,
} from 'lucide-react';
import { api } from '@/lib/api-client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

const ROTULO_REFEICAO: Record<string, string> = {
  cafe_manha: 'Café da manhã',
  lanche_manha: 'Lanche da manhã',
  almoco: 'Almoço',
  lanche_tarde: 'Lanche da tarde',
  jantar: 'Jantar',
  ceia: 'Ceia',
};

const quando = (iso: string) =>
  new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });

const PERIODOS = [
  { dias: 7, rotulo: '7 dias' },
  { dias: 14, rotulo: '14 dias' },
  { dias: 30, rotulo: '30 dias' },
];

/**
 * Diário alimentar, lado da profissional.
 *
 * A adesão é apresentada como fato, sem juízo: "4 de 7 dias". Não existe cor
 * de aprovação nem de reprovação — quem interpreta o número é a profissional,
 * com o contexto da pessoa. Um semáforo vermelho num paciente em semana difícil
 * seria o software emitindo um julgamento clínico que não é dele.
 */
export function DiarioAlimentar({ patientId }: { patientId: string }) {
  const qc = useQueryClient();
  const [dias, setDias] = useState(7);
  const [linkNovo, setLinkNovo] = useState<string | null>(null);
  const [copiado, setCopiado] = useState(false);
  const [comentando, setComentando] = useState<string | null>(null);
  const [texto, setTexto] = useState('');

  const de = new Date(Date.now() - dias * 864e5).toISOString();

  const registrosQ = useQuery({
    queryKey: ['diario-registros', patientId, dias],
    queryFn: () => api.foodDiary.registros(patientId, { de }),
  });

  const linksQ = useQuery({
    queryKey: ['diario-links', patientId],
    queryFn: () => api.foodDiary.links(patientId),
  });

  const gerar = useMutation({
    mutationFn: () => api.foodDiary.criarLink({ patientId }),
    onSuccess: (r: any) => {
      setLinkNovo(`${window.location.origin}/diario/${r.token}`);
      setCopiado(false);
      qc.invalidateQueries({ queryKey: ['diario-links', patientId] });
    },
  });

  const revogar = useMutation({
    mutationFn: (id: string) => api.foodDiary.revogarLink(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['diario-links', patientId] }),
  });

  const comentar = useMutation({
    mutationFn: ({ id, c }: { id: string; c: string }) => api.foodDiary.comentar(id, c),
    onSuccess: () => {
      setComentando(null); setTexto('');
      qc.invalidateQueries({ queryKey: ['diario-registros', patientId, dias] });
    },
  });

  const dados = registrosQ.data as any;
  const registros = dados?.registros ?? [];
  const adesao = dados?.adesao;
  const ativos = ((linksQ.data as any) ?? []).filter(
    (l: any) => l.status === 'ativo' && new Date(l.expiraEm) > new Date(),
  );

  return (
    <Card>
      <CardContent className="pt-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-semibold flex items-center gap-1.5">
            <Camera className="h-4 w-4 text-muted-foreground" />
            Diário alimentar
          </p>
          <div className="flex items-center gap-1.5">
            {PERIODOS.map((p) => (
              <Button key={p.dias} size="sm" variant={dias === p.dias ? 'default' : 'outline'}
                      onClick={() => setDias(p.dias)}>
                {p.rotulo}
              </Button>
            ))}
            <Button size="sm" onClick={() => gerar.mutate()} disabled={gerar.isPending}>
              {gerar.isPending
                ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                : <><Link2 className="h-3.5 w-3.5 mr-1" /> Gerar link</>}
            </Button>
          </div>
        </div>

        {linkNovo && (
          <div className="rounded-md border border-primary/40 bg-primary/5 p-3 space-y-2">
            <p className="text-xs font-medium">Copie agora — este link não aparece de novo</p>
            <div className="flex gap-2">
              <input readOnly value={linkNovo} onFocus={(e) => e.currentTarget.select()}
                     className="flex-1 rounded-md border border-input bg-background px-2 py-1.5 text-xs" />
              <Button size="sm" variant="outline"
                      onClick={async () => { await navigator.clipboard.writeText(linkNovo); setCopiado(true); }}>
                {copiado ? <><Check className="h-3.5 w-3.5 mr-1" /> Copiado</>
                         : <><Copy className="h-3.5 w-3.5 mr-1" /> Copiar</>}
              </Button>
            </div>
          </div>
        )}

        {ativos.length > 0 && (
          <div className="text-[11px] text-muted-foreground flex flex-wrap items-center gap-2">
            <span>{ativos.length === 1 ? '1 link ativo' : `${ativos.length} links ativos`}</span>
            {ativos.map((l: any) => (
              <button key={l.id} onClick={() => revogar.mutate(l.id)}
                      className="inline-flex items-center gap-1 underline hover:text-foreground">
                <Ban className="h-3 w-3" /> revogar (válido até {new Date(l.expiraEm).toLocaleDateString('pt-BR')})
              </button>
            ))}
          </div>
        )}

        {/* Adesão como fato, sem semáforo. Ver "4 de 7 dias" e decidir o que
            isso significa é ato da profissional, não do software. */}
        {adesao && (
          <div className="flex flex-wrap gap-5 py-2 border-y">
            <div>
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Dias com registro</p>
              <p className="text-lg font-semibold tabular-nums">
                {adesao.diasComRegistro} <span className="text-sm font-normal text-muted-foreground">
                  de {adesao.diasNoPeriodo}
                </span>
              </p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Refeições registradas</p>
              <p className="text-lg font-semibold tabular-nums">{adesao.totalRegistros}</p>
            </div>
          </div>
        )}

        {registrosQ.isLoading ? (
          <div className="py-8 flex justify-center">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        ) : registros.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            Nenhum registro neste período. Gere um link e envie ao paciente.
          </p>
        ) : (
          <ul className="space-y-2">
            {registros.map((r: any) => (
              <li key={r.id} className="rounded-lg border p-3 space-y-2">
                <div className="flex gap-3">
                  {r.fotoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={r.fotoUrl} alt={`Foto do ${ROTULO_REFEICAO[r.refeicao] ?? 'registro'}`}
                         className="h-20 w-20 object-cover rounded shrink-0" />
                  ) : r.fotoPathAusente ? (
                    <div className="h-20 w-20 rounded bg-muted flex items-center justify-center shrink-0">
                      <ImageOff className="h-5 w-5 text-muted-foreground" />
                    </div>
                  ) : null}
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">
                      {ROTULO_REFEICAO[r.refeicao] ?? r.refeicao}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      {quando(r.tomadaEm)}
                      {/* Registro feito pela própria profissional precisa ficar
                          distinguível do que o paciente enviou. */}
                      {r.origem === 'profissional' && ' · registrado por você'}
                    </p>
                    {r.descricao && <p className="text-sm mt-1">{r.descricao}</p>}
                  </div>
                </div>

                {r.comentario && (
                  <p className="text-xs bg-muted rounded px-2 py-1.5">
                    <span className="text-muted-foreground">Sua anotação: </span>{r.comentario}
                  </p>
                )}

                {comentando === r.id ? (
                  <div className="flex gap-2">
                    <input
                      value={texto} onChange={(e) => setTexto(e.target.value)}
                      placeholder="Anotação para o prontuário"
                      className="flex-1 rounded-md border border-input bg-background px-2 py-1.5 text-xs"
                    />
                    <Button size="sm" onClick={() => comentar.mutate({ id: r.id, c: texto })}
                            disabled={comentar.isPending}>Salvar</Button>
                    <Button size="sm" variant="ghost" onClick={() => setComentando(null)}>Cancelar</Button>
                  </div>
                ) : (
                  <button
                    onClick={() => { setComentando(r.id); setTexto(r.comentario ?? ''); }}
                    className="text-[11px] text-muted-foreground inline-flex items-center gap-1 hover:text-foreground"
                  >
                    <MessageSquare className="h-3 w-3" />
                    {r.comentario ? 'Editar anotação' : 'Anotar'}
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}

        {/* O paciente não vê as anotações. Dizer isso evita que a profissional
            escreva para ele por engano, achando que é um canal de conversa. */}
        <p className="text-[11px] text-muted-foreground border-t pt-3">
          As anotações são suas e ficam no prontuário — o paciente não as vê pelo link.
        </p>
      </CardContent>
    </Card>
  );
}
