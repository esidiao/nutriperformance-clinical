'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Loader2, Video, Copy, Check, Trash2, ExternalLink, AlertTriangle } from 'lucide-react';
import { api } from '@/lib/api-client';
import { Button } from '@/components/ui/button';

/**
 * Sala da consulta online — lacuna 13.
 *
 * A profissional escolhe entre a sala gerada e o link da ferramenta que já usa.
 * A escolha é dela porque é ela quem responde pelo sigilo do atendimento — e o
 * aviso sobre o serviço de terceiro aparece só quando ela usa a sala gerada,
 * que é quando o aviso é verdadeiro.
 */
export function SalaDeVideo({ consulta }: { consulta: any }) {
  const qc = useQueryClient();
  const [colando, setColando] = useState(false);
  const [link, setLink] = useState('');
  const [copiado, setCopiado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const invalidar = () => qc.invalidateQueries({ queryKey: ['agenda'] });

  const definir = useMutation({
    mutationFn: (proprio?: string) => api.appointments.definirSala(consulta.id, proprio),
    onSuccess: () => { setColando(false); setLink(''); setErro(null); invalidar(); },
    onError: (e: any) => setErro(e?.message ?? 'Não foi possível definir a sala.'),
  });

  const remover = useMutation({
    mutationFn: () => api.appointments.removerSala(consulta.id),
    onSuccess: invalidar,
  });

  if (consulta.tipo !== 'online') return null;

  if (!consulta.linkVideo) {
    return (
      <div className="space-y-2">
        {colando ? (
          <div className="space-y-2">
            <input
              value={link} onChange={(e) => setLink(e.target.value)}
              placeholder="https://meet.google.com/..."
              className="w-full h-9 px-2 rounded-md border border-input bg-background text-xs"
            />
            {erro && <p className="text-[11px] text-destructive">{erro}</p>}
            <div className="flex gap-1.5">
              <Button size="sm" disabled={!link.trim() || definir.isPending}
                      onClick={() => definir.mutate(link.trim())}>
                Usar este link
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setColando(false)}>Cancelar</Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            <Button size="sm" variant="outline" disabled={definir.isPending}
                    onClick={() => definir.mutate(undefined)}>
              {definir.isPending
                ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                : <><Video className="h-3.5 w-3.5 mr-1" /> Criar sala</>}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => { setColando(true); setErro(null); }}>
              Usar meu link
            </Button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap items-center gap-1.5">
        <a href={consulta.linkVideo} target="_blank" rel="noopener noreferrer"
           className="inline-flex items-center gap-1 text-xs text-primary underline">
          <ExternalLink className="h-3 w-3" /> Entrar na consulta
        </a>
        <button
          onClick={async () => { await navigator.clipboard.writeText(consulta.linkVideo); setCopiado(true); }}
          className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground"
        >
          {copiado ? <><Check className="h-3 w-3" /> copiado</> : <><Copy className="h-3 w-3" /> copiar</>}
        </button>
        <button onClick={() => remover.mutate()} disabled={remover.isPending}
                className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground">
          <Trash2 className="h-3 w-3" /> remover
        </button>
      </div>

      {/* O aviso aparece só na sala gerada, que é quando ele é verdadeiro. No
          link próprio, seria ruído sobre uma escolha que ela já fez. */}
      {consulta.videoOrigem === 'gerado' && (
        <p className="text-[11px] text-muted-foreground flex items-start gap-1">
          <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0" />
          Sala em serviço público de terceiro. A conversa passa por ele — se o
          atendimento exigir outra garantia, use o link da sua própria ferramenta.
        </p>
      )}

      <p className="text-[11px] text-muted-foreground">
        O paciente vê este link no portal a partir de 15 minutos antes.
      </p>
    </div>
  );
}
