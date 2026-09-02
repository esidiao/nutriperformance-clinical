'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Loader2, LayoutTemplate, Wand2, Info } from 'lucide-react';
import { api } from '@/lib/api-client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

/**
 * Modelos de plano alimentar.
 *
 * Um modelo é a estrutura de um plano sem paciente: refeições, alimentos,
 * quantidades e metas. Serve para não remontar do zero o mesmo cardápio a cada
 * atendimento parecido.
 */
export function ModelosDePlano({ patientId }: { patientId: string }) {
  const qc = useQueryClient();
  const [erro, setErro] = useState<string | null>(null);

  const modelosQ = useQuery({
    queryKey: ['meal-plan-modelos'],
    queryFn: () => api.mealPlans.modelos(),
  });

  const aplicar = useMutation({
    mutationFn: (modeloId: string) => api.mealPlans.aplicarModelo(modeloId, { patientId }),
    onSuccess: (novo: any) => {
      qc.invalidateQueries({ queryKey: ['meal-plans', patientId] });
      if (novo?.id) window.location.href = `/meal-plans/${novo.id}?patient=${patientId}`;
    },
    onError: (e: any) => setErro(e?.message ?? 'Não foi possível aplicar o modelo.'),
  });

  const modelos = (modelosQ.data as any) ?? [];

  if (modelosQ.isLoading) return null;

  if (modelos.length === 0) {
    return (
      <Card>
        <CardContent className="py-5 text-sm text-muted-foreground flex items-start gap-2">
          <LayoutTemplate className="h-4 w-4 mt-0.5 shrink-0" />
          <span>
            Nenhum modelo salvo ainda. Ao terminar um plano que você vai repetir,
            use <strong className="text-foreground">Salvar como modelo</strong> na tela dele.
          </span>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="pt-5 space-y-3">
        <p className="text-sm font-semibold flex items-center gap-1.5">
          <LayoutTemplate className="h-4 w-4 text-muted-foreground" />
          Começar a partir de um modelo
        </p>

        <ul className="space-y-2">
          {modelos.map((m: any) => (
            <li key={m.id} className="flex items-center justify-between gap-3 rounded-md border p-3">
              <div className="min-w-0">
                <p className="text-sm font-medium truncate">{m.nome}</p>
                {m.objetivo && (
                  <p className="text-xs text-muted-foreground truncate">{m.objetivo}</p>
                )}
                {m.metaKcal && (
                  <p className="text-[11px] text-muted-foreground tabular-nums">
                    meta {Number(m.metaKcal).toLocaleString('pt-BR')} kcal
                  </p>
                )}
              </div>
              <Button size="sm" variant="outline" disabled={aplicar.isPending}
                      onClick={() => { setErro(null); aplicar.mutate(m.id); }}>
                {aplicar.isPending
                  ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  : <><Wand2 className="h-3.5 w-3.5 mr-1" /> Usar</>}
              </Button>
            </li>
          ))}
        </ul>

        {erro && <p className="text-xs text-destructive">{erro}</p>}

        {/* O plano gerado nasce rascunho — dizer isso evita que alguém aplique
            um modelo e entregue sem revisar. */}
        <p className="text-[11px] text-muted-foreground flex items-start gap-1.5 border-t pt-2.5">
          <Info className="h-3 w-3 mt-0.5 shrink-0" />
          O plano gerado entra como rascunho, para você ajustar às necessidades
          desta pessoa antes de entregar.
        </p>
      </CardContent>
    </Card>
  );
}

/**
 * Botão "Salvar como modelo", para a tela do plano.
 *
 * O aviso sobre o que não é copiado fica ANTES da ação, não depois: descobrir
 * que as observações sumiram só ao abrir o modelo seria uma surpresa ruim, e a
 * profissional precisa saber que vai reescrevê-las.
 */
export function SalvarComoModelo({ planoId, nomeAtual }: { planoId: string; nomeAtual: string }) {
  const qc = useQueryClient();
  const [aberto, setAberto] = useState(false);
  const [nome, setNome] = useState(`${nomeAtual} (modelo)`);
  const [erro, setErro] = useState<string | null>(null);
  const [pronto, setPronto] = useState(false);

  const salvar = useMutation({
    mutationFn: () => api.mealPlans.salvarComoModelo(planoId, nome.trim()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['meal-plan-modelos'] });
      setPronto(true); setAberto(false);
    },
    onError: (e: any) => setErro(e?.message ?? 'Não foi possível salvar o modelo.'),
  });

  if (pronto) {
    return (
      <p className="text-xs text-primary">
        Modelo salvo. Ele aparece ao criar um plano para qualquer paciente.
      </p>
    );
  }

  if (!aberto) {
    return (
      <Button size="sm" variant="outline" onClick={() => setAberto(true)}>
        <LayoutTemplate className="h-3.5 w-3.5 mr-1.5" /> Salvar como modelo
      </Button>
    );
  }

  return (
    <Card>
      <CardContent className="pt-5 space-y-3">
        <p className="text-sm font-semibold">Salvar como modelo</p>

        <div>
          <label htmlFor="mod-nome" className="text-[11px] text-muted-foreground">
            Nome do modelo
          </label>
          <input
            id="mod-nome" value={nome} onChange={(e) => setNome(e.target.value)}
            className="w-full h-9 px-3 rounded-md border border-input bg-background text-sm"
          />
        </div>

        {/* Isto não é detalhe de implementação: é o que a profissional precisa
            saber para não achar que o modelo saiu incompleto. */}
        <div className="text-[11px] text-muted-foreground flex items-start gap-1.5 rounded-md bg-muted p-2.5">
          <Info className="h-3 w-3 mt-0.5 shrink-0" />
          <span>
            O modelo leva as refeições, os alimentos, as quantidades e as metas.
            <strong className="text-foreground"> Observações e orientações não vão junto</strong> —
            elas costumam falar de um paciente específico, e reapareceriam no
            prontuário de outra pessoa.
          </span>
        </div>

        {erro && <p className="text-xs text-destructive">{erro}</p>}

        <div className="flex gap-2">
          <Button size="sm" disabled={!nome.trim() || salvar.isPending}
                  onClick={() => { setErro(null); salvar.mutate(); }}>
            {salvar.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Salvar modelo'}
          </Button>
          <Button size="sm" variant="outline" onClick={() => setAberto(false)}>Cancelar</Button>
        </div>
      </CardContent>
    </Card>
  );
}
