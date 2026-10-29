'use client';

import { AlertTriangle } from 'lucide-react';

/**
 * Saturada, mono, poli, insaturada total e trans do plano.
 *
 * Pedido da nutricionista (29/10/2026): os lipídios separados, "porque a
 * gente também tem referência para esses".
 *
 * ===================== O QUE ESTA TELA PRECISA DIZER =======================
 *
 * Que o número pode estar INCOMPLETO, e de onde ele vem. Depois da
 * importação da planilha oficial do NEPA, a TACO traz saturada em 417 dos
 * 597 e mono/poli em 423; o IBGE traz saturada em 1814 de 1971 e **não
 * publica mono nem poli**. Um plano que mistura as duas fontes soma só a
 * parte que tem o dado — e um total parcial com cara de total é pior que não
 * mostrar nada, porque a profissional aprova confiando nele.
 *
 * Por isso cada linha diz de quantos itens o número saiu, e o aviso aparece
 * sempre que faltar um. E quando NENHUM item tem o dado, não há número: há a
 * frase dizendo que a base não traz.
 *
 * ==================== MEDIDO GANHA DE DEDUZIDO, ITEM A ITEM ================
 *
 * A insaturada total usa `mono + poli` no item em que a fonte publica as
 * duas, e cai em `lipídio − saturada − trans` no resto. A segunda é exata
 * quando as três parcelas são conhecidas, mas junta mono com poli — então
 * quando ela entra, a linha diz quantos itens vieram por conta.
 */

interface Total {
  valor: number;
  itensComDado: number;
  itensTotal: number;
  completo: boolean;
  derivada?: boolean;
  itensDeduzidos?: number;
}

export function GordurasDoPlano({ gorduras }: {
  gorduras?: {
    saturadaG?: Total | null;
    transG?: Total | null;
    monoinsaturadaG?: Total | null;
    poliinsaturadaG?: Total | null;
    insaturadaG?: Total | null;
  } | null;
}) {
  const insat = gorduras?.insaturadaG;

  const linhas: Array<{
    rotulo: string; t: Total | null | undefined; ausente?: string; destaque?: boolean;
  }> = [
    { rotulo: 'Saturada', t: gorduras?.saturadaG, destaque: true },
    {
      rotulo: 'Monoinsaturada', t: gorduras?.monoinsaturadaG,
      ausente: 'a fonte não publica',
    },
    {
      rotulo: 'Poli-insaturada', t: gorduras?.poliinsaturadaG,
      ausente: 'a fonte não publica',
    },
    { rotulo: 'Insaturada (total)', t: insat },
    { rotulo: 'Trans', t: gorduras?.transG, destaque: true },
  ];

  const temAlgum = linhas.some((l) => l.t);
  const deduzidos = insat?.itensDeduzidos ?? 0;

  return (
    <div className="mt-4 pt-3 border-t">
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground mb-1.5">
        Lipídios por tipo
      </p>

      {!temAlgum ? (
        <p className="text-xs text-muted-foreground">
          Nenhum alimento deste plano tem a composição de gorduras na base.
        </p>
      ) : (
        <div className="space-y-1">
          {linhas.map((l) => (
            <div key={l.rotulo} className="flex items-baseline justify-between gap-3 text-xs">
              <span className="text-gray-600 dark:text-gray-300">{l.rotulo}</span>
              <span className="whitespace-nowrap">
                {l.t ? (
                  <>
                    <strong className={l.destaque ? 'text-gray-900 dark:text-gray-100' : ''}>
                      {l.t.valor} g
                    </strong>
                    {!l.t.completo && (
                      <span className="ml-1.5 text-amber-700 dark:text-amber-500">
                        de {l.t.itensComDado} de {l.t.itensTotal} itens
                      </span>
                    )}
                  </>
                ) : (
                  <span className="text-muted-foreground">
                    {l.ausente ?? 'sem dado na base'}
                  </span>
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

          {insat && (
            <p className="text-[10px] text-muted-foreground mt-1">
              {deduzidos === 0 ? (
                <>Insaturada medida na fonte (mono + poli).</>
              ) : deduzidos === insat.itensComDado ? (
                <>
                  Insaturada <strong>deduzida</strong> por subtração (lipídio total
                  − saturada − trans): junta mono e poli, que a fonte destes
                  alimentos não separa.
                </>
              ) : (
                <>
                  Insaturada medida na fonte em {insat.itensComDado - deduzidos} item(ns)
                  e <strong>deduzida</strong> por subtração em {deduzidos}, onde a
                  fonte não separa mono e poli.
                </>
              )}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
