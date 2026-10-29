'use client';

import { AlertTriangle } from 'lucide-react';

/**
 * Saturada, trans e insaturada do plano.
 *
 * Pedido da nutricionista (29/10/2026): os lipídios separados, "porque a
 * gente também tem referência para esses".
 *
 * ===================== O QUE ESTA TELA PRECISA DIZER =======================
 *
 * Que o número pode estar INCOMPLETO. A TACO não traz gordura saturada em
 * nenhum dos seus 597 alimentos (medido em 29/10/2026); o IBGE traz em 1814
 * de 1971. Um plano que mistura as duas fontes soma só a parte que tem o
 * dado — e um total parcial com cara de total é pior que não mostrar nada,
 * porque a profissional aprova confiando nele.
 *
 * Por isso cada linha diz de quantos itens o número saiu, e o aviso aparece
 * sempre que faltar um. E quando NENHUM item tem o dado, não há número: há a
 * frase dizendo que a base não traz.
 *
 * A insaturada vem marcada como deduzida (`lipídio − saturada − trans`): é
 * exata quando as três parcelas são conhecidas, mas junta mono com poli, e
 * isso a profissional precisa saber ao ler.
 */

interface Total {
  valor: number;
  itensComDado: number;
  itensTotal: number;
  completo: boolean;
  derivada?: boolean;
}

export function GordurasDoPlano({ gorduras }: {
  gorduras?: {
    saturadaG?: Total | null;
    transG?: Total | null;
    insaturadaG?: Total | null;
  } | null;
}) {
  const linhas: Array<{ rotulo: string; t: Total | null | undefined; nota?: string }> = [
    { rotulo: 'Saturada', t: gorduras?.saturadaG },
    {
      rotulo: 'Insaturada', t: gorduras?.insaturadaG,
      nota: 'deduzida: lipídio total − saturada − trans; junta mono e poli',
    },
    { rotulo: 'Trans', t: gorduras?.transG },
  ];

  const temAlgum = linhas.some((l) => l.t);

  return (
    <div className="mt-4 pt-3 border-t">
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground mb-1.5">
        Lipídios por tipo
      </p>

      {!temAlgum ? (
        <p className="text-xs text-muted-foreground">
          Nenhum alimento deste plano tem a composição de gorduras na base. A
          tabela TACO não publica gordura saturada; a do IBGE publica para a
          maior parte dos alimentos.
        </p>
      ) : (
        <div className="space-y-1">
          {linhas.map((l) => (
            <div key={l.rotulo} className="flex items-baseline justify-between gap-3 text-xs">
              <span className="text-gray-600 dark:text-gray-300">
                {l.rotulo}
                {l.t?.derivada && (
                  <span className="ml-1 text-[10px] text-muted-foreground">(deduzida)</span>
                )}
              </span>
              <span className="whitespace-nowrap">
                {l.t ? (
                  <>
                    <strong>{l.t.valor} g</strong>
                    {!l.t.completo && (
                      <span className="ml-1.5 text-amber-700 dark:text-amber-500">
                        de {l.t.itensComDado} de {l.t.itensTotal} itens
                      </span>
                    )}
                  </>
                ) : (
                  <span className="text-muted-foreground">sem dado na base</span>
                )}
              </span>
            </div>
          ))}

          {linhas.some((l) => l.t && !l.t.completo) && (
            <p className="flex items-start gap-1.5 text-[11px] text-amber-700 dark:text-amber-500 mt-1.5">
              <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0" />
              <span>
                O total está <strong>incompleto</strong>: alguns alimentos do plano
                não têm essa composição na base. O valor real é maior que o
                mostrado.
              </span>
            </p>
          )}

          {linhas.find((l) => l.rotulo === 'Insaturada')?.t && (
            <p className="text-[10px] text-muted-foreground mt-1">
              Insaturada é deduzida por subtração — junta mono e poli, que a base
              não separa.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
