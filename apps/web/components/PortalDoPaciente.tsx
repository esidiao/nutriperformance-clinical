'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Loader2, Smartphone, Copy, Check, Ban, Eye, Info } from 'lucide-react';
import { api } from '@/lib/api-client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

const dataBR = (iso: string) => new Date(iso).toLocaleDateString('pt-BR');
const dataHora = (iso: string) =>
  new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });

/**
 * Portal do paciente, lado da profissional.
 *
 * A parte mais importante desta tela não é o botão: é a lista do que o link
 * entrega. Este é o link de maior exposição do sistema — devolve o plano
 * prescrito, as consultas marcadas e o primeiro nome da pessoa. Quem envia
 * precisa saber disso ANTES de enviar, não descobrir depois.
 */
export function PortalDoPaciente({ patientId }: { patientId: string }) {
  const qc = useQueryClient();
  const [linkNovo, setLinkNovo] = useState<string | null>(null);
  const [copiado, setCopiado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const linksQ = useQuery({
    queryKey: ['portal-links', patientId],
    queryFn: () => api.patientPortal.links(patientId),
  });

  const gerar = useMutation({
    mutationFn: () => api.patientPortal.criarLink({ patientId }),
    onSuccess: (r: any) => {
      setLinkNovo(`${window.location.origin}/portal/${r.token}`);
      setCopiado(false);
      qc.invalidateQueries({ queryKey: ['portal-links', patientId] });
    },
    onError: (e: any) => setErro(e?.message ?? 'Não foi possível gerar o link.'),
  });

  const revogar = useMutation({
    mutationFn: (id: string) => api.patientPortal.revogar(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['portal-links', patientId] }),
  });

  const links = ((linksQ.data as any) ?? []);
  const ativos = links.filter(
    (l: any) => l.status === 'ativo' && new Date(l.expiraEm) > new Date(),
  );

  return (
    <Card>
      <CardContent className="pt-5 space-y-4">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-semibold flex items-center gap-1.5">
            <Smartphone className="h-4 w-4 text-muted-foreground" />
            Portal do paciente
          </p>
          <Button size="sm" onClick={() => { setErro(null); gerar.mutate(); }}
                  disabled={gerar.isPending}>
            {gerar.isPending
              ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
              : 'Gerar acesso'}
          </Button>
        </div>

        {/* O que o link entrega — antes de enviar, não depois. */}
        <div className="text-[11px] text-muted-foreground rounded-md bg-muted p-2.5 space-y-1">
          <p className="flex items-center gap-1.5 font-medium text-foreground">
            <Eye className="h-3 w-3" /> Quem abrir este link vê:
          </p>
          <ul className="space-y-0.5 pl-4 list-disc">
            <li>o plano alimentar <strong>já publicado</strong> (rascunho não aparece)</li>
            <li>as orientações gerais do plano</li>
            <li>as consultas marcadas e o primeiro nome do paciente</li>
            <li>os registros do diário dele</li>
          </ul>
          <p className="flex items-center gap-1.5 pt-1">
            <Info className="h-3 w-3 shrink-0" />
            Não aparecem: suas observações do plano, suas anotações no diário, metas
            numéricas, nem qualquer outro paciente.
          </p>
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
            <p className="text-[11px] text-muted-foreground">
              Envie apenas ao paciente. Quem receber o link encaminhado vê o mesmo conteúdo —
              por isso ele expira, e você pode cortá-lo abaixo a qualquer momento.
            </p>
          </div>
        )}

        {erro && <p className="text-xs text-destructive">{erro}</p>}

        {linksQ.isLoading ? (
          <div className="py-4 flex justify-center">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        ) : ativos.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nenhum acesso ativo. Gere um link para o paciente ver o plano no celular.
          </p>
        ) : (
          <ul className="space-y-1.5">
            {ativos.map((l: any) => (
              <li key={l.id} className="flex items-start justify-between gap-3 rounded-md border p-2.5">
                <div className="min-w-0">
                  <p className="text-sm">Acesso ativo até {dataBR(l.expiraEm)}</p>
                  {/* Saber se o paciente abriu muda a conversa da próxima
                      consulta — "não viu o plano" é diferente de "não seguiu". */}
                  <p className="text-[11px] text-muted-foreground">
                    {l.ultimoAcessoEm
                      ? `Último acesso em ${dataHora(l.ultimoAcessoEm)}`
                      : 'Ainda não foi aberto'}
                  </p>
                </div>
                <Button size="sm" variant="ghost" onClick={() => revogar.mutate(l.id)}
                        disabled={revogar.isPending}>
                  <Ban className="h-3.5 w-3.5 mr-1" /> Revogar
                </Button>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
