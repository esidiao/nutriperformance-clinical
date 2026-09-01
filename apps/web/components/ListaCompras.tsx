'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Loader2, ShoppingCart, AlertTriangle, Printer } from 'lucide-react';
import { api } from '@/lib/api-client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

const OPCOES_DIAS = [1, 7, 15, 30];

/** Gramas para leitura humana. Acima de 1 kg, quilo. */
function formatar(gramas: number): string {
  if (gramas >= 1000) {
    return `${(gramas / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 2 })} kg`;
  }
  return `${gramas.toLocaleString('pt-BR', { maximumFractionDigits: 0 })} g`;
}

/**
 * Lista de compras do plano.
 *
 * Os itens têm caixa de marcar, mas o estado NÃO é salvo em lugar nenhum: é
 * marcação de uso no mercado, some ao recarregar. Persistir daria a impressão
 * de que a lista é um documento com vida própria — e ela é só um retrato do
 * plano no momento em que foi aberta.
 */
export function ListaCompras({ planoId }: { planoId: string }) {
  const [dias, setDias] = useState(7);
  const [marcados, setMarcados] = useState<Set<string>>(new Set());

  const { data, isLoading, error } = useQuery({
    queryKey: ['lista-compras', planoId, dias],
    queryFn: () => api.mealPlans.listaCompras(planoId, dias),
  });

  const alternar = (chave: string) => {
    setMarcados((prev) => {
      const novo = new Set(prev);
      if (novo.has(chave)) novo.delete(chave); else novo.add(chave);
      return novo;
    });
  };

  if (isLoading) {
    return (
      <Card><CardContent className="py-8 flex justify-center">
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      </CardContent></Card>
    );
  }

  if (error) {
    return (
      <Card><CardContent className="py-6 text-sm text-destructive">
        {(error as any)?.message ?? 'Não foi possível montar a lista.'}
      </CardContent></Card>
    );
  }

  const lista = data as any;
  const vazia = !lista?.secoes?.length;

  return (
    <Card>
      <CardContent className="pt-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-semibold flex items-center gap-1.5">
            <ShoppingCart className="h-4 w-4 text-muted-foreground" />
            Lista de compras
          </p>
          <div className="flex items-center gap-1.5">
            {OPCOES_DIAS.map((d) => (
              <Button
                key={d} size="sm" variant={dias === d ? 'default' : 'outline'}
                onClick={() => setDias(d)}
              >
                {d === 1 ? '1 dia' : `${d} dias`}
              </Button>
            ))}
            <Button size="sm" variant="ghost" onClick={() => window.print()}
                    aria-label="Imprimir lista">
              <Printer className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

        {/* O cardápio é de um dia; comprar para a semana é multiplicar. Dizer
            isso evita que alguém leia 700 g de arroz como erro. */}
        <p className="text-[11px] text-muted-foreground">
          Quantidades para <strong>{dias === 1 ? '1 dia' : `${dias} dias`}</strong> do
          cardápio, somando cada alimento em todas as refeições.
        </p>

        {vazia ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            O plano ainda não tem alimentos.
          </p>
        ) : (
          <div className="space-y-4">
            {lista.secoes.map((s: any) => (
              <div key={s.secao}>
                <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-1.5">
                  {s.secao}
                </p>
                <ul className="space-y-1">
                  {s.itens.map((i: any) => {
                    const chave = `${s.secao}:${i.nome}`;
                    const marcado = marcados.has(chave);
                    return (
                      <li key={chave}>
                        <label className="flex items-start gap-2 py-1 cursor-pointer">
                          <input
                            type="checkbox" checked={marcado}
                            onChange={() => alternar(chave)}
                            className="mt-0.5 h-3.5 w-3.5 rounded border-input"
                          />
                          <span className={`flex-1 text-sm ${marcado ? 'line-through text-muted-foreground' : ''}`}>
                            {i.nome}
                            {/* Medida caseira só aparece quando o backend
                                confirma que todas as ocorrências usam a mesma.
                                Quando divergem, ficam só os gramas. */}
                            {i.medidaCaseira && (
                              <span className="text-muted-foreground">
                                {' '}— {i.quantidadeMedidas} {i.medidaCaseira}
                                {i.quantidadeMedidas > 1 ? 's' : ''}
                              </span>
                            )}
                          </span>
                          <span className={`text-sm tabular-nums shrink-0 ${marcado ? 'text-muted-foreground' : ''}`}>
                            {formatar(i.totalG)}
                          </span>
                        </label>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
        )}

        {/* Item digitado à mão não tem grupo alimentar, então não tem seção de
            mercado. Dizer isso é melhor que deixar a pessoa estranhar por que
            "tempero caseiro" foi parar em "Outros". */}
        {lista?.semVinculo > 0 && (
          <p className="text-[11px] text-muted-foreground flex items-start gap-1.5 pt-1 border-t">
            <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0" />
            {lista.semVinculo === 1
              ? '1 item foi digitado à mão e não tem grupo alimentar — aparece em "Outros".'
              : `${lista.semVinculo} itens foram digitados à mão e não têm grupo alimentar — aparecem em "Outros".`}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
