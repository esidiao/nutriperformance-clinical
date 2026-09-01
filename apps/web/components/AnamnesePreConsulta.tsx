'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Loader2, Link2, Copy, Check, Ban, ClipboardList, Clock, AlertTriangle,
} from 'lucide-react';
import { api } from '@/lib/api-client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

const dataHora = (iso: string) =>
  new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });

const ROTULO: Record<string, string> = {
  pendente: 'Aguardando resposta',
  respondido: 'Respondido',
  cancelado: 'Cancelado',
};

/**
 * Anamnese pré-consulta, do lado da profissional.
 *
 * O link em claro aparece UMA vez, logo depois de gerar, e nunca mais: o banco
 * guarda só o hash. Perdeu, gera outro. É o mesmo contrato de uma chave de API,
 * e a tela precisa dizer isso na hora — descobrir depois que o link sumiu seria
 * uma surpresa ruim.
 */
export function AnamnesePreConsulta({ patientId }: { patientId: string }) {
  const qc = useQueryClient();
  const [linkNovo, setLinkNovo] = useState<string | null>(null);
  const [copiado, setCopiado] = useState(false);
  const [aberto, setAberto] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['pre-consult', patientId],
    queryFn: () => api.preConsult.list(patientId),
  });

  const gerar = useMutation({
    mutationFn: () => api.preConsult.create({ patientId }),
    onSuccess: (r: any) => {
      setLinkNovo(`${window.location.origin}/responder/${r.token}`);
      setCopiado(false);
      qc.invalidateQueries({ queryKey: ['pre-consult', patientId] });
    },
  });

  const cancelar = useMutation({
    mutationFn: (id: string) => api.preConsult.cancelar(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['pre-consult', patientId] }),
  });

  const copiar = async () => {
    if (!linkNovo) return;
    await navigator.clipboard.writeText(linkNovo);
    setCopiado(true);
  };

  const lista = (data as any) ?? [];

  return (
    <Card>
      <CardContent className="pt-5 space-y-4">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-semibold flex items-center gap-1.5">
            <ClipboardList className="h-4 w-4 text-muted-foreground" />
            Anamnese pré-consulta
          </p>
          <Button size="sm" onClick={() => gerar.mutate()} disabled={gerar.isPending}>
            {gerar.isPending
              ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
              : <><Link2 className="h-3.5 w-3.5 mr-1.5" /> Gerar link</>}
          </Button>
        </div>

        {linkNovo && (
          <div className="rounded-md border border-primary/40 bg-primary/5 p-3 space-y-2">
            <p className="text-xs font-medium">
              Copie agora — este link não aparece de novo
            </p>
            <div className="flex gap-2">
              <input
                readOnly value={linkNovo}
                onFocus={(e) => e.currentTarget.select()}
                className="flex-1 rounded-md border border-input bg-background px-2 py-1.5 text-xs"
              />
              <Button size="sm" variant="outline" onClick={copiar}>
                {copiado
                  ? <><Check className="h-3.5 w-3.5 mr-1" /> Copiado</>
                  : <><Copy className="h-3.5 w-3.5 mr-1" /> Copiar</>}
              </Button>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Guardamos só um resumo criptográfico do link, não o link. Se perder, gere outro —
              o anterior continua valendo até expirar, e você pode cancelá-lo abaixo.
            </p>
          </div>
        )}

        {isLoading ? (
          <div className="py-6 flex justify-center">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        ) : lista.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">
            Nenhum formulário enviado. Gere um link e envie ao paciente antes da consulta.
          </p>
        ) : (
          <ul className="space-y-2">
            {lista.map((f: any) => {
              const expirado = f.status === 'pendente' && new Date(f.expiraEm) < new Date();
              return (
                <li key={f.id} className="rounded-md border p-3 space-y-1.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm flex items-center gap-1.5">
                        {expirado && <AlertTriangle className="h-3.5 w-3.5 text-destructive" />}
                        {/* Estado por rótulo, nunca só por cor. */}
                        {expirado ? 'Expirado sem resposta' : ROTULO[f.status] ?? f.status}
                      </p>
                      <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {f.status === 'respondido'
                          ? `Respondido em ${dataHora(f.respondidoEm)}`
                          : `Válido até ${dataHora(f.expiraEm)}`}
                      </p>
                    </div>
                    <div className="flex gap-1.5 shrink-0">
                      {f.status === 'respondido' && (
                        <Button size="sm" variant="outline"
                                onClick={() => setAberto(aberto === f.id ? null : f.id)}>
                          {aberto === f.id ? 'Fechar' : 'Ver respostas'}
                        </Button>
                      )}
                      {f.status === 'pendente' && !expirado && (
                        <Button size="sm" variant="ghost"
                                onClick={() => cancelar.mutate(f.id)}
                                disabled={cancelar.isPending}>
                          <Ban className="h-3.5 w-3.5 mr-1" /> Cancelar
                        </Button>
                      )}
                    </div>
                  </div>

                  {aberto === f.id && <Respostas formId={f.id} />}
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * Busca o formulário completo só quando alguém pede para ver.
 *
 * A listagem não traz as respostas de propósito: são dado clínico sensível e
 * não precisam trafegar para desenhar uma lista de status.
 */
function Respostas({ formId }: { formId: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ['pre-consult-detalhe', formId],
    queryFn: () => api.preConsult.get(formId),
  });

  if (isLoading) {
    return <div className="py-4 flex justify-center">
      <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
    </div>;
  }

  const f = data as any;
  const respostas = f?.respostas ?? {};
  const perguntas = f?.questionario ?? [];

  return (
    <div className="mt-2 pt-2 border-t space-y-2">
      {perguntas.flatMap((s: any) => s.perguntas).map((p: any) => {
        const v = respostas[p.id];
        const vazia = v === undefined || v === null || v === ''
          || (Array.isArray(v) && v.length === 0);
        return (
          <div key={p.id}>
            <p className="text-[11px] text-muted-foreground">{p.rotulo}</p>
            {/* "Não respondeu" explícito. Um campo em branco na tela deixaria
                dúvida entre não ter sido perguntado e não ter sido respondido. */}
            <p className={`text-sm whitespace-pre-wrap ${vazia ? 'text-muted-foreground italic' : ''}`}>
              {vazia ? 'Não respondeu'
                : Array.isArray(v) ? v.join(', ')
                : typeof v === 'boolean' ? (v ? 'Sim' : 'Não')
                : String(v)}
            </p>
          </div>
        );
      })}
    </div>
  );
}
