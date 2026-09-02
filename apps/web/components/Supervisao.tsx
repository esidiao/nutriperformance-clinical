'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Loader2, GraduationCap, Check, MessageSquareWarning, Clock, AlertTriangle,
} from 'lucide-react';
import { api } from '@/lib/api-client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

const quando = (iso: string) =>
  new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });

const ROTULO: Record<string, string> = {
  pendente: 'Aguardando revisão',
  aprovado: 'Aprovado',
  ajustes_solicitados: 'Ajustes solicitados',
};

const ROTULO_RECURSO: Record<string, string> = {
  meal_plan: 'Plano alimentar',
  nutritional_assessment: 'Avaliação nutricional',
  physical_assessment: 'Avaliação física',
};

/**
 * Situação de supervisão de um trabalho — aparece para o estagiário.
 *
 * O parecer do supervisor fica visível na íntegra. Esconder atrás de um
 * "ajustes solicitados" tiraria do estágio exatamente a parte que ensina.
 */
export function SupervisaoDoTrabalho({
  recurso, recursoId, souEstudante,
}: { recurso: string; recursoId: string; souEstudante: boolean }) {
  const qc = useQueryClient();
  const [erro, setErro] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['supervisao', recurso, recursoId],
    queryFn: () => api.supervision.doRecurso(recurso, recursoId),
  });

  const solicitar = useMutation({
    mutationFn: () => api.supervision.solicitar({ recurso, recursoId }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['supervisao', recurso, recursoId] }),
    onError: (e: any) => setErro(e?.message ?? 'Não foi possível solicitar.'),
  });

  if (isLoading) return null;

  const pedido = data as any;

  // Profissional habilitado sem pedido: nada a mostrar — não passa por
  // supervisão e o aviso só ocuparia espaço.
  if (!pedido && !souEstudante) return null;

  if (!pedido) {
    return (
      <Card>
        <CardContent className="pt-5 space-y-2">
          <p className="text-sm font-semibold flex items-center gap-1.5">
            <GraduationCap className="h-4 w-4 text-muted-foreground" />
            Supervisão
          </p>
          <p className="text-xs text-muted-foreground">
            Este trabalho ainda não foi enviado para revisão. Ele só pode ser entregue
            ao paciente depois da aprovação de quem responde pelo atendimento.
          </p>
          {erro && <p className="text-xs text-destructive">{erro}</p>}
          <Button size="sm" disabled={solicitar.isPending}
                  onClick={() => { setErro(null); solicitar.mutate(); }}>
            {solicitar.isPending
              ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
              : 'Enviar para supervisão'}
          </Button>
        </CardContent>
      </Card>
    );
  }

  const cor = pedido.status === 'ajustes_solicitados' ? 'text-destructive' : '';

  return (
    <Card>
      <CardContent className="pt-5 space-y-2">
        <p className="text-sm font-semibold flex items-center gap-1.5">
          <GraduationCap className="h-4 w-4 text-muted-foreground" />
          Supervisão
        </p>

        {/* Estado por rótulo, nunca só por cor. */}
        <p className={`text-sm flex items-center gap-1.5 ${cor}`}>
          {pedido.status === 'pendente' && <Clock className="h-3.5 w-3.5" />}
          {pedido.status === 'aprovado' && <Check className="h-3.5 w-3.5" />}
          {pedido.status === 'ajustes_solicitados' && <MessageSquareWarning className="h-3.5 w-3.5" />}
          {ROTULO[pedido.status] ?? pedido.status}
        </p>

        {pedido.decididoEm && (
          <p className="text-[11px] text-muted-foreground">Em {quando(pedido.decididoEm)}</p>
        )}

        {pedido.parecer && (
          <p className="text-sm rounded-md bg-muted p-2.5">
            <span className="text-muted-foreground">Parecer do supervisor: </span>
            {pedido.parecer}
          </p>
        )}

        {pedido.status === 'ajustes_solicitados' && souEstudante && (
          <>
            {erro && <p className="text-xs text-destructive">{erro}</p>}
            <Button size="sm" variant="outline" disabled={solicitar.isPending}
                    onClick={() => { setErro(null); solicitar.mutate(); }}>
              Enviar para nova revisão
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * Fila do supervisor.
 *
 * Ordenada do mais antigo para o mais novo: quem está esperando há mais tempo
 * é quem está travado há mais tempo.
 */
export function FilaDeSupervisao() {
  const qc = useQueryClient();
  const [decidindo, setDecidindo] = useState<string | null>(null);
  const [parecer, setParecer] = useState('');
  const [erro, setErro] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['supervisao-fila'],
    queryFn: () => api.supervision.list({ status: 'pendente' }),
  });

  const decidir = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      api.supervision.decidir(id, { status, parecer: parecer.trim() || undefined }),
    onSuccess: () => {
      setDecidindo(null); setParecer(''); setErro(null);
      qc.invalidateQueries({ queryKey: ['supervisao-fila'] });
    },
    onError: (e: any) => setErro(e?.message ?? 'Não foi possível registrar a decisão.'),
  });

  const fila = (data as any) ?? [];

  if (isLoading || fila.length === 0) return null;

  return (
    <Card>
      <CardContent className="pt-5 space-y-3">
        <p className="text-sm font-semibold flex items-center gap-1.5">
          <GraduationCap className="h-4 w-4 text-muted-foreground" />
          Trabalhos aguardando sua revisão
          <span className="text-xs font-normal text-muted-foreground">({fila.length})</span>
        </p>

        {/* Diz o peso do ato. Aprovar não é uma formalidade administrativa. */}
        <p className="text-[11px] text-muted-foreground flex items-start gap-1.5 rounded-md bg-muted p-2.5">
          <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0" />
          Ao aprovar, você assume a responsabilidade profissional pelo que foi prescrito.
          Abra o trabalho e revise antes de decidir.
        </p>

        <ul className="space-y-2">
          {fila.map((p: any) => (
            <li key={p.id} className="rounded-md border p-3 space-y-2">
              <div>
                <p className="text-sm font-medium">
                  {ROTULO_RECURSO[p.recurso] ?? p.recurso}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  Enviado em {quando(p.createdAt)}
                </p>
              </div>

              {decidindo === p.id ? (
                <div className="space-y-2">
                  <textarea
                    rows={3} value={parecer} onChange={(e) => setParecer(e.target.value)}
                    placeholder="Parecer — obrigatório ao pedir ajustes"
                    className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm"
                  />
                  {erro && <p className="text-xs text-destructive">{erro}</p>}
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" disabled={decidir.isPending}
                            onClick={() => decidir.mutate({ id: p.id, status: 'aprovado' })}>
                      <Check className="h-3.5 w-3.5 mr-1" /> Aprovar
                    </Button>
                    <Button size="sm" variant="outline"
                            disabled={decidir.isPending || !parecer.trim()}
                            onClick={() => decidir.mutate({ id: p.id, status: 'ajustes_solicitados' })}>
                      <MessageSquareWarning className="h-3.5 w-3.5 mr-1" /> Pedir ajustes
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setDecidindo(null)}>
                      Cancelar
                    </Button>
                  </div>
                  {!parecer.trim() && (
                    <p className="text-[11px] text-muted-foreground">
                      Pedir ajustes exige parecer — sem dizer o que corrigir, o estágio não ensina.
                    </p>
                  )}
                </div>
              ) : (
                <Button size="sm" variant="outline"
                        onClick={() => { setDecidindo(p.id); setParecer(''); setErro(null); }}>
                  Revisar
                </Button>
              )}
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
